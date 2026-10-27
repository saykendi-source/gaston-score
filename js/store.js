/* Lapisan data: mode lokal (localStorage) atau mode online (Firebase Realtime Database).
   Setiap komunitas punya ID sendiri (parameter ?k= di alamat). Perangkat panitia dan wasit
   masuk otomatis secara anonim; penonton (lihat.html) hanya membaca. */
(function(){
  'use strict';
  var FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

  function empty(){ return {settings:null, members:{}, matches:{}, events:{}, tournaments:{}, owners:{}, ownerNames:{}, wasit:{}, wasitNames:{}}; }
  function norm(s){ var e = empty(); s = s || {}; for (var k in s) e[k] = s[k]; return e; }
  function clean(v){ return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
  function setPath(obj, path, val){
    var ks = path.split('/'), o = obj;
    for (var i = 0; i < ks.length - 1; i++){
      if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
      o = o[ks[i]];
    }
    var k = ks[ks.length - 1];
    if (val === null || val === undefined) delete o[k]; else o[k] = val;
  }

  window.createStore = function(viewOnly, kid){
    var cfg = window.APP_CONFIG || {};
    var KID = kid;
    var LS = 'skor-mabar:' + KID, LS_SECRET = LS + ':rahasia';
    var state = empty(), listeners = [];
    var s = {mode: cfg.FIREBASE_CONFIG ? 'cloud' : 'local', ready:false, online:true, user:null, error:null};
    var db, dbm, auth, am;

    function emit(){ listeners.forEach(function(f){ try{ f(); }catch(e){ console.error(e); } }); }
    function loadLocal(){ try{ state = norm(JSON.parse(localStorage.getItem(LS))); }catch(e){ state = empty(); } }
    function saveLocal(){ try{ localStorage.setItem(LS, JSON.stringify(state)); }catch(e){} }
    function base(p){ return dbm.ref(db, 'komunitas/' + KID + (p ? '/' + p : '')); }
    function secretRef(p){ return dbm.ref(db, 'rahasia/' + KID + (p ? '/' + p : '')); }

    var api = {
      get kid(){ return KID; },
      get state(){ return state; },
      get mode(){ return s.mode; },
      get ready(){ return s.ready; },
      get online(){ return s.online; },
      get uid(){ return s.user ? s.user.uid : (s.mode === 'local' ? 'lokal' : null); },
      get error(){ return s.error; },
      get viewOnly(){ return !!viewOnly; },
      /* 'panitia', 'wasit', atau null */
      get role(){
        if (viewOnly) return null;
        if (s.mode === 'local') return 'panitia';
        if (!s.user) return null;
        if (state.owners && state.owners[s.user.uid]) return 'panitia';
        if (state.wasit && state.wasit[s.user.uid]) return 'wasit';
        return null;
      },
      get isAdmin(){ return api.role === 'panitia'; },
      onChange: function(f){ listeners.push(f); },

      init: function(){
        if (!KID){ s.ready = true; emit(); return Promise.resolve(); }
        if (s.mode === 'local'){
          loadLocal(); s.ready = true; emit();
          window.addEventListener('storage', function(e){ if (e.key === LS){ loadLocal(); emit(); } });
          return Promise.resolve();
        }
        var mods = [import(FB + 'firebase-app.js'), import(FB + 'firebase-database.js')];
        if (!viewOnly) mods.push(import(FB + 'firebase-auth.js'));
        return Promise.all(mods).then(function(m){
          var app = m[0].initializeApp(cfg.FIREBASE_CONFIG);
          dbm = m[1]; db = dbm.getDatabase(app);
          dbm.onValue(base(), function(snap){ state = norm(snap.val()); s.ready = true; emit(); },
            function(err){ s.error = err.message; s.ready = true; emit(); });
          dbm.onValue(dbm.ref(db, '.info/connected'), function(snap){ s.online = !!snap.val(); emit(); });
          if (viewOnly) return;
          am = m[2]; auth = am.getAuth(app);
          am.onAuthStateChanged(auth, function(u){
            s.user = u; emit();
            if (!u) am.signInAnonymously(auth).catch(function(err){ s.error = 'Gagal masuk anonim: ' + err.message + ' (aktifkan Anonymous di Firebase Authentication)'; emit(); });
          });
        }).catch(function(err){ s.error = 'Gagal memuat Firebase: ' + err.message; s.ready = true; emit(); });
      },

      update: function(paths){
        var fixed = {};
        Object.keys(paths).forEach(function(p){ fixed[p] = clean(paths[p]); setPath(state, p, fixed[p]); });
        emit();
        if (s.mode === 'local'){ saveLocal(); return Promise.resolve(); }
        return dbm.update(base(), fixed).catch(function(err){ s.error = 'Gagal menyimpan: ' + err.message; emit(); throw err; });
      },

      /* Data rahasia (kode undangan & pemulihan): hanya bisa dibaca panitia. */
      setSecret: function(path, val){
        if (s.mode === 'local'){
          var sec = {}; try { sec = JSON.parse(localStorage.getItem(LS_SECRET)) || {}; } catch(e){}
          setPath(sec, path, clean(val)); try { localStorage.setItem(LS_SECRET, JSON.stringify(sec)); } catch(e){}
          return Promise.resolve();
        }
        return dbm.set(secretRef(path), clean(val));
      },
      getSecrets: function(){
        if (s.mode === 'local'){ try { return Promise.resolve(JSON.parse(localStorage.getItem(LS_SECRET)) || {}); } catch(e){ return Promise.resolve({}); } }
        return dbm.get(secretRef()).then(function(x){ return x.val() || {}; });
      },

      /* Menghapus komunitas: data rahasia dihapus, lalu data komunitas diganti tanda "dihapus"
         agar kode komunitas tidak bisa diklaim ulang. */
      deleteCommunity: function(){
        if (s.mode === 'local'){
          try { localStorage.removeItem(LS_SECRET); } catch(e){}
          state = norm({dihapus:Date.now()}); saveLocal(); emit();
          return Promise.resolve();
        }
        return dbm.remove(secretRef()).then(function(){ return dbm.set(base(), {dihapus:Date.now()}); });
      },

      /* Mendaftarkan perangkat ini dengan kode undangan/pemulihan.
         Dicoba sebagai panitia dulu; jika kodenya kode wasit, aturan database menolak, lalu dicoba sebagai wasit. */
      claim: function(code, label){
        if (s.mode === 'local' || !s.user) return Promise.reject(new Error('Belum terhubung.'));
        var uid = s.user.uid, info = {name:label || 'Perangkat', at:Date.now()};
        return dbm.set(base('owners/' + uid), code).then(function(){
          return dbm.set(base('ownerNames/' + uid), info).then(function(){
            return dbm.get(secretRef('undangan/' + code)).then(function(x){ var v = x.val(); if (v && !v.pemulihan) return dbm.remove(secretRef('undangan/' + code)); });
          }).then(function(){ return 'panitia'; });
        }, function(){
          return dbm.set(base('wasit/' + uid), code).then(function(){
            return dbm.set(base('wasitNames/' + uid), info);
          }).then(function(){ return dbm.remove(secretRef('undangan/' + code)).catch(function(){}); })
            .then(function(){ return 'wasit'; });
        });
      }
    };
    return api;
  };
})();
