/* Lapisan data: mode lokal (localStorage) atau mode online (Firebase Realtime Database).
   Perangkat panitia masuk otomatis secara anonim. Penonton (lihat.html) hanya membaca. */
(function(){
  'use strict';
  var FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

  function empty(){ return {settings:null, members:{}, matches:{}, courts:{}, present:null, tournaments:{}, owners:{}, ownerNames:{}}; }
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

  window.createStore = function(viewOnly){
    var cfg = window.APP_CONFIG || {};
    var KID = cfg.KOMUNITAS_ID || 'komunitas';
    var LS = 'skor-mabar:' + KID, LS_SECRET = LS + ':rahasia';
    var state = empty(), listeners = [];
    var s = {mode:'local', ready:false, online:true, user:null, error:null};
    var db, dbm, auth, am;

    function emit(){ listeners.forEach(function(f){ try{ f(); }catch(e){ console.error(e); } }); }
    function loadLocal(){ try{ state = norm(JSON.parse(localStorage.getItem(LS))); }catch(e){ state = empty(); } }
    function saveLocal(){ try{ localStorage.setItem(LS, JSON.stringify(state)); }catch(e){} }
    function base(){ return dbm.ref(db, 'komunitas/' + KID); }
    function secretRef(p){ return dbm.ref(db, 'rahasia/' + KID + (p ? '/' + p : '')); }

    var api = {
      get state(){ return state; },
      get mode(){ return s.mode; },
      get ready(){ return s.ready; },
      get online(){ return s.online; },
      get uid(){ return s.user ? s.user.uid : (s.mode === 'local' ? 'lokal' : null); },
      get error(){ return s.error; },
      get viewOnly(){ return !!viewOnly; },
      get isAdmin(){
        if (viewOnly) return false;
        if (s.mode === 'local') return true;
        return !!(s.user && state.owners && state.owners[s.user.uid]);
      },
      onChange: function(f){ listeners.push(f); },

      init: function(){
        if (!cfg.FIREBASE_CONFIG){
          s.mode = 'local'; loadLocal(); s.ready = true; emit();
          window.addEventListener('storage', function(e){ if (e.key === LS){ loadLocal(); emit(); } });
          return Promise.resolve();
        }
        s.mode = 'cloud';
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

      /* Data rahasia (kode undangan & pemulihan): tidak bisa dibaca penonton. */
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

      /* Mendaftarkan perangkat ini sebagai panitia dengan kode undangan/pemulihan. */
      claim: function(code, label){
        if (s.mode === 'local' || !s.user) return Promise.reject(new Error('Belum terhubung.'));
        var uid = s.user.uid;
        return dbm.set(dbm.ref(db, 'komunitas/' + KID + '/owners/' + uid), code).then(function(){
          var p = {}; p['ownerNames/' + uid] = {name:label || 'Perangkat panitia', at:Date.now()};
          return dbm.update(base(), p);
        }).then(function(){
          return dbm.get(secretRef('undangan/' + code)).then(function(x){
            var v = x.val(); if (v && !v.pemulihan) return dbm.remove(secretRef('undangan/' + code));
          });
        });
      }
    };
    return api;
  };
})();
