/* Skor Mabar v3: aplikasi utama (mabar per acara, turnamen, skor rally dan tenis) */
(function(){
  'use strict';
  var VIEW = !!window.VIEW_ONLY;
  var store = window.createStore(VIEW);
  var MIN = 60000;
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
  function todayStr(d){ d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function uid(p){ return p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2,6); }
  function mins(t){ return Math.max(0, Math.round((Date.now() - t) / MIN)); }
  function viewerUrl(evId){ var u = new URL('lihat.html', location.href.split('#')[0].split('?')[0]).href; return evId ? u + '#ev=' + evId : u; }
  function randCode(n){ var ch = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', b = new Uint32Array(n); (window.crypto || window.msCrypto).getRandomValues(b); for (var i = 0; i < n; i++) out += ch[b[i] % ch.length]; return out; }
  function fmtCode(c){ return c.length > 6 ? c.match(/.{1,4}/g).join('-') : c; }
  function normCode(c){ return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function qrSvg(text){ try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize:8, margin:2, scalable:true}); } catch(e){ return '<p class="muted">QR tidak dapat dibuat.</p>'; } }
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  function fmtDate(ds){ if (!ds) return ''; var p = ds.split('-'), d = new Date(+p[0], +p[1]-1, +p[2]); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }

  // ---------- Cabang olahraga dan aturan skor ----------
  var SPORTS = {
    Badminton: {type:'rally', target:21, cap:30, jenis:'ganda'},
    Pickleball:{type:'rally', target:11, cap:0, jenis:'ganda'},
    Tenis:     {type:'tennis', sets:1, games:6, golden:false, tb:true, jenis:'tunggal'},
    Padel:     {type:'tennis', sets:1, games:6, golden:true, tb:true, jenis:'ganda'}
  };
  function rulesText(r){
    if (!r) return '';
    if (r.type === 'rally') return r.target + ' poin' + (r.cap ? ', maks ' + r.cap : '') + ', 1 gim';
    return (r.sets === 3 ? 'Best of 3 set' : '1 set') + ', ' + r.games + ' game' + (r.golden ? ', golden point' : ', advantage') + (r.tb ? ', tiebreak' : '');
  }
  /* Menghitung keadaan pertandingan dari urutan poin (0 = sisi biru, 1 = sisi merah). */
  function play(r, pts){
    if (r.type !== 'tennis'){
      var s = [0,0], done = false, w = null;
      for (var i = 0; i < pts.length && !done; i++){
        var p = pts[i], o = 1 - p; s[p]++;
        if ((s[p] >= r.target && s[p] - s[o] >= 2) || (r.cap && s[p] >= r.cap)){ done = true; w = p; }
      }
      return {kind:'rally', s:s, done:done, w:w, labels:[String(s[0]), String(s[1])], sub:'', tot:s.slice(), text:s[0] + '–' + s[1], lead: s[0] === s[1] ? null : (s[0] > s[1] ? 0 : 1)};
    }
    var need = r.sets === 3 ? 2 : 1, G = r.games || 6;
    var pt = [0,0], gm = [0,0], sets = [0,0], hist = [], tb = false, done2 = false, w2 = null, tot = [0,0];
    for (var j = 0; j < pts.length && !done2; j++){
      var q = pts[j], oq = 1 - q; pt[q]++;
      var gw = tb ? (pt[q] >= 7 && pt[q] - pt[oq] >= 2) : (r.golden ? pt[q] >= 4 : (pt[q] >= 4 && pt[q] - pt[oq] >= 2));
      if (gw){
        gm[q]++; tot[q]++; pt = [0,0];
        var sw = tb || (gm[q] >= G && gm[q] - gm[oq] >= 2);
        tb = false;
        if (sw){ sets[q]++; hist.push([gm[0], gm[1]]); gm = [0,0]; if (sets[q] >= need){ done2 = true; w2 = q; } }
        else if (r.tb && gm[0] === G && gm[1] === G) tb = true;
      }
    }
    var L = ['0','15','30','40'], lab;
    if (tb) lab = [String(pt[0]), String(pt[1])];
    else if (pt[0] >= 3 && pt[1] >= 3) lab = pt[0] === pt[1] ? ['40','40'] : (pt[0] > pt[1] ? ['AD','40'] : ['40','AD']);
    else lab = [L[pt[0]], L[pt[1]]];
    if (done2) lab = ['',''];
    var parts = hist.map(function(h){ return h[0] + '–' + h[1]; });
    var sub = (parts.length ? 'Set ' + parts.join(', ') : '') + (done2 ? '' : (parts.length ? ' · ' : '') + 'Game ' + gm[0] + '–' + gm[1] + (tb ? ' (tiebreak)' : ''));
    var text = parts.concat(done2 || (gm[0] + gm[1] === 0) ? [] : [gm[0] + '–' + gm[1]]).join(', ') || '0–0';
    var lead = sets[0] !== sets[1] ? (sets[0] > sets[1] ? 0 : 1) : gm[0] !== gm[1] ? (gm[0] > gm[1] ? 0 : 1) : pt[0] !== pt[1] ? (pt[0] > pt[1] ? 0 : 1) : null;
    var deuce = !tb && !done2 && pt[0] >= 3 && pt[0] === pt[1];
    return {kind:'tennis', pt:pt, gm:gm, sets:sets, hist:hist, tb:tb, done:done2, w:w2, labels:lab, sub:sub, tot:tot, text:text, lead:lead, flag: tb ? 'Tiebreak' : deuce ? (r.golden ? 'Golden point' : 'Deuce') : ''};
  }

  // ---------- Data ----------
  function st(){ return store.state; }
  function cfg(){ return st().settings || {}; }
  function arr(x){ return Array.isArray(x) ? x : (x ? Object.keys(x).map(function(k){ return x[k]; }) : []); }
  function members(){ var m = st().members || {}; return Object.keys(m).map(function(id){ return Object.assign({rating:1500}, m[id], {id:id}); }); }
  function byId(id){ var m = (st().members || {})[id]; return m ? Object.assign({rating:1500, hist:[]}, m, {id:id}) : {id:id, name:'(terhapus)', rating:1500, hist:[]}; }
  function nm(id){ return byId(id).name; }
  function avg(ids){ return ids.reduce(function(s,i){ return s + (byId(i).rating || 1500); }, 0) / (ids.length || 1); }
  function expA(a,b){ return 1 / (1 + Math.pow(10, (avg(b) - avg(a)) / 400)); }
  function winner(m){ return m.w != null ? m.w : (m.sa > m.sb ? 0 : 1); }
  function allMatches(){
    var m = st().matches || {};
    return Object.keys(m).map(function(id){ var x = m[id]; return Object.assign({}, x, {id:id, a:arr(x.a), b:arr(x.b)}); }).sort(function(x,y){ return x.t - y.t; });
  }
  function evMatches(eid){ return allMatches().filter(function(m){ return m.ev === eid; }); }
  function events(){
    var e = st().events || {};
    return Object.keys(e).map(function(id){ return getEv(id); }).sort(function(a,b){
      if ((a.status === 'aktif') !== (b.status === 'aktif')) return a.status === 'aktif' ? -1 : 1;
      return (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0);
    });
  }
  function getEv(id){
    var e = (st().events || {})[id]; if (!e) return null;
    return Object.assign({courts:3, jenis:'ganda', sport:'Badminton', status:'aktif'}, e, {id:id, rules:e.rules || SPORTS[e.sport || 'Badminton'], present:e.present || {}});
  }
  function slotsN(e){ return e.jenis === 'tunggal' ? 1 : 2; }
  function fillSlots(x, n){ var a = arr(x), out = []; for (var i = 0; i < n; i++) out.push(a[i] || 0); return out; }
  function courtsOf(e){
    var n = +e.courts || 3, c = e.lap || {}, out = [], k = slotsN(e);
    for (var i = 1; i <= n; i++){
      var x = c[i] || {};
      out.push({id:i,
        match: x.match ? {a:arr(x.match.a), b:arr(x.match.b), pts:arr(x.match.pts), start:x.match.start || Date.now()} : null,
        draft: x.draft ? {a:fillSlots(x.draft.a, k), b:fillSlots(x.draft.b, k)} : null});
    }
    return out;
  }
  function courtOf(e, id){ return courtsOf(e).filter(function(c){ return c.id == id; })[0]; }
  function games(e, id){ return evMatches(e.id).filter(function(m){ return m.a.indexOf(id) > -1 || m.b.indexOf(id) > -1; }).length; }
  function lastFree(e, id){
    var ms = evMatches(e.id).filter(function(m){ return m.a.indexOf(id) > -1 || m.b.indexOf(id) > -1; });
    return ms.length ? Math.max.apply(null, ms.map(function(m){ return m.t; })) : (e.present[id] || Date.now());
  }
  function onCourt(e){ var s = {}; courtsOf(e).forEach(function(c){ if (c.match) c.match.a.concat(c.match.b).forEach(function(i){ s[i] = 1; }); }); return s; }
  function reserved(e){ var s = {}; courtsOf(e).forEach(function(c){ if (c.draft) c.draft.a.concat(c.draft.b).forEach(function(i){ if (i) s[i] = 1; }); }); return s; }
  function queue(e){
    var busy = onCourt(e), res = reserved(e);
    return Object.keys(e.present).filter(function(id){ return !busy[id] && !res[id] && st().members[id]; })
      .sort(function(x,y){ return games(e,x) - games(e,y) || lastFree(e,x) - lastFree(e,y); });
  }
  function evPath(e, p){ return 'events/' + e.id + (p ? '/' + p : ''); }

  // ---------- UI state ----------
  var ui = {mode:'mabar', view:'list', listTab:'daftar', ev:null, tab:'skor', sortBy:'menang', pendingRender:false, lastErr:null};
  function toast(msg){ var el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function(){ el.hidden = true; }, 2800); }

  // ---------- Header & navigasi ----------
  function renderTop(){
    var c = cfg(), A = store.isAdmin;
    var status = store.mode === 'local' ? '<span class="statusdot local">Mode lokal</span>' : (store.online ? '<span class="statusdot">Online</span>' : '<span class="statusdot off">Offline</span>');
    var role = VIEW ? '<span class="tag">Penonton</span>' : (A ? '<span class="tag">Panitia</span>' : '');
    var theme = (function(){ try { return localStorage.getItem('skor-tema') || 'auto'; } catch(e){ return 'auto'; } })();
    $('top').innerHTML =
      '<div class="brand"><b>' + esc(c.name || 'Skor Mabar') + '</b><span>' + esc(c.place || 'Skor langsung komunitas') + '</span></div>' +
      '<div class="seg" role="group" aria-label="Mode"><button data-mode="mabar" aria-pressed="' + (ui.mode === 'mabar') + '">Mabar</button><button data-mode="turnamen" aria-pressed="' + (ui.mode === 'turnamen') + '">Turnamen</button></div>' +
      '<div class="seg theme" role="group" aria-label="Tema"><button data-theme-set="auto" aria-pressed="' + (theme === 'auto') + '" aria-label="Tema otomatis">Auto</button><button data-theme-set="light" aria-pressed="' + (theme === 'light') + '" aria-label="Tema terang">☀︎</button><button data-theme-set="dark" aria-pressed="' + (theme === 'dark') + '" aria-label="Tema gelap">☾</button></div>' +
      status + role;
  }
  function segTabs(tabs, cur, attr){ return '<div class="seg glass" role="tablist">' + tabs.map(function(t){ return '<button data-' + attr + '="' + t[0] + '" aria-pressed="' + (cur === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>'; }
  function renderNav(){
    var A = store.isAdmin, el = $('subnav');
    if (ui.mode === 'mabar' && ui.view === 'event'){
      var e = getEv(ui.ev);
      if (!e){ ui.view = 'list'; return renderNav(); }
      el.innerHTML = '<div class="evhead"><button class="btn" data-back>← Semua mabar</button><div class="evtitle"><b>' + esc(e.name) + '</b><span>' + esc(e.sport) + ', ' + (e.jenis === 'tunggal' ? 'tunggal' : 'ganda') + ', ' + esc(rulesText(e.rules)) + '</span></div>' +
        (e.status !== 'aktif' ? '<span class="tag">Selesai</span>' : '<span class="tag live">Berlangsung</span>') + '</div>' +
        segTabs([['skor', VIEW ? 'Skor langsung' : 'Lapangan'], ['klasemen','Klasemen'], ['hadir', VIEW ? 'Pemain hadir' : 'Absensi']], ui.tab, 'tab');
      return;
    }
    if (ui.mode === 'mabar'){
      var tabs = [['daftar','Daftar mabar'], ['pemain','Pemain']];
      if (A) tabs.push(['bagikan','Bagikan'], ['pengaturan','Pengaturan']);
      el.innerHTML = segTabs(tabs, ui.listTab, 'ltab');
      return;
    }
    el.innerHTML = '';
  }

  // ---------- Setup & perangkat panitia ----------
  function viewSetup(){
    if (VIEW) return '<div class="panel glass empty-state center"><h2>Belum ada data</h2><p class="muted">Panitia belum menyiapkan komunitas ini. Coba buka lagi nanti.</p></div>';
    if (store.mode === 'cloud' && !store.uid) return '<div class="panel glass empty-state center"><h2>Menghubungkan…</h2><p class="muted">Menyiapkan perangkat panitia.</p></div>';
    return '<div class="panel glass empty-state"><h2>Siapkan komunitas</h2><p class="muted">Perangkat yang menyiapkan komunitas otomatis menjadi perangkat panitia. Tidak perlu membuat akun.</p>' + communityForm({}) +
      '<label class="field" style="margin-top:12px"><span>Nama perangkat ini</span><input id="devName" placeholder="Misalnya: HP Andi atau Tablet meja panitia" maxlength="30"></label>' +
      '<div class="btns"><button class="btn primary" data-setup>Simpan dan mulai</button></div></div>';
  }
  function communityForm(c){
    return '<div class="formgrid">' +
      '<label class="field"><span>Nama komunitas</span><input id="sName" value="' + esc(c.name || '') + '" placeholder="Mabar Selasa Malam" maxlength="40"></label>' +
      '<label class="field"><span>Tempat</span><input id="sPlace" value="' + esc(c.place || '') + '" placeholder="GOR Kampus" maxlength="40"></label></div>';
  }
  function readCommunity(){ return {name: $('sName').value.trim() || 'Komunitas Raket', place: $('sPlace').value.trim()}; }
  function viewClaim(){
    return '<div class="panel glass empty-state"><h2>Daftarkan perangkat panitia</h2><p class="muted">Perangkat ini belum terdaftar sebagai panitia <b>' + esc(cfg().name || '') + '</b>. Minta kode undangan dari panitia lain (menu Pengaturan), atau masukkan kode pemulihan.</p>' +
      '<div class="formgrid" style="grid-template-columns:1fr"><label class="field"><span>Kode undangan atau pemulihan</span><input id="claimCode" autocomplete="off" autocapitalize="characters" placeholder="Contoh: K7M2QX"></label>' +
      '<label class="field"><span>Nama perangkat ini</span><input id="devName" placeholder="Misalnya: HP Budi" maxlength="30"></label></div>' +
      '<p class="err" id="claimErr" hidden></p><div class="btns"><button class="btn primary" data-claim>Daftarkan</button><a class="btn" href="' + esc(viewerUrl()) + '" style="text-decoration:none">Buka tampilan penonton</a></div></div>';
  }
  function viewDevices(){
    var names = st().ownerNames || {}, owners = st().owners || {};
    var rows = Object.keys(owners).map(function(u){
      var n = names[u] ? names[u].name : 'Perangkat panitia';
      return '<li><span>' + esc(n) + (u === store.uid ? ' <span class="badge n">Perangkat ini</span>' : '') + '</span>' + (u !== store.uid ? '<button class="x" data-revoke="' + u + '">Cabut</button>' : '') + '</li>';
    }).join('');
    return '<div class="panel glass"><h3>Perangkat panitia</h3><p class="muted" style="margin:0">Tidak ada akun. Untuk menambah panitia, buat kode undangan lalu masukkan kode itu di HP panitia baru.</p>' +
      '<ul class="pairs" style="margin-top:8px">' + rows + '</ul>' +
      '<div class="btns"><button class="btn primary" data-invite>Buat kode undangan</button><button class="btn" data-newrecovery>Buat kode pemulihan baru</button></div>' +
      '<p class="hint">Kode undangan berlaku 15 menit dan hanya sekali pakai. Kode pemulihan dipakai jika semua perangkat panitia hilang atau datanya terhapus.</p></div>';
  }
  function showCode(title, code, note){
    $('dlgBody').innerHTML = '<h2>' + esc(title) + '</h2><p class="muted">' + note + '</p><div class="bigcode">' + esc(fmtCode(code)) + '</div><div class="btns"><button class="btn primary" data-copycode="' + code + '">Salin kode</button><button class="btn" data-close>Tutup</button></div>';
    $('dlg').showModal();
  }
  function makeRecovery(){
    var code = randCode(12);
    return store.getSecrets().then(function(sec){
      var und = (sec && sec.undangan) || {}, p = [];
      Object.keys(und).forEach(function(k){ if (und[k] && und[k].pemulihan) p.push(store.setSecret('undangan/' + k, null)); });
      return Promise.all(p);
    }).catch(function(){}).then(function(){ return store.setSecret('undangan/' + code, {exp:4102444800000, pemulihan:true, dibuat:Date.now()}); })
      .then(function(){ showCode('Kode pemulihan', code, 'Catat dan simpan kode ini di tempat aman. Kode ini bisa mendaftarkan perangkat baru sebagai panitia kapan saja. Kode pemulihan sebelumnya tidak berlaku lagi.'); });
  }

  // ---------- Daftar mabar ----------
  function viewDaftar(){
    var A = store.isAdmin, list = events();
    var head = A ? '<div class="btns" style="margin:0 0 14px"><button class="btn primary" data-newmabar>+ Mabar baru</button></div>' : '';
    if (!list.length) return head + '<div class="panel glass empty-state center"><h2>Belum ada mabar</h2><p class="muted">' + (A ? 'Tekan “+ Mabar baru” untuk memulai.' : 'Mabar yang dibuat panitia akan muncul di sini.') + '</p></div>';
    return head + '<div class="tcards">' + list.map(function(e){
      var n = evMatches(e.id).length, h = Object.keys(e.present).length, live = courtsOf(e).filter(function(c){ return c.match; }).length;
      return '<div class="tcard glass evcard"><button class="evopen" data-open="' + e.id + '" aria-label="Buka ' + esc(e.name) + '">' +
        '<span class="tag ' + (e.status === 'aktif' ? 'live' : '') + '">' + (e.status === 'aktif' ? (live ? live + ' lapangan main' : 'Berlangsung') : 'Selesai') + '</span>' +
        '<b style="margin-top:8px">' + esc(e.name) + '</b><span class="muted">' + fmtDate(e.date) + '</span><span class="muted">' + esc(e.sport) + ' ' + (e.jenis === 'tunggal' ? 'tunggal' : 'ganda') + ', ' + h + ' hadir, ' + n + ' pertandingan</span></button>' +
        (A ? '<div class="btns"><button class="btn" data-evstatus="' + e.id + '">' + (e.status === 'aktif' ? 'Selesaikan' : 'Buka lagi') + '</button><button class="btn" data-evshare="' + e.id + '">QR</button><button class="btn danger" data-evdel="' + e.id + '">Hapus</button></div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // ---------- Form mabar baru ----------
  var mf = null;
  function newMf(){
    var d = new Date(), last = events()[0];
    var sport = last ? last.sport : 'Badminton';
    var f = {name:'Mabar ' + HARI[d.getDay()] + ' ' + d.getDate() + ' ' + BULAN[d.getMonth()], date:todayStr(), sport:sport, courts: last ? last.courts : 3, copyPresent:false};
    return applySport(f, sport, last && last.sport === sport ? last : null);
  }
  function applySport(f, sport, from){
    var base = from ? Object.assign({}, from.rules, {jenis:from.jenis}) : SPORTS[sport];
    f.sport = sport; f.type = base.type; f.jenis = base.jenis || SPORTS[sport].jenis;
    if (base.type === 'rally'){ f.target = base.target; f.cap = base.cap; }
    else { f.sets = base.sets; f.games = base.games; f.golden = !!base.golden; f.tb = base.tb !== false; }
    return f;
  }
  function viewMabarForm(){
    var f = mf, prev = events()[0];
    var sel = function(id, opts, cur){ return '<select data-mf="' + id + '">' + opts.map(function(o){ return '<option value="' + o[0] + '" ' + (String(cur) === String(o[0]) ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
    var rules = f.type === 'rally'
      ? '<label class="field"><span>Target poin per gim</span><input type="number" min="5" max="50" data-mf="target" value="' + f.target + '"></label>' +
        '<label class="field"><span>Batas poin maksimal (0 = tanpa batas)</span><input type="number" min="0" max="60" data-mf="cap" value="' + f.cap + '"></label>'
      : '<label class="field"><span>Jumlah set</span>' + sel('sets', [[1,'1 set'],[3,'Best of 3 set']], f.sets) + '</label>' +
        '<label class="field"><span>Game per set</span>' + sel('games', [[4,'4 game (short set)'],[6,'6 game'],[8,'8 game (pro set)']], f.games) + '</label>' +
        '<label class="field"><span>Saat 40–40</span>' + sel('golden', [['0','Advantage (deuce)'],['1','Golden point']], f.golden ? '1' : '0') + '</label>' +
        '<label class="field"><span>Tiebreak saat game sama</span>' + sel('tb', [['1','Ya, tiebreak ke 7'],['0','Tidak, harus unggul 2 game']], f.tb ? '1' : '0') + '</label>';
    return '<div class="btns" style="margin:0 0 12px"><button class="btn" data-back-list>← Batal</button></div>' +
      '<div class="panel glass" style="max-width:760px"><h2 style="margin-top:0">Mabar baru</h2><div class="formgrid">' +
      '<label class="field"><span>Nama mabar</span><input data-mf="name" value="' + esc(f.name) + '" maxlength="50"></label>' +
      '<label class="field"><span>Tanggal</span><input type="date" data-mf="date" value="' + f.date + '"></label>' +
      '<label class="field"><span>Cabang</span>' + sel('sport', Object.keys(SPORTS).map(function(k){ return [k,k]; }), f.sport) + '</label>' +
      '<label class="field"><span>Jenis</span>' + sel('jenis', [['ganda','Ganda'],['tunggal','Tunggal']], f.jenis) + '</label>' +
      '<label class="field"><span>Jumlah lapangan</span><input type="number" min="1" max="12" data-mf="courts" value="' + f.courts + '"></label>' + rules + '</div>' +
      (prev ? '<label class="opt"><input type="checkbox" data-mf="copyPresent" ' + (f.copyPresent ? 'checked' : '') + '><span><b>Salin daftar hadir dari “' + esc(prev.name) + '”</b><span class="muted">Berguna jika pesertanya kurang lebih sama.</span></span></label>' : '') +
      '<div class="btns"><button class="btn primary" data-createmabar>Buat mabar</button></div></div>';
  }

  // ---------- Lapangan (dalam mabar) ----------
  function chipTxt(id){ var p = byId(id); return esc(p.name) + ' <small>' + p.rating + '</small>'; }
  function liveRow(side, ids){ return '<div class="team"><span class="side ' + side + '"></span>' + ids.map(function(id){ return '<span class="chip">' + chipTxt(id) + '</span>'; }).join('') + (ids.length > 1 ? '<span class="avg">rata-rata ' + Math.round(avg(ids)) + '</span>' : '') + '</div>'; }
  function slotRow(e, c, side){
    var ids = c.draft[side], qu = queue(e);
    return '<div class="team"><span class="side ' + side + '"></span>' + ids.map(function(id, i){
      var opts = (id ? [id] : []).concat(qu).map(function(pid){
        var g = games(e, pid), info = g === 0 ? 'belum main' : g + '× main, tunggu ' + mins(lastFree(e, pid)) + ' mnt';
        return '<option value="' + pid + '" ' + (pid === id ? 'selected' : '') + '>' + esc(nm(pid)) + ' (' + info + ')</option>';
      }).join('');
      return '<select class="slotsel" data-slotsel="' + c.id + ':' + side + ':' + i + '" aria-label="Pemain ' + (side === 'a' ? 'biru' : 'merah') + ' ' + (i + 1) + '"><option value="">Pilih pemain…</option>' + opts + '</select>';
    }).join('') + '</div>';
  }
  function courtCard(e, c){
    var A = store.isAdmin && e.status === 'aktif';
    if (c.match){
      var m = c.match, pa = Math.round(expA(m.a, m.b) * 100), g = play(e.rules, m.pts);
      var h = '<div class="court glass"><div class="chead"><b>Lapangan ' + c.id + '</b><span class="tag live">Berjalan ' + mins(m.start) + ' mnt</span></div>' +
        liveRow('a', m.a) + liveRow('b', m.b) +
        '<div class="vs"><span>Peluang biru ' + pa + '%</span><span class="bar"><i style="width:' + pa + '%"></i></span><span>merah ' + (100 - pa) + '%</span></div>';
      if (A) h += '<div class="livebtns"><button class="ptbtn a" data-point="' + c.id + ':0" ' + (g.done ? 'disabled' : '') + ' aria-label="Poin untuk biru"><span>+1 Biru</span><b>' + (g.labels[0] || '–') + '</b></button>' +
        '<button class="ptbtn b" data-point="' + c.id + ':1" ' + (g.done ? 'disabled' : '') + ' aria-label="Poin untuk merah"><span>+1 Merah</span><b>' + (g.labels[1] || '–') + '</b></button></div>';
      else h += '<div class="bigscore"><b class="ca">' + (g.labels[0] || '') + '</b><span>–</span><b class="cb">' + (g.labels[1] || '') + '</b></div>';
      if (g.sub) h += '<p class="center muted" style="margin:8px 0 0;font-weight:600">' + esc(g.sub) + '</p>';
      if (g.flag) h += '<p class="center" style="margin:6px 0 0"><span class="tag prop">' + g.flag + '</span></p>';
      if (g.done) h += '<div class="gameover">' + (g.w === 0 ? 'Biru' : 'Merah') + ' menang ' + esc(g.text) + (A ? '. Tekan Simpan hasil.' : '.') + '</div>';
      if (A) h += '<div class="btns"><button class="btn primary" data-finish="' + c.id + '">Simpan hasil</button><button class="btn" data-undo="' + c.id + '" ' + (m.pts.length ? '' : 'disabled') + '>Batal poin</button><button class="btn danger" data-abort="' + c.id + '">Batalkan</button></div>';
      return h + '</div>';
    }
    if (c.draft && A){
      var full = c.draft.a.concat(c.draft.b).every(Boolean);
      var diff = full ? Math.round(Math.abs(avg(c.draft.a) - avg(c.draft.b))) : 0;
      return '<div class="court glass"><div class="chead"><b>Lapangan ' + c.id + '</b><span class="tag prop">Disusun panitia</span></div>' + slotRow(e, c, 'a') + slotRow(e, c, 'b') +
        '<p class="hint">' + (full ? 'Selisih rating ' + diff + '. Hanya acuan, keputusan di panitia.' : 'Pilih pemain dari daftar antrean di setiap kolom. Yang paling sedikit main dan paling lama menunggu ada di atas.') + '</p>' +
        '<div class="btns"><button class="btn primary" data-start="' + c.id + '" ' + (full ? '' : 'disabled') + '>Mulai main</button><button class="btn" data-swapsides="' + c.id + '">Tukar sisi</button><button class="btn" data-cancel="' + c.id + '">Batal</button></div></div>';
    }
    return '<div class="court glass"><div class="chead"><b>Lapangan ' + c.id + '</b><span class="tag">' + (c.draft ? 'Sedang disusun' : 'Kosong') + '</span></div>' +
      (A ? '<div class="btns" style="margin-top:0"><button class="btn primary" data-compose="' + c.id + '">Susun pertandingan</button></div>' : '<p class="muted" style="margin:0">' + (e.status === 'aktif' ? 'Menunggu panitia menyusun pertandingan.' : 'Mabar sudah selesai.') + '</p>') + '</div>';
  }
  function viewSkor(e){
    var A = store.isAdmin && e.status === 'aktif', qu = queue(e), busy = onCourt(e), pres = Object.keys(e.present);
    var never = pres.filter(function(id){ return games(e, id) === 0 && !busy[id]; }).length;
    var qHtml = qu.length ? qu.map(function(id, i){
      var g = games(e, id);
      return '<li><span class="rk">' + (i+1) + '</span><span class="nm">' + esc(nm(id)) + '<small>menunggu ' + mins(lastFree(e, id)) + ' mnt, rating ' + byId(id).rating + '</small></span>' +
        (g === 0 ? '<span class="badge new">Belum main</span>' : '<span class="badge n">' + g + '× main</span>') + '</li>';
    }).join('') : '<li class="muted">' + (pres.length ? 'Semua pemain hadir sedang bermain atau sudah dipilih.' : 'Belum ada yang hadir.' + (A ? ' Tandai kehadiran di tab Absensi.' : '')) + '</li>';
    return '<div class="stats"><div class="stat glass"><b>' + pres.length + '</b><span>pemain hadir</span></div>' +
      '<div class="stat glass"><b>' + evMatches(e.id).length + '</b><span>pertandingan selesai</span></div>' +
      '<div class="stat glass"><b>' + courtsOf(e).filter(function(c){ return c.match; }).length + '/' + courtsOf(e).length + '</b><span>lapangan terpakai</span></div>' +
      '<div class="stat glass"><b>' + never + '</b><span>belum main</span></div></div>' +
      '<div class="cols"><div class="courts">' + courtsOf(e).map(function(c){ return courtCard(e, c); }).join('') + '</div>' +
      '<div class="panel glass"><h3>Antrean</h3><p class="hint" style="margin:-4px 0 8px">Urutan: jumlah main paling sedikit, lalu menunggu paling lama.</p><ul class="q">' + qHtml + '</ul>' +
      '<div class="btns"><button class="btn" data-evshare="' + e.id + '">QR mabar ini</button></div></div></div>';
  }

  // ---------- Klasemen per mabar ----------
  function rankRows(e){
    var ms = evMatches(e.id), S = {};
    ms.forEach(function(m){
      var w = winner(m);
      function add(i, win, pf, pa, dr){ var s = S[i] || (S[i] = {id:i, n:0, w:0, l:0, pf:0, pa:0, dr:0}); s.n++; win ? s.w++ : s.l++; s.pf += pf; s.pa += pa; s.dr += dr; }
      m.a.forEach(function(i){ add(i, w === 0, m.sa, m.sb, m.delta || 0); });
      m.b.forEach(function(i){ add(i, w === 1, m.sb, m.sa, -(m.delta || 0)); });
    });
    var rows = Object.keys(S).map(function(k){ return S[k]; }), diff = function(s){ return s.pf - s.pa; };
    rows.sort(ui.sortBy === 'selisih' ? function(x,y){ return diff(y) - diff(x) || y.w - x.w; }
      : ui.sortBy === 'persen' ? function(x,y){ return y.w / y.n - x.w / x.n || y.w - x.w || diff(y) - diff(x); }
      : function(x,y){ return y.w - x.w || diff(y) - diff(x) || x.l - y.l; });
    return {rows:rows, count:ms.length};
  }
  function viewKlasemen(e){
    var r = rankRows(e), unit = e.rules.type === 'tennis' ? 'game' : 'poin';
    var sg = function(v){ return v > 0 ? '+' + v : String(v); };
    var tr = function(s, i){ return '<tr class="' + (i === 0 ? 'top1' : '') + '"><td>' + (i+1) + '</td><td class="name"><button data-profile="' + s.id + '">' + esc(nm(s.id)) + '</button></td><td>' + s.n + '</td><td><b>' + s.w + '</b></td><td>' + s.l + '</td><td>' + Math.round(s.w / s.n * 100) + '%</td><td>' + sg(s.pf - s.pa) + '</td></tr>'; };
    var head = '<thead><tr><th>#</th><th>Pemain</th><th>Main</th><th>Menang</th><th>Kalah</th><th>% menang</th><th>Selisih ' + unit + '</th></tr></thead>';
    var seg = function(v, l){ return '<button data-sort="' + v + '" aria-pressed="' + (ui.sortBy === v) + '">' + l + '</button>'; };
    return '<div class="toolbar"><p class="muted" style="margin:0">' + fmtDate(e.date) + ', ' + r.count + ' pertandingan</p><div class="seg glass" role="group" aria-label="Urutkan">' + seg('menang','Menang terbanyak') + seg('persen','% menang') + seg('selisih','Selisih ' + unit) + '</div></div>' +
      '<div class="tw glass"><table>' + head + '<tbody>' + (r.rows.map(tr).join('') || '<tr><td></td><td colspan="6">Belum ada pertandingan di mabar ini.</td></tr>') + '</tbody></table></div>' +
      '<p class="hint">Klasemen hanya menghitung pertandingan di mabar ini. Ketuk nama untuk melihat profil pemain.</p>' +
      (r.rows.length ? '<div class="btns"><button class="btn" data-share-rank>Bagikan ke WhatsApp</button></div>' : '');
  }
  function shareRank(e){
    var r = rankRows(e), unit = e.rules.type === 'tennis' ? 'game' : 'poin';
    var lines = ['*Klasemen ' + e.name + '*', fmtDate(e.date), ''];
    r.rows.forEach(function(s, i){ var d = s.pf - s.pa; lines.push((i+1) + '. ' + nm(s.id) + ': ' + s.w + 'M ' + s.l + 'K, selisih ' + unit + ' ' + (d > 0 ? '+' : '') + d); });
    lines.push('', 'Skor langsung: ' + viewerUrl(e.id));
    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
  }

  // ---------- Absensi (dalam mabar) ----------
  function viewHadir(e){
    var A = store.isAdmin && e.status === 'aktif', list = members().sort(function(a,b){ return a.name.localeCompare(b.name); });
    if (!A){
      var pres = list.filter(function(m){ return e.present[m.id]; });
      return '<div class="panel glass"><h3>' + pres.length + ' pemain hadir</h3><ul class="mlist">' + (pres.map(function(m){ return '<li><span class="nm"><button data-profile="' + m.id + '">' + esc(m.name) + '</button></span><span class="badge n">' + games(e, m.id) + '× main</span></li>'; }).join('') || '<li class="muted">Belum ada.</li>') + '</ul></div>';
    }
    return '<div class="grid2"><div class="panel glass"><h3>Absensi</h3><p class="hint" style="margin:-4px 0 6px">' + Object.keys(e.present).length + ' hadir dari ' + list.length + ' pemain.</p><ul class="mlist">' +
      (list.map(function(m){ return '<li><span class="nm"><button data-profile="' + m.id + '">' + esc(m.name) + '</button>' + (m.guest ? ' <span class="badge n">Tamu</span>' : '') + '</span><span class="muted">' + m.rating + '</span><button class="sw" role="switch" aria-checked="' + (!!e.present[m.id]) + '" data-present="' + m.id + '" aria-label="Hadir ' + esc(m.name) + '"></button></li>'; }).join('') || '<li class="muted">Belum ada pemain. Tambahkan di samping.</li>') + '</ul></div>' +
      '<div class="panel glass"><h3>Pemain baru atau tamu</h3><p class="muted" style="margin:0">Langsung ditandai hadir di mabar ini.</p>' + addPlayerForm() + '</div></div>';
  }
  function addPlayerForm(){ return '<div class="form"><input id="newName" placeholder="Nama pemain" maxlength="24"><select id="newType"><option value="anggota">Anggota</option><option value="tamu">Tamu</option></select><button class="btn primary" data-addplayer>Tambah</button></div>'; }

  // ---------- Pemain (daftar global) ----------
  function viewPemain(){
    var A = store.isAdmin, list = members().sort(function(a,b){ return a.name.localeCompare(b.name); });
    var cnt = {}; allMatches().forEach(function(m){ m.a.concat(m.b).forEach(function(i){ cnt[i] = (cnt[i] || 0) + 1; }); });
    return '<div class="grid2"><div class="panel glass"><h3>' + list.length + ' pemain</h3><ul class="mlist">' +
      (list.map(function(m){ return '<li><span class="nm"><button data-profile="' + m.id + '">' + esc(m.name) + '</button>' + (m.guest ? ' <span class="badge n">Tamu</span>' : '') + '<small class="muted" style="display:block;font-weight:400">' + (cnt[m.id] || 0) + ' pertandingan</small></span><span class="muted">rating ' + m.rating + '</span>' +
        (A && !cnt[m.id] ? '<button class="x" data-delmember="' + m.id + '">Hapus</button>' : '') + '</li>'; }).join('') || '<li class="muted">Belum ada pemain.</li>') + '</ul></div>' +
      (A ? '<div class="panel glass"><h3>Tambah pemain</h3><p class="muted" style="margin:0">Rating awal 1500. Rating berlanjut lintas mabar dan dipakai sebagai acuan menyusun tim.</p>' + addPlayerForm() + '</div>' : '') + '</div>';
  }

  // ---------- Bagikan & pengaturan ----------
  function viewBagikan(){
    var url = viewerUrl(), active = events().filter(function(e){ return e.status === 'aktif'; });
    return '<div class="grid2"><div class="panel glass center"><h3>QR tampilan penonton</h3><div class="qrbox">' + qrSvg(url) + '</div><p class="url">' + esc(url) + '</p>' +
      '<div class="btns" style="justify-content:center"><button class="btn primary" data-qrfull="">Layar penuh</button><button class="btn" data-copylink="">Salin tautan</button><button class="btn" data-share-link="">Bagikan</button></div></div>' +
      '<div class="panel glass"><h3>Cara pakai</h3><p class="muted" style="margin:0 0 8px">QR di samping membuka daftar semua mabar dan turnamen. Setiap mabar juga punya QR sendiri (tombol QR di daftar mabar) yang langsung membuka skor mabar itu.</p>' +
      '<p class="muted" style="margin:0 0 8px">Penonton tidak perlu memasang aplikasi atau membuat akun, dan tidak bisa mengubah data.</p>' +
      (active.length ? '<h3 style="margin-top:14px">Mabar berlangsung</h3><ul class="pairs">' + active.map(function(e){ return '<li><span>' + esc(e.name) + '</span><button class="btn" data-evshare="' + e.id + '">QR</button></li>'; }).join('') + '</ul>' : '') +
      (store.mode === 'local' ? '<p class="err">Mode lokal aktif: tautan penonton hanya berfungsi di perangkat ini. Aktifkan mode online agar penonton bisa melihat dari HP masing-masing.</p>' : '') + '</div></div>';
  }
  function qrDialog(title, url){
    $('dlgBody').innerHTML = '<div class="center"><h2>' + esc(title) + '</h2><p class="muted">Pindai untuk melihat skor langsung. Tidak perlu instal aplikasi.</p><div class="qrbox big">' + qrSvg(url) + '</div><p class="url">' + esc(url) + '</p>' +
      '<div class="btns" style="justify-content:center"><button class="btn" data-copylink="' + esc(url) + '">Salin tautan</button><button class="btn" data-share-link="' + esc(url) + '">Bagikan</button><button class="btn" data-close>Tutup</button></div></div>';
    $('dlg').classList.add('wide'); $('dlg').showModal();
  }
  function viewPengaturan(){
    var local = store.mode === 'local';
    return '<div class="grid2"><div class="panel glass"><h3>Komunitas</h3>' + communityForm(cfg()) + '<div class="btns"><button class="btn primary" data-savesettings>Simpan</button></div></div>' +
      '<div class="panel glass"><h3>Data</h3><p class="muted" style="margin:0">' + (local ? 'Mode lokal: data hanya tersimpan di browser perangkat ini. Unduh cadangan secara berkala.' : 'Mode online: data tersimpan di Firebase dan tersinkron ke semua perangkat.') + '</p>' +
      '<div class="btns"><button class="btn" data-export>Unduh cadangan (JSON)</button><label class="btn" style="display:inline-block">Pulihkan dari cadangan<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>' +
      '<div class="btns"><button class="btn danger" data-wipe>Hapus semua pemain, mabar, dan turnamen</button></div></div>' +
      (store.mode === 'cloud' ? viewDevices() : '') + '</div>';
  }

  function flipSkor(x){ return String(x).split(', ').map(function(p){ return p.split('–').reverse().join('–'); }).join(', '); }
  // ---------- Profil pemain ----------
  function profile(id){
    var p = byId(id), mine = allMatches().filter(function(m){ return m.a.indexOf(id) > -1 || m.b.indexOf(id) > -1; });
    var won = function(m){ return (m.a.indexOf(id) > -1) === (winner(m) === 0); };
    var w = mine.filter(won).length, partners = {};
    mine.forEach(function(m){ var tm = m.a.indexOf(id) > -1 ? m.a : m.b, q = tm.filter(function(x){ return x !== id; })[0]; if (!q) return; partners[q] = partners[q] || {n:0, w:0}; partners[q].n++; if (won(m)) partners[q].w++; });
    var best = Object.keys(partners).map(function(k){ return [k, partners[k]]; }).filter(function(x){ return x[1].n >= 2; }).sort(function(a,b){ return b[1].w / b[1].n - a[1].w / a[1].n || b[1].n - a[1].n; })[0];
    var h = [1500].concat(arr(p.hist).map(function(x){ return x.r; })), mn = Math.min.apply(null, h) - 10, mx = Math.max.apply(null, h) + 10;
    var pts = h.map(function(r, i){ return ((i / (h.length - 1 || 1)) * 300).toFixed(1) + ',' + (66 - ((r - mn) / (mx - mn)) * 60).toFixed(1); }).join(' ');
    var last = mine.slice(-5).reverse().map(function(m){
      var inA = m.a.indexOf(id) > -1, tm = inA ? m.a : m.b, op = inA ? m.b : m.a, mate = tm.filter(function(x){ return x !== id; })[0], ev = getEv(m.ev);
      return '<li><span><span class="' + (won(m) ? 'w' : 'l') + '">' + (won(m) ? 'M' : 'K') + '</span> ' + (mate ? 'bersama ' + esc(nm(mate)) + ' ' : '') + 'melawan ' + op.map(nm).map(esc).join(' / ') + (ev ? '<br><small class="muted">' + esc(ev.name) + '</small>' : '') + '</span><span>' + esc(m.skor ? (inA ? m.skor : flipSkor(m.skor)) : (inA ? m.sa + '–' + m.sb : m.sb + '–' + m.sa)) + '</span></li>';
    }).join('');
    $('dlgBody').innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><h2>' + esc(p.name) + '</h2><span class="muted">' + (p.guest ? 'Tamu' : 'Anggota') + '</span></div><button class="btn" data-close>Tutup</button></div>' +
      '<div class="kv"><div><b>' + p.rating + '</b><span>rating</span></div><div><b>' + mine.length + '</b><span>total main</span></div><div><b>' + w + '</b><span>menang</span></div><div><b>' + (mine.length ? Math.round(w / mine.length * 100) : 0) + '%</b><span>% menang</span></div></div>' +
      '<h3>Perjalanan rating</h3><svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label="Grafik rating"><polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>' +
      '<p style="margin:10px 0">' + (best ? 'Pasangan terbaik: <b>' + esc(nm(best[0])) + '</b>, menang ' + best[1].w + ' dari ' + best[1].n + ' pertandingan.' : 'Belum cukup data untuk pasangan terbaik.') + '</p>' +
      '<h3>Lima pertandingan terakhir</h3><ul class="res">' + (last || '<li>Belum ada pertandingan.</li>') + '</ul>';
    $('dlg').showModal();
  }

  // ---------- Turnamen ----------
  function newTd(){ return {name:'', sport:'Badminton', fmt:'Gugur', jenis:'ganda', picked:{}, ext:[], pairs:[], order:[], affect:false}; }
  var td = newTd();
  function tName(id){ if (String(id).charAt(0) === 'x'){ var e = td.ext.filter(function(x){ return x.id === id; })[0]; return e ? e.name : '?'; } return nm(id); }
  function allT(){ return Object.keys(td.picked).concat(td.ext.map(function(e){ return e.id; })); }
  function entries(){
    if (td.jenis === 'ganda') return td.pairs;
    var all = allT();
    td.order = td.order.filter(function(id){ return all.indexOf(id) > -1; }).concat(all.filter(function(id){ return td.order.indexOf(id) < 0; }));
    return td.order;
  }
  function entryName(x){ return Array.isArray(x) ? x.map(tName).map(esc).join(' / ') : esc(tName(x)); }
  function tournaments(){ var t = st().tournaments || {}; return Object.keys(t).map(function(id){ return Object.assign({}, t[id], {id:id}); }).sort(function(a,b){ return (b.created || 0) - (a.created || 0); }); }
  function viewTList(){
    var A = store.isAdmin, list = tournaments();
    var head = A ? '<div class="btns" style="margin:0 0 14px"><button class="btn primary" data-newtour>+ Turnamen baru</button></div>' : '';
    if (!list.length) return head + '<div class="panel glass empty-state center"><h2>Belum ada turnamen</h2><p class="muted">' + (A ? 'Tekan “+ Turnamen baru” untuk membuat.' : 'Turnamen yang dibuat panitia akan muncul di sini.') + '</p></div>';
    return head + '<div class="tcards">' + list.map(function(t){
      var ent = arr(t.entries).map(function(x){ return arr(x).map(function(p){ return esc(p.name); }).join(' / '); });
      var link = t.linked ? (t.affect ? 'Terhubung, memengaruhi rating' : 'Terhubung, rating terpisah') : 'Data terpisah';
      return '<div class="tcard glass"><span class="tag ' + (t.status === 'Berlangsung' ? 'live' : '') + '">' + esc(t.status) + '</span> <span class="tag">' + link + '</span>' +
        '<b style="margin-top:8px">' + esc(t.name) + '</b><p class="muted" style="margin:4px 0 0">' + esc(t.sport || 'Badminton') + ', ' + esc(t.fmt) + ', ' + ent.length + ' ' + (t.jenis === 'ganda' ? 'pasangan' : 'peserta') + '</p>' +
        '<details class="tdet"><summary>Daftar unggulan</summary><ol>' + ent.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ol></details>' +
        (A ? '<div class="btns"><button class="btn" data-tstatus="' + t.id + '">' + (t.status === 'Pendaftaran' ? 'Mulai turnamen' : t.status === 'Berlangsung' ? 'Tandai selesai' : 'Buka lagi') + '</button><button class="btn danger" data-tdel="' + t.id + '">Hapus</button></div>' : '') + '</div>';
    }).join('') + '</div><p class="hint" style="margin-top:14px">Pencatatan skor per pertandingan turnamen akan ditambahkan pada versi berikutnya.</p>';
  }
  function viewTForm(){
    var list = members().sort(function(a,b){ return a.name.localeCompare(b.name); });
    var ent = entries(), ganda = td.jenis === 'ganda', paired = {};
    td.pairs.forEach(function(p){ p.forEach(function(i){ paired[i] = 1; }); });
    var free = allT().filter(function(id){ return !paired[id]; });
    var opt = function(sel){ return free.map(function(id, i){ return '<option value="' + id + '" ' + (i === sel ? 'selected' : '') + '>' + esc(tName(id)) + '</option>'; }).join(''); };
    var linked = Object.keys(td.picked).length > 0;
    return '<div class="btns" style="margin:0 0 12px"><button class="btn" data-back-tlist>← Batal</button></div>' +
      '<div class="grid2"><div class="panel glass"><h3>Turnamen baru</h3>' +
      '<div class="form"><input data-td="name" value="' + esc(td.name) + '" placeholder="Nama turnamen" aria-label="Nama turnamen" maxlength="60"></div>' +
      '<div class="form"><select id="tSport" aria-label="Cabang">' + Object.keys(SPORTS).map(function(k){ return '<option ' + (td.sport === k ? 'selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<select id="tFmt" aria-label="Format">' + ['Gugur','Round robin','Grup lalu gugur','Americano'].map(function(f){ return '<option ' + (td.fmt === f ? 'selected' : '') + '>' + f + '</option>'; }).join('') + '</select>' +
      '<select id="tJenis" aria-label="Jenis"><option value="ganda" ' + (ganda ? 'selected' : '') + '>Ganda</option><option value="tunggal" ' + (!ganda ? 'selected' : '') + '>Tunggal</option></select></div>' +
      '<h3 style="margin-top:16px">Peserta dari pemain mabar</h3><p class="muted" style="margin:0">Opsional.</p>' +
      '<div class="checks">' + list.map(function(m){ return '<label><input type="checkbox" data-tpick="' + m.id + '" ' + (td.picked[m.id] ? 'checked' : '') + '>' + esc(m.name) + '</label>'; }).join('') + '</div>' +
      '<h3 style="margin-top:16px">Peserta dari luar</h3><div class="form"><input id="extName" placeholder="Nama peserta" maxlength="24"><button class="btn" data-addext>Tambah</button></div>' +
      '<ul class="pairs" style="margin-top:6px">' + td.ext.map(function(e){ return '<li><span>' + esc(e.name) + '</span><button class="x" data-delext="' + e.id + '">Hapus</button></li>'; }).join('') + '</ul>' +
      '<label class="opt" style="margin-top:10px;' + (linked ? '' : 'opacity:.5') + '"><input type="checkbox" data-affect ' + (td.affect ? 'checked' : '') + ' ' + (linked ? '' : 'disabled') + '><span><b>Hasil turnamen memengaruhi rating mabar</b><span class="muted">Biarkan mati jika level atau format turnamen berbeda dengan mabar.</span></span></label></div>' +
      '<div class="panel glass"><h3>' + (ganda ? 'Pasangan dan unggulan' : 'Urutan unggulan') + '</h3>' +
      (ganda ? '<div class="form"><select id="tp1" aria-label="Peserta pertama">' + opt(0) + '</select><select id="tp2" aria-label="Peserta kedua">' + opt(1) + '</select><button class="btn primary" data-addtpair ' + (free.length < 2 ? 'disabled' : '') + '>Pasangkan</button></div>' : '') +
      '<ol class="pairs seeds" style="margin-top:10px">' + (ent.map(function(x, i){ return '<li><span>' + (i+1) + '. ' + entryName(x) + '</span><button class="mini" data-mv="' + i + ':-1" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Naikkan">↑</button><button class="mini" data-mv="' + i + ':1" ' + (i === ent.length - 1 ? 'disabled' : '') + ' aria-label="Turunkan">↓</button>' + (ganda ? '<button class="x" data-delpairt="' + i + '">Pisahkan</button>' : '') + '</li>'; }).join('') || '<li class="muted">Belum ada.</li>') + '</ol>' +
      (ganda && free.length ? '<p class="hint">Belum berpasangan: ' + free.map(tName).map(esc).join(', ') + '</p>' : '') +
      '<div class="btns"><button class="btn primary" data-createt>Buat turnamen</button></div></div></div>';
  }

  // ---------- Banner instal ----------
  var deferredPrompt = null;
  function isStandalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function renderInstall(){
    var el = $('install'), dismissed = false;
    try { dismissed = localStorage.getItem('install-dismissed') === '1'; } catch(e){}
    if (VIEW || isStandalone() || dismissed){ el.hidden = true; return; }
    var share = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';
    if (deferredPrompt){ el.innerHTML = '<div><b>Pasang aplikasi panitia</b><span>Buka langsung dari layar utama, tanpa browser.</span></div><button class="btn primary" data-install>Instal</button><button class="x" data-dismiss-install aria-label="Tutup">✕</button>'; el.hidden = false; }
    else if (isIOS()){ el.innerHTML = '<div><b>Pasang di layar utama</b><span>Di Safari, ketuk tombol Bagikan ' + share + ', lalu pilih “Tambahkan ke Layar Utama”.</span></div><button class="x" data-dismiss-install aria-label="Tutup">✕</button>'; el.hidden = false; }
    else el.hidden = true;
  }
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferredPrompt = e; renderInstall(); });
  window.addEventListener('appinstalled', function(){ deferredPrompt = null; renderInstall(); toast('Aplikasi terpasang.'); });

  // ---------- Render ----------
  function isTyping(){ var a = document.activeElement; return a && a.matches && a.matches('#app input:not([type=checkbox]):not([type=file]),#app select,#app textarea'); }
  function render(){
    ui.pendingRender = false;
    renderTop();
    if (!store.ready){ $('subnav').innerHTML = ''; $('app').innerHTML = '<p class="muted">Memuat…</p>'; return; }
    if (store.error && store.error !== ui.lastErr){ ui.lastErr = store.error; toast(store.error); }
    if (!st().settings){ $('subnav').innerHTML = ''; $('app').innerHTML = viewSetup(); return; }
    if (!VIEW && !store.isAdmin){ $('subnav').innerHTML = ''; $('app').innerHTML = store.uid ? viewClaim() : viewSetup(); return; }
    if (ui.view === 'event' && !getEv(ui.ev)) ui.view = 'list';
    renderNav();
    var html;
    if (ui.mode === 'turnamen') html = ui.view === 'tform' && store.isAdmin ? viewTForm() : viewTList();
    else if (ui.view === 'mform' && store.isAdmin) html = viewMabarForm();
    else if (ui.view === 'event'){ var e = getEv(ui.ev); html = ui.tab === 'klasemen' ? viewKlasemen(e) : ui.tab === 'hadir' ? viewHadir(e) : viewSkor(e); }
    else html = {daftar:viewDaftar, pemain:viewPemain, bagikan:viewBagikan, pengaturan:viewPengaturan}[store.isAdmin ? ui.listTab : (ui.listTab === 'pemain' ? 'pemain' : 'daftar')]();
    $('app').innerHTML = html;
  }
  function softRender(){ if (isTyping()) ui.pendingRender = true; else render(); }
  document.addEventListener('focusout', function(){ setTimeout(function(){ if (ui.pendingRender && !isTyping()) render(); }, 50); });
  function openEvent(id, tab){ ui.mode = 'mabar'; ui.view = 'event'; ui.ev = id; ui.tab = tab || 'skor'; if (VIEW) try { history.replaceState(null, '', '#ev=' + id); } catch(err){} render(); window.scrollTo(0, 0); }
  function readHash(){ var m = /ev=([\w-]+)/.exec(location.hash); if (m){ ui.mode = 'mabar'; ui.view = 'event'; ui.ev = m[1]; ui.tab = 'skor'; } }
  window.addEventListener('hashchange', function(){ readHash(); render(); });

  // ---------- Aksi ----------
  function saveMatch(e, c, g){
    var m = c.match, w = g.done ? g.w : g.lead;
    var ea = expA(m.a, m.b), d = Math.round(24 * ((w === 0 ? 1 : 0) - ea)), t = Date.now(), paths = {};
    paths['matches/' + uid('g')] = {ev:e.id, a:m.a, b:m.b, sa:g.tot[0], sb:g.tot[1], w:w, skor:g.text, t:t, start:m.start, court:c.id, delta:d};
    function upd(ids, delta){ ids.forEach(function(i){ var p = byId(i), r = (p.rating || 1500) + delta; paths['members/' + i + '/rating'] = r; paths['members/' + i + '/hist'] = arr(p.hist).concat([{t:t, r:r}]).slice(-300); }); }
    upd(m.a, d); upd(m.b, -d);
    paths[evPath(e, 'lap/' + c.id + '/match')] = null;
    store.update(paths);
    return {d:d, w:w};
  }
  function download(name, text){
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:'application/json'})); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }
  function setTheme(m){
    if (m === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', m);
    try { localStorage.setItem('skor-tema', m); } catch(e){}
    var meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', m === 'dark' ? '#0F1828' : '#1E4F8A');
  }
  try { var tm = localStorage.getItem('skor-tema'); if (tm && tm !== 'auto') setTheme(tm); } catch(e){}
  function addPlayer(e){
    var n = $('newName').value.trim(); if (!n){ $('newName').focus(); return; }
    var mid = uid('m'), p = {}; p['members/' + mid] = {name:n, rating:1500, hist:[], guest:$('newType').value === 'tamu', joined:Date.now()};
    if (e) p[evPath(e, 'present/' + mid)] = Date.now();
    store.update(p); toast(n + ' ditambahkan' + (e ? ' dan ditandai hadir.' : '.')); render(); var x = $('newName'); if (x) x.focus();
  }

  document.addEventListener('click', function(ev){
    var t = ev.target.closest('button'); if (!t) return;
    var d = t.dataset, A = store.isAdmin, e = ui.view === 'event' ? getEv(ui.ev) : null;
    if (d.mode){ ui.mode = d.mode; ui.view = 'list'; if (VIEW) try { history.replaceState(null, '', location.pathname); } catch(err){} return render(); }
    if (d.themeSet){ setTheme(d.themeSet); return renderTop(); }
    if (d.ltab){ ui.listTab = d.ltab; return render(); }
    if (d.tab){ ui.tab = d.tab; return render(); }
    if (t.hasAttribute('data-back') || t.hasAttribute('data-back-list')){ ui.view = 'list'; ui.listTab = 'daftar'; if (VIEW) try { history.replaceState(null, '', location.pathname); } catch(err){} return render(); }
    if (t.hasAttribute('data-back-tlist')){ ui.view = 'list'; return render(); }
    if (d.open) return openEvent(d.open);
    if (d.sort){ ui.sortBy = d.sort; return render(); }
    if (d.profile) return profile(d.profile);
    if (t.hasAttribute('data-close')) return $('dlg').close();
    if (t.hasAttribute('data-install')){ if (deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.finally(function(){ deferredPrompt = null; renderInstall(); }); } return; }
    if (t.hasAttribute('data-dismiss-install')){ try { localStorage.setItem('install-dismissed', '1'); } catch(err){} return renderInstall(); }
    if (t.hasAttribute('data-share-rank') && e) return shareRank(e);
    if (d.evshare){ var se = getEv(d.evshare); return qrDialog(se.name, viewerUrl(se.id)); }
    if (t.hasAttribute('data-qrfull')) return qrDialog(cfg().name || 'Skor langsung', viewerUrl());
    if (t.hasAttribute('data-share-link')){
      var url = d.shareLink || viewerUrl();
      if (navigator.share) navigator.share({title: cfg().name || 'Skor Mabar', text:'Lihat skor langsung:', url:url}).catch(function(){});
      else window.open('https://wa.me/?text=' + encodeURIComponent('Lihat skor langsung: ' + url), '_blank');
      return;
    }
    if (t.hasAttribute('data-copylink') || d.copycode){
      var txt = d.copycode ? fmtCode(d.copycode) : (d.copylink || viewerUrl());
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ toast('Tersalin.'); }).catch(function(){ prompt('Salin teks ini:', txt); });
      return;
    }
    if (t.hasAttribute('data-claim')){
      var code = normCode($('claimCode').value), errc = $('claimErr'); if (!code){ $('claimCode').focus(); return; }
      t.disabled = true; errc.hidden = true;
      store.claim(code, $('devName').value.trim()).then(function(){ toast('Perangkat terdaftar sebagai panitia.'); render(); })
        .catch(function(){ errc.textContent = 'Kode tidak berlaku. Periksa kembali, atau minta kode undangan baru.'; errc.hidden = false; t.disabled = false; });
      return;
    }
    if (t.hasAttribute('data-setup') && !st().settings && !VIEW){
      var paths = {settings:readCommunity()}, dev = ($('devName') && $('devName').value.trim()) || 'Perangkat pendiri';
      if (store.mode === 'cloud'){ paths['owners/' + store.uid] = 'pendiri'; paths['ownerNames/' + store.uid] = {name:dev, at:Date.now()}; }
      t.disabled = true;
      store.update(paths).then(function(){ ui.view = 'list'; ui.listTab = 'daftar'; render(); toast('Komunitas siap.'); if (store.mode === 'cloud') makeRecovery(); })
        .catch(function(){ t.disabled = false; toast('Gagal menyimpan. Mungkin komunitas ini sudah disiapkan perangkat lain.'); });
      return;
    }

    if (!A) return;
    // ===== Panitia =====
    if (t.hasAttribute('data-invite')){
      var ic = randCode(6);
      store.setSecret('undangan/' + ic, {exp:Date.now() + 15 * MIN, dibuat:Date.now()}).then(function(){ showCode('Kode undangan panitia', ic, 'Di HP panitia baru, buka aplikasi panitia lalu masukkan kode ini. Berlaku 15 menit dan sekali pakai.'); }).catch(function(){ toast('Gagal membuat kode.'); });
      return;
    }
    if (t.hasAttribute('data-newrecovery')) return makeRecovery();
    if (d.revoke){ if (!confirm('Cabut akses panitia dari perangkat ini?')) return; var rv = {}; rv['owners/' + d.revoke] = null; rv['ownerNames/' + d.revoke] = null; store.update(rv); return render(); }
    if (t.hasAttribute('data-savesettings')){ store.update({settings:readCommunity()}); toast('Tersimpan.'); return render(); }
    if (t.hasAttribute('data-export')){ var ex = JSON.parse(JSON.stringify(st())); delete ex.owners; delete ex.ownerNames; download('skor-mabar-cadangan-' + todayStr() + '.json', JSON.stringify(ex, null, 2)); return; }
    if (t.hasAttribute('data-wipe')){ if (prompt('Ketik HAPUS untuk menghapus semua pemain, mabar, dan turnamen. Pengaturan dan perangkat panitia tetap.') !== 'HAPUS') return; store.update({members:null, matches:null, events:null, tournaments:null}); ui.view = 'list'; toast('Data dihapus.'); return render(); }
    if (t.hasAttribute('data-addplayer')) return addPlayer(e && e.status === 'aktif' ? e : null);
    if (d.delmember){ if (!confirm('Hapus ' + nm(d.delmember) + '?')) return; store.update({['members/' + d.delmember]:null}); return render(); }

    // Mabar: buat, status, hapus
    if (t.hasAttribute('data-newmabar')){ mf = newMf(); ui.view = 'mform'; return render(); }
    if (t.hasAttribute('data-createmabar')){
      var f = mf;
      if (!f.name.trim()){ toast('Isi nama mabar.'); return; }
      var rules = f.type === 'rally' ? {type:'rally', target:Math.max(5, +f.target || 21), cap:Math.max(0, +f.cap || 0)} : {type:'tennis', sets:+f.sets === 3 ? 3 : 1, games:+f.games || 6, golden:!!f.golden, tb:!!f.tb};
      var id = uid('e'), prev = events()[0], present = {};
      if (f.copyPresent && prev) Object.keys(prev.present).forEach(function(k){ present[k] = Date.now(); });
      store.update({['events/' + id]:{type:'mabar', name:f.name.trim(), date:f.date || todayStr(), sport:f.sport, jenis:f.jenis, rules:rules, courts:Math.min(12, Math.max(1, +f.courts || 1)), status:'aktif', created:Date.now(), present:present}});
      mf = null; toast('Mabar dibuat. Tandai pemain yang hadir.');
      return openEvent(id, 'hadir');
    }
    if (d.evstatus){ var es = getEv(d.evstatus); if (es.status === 'aktif' && courtsOf(es).some(function(c){ return c.match; }) && !confirm('Masih ada pertandingan berjalan. Tetap selesaikan? Pertandingan yang belum disimpan akan dibuang.')) return;
      var up = {}; up['events/' + es.id + '/status'] = es.status === 'aktif' ? 'selesai' : 'aktif'; if (es.status === 'aktif') up['events/' + es.id + '/lap'] = null; store.update(up); return render(); }
    if (d.evdel){ var ed = getEv(d.evdel), n = evMatches(ed.id).length;
      if (!confirm('Hapus “' + ed.name + '”' + (n ? ' beserta ' + n + ' pertandingannya? Rating pemain tidak dikembalikan.' : '?'))) return;
      var dp = {}; dp['events/' + ed.id] = null; evMatches(ed.id).forEach(function(m){ dp['matches/' + m.id] = null; }); store.update(dp); return render(); }

    // Dalam mabar
    if (e && e.status === 'aktif'){
      if (d.compose){ var k = slotsN(e), blank = []; for (var i = 0; i < k; i++) blank.push(0); store.update({[evPath(e, 'lap/' + d.compose + '/draft')]:{a:blank, b:blank.slice()}}); return render(); }
      if (d.swapsides){ var c3 = courtOf(e, d.swapsides); store.update({[evPath(e, 'lap/' + c3.id + '/draft')]:{a:c3.draft.b, b:c3.draft.a}}); return render(); }
      if (d.cancel){ store.update({[evPath(e, 'lap/' + d.cancel + '/draft')]:null}); return render(); }
      if (d.start){ var c4 = courtOf(e, d.start); store.update({[evPath(e, 'lap/' + c4.id)]:{match:{a:c4.draft.a, b:c4.draft.b, pts:[], start:Date.now()}}}); toast('Lapangan ' + c4.id + ' dimulai.'); return render(); }
      if (d.point){ var pp = d.point.split(':'), c5 = courtOf(e, pp[0]); if (!c5 || !c5.match || play(e.rules, c5.match.pts).done) return;
        if (navigator.vibrate) navigator.vibrate(20);
        store.update({[evPath(e, 'lap/' + c5.id + '/match/pts')]:c5.match.pts.concat([+pp[1]])}); return render(); }
      if (d.undo){ var c6 = courtOf(e, d.undo); store.update({[evPath(e, 'lap/' + c6.id + '/match/pts')]:c6.match.pts.slice(0, -1)}); return render(); }
      if (d.finish){ var c7 = courtOf(e, d.finish), g = play(e.rules, c7.match.pts);
        if (!g.done && g.lead == null){ toast('Skor masih imbang. Tambah poin dulu atau batalkan.'); return; }
        if (!g.done && !confirm('Pertandingan belum selesai menurut aturan. Simpan dengan ' + (g.lead === 0 ? 'biru' : 'merah') + ' sebagai pemenang (' + g.text + ')?')) return;
        var res = saveMatch(e, c7, g); toast('Hasil tersimpan. Rating tim ' + (res.w === 0 ? 'biru' : 'merah') + ' +' + Math.abs(res.d) + '.'); return render(); }
      if (d.abort){ if (!confirm('Batalkan pertandingan di Lapangan ' + d.abort + '? Skor tidak disimpan.')) return; store.update({[evPath(e, 'lap/' + d.abort + '/match')]:null}); return render(); }
      if (d.present){ var pid = d.present, on = !e.present[pid];
        if (!on && onCourt(e)[pid]){ toast('Pemain sedang bermain.'); return; }
        var pu = {}; pu[evPath(e, 'present/' + pid)] = on ? Date.now() : null;
        if (!on) courtsOf(e).forEach(function(cc){ if (cc.draft && cc.draft.a.concat(cc.draft.b).indexOf(pid) > -1) pu[evPath(e, 'lap/' + cc.id + '/draft')] = {a:cc.draft.a.map(function(x){ return x === pid ? 0 : x; }), b:cc.draft.b.map(function(x){ return x === pid ? 0 : x; })}; });
        store.update(pu); return render(); }
    }

    // Turnamen
    if (t.hasAttribute('data-newtour')){ td = newTd(); ui.view = 'tform'; return render(); }
    if (t.hasAttribute('data-addext')){ var en = $('extName').value.trim(); if (!en){ $('extName').focus(); return; } td.ext.push({id:uid('x'), name:en}); render(); $('extName').focus(); return; }
    if (d.delext){ td.ext = td.ext.filter(function(x){ return x.id !== d.delext; }); td.pairs = td.pairs.filter(function(p){ return p.indexOf(d.delext) < 0; }); return render(); }
    if (t.hasAttribute('data-addtpair')){ var p1 = $('tp1').value, p2 = $('tp2').value; if (!p1 || !p2 || p1 === p2){ toast('Pilih dua peserta yang berbeda.'); return; } td.pairs.push([p1, p2]); return render(); }
    if (d.delpairt){ td.pairs.splice(+d.delpairt, 1); return render(); }
    if (d.mv){ var mv = d.mv.split(':').map(Number), L = td.jenis === 'ganda' ? td.pairs : td.order, a = mv[0], b = mv[0] + mv[1], tmp = L[a]; L[a] = L[b]; L[b] = tmp; return render(); }
    if (t.hasAttribute('data-createt')){
      var ent = entries();
      if (!td.name.trim()){ toast('Isi nama turnamen.'); return; }
      if (ent.length < 2){ toast(td.jenis === 'ganda' ? 'Susun minimal 2 pasangan.' : 'Tambahkan minimal 2 peserta.'); return; }
      var tp = {}; tp['tournaments/' + uid('t')] = {name:td.name.trim(), sport:td.sport, fmt:td.fmt, jenis:td.jenis, status:'Pendaftaran', created:Date.now(), linked:Object.keys(td.picked).length > 0, affect:td.affect,
        entries:ent.map(function(x){ return (Array.isArray(x) ? x : [x]).map(function(id){ return {id:id, name:tName(id)}; }); })};
      store.update(tp); td = newTd(); ui.view = 'list'; toast('Turnamen dibuat.'); return render();
    }
    if (d.tstatus){ var tt = st().tournaments[d.tstatus], nx = tt.status === 'Pendaftaran' ? 'Berlangsung' : tt.status === 'Berlangsung' ? 'Selesai' : 'Berlangsung'; store.update({['tournaments/' + d.tstatus + '/status']:nx}); return render(); }
    if (d.tdel){ if (!confirm('Hapus turnamen ini?')) return; store.update({['tournaments/' + d.tdel]:null}); return render(); }
  });

  document.addEventListener('change', function(ev){
    var x = ev.target;
    if (x.id === 'importFile' && x.files[0]){
      var r = new FileReader();
      r.onload = function(){ try { var o = JSON.parse(r.result); if (!o.settings) throw 0; if (!confirm('Ganti data pemain, mabar, dan turnamen dengan isi cadangan ini?')) return;
        store.update({settings:o.settings, members:o.members || null, matches:o.matches || null, events:o.events || null, tournaments:o.tournaments || null}); toast('Data dipulihkan.'); render(); } catch(err){ toast('File cadangan tidak valid.'); } };
      r.readAsText(x.files[0]); return;
    }
    if (x.dataset && x.dataset.slotsel && store.isAdmin){
      var e = ui.view === 'event' ? getEv(ui.ev) : null; if (!e || e.status !== 'aktif') return;
      var sp = x.dataset.slotsel.split(':'), c = courtOf(e, sp[0]); if (!c || !c.draft) return;
      c.draft[sp[1]][+sp[2]] = x.value || 0;
      store.update({[evPath(e, 'lap/' + c.id + '/draft')]:c.draft}); x.blur(); return render();
    }
    if (x.dataset && x.dataset.mf && mf){
      var k = x.dataset.mf;
      if (k === 'sport'){ applySport(mf, x.value, null); return render(); }
      if (k === 'copyPresent') mf.copyPresent = x.checked;
      else if (k === 'golden' || k === 'tb') mf[k] = x.value === '1';
      else mf[k] = x.value;
      return;
    }
    if (x.matches('[data-tpick]')){ var id = x.dataset.tpick; if (x.checked) td.picked[id] = 1; else { delete td.picked[id]; td.pairs = td.pairs.filter(function(p){ return p.indexOf(id) < 0; }); } if (!Object.keys(td.picked).length) td.affect = false; return render(); }
    if (x.matches('[data-affect]')) td.affect = x.checked;
    if (x.id === 'tFmt') td.fmt = x.value;
    if (x.id === 'tSport') td.sport = x.value;
    if (x.id === 'tJenis'){ td.jenis = x.value; render(); }
  });
  document.addEventListener('input', function(ev){
    var x = ev.target;
    if (x.matches('[data-td="name"]')) td.name = x.value;
    if (x.dataset && x.dataset.mf && mf && x.type !== 'checkbox' && x.tagName !== 'SELECT') mf[x.dataset.mf] = x.value;
  });
  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter') return;
    var map = {extName:'[data-addext]', newName:'[data-addplayer]', claimCode:'[data-claim]'}, sel = map[ev.target.id];
    if (sel){ ev.preventDefault(); var b = document.querySelector(sel); if (b) b.click(); }
  });
  $('dlg').addEventListener('click', function(ev){ if (ev.target === $('dlg')) $('dlg').close(); });
  $('dlg').addEventListener('close', function(){ $('dlg').classList.remove('wide'); });

  store.onChange(softRender);
  setInterval(function(){ if (ui.view === 'event' && ui.tab === 'skor') softRender(); }, 30000);
  readHash();
  render(); renderInstall();
  store.init();
})();
