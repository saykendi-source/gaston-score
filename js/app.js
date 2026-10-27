/* Skor Mabar: aplikasi utama */
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
  function viewerUrl(){ return new URL('lihat.html', location.href.split('#')[0].split('?')[0]).href; }
  function randCode(n){ var ch = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', b = new Uint32Array(n); (window.crypto || window.msCrypto).getRandomValues(b); for (var i = 0; i < n; i++) out += ch[b[i] % ch.length]; return out; }
  function fmtCode(c){ return c.length > 6 ? c.match(/.{1,4}/g).join('-') : c; }
  function normCode(c){ return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function qrSvg(text){ try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize:8, margin:2, scalable:true}); } catch(e){ return '<p class="muted">QR tidak dapat dibuat.</p>'; } }
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  // ---------- Data helpers ----------
  function st(){ return store.state; }
  function cfg(){ return st().settings || {}; }
  function members(){ var m = st().members || {}; return Object.keys(m).map(function(id){ return Object.assign({}, m[id], {id:id}); }); }
  function byId(id){ var m = (st().members || {})[id]; return m ? Object.assign({rating:1500, hist:[]}, m, {id:id}) : {id:id, name:'(terhapus)', rating:1500, hist:[]}; }
  function nm(id){ return byId(id).name; }
  function arr(x){ return Array.isArray(x) ? x : (x ? Object.keys(x).map(function(k){ return x[k]; }) : []); }
  function matches(){
    var m = st().matches || {};
    return Object.keys(m).map(function(id){ var x = m[id]; return Object.assign({}, x, {id:id, a:arr(x.a), b:arr(x.b)}); }).sort(function(x,y){ return x.t - y.t; });
  }
  function avg(ids){ return ids.reduce(function(s,i){ return s + (byId(i).rating || 1500); }, 0) / (ids.length || 1); }
  function expA(a,b){ return 1 / (1 + Math.pow(10, (avg(b) - avg(a)) / 400)); }
  function presentMap(){ var p = st().present; return p && p.date === todayStr() ? (p.list || {}) : {}; }
  function presentIds(){ return Object.keys(presentMap()); }
  function slot2(x){ var a = arr(x); return [a[0] || 0, a[1] || 0]; }
  function courts(){
    var n = +cfg().courts || 3, c = st().courts || {}, out = [];
    for (var i = 1; i <= n; i++){
      var x = c[i] || {};
      out.push({
        id: i,
        match: x.match ? {a:arr(x.match.a), b:arr(x.match.b), pts:arr(x.match.pts), start:x.match.start || Date.now()} : null,
        draft: x.draft ? {a:slot2(x.draft.a), b:slot2(x.draft.b)} : null
      });
    }
    return out;
  }
  function court(id){ return courts().filter(function(c){ return c.id == id; })[0]; }
  function todayMatches(){ var d = todayStr(); return matches().filter(function(m){ return m.sess === d; }); }
  function games(id){ return todayMatches().filter(function(m){ return m.a.indexOf(id) > -1 || m.b.indexOf(id) > -1; }).length; }
  function lastFree(id){
    var ms = todayMatches().filter(function(m){ return m.a.indexOf(id) > -1 || m.b.indexOf(id) > -1; });
    return ms.length ? Math.max.apply(null, ms.map(function(m){ return m.t; })) : (presentMap()[id] || Date.now());
  }
  function onCourt(){ var s = {}; courts().forEach(function(c){ if (c.match) c.match.a.concat(c.match.b).forEach(function(i){ s[i] = 1; }); }); return s; }
  function reserved(){ var s = {}; courts().forEach(function(c){ if (c.draft) c.draft.a.concat(c.draft.b).forEach(function(i){ if (i) s[i] = 1; }); }); return s; }
  function queue(){
    var busy = onCourt(), res = reserved();
    return presentIds().filter(function(id){ return !busy[id] && !res[id] && st().members[id]; })
      .sort(function(x,y){ return games(x) - games(y) || lastFree(x) - lastFree(y); });
  }
  function gameState(pts){
    var s = [0,0]; pts.forEach(function(p){ s[p]++; });
    var T = +cfg().target || 21, C = +cfg().cap || 0, done = false, w = null;
    [0,1].forEach(function(p){ var o = 1 - p; if ((s[p] >= T && s[p] - s[o] >= 2) || (C && s[p] >= C)){ done = true; w = p; } });
    return {s:s, done:done, w:w};
  }

  // ---------- UI state ----------
  var ui = {mode:'mabar', tab:'sesi', period:'hari', sortBy:'rating', draftCourt:null, activeSlot:null, pendingRender:false};
  var ORDER = [['a',0],['a',1],['b',0],['b',1]];
  function firstEmpty(c){ for (var i = 0; i < ORDER.length; i++){ if (!c.draft[ORDER[i][0]][ORDER[i][1]]) return ORDER[i]; } return null; }

  function toast(msg){ var el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function(){ el.hidden = true; }, 2800); }

  // ---------- Header ----------
  function renderTop(){
    var c = cfg(), A = store.isAdmin;
    var status = store.mode === 'local' ? '<span class="statusdot local">Mode lokal</span>'
      : (store.online ? '<span class="statusdot">Online</span>' : '<span class="statusdot off">Offline</span>');
    var auth = VIEW ? '<span class="statusdot local" style="--x:0">Tampilan penonton</span>' : (A ? '<span class="tag">Panitia</span>' : '');
    var theme = (function(){ try { return localStorage.getItem('skor-tema') || 'auto'; } catch(e){ return 'auto'; } })();
    $('top').innerHTML =
      '<div class="brand"><b>' + esc(c.name || 'Skor Mabar') + '</b><span>' + esc(c.sport || 'Komunitas raket') + (c.place ? ', ' + esc(c.place) : '') + '</span></div>' +
      '<div class="seg" role="group" aria-label="Mode"><button data-mode="mabar" aria-pressed="' + (ui.mode === 'mabar') + '">Mabar</button><button data-mode="turnamen" aria-pressed="' + (ui.mode === 'turnamen') + '">Turnamen</button></div>' +
      '<div class="seg theme" role="group" aria-label="Tema"><button data-theme-set="auto" aria-pressed="' + (theme === 'auto') + '" aria-label="Tema otomatis">Auto</button><button data-theme-set="light" aria-pressed="' + (theme === 'light') + '" aria-label="Tema terang">☀︎</button><button data-theme-set="dark" aria-pressed="' + (theme === 'dark') + '" aria-label="Tema gelap">☾</button></div>' +
      status + auth;
  }
  function renderNav(){
    var A = store.isAdmin, tabs;
    if (ui.mode === 'mabar'){
      tabs = [['sesi', VIEW ? 'Skor langsung' : 'Sesi hari ini'],['klasemen','Klasemen'],['anggota', VIEW ? 'Pemain' : 'Anggota']];
      if (A) tabs.push(['bagikan','Bagikan ke penonton'], ['pengaturan','Pengaturan']);
    } else {
      tabs = [['tlist','Daftar turnamen']];
      if (A) tabs.push(['tbaru','Buat turnamen']);
    }
    if (!tabs.some(function(t){ return t[0] === ui.tab; })) ui.tab = tabs[0][0];
    $('subnav').innerHTML = '<div class="seg glass" role="tablist">' + tabs.map(function(t){ return '<button data-tab="' + t[0] + '" aria-pressed="' + (ui.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }

  // ---------- Setup ----------
  function viewSetup(){
    if (VIEW) return '<div class="panel glass empty-state center"><h2>Belum ada data</h2><p class="muted">Panitia belum menyiapkan komunitas ini. Coba buka lagi nanti.</p></div>';
    if (store.mode === 'cloud' && !store.uid) return '<div class="panel glass empty-state center"><h2>Menghubungkan…</h2><p class="muted">Menyiapkan perangkat panitia.</p></div>';
    return '<div class="panel glass empty-state"><h2>Siapkan komunitas</h2><p class="muted">Perangkat yang menyiapkan komunitas otomatis menjadi perangkat panitia. Tidak perlu membuat akun.</p>' + settingsForm({name:'', sport:'Badminton', place:'', courts:3, target:21, cap:30, minMonthly:8}) +
      '<label class="field" style="margin-top:12px"><span>Nama perangkat ini</span><input id="devName" placeholder="Misalnya: HP Andi atau Tablet meja panitia" maxlength="30"></label>' +
      '<label class="opt"><input type="checkbox" id="sample"><span><b>Isi dengan data contoh</b><span class="muted">14 anggota dan riwayat 3 minggu untuk mencoba fitur. Bisa dihapus di Pengaturan.</span></span></label>' +
      '<div class="btns"><button class="btn primary" data-setup>Simpan dan mulai</button></div></div>';
  }
  function viewClaim(){
    return '<div class="panel glass empty-state"><h2>Daftarkan perangkat panitia</h2><p class="muted">Perangkat ini belum terdaftar sebagai panitia <b>' + esc(cfg().name || '') + '</b>. Minta kode undangan dari panitia lain (menu Pengaturan), atau masukkan kode pemulihan.</p>' +
      '<div class="formgrid" style="grid-template-columns:1fr"><label class="field"><span>Kode undangan atau pemulihan</span><input id="claimCode" autocomplete="off" autocapitalize="characters" placeholder="Contoh: K7M2QX"></label>' +
      '<label class="field"><span>Nama perangkat ini</span><input id="devName" placeholder="Misalnya: HP Budi" maxlength="30"></label></div>' +
      '<p class="err" id="claimErr" hidden></p><div class="btns"><button class="btn primary" data-claim>Daftarkan</button><a class="btn" href="' + esc(viewerUrl()) + '" style="text-decoration:none">Buka tampilan penonton</a></div></div>';
  }
  function viewBagikan(){
    var url = viewerUrl();
    return '<div class="grid2"><div class="panel glass center"><h3>QR untuk penonton</h3><div class="qrbox" id="qrSmall">' + qrSvg(url) + '</div>' +
      '<p class="url">' + esc(url) + '</p><div class="btns" style="justify-content:center"><button class="btn primary" data-qrfull>Tampilkan layar penuh</button><button class="btn" data-copylink>Salin tautan</button><button class="btn" data-share-link>Bagikan</button></div></div>' +
      '<div class="panel glass"><h3>Cara pakai</h3><p class="muted" style="margin:0 0 8px">Penonton dan peserta tidak perlu memasang aplikasi atau membuat akun. Mereka cukup memindai QR atau membuka tautan ini, lalu bisa melihat skor langsung, antrean, klasemen, dan turnamen. Tampilan penonton tidak bisa mengubah data.</p>' +
      '<p class="muted" style="margin:0 0 8px">Cetak QR ini dan tempel di GOR, atau tampilkan layar penuh di tablet panitia saat sesi dimulai.</p>' +
      (store.mode === 'local' ? '<p class="err">Mode lokal aktif: tautan penonton hanya berfungsi di perangkat ini. Aktifkan mode online (README langkah 2 sampai 4) agar penonton bisa melihat dari HP masing-masing.</p>' : '') + '</div></div>';
  }
  function settingsForm(c){
    return '<div class="formgrid">' +
      '<label class="field"><span>Nama komunitas</span><input id="sName" value="' + esc(c.name) + '" placeholder="Mabar Selasa Malam" maxlength="40"></label>' +
      '<label class="field"><span>Cabang olahraga</span><select id="sSport">' + ['Badminton','Pickleball','Padel','Tenis meja','Lainnya'].map(function(x){ return '<option ' + (c.sport === x ? 'selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Tempat</span><input id="sPlace" value="' + esc(c.place || '') + '" placeholder="GOR Kampus" maxlength="40"></label>' +
      '<label class="field"><span>Jumlah lapangan</span><input id="sCourts" type="number" min="1" max="12" value="' + (c.courts || 3) + '"></label>' +
      '<label class="field"><span>Target poin per gim</span><input id="sTarget" type="number" min="5" max="50" value="' + (c.target || 21) + '"></label>' +
      '<label class="field"><span>Batas poin maksimal (0 = tanpa batas)</span><input id="sCap" type="number" min="0" max="60" value="' + (c.cap == null ? 30 : c.cap) + '"></label>' +
      '<label class="field"><span>Minimal main untuk klasemen bulanan</span><input id="sMin" type="number" min="0" max="50" value="' + (c.minMonthly == null ? 8 : c.minMonthly) + '"></label>' +
      '</div>';
  }
  function readSettings(){
    return {
      name: $('sName').value.trim() || 'Mabar Komunitas', sport: $('sSport').value, place: $('sPlace').value.trim(),
      courts: Math.min(12, Math.max(1, +$('sCourts').value || 3)), target: Math.max(5, +$('sTarget').value || 21),
      cap: Math.max(0, +$('sCap').value || 0), minMonthly: Math.max(0, +$('sMin').value || 0)
    };
  }

  // ---------- Sesi ----------
  function chipTxt(id){ var p = byId(id); return esc(p.name) + ' <small>' + p.rating + '</small>'; }
  function liveRow(side, ids){
    return '<div class="team"><span class="side ' + side + '"></span>' + ids.map(function(id){ return '<span class="chip">' + chipTxt(id) + '</span>'; }).join('') + '<span class="avg">rata-rata ' + Math.round(avg(ids)) + '</span></div>';
  }
  function slotRow(c, side){
    var ids = c.draft[side];
    return '<div class="team"><span class="side ' + side + '"></span>' + ids.map(function(id, i){
      var act = ui.draftCourt === c.id && ui.activeSlot && ui.activeSlot[0] === side && ui.activeSlot[1] === i;
      return id ? '<button class="chip ' + (act ? 'sel' : '') + '" data-slot="' + c.id + ':' + side + ':' + i + '" aria-label="Keluarkan ' + esc(nm(id)) + '">' + chipTxt(id) + ' ✕</button>'
                : '<button class="slot ' + (act ? 'sel' : '') + '" data-slot="' + c.id + ':' + side + ':' + i + '">' + (act ? 'Pilih dari antrean' : '+ Pemain') + '</button>';
    }).join('') + (ids[0] && ids[1] ? '<span class="avg">rata-rata ' + Math.round(avg(ids)) + '</span>' : '') + '</div>';
  }
  function courtCard(c){
    var A = store.isAdmin;
    if (c.match){
      var m = c.match, pa = Math.round(expA(m.a, m.b) * 100), g = gameState(m.pts);
      var h = '<div class="court glass"><div class="chead"><b>Lapangan ' + c.id + '</b><span class="tag live">Berjalan ' + mins(m.start) + ' mnt</span></div>' +
        liveRow('a', m.a) + liveRow('b', m.b) +
        '<div class="vs"><span>Peluang biru ' + pa + '%</span><span class="bar"><i style="width:' + pa + '%"></i></span><span>merah ' + (100 - pa) + '%</span></div>';
      if (A){
        h += '<div class="livebtns"><button class="ptbtn a" data-point="' + c.id + ':0" ' + (g.done ? 'disabled' : '') + ' aria-label="Poin untuk tim biru"><span>+1 Biru</span><b>' + g.s[0] + '</b></button>' +
             '<button class="ptbtn b" data-point="' + c.id + ':1" ' + (g.done ? 'disabled' : '') + ' aria-label="Poin untuk tim merah"><span>+1 Merah</span><b>' + g.s[1] + '</b></button></div>';
      } else {
        h += '<div class="bigscore"><b class="ca">' + g.s[0] + '</b><span>–</span><b class="cb">' + g.s[1] + '</b></div>';
      }
      if (g.done) h += '<div class="gameover">Tim ' + (g.w === 0 ? 'biru' : 'merah') + ' menang ' + Math.max(g.s[0], g.s[1]) + '–' + Math.min(g.s[0], g.s[1]) + (A ? '. Tekan Simpan hasil.' : '.') + '</div>';
      if (A) h += '<div class="btns"><button class="btn primary" data-finish="' + c.id + '">Simpan hasil</button><button class="btn" data-undo="' + c.id + '" ' + (m.pts.length ? '' : 'disabled') + '>Batal poin</button><button class="btn danger" data-abort="' + c.id + '">Batalkan pertandingan</button></div>';
      return h + '</div>';
    }
    if (c.draft && A){
      var full = c.draft.a.concat(c.draft.b).every(Boolean);
      var diff = full ? Math.round(Math.abs(avg(c.draft.a) - avg(c.draft.b))) : 0;
      return '<div class="court glass"><div class="chead"><b>Lapangan ' + c.id + '</b><span class="tag prop">Disusun panitia</span></div>' +
        slotRow(c, 'a') + slotRow(c, 'b') +
        '<p class="hint">' + (full ? 'Selisih rating kedua tim ' + diff + '. Angka ini hanya acuan.' : 'Ketuk slot, lalu pilih pemain di antrean. Ketuk nama yang sudah masuk untuk mengeluarkannya.') + '</p>' +
        '<div class="btns"><button class="btn primary" data-start="' + c.id + '" ' + (full ? '' : 'disabled') + '>Mulai main</button><button class="btn" data-swapsides="' + c.id + '">Tukar sisi</button><button class="btn" data-cancel="' + c.id + '">Batal</button></div></div>';
    }
    return '<div class="court glass"><div class="chead"><b>Lapangan ' + c.id + '</b><span class="tag">' + (c.draft ? 'Sedang disusun' : 'Kosong') + '</span></div>' +
      (A ? '<div class="btns" style="margin-top:0"><button class="btn primary" data-compose="' + c.id + '">Susun pertandingan</button></div>' : '<p class="muted" style="margin:0">Menunggu panitia menyusun pertandingan.</p>') + '</div>';
  }
  function viewSesi(){
    var A = store.isAdmin, qu = queue(), busy = onCourt(), pres = presentIds();
    var never = pres.filter(function(id){ return games(id) === 0 && !busy[id]; }).length;
    var dc = ui.draftCourt && court(ui.draftCourt), canPick = A && dc && dc.draft && firstEmpty(dc);
    var d = new Date();
    var qHtml = qu.length ? qu.map(function(id, i){
      var g = games(id);
      return '<li><span class="rk">' + (i+1) + '</span><span class="nm">' + esc(nm(id)) + '<small>menunggu ' + mins(lastFree(id)) + ' mnt, rating ' + byId(id).rating + '</small></span>' +
        (g === 0 ? '<span class="badge new">Belum main</span>' : '<span class="badge n">' + g + '× main</span>') +
        (canPick ? '<button class="swapin" data-pick="' + id + '" aria-label="Pilih ' + esc(nm(id)) + '">Pilih</button>' : '') + '</li>';
    }).join('') : '<li class="muted">' + (pres.length ? 'Semua pemain hadir sedang bermain atau sudah dipilih.' : 'Belum ada yang absen hadir hari ini.' + (A ? ' Tandai kehadiran di tab Anggota.' : '')) + '</li>';
    var playing = Object.keys(busy).map(function(id){ return esc(nm(id)) + ' (' + games(id) + '×)'; }).join(', ');
    return '<p class="muted" style="margin:0 0 10px">' + ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() + '</p>' +
      '<div class="stats"><div class="stat glass"><b>' + pres.length + '</b><span>pemain hadir</span></div>' +
      '<div class="stat glass"><b>' + todayMatches().length + '</b><span>pertandingan selesai</span></div>' +
      '<div class="stat glass"><b>' + courts().filter(function(c){ return c.match; }).length + '/' + courts().length + '</b><span>lapangan terpakai</span></div>' +
      '<div class="stat glass"><b>' + never + '</b><span>belum main</span></div></div>' +
      '<div class="cols"><div class="courts">' + courts().map(courtCard).join('') + '</div>' +
      '<div class="panel glass"><h3>Antrean</h3><p class="hint" style="margin:-4px 0 8px">' + (canPick ? 'Memilih untuk Lapangan ' + dc.id + '.' : 'Urutan: jumlah main paling sedikit, lalu menunggu paling lama.') + '</p><ul class="q">' + qHtml + '</ul>' +
      '<p class="hint">Sedang main: ' + (playing || '-') + '</p>' +
      '<div class="btns"><button class="btn" data-share-link>Bagikan tautan</button></div></div></div>';
  }

  // ---------- Klasemen ----------
  function stats(fn){
    var S = {};
    matches().filter(fn).forEach(function(m){
      var aw = m.sa > m.sb;
      function add(i, win, pf, pa){ var s = S[i] || (S[i] = {id:i, n:0, w:0, l:0, pf:0, pa:0}); s.n++; win ? s.w++ : s.l++; s.pf += pf; s.pa += pa; }
      m.a.forEach(function(i){ add(i, aw, m.sa, m.sb); });
      m.b.forEach(function(i){ add(i, !aw, m.sb, m.sa); });
    });
    return Object.keys(S).map(function(k){ return S[k]; }).filter(function(s){ return st().members[s.id]; });
  }
  function rankRows(){
    var month = todayStr().slice(0,7), today = todayStr();
    var fn = ui.period === 'hari' ? function(m){ return m.sess === today; } : ui.period === 'bulan' ? function(m){ return (m.sess || '').slice(0,7) === month; } : function(){ return true; };
    var minN = ui.period === 'hari' ? 1 : (ui.period === 'bulan' ? (+cfg().minMonthly || 0) : 1);
    var rows = stats(fn);
    var pct = function(s){ return s.n ? s.w / s.n : 0; };
    rows.sort(ui.sortBy === 'rating' ? function(x,y){ return byId(y.id).rating - byId(x.id).rating; }
      : ui.sortBy === 'menang' ? function(x,y){ return pct(y) - pct(x) || y.n - x.n; } : function(x,y){ return y.n - x.n; });
    return {ok: rows.filter(function(s){ return s.n >= minN; }), low: rows.filter(function(s){ return s.n < minN; }), minN:minN, pct:pct};
  }
  function viewKlasemen(){
    var r = rankRows(), d = new Date();
    var tr = function(s, i, top){ return '<tr class="' + (top && i === 0 ? 'top1' : '') + '"><td>' + (i+1) + '</td><td class="name"><button data-profile="' + s.id + '">' + esc(nm(s.id)) + '</button></td><td>' + s.n + '</td><td>' + s.w + '</td><td>' + s.l + '</td><td>' + Math.round(r.pct(s) * 100) + '%</td><td>' + (s.pf - s.pa > 0 ? '+' : '') + (s.pf - s.pa) + '</td><td><b>' + byId(s.id).rating + '</b></td></tr>'; };
    var head = '<thead><tr><th>#</th><th>Pemain</th><th>Main</th><th>Menang</th><th>Kalah</th><th>% menang</th><th>Selisih poin</th><th>Rating</th></tr></thead>';
    var seg = function(key, val, label, cur){ return '<button data-' + key + '="' + val + '" aria-pressed="' + (cur === val) + '">' + label + '</button>'; };
    return '<div class="toolbar"><div class="seg glass" role="group" aria-label="Periode">' + seg('period','hari','Hari ini',ui.period) + seg('period','bulan',BULAN[d.getMonth()],ui.period) + seg('period','semua','Semua',ui.period) + '</div>' +
      '<div class="seg glass" role="group" aria-label="Urutkan">' + seg('sort','rating','Rating',ui.sortBy) + seg('sort','menang','% menang',ui.sortBy) + seg('sort','main','Paling sering',ui.sortBy) + '</div></div>' +
      '<div class="tw glass"><table>' + head + '<tbody>' + (r.ok.map(function(s,i){ return tr(s,i,true); }).join('') || '<tr><td></td><td colspan="7">Belum ada data pada periode ini.</td></tr>') + '</tbody></table></div>' +
      (r.low.length ? '<h3 style="margin-top:20px">Belum memenuhi minimal ' + r.minN + ' kali main</h3><div class="tw glass"><table>' + head + '<tbody>' + r.low.map(function(s,i){ return tr(s,i,false); }).join('') + '</tbody></table></div>' : '') +
      '<div class="btns"><button class="btn" data-share-rank>Bagikan ke WhatsApp</button></div>' +
      '<p class="hint">Rating dihitung per individu dengan sistem Elo. Menang melawan tim yang lebih kuat menambah rating lebih banyak. Ketuk nama untuk melihat profil.</p>';
  }
  function shareRank(){
    var r = rankRows(), d = new Date();
    var label = ui.period === 'hari' ? 'hari ini' : ui.period === 'bulan' ? BULAN[d.getMonth()] + ' ' + d.getFullYear() : 'sepanjang waktu';
    var lines = ['*Klasemen ' + (cfg().name || 'Mabar') + '*', '(' + label + ', urut ' + (ui.sortBy === 'rating' ? 'rating' : ui.sortBy === 'menang' ? '% menang' : 'jumlah main') + ')', ''];
    r.ok.slice(0, 10).forEach(function(s, i){ lines.push((i+1) + '. ' + nm(s.id) + ': ' + s.w + 'M ' + s.l + 'K, rating ' + byId(s.id).rating); });
    lines.push('', 'Skor langsung: ' + viewerUrl());
    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
  }

  // ---------- Anggota ----------
  function viewAnggota(){
    var A = store.isAdmin, pres = presentMap();
    var list = members().sort(function(a,b){ return a.name.localeCompare(b.name); });
    var hasM = {}; matches().forEach(function(m){ m.a.concat(m.b).forEach(function(i){ hasM[i] = 1; }); });
    var rows = list.map(function(m){
      return '<li><span class="nm"><button data-profile="' + m.id + '">' + esc(m.name) + '</button>' + (m.guest ? ' <span class="badge n">Tamu</span>' : '') + '</span><span class="muted">' + (m.rating || 1500) + '</span>' +
        (A ? (!hasM[m.id] ? '<button class="x" data-delmember="' + m.id + '" aria-label="Hapus ' + esc(m.name) + '">Hapus</button>' : '') + '<button class="sw" role="switch" aria-checked="' + (!!pres[m.id]) + '" data-present="' + m.id + '" aria-label="Hadir ' + esc(m.name) + '"></button>'
           : (pres[m.id] ? '<span class="badge new">Hadir</span>' : '')) + '</li>';
    }).join('') || '<li class="muted">Belum ada anggota.</li>';
    return '<div class="grid2"><div class="panel glass"><h3>' + (A ? 'Absensi hari ini' : 'Anggota') + '</h3>' + (A ? '<p class="hint" style="margin:-4px 0 6px">Kehadiran otomatis kosong lagi keesokan harinya.</p>' : '') +
      '<ul class="mlist">' + rows + '</ul></div>' +
      (A ? '<div class="panel glass"><h3>Tambah pemain</h3><p class="muted" style="margin:0">Pemain baru mulai dengan rating 1500 dan langsung ditandai hadir.</p>' +
        '<div class="form"><input id="newName" placeholder="Nama pemain" maxlength="24"><select id="newType"><option value="anggota">Anggota</option><option value="tamu">Tamu</option></select><button class="btn primary" data-addplayer>Tambah</button></div></div>' : '') + '</div>';
  }

  // ---------- Pengaturan ----------
  function viewPengaturan(){
    var local = store.mode === 'local';
    return '<div class="grid2"><div class="panel glass"><h3>Komunitas</h3>' + settingsForm(cfg()) + '<div class="btns"><button class="btn primary" data-savesettings>Simpan pengaturan</button></div></div>' +
      '<div class="panel glass"><h3>Data</h3><p class="muted" style="margin:0">' + (local ? 'Mode lokal: data hanya tersimpan di browser perangkat ini. Unduh cadangan secara berkala, atau aktifkan mode online (lihat README).' : 'Mode online: data tersimpan di Firebase dan tersinkron ke semua perangkat.') + '</p>' +
      '<div class="btns"><button class="btn" data-export>Unduh cadangan (JSON)</button><label class="btn" style="display:inline-block">Pulihkan dari cadangan<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>' +
      '<div class="btns"><button class="btn danger" data-wipe>Hapus data pemain dan pertandingan</button></div></div>' +
      (store.mode === 'cloud' ? viewDevices() : '') + '</div>';
  }

  function viewDevices(){
    var names = st().ownerNames || {}, owners = st().owners || {};
    var rows = Object.keys(owners).map(function(u){
      var n = names[u] ? names[u].name : 'Perangkat panitia';
      return '<li><span>' + esc(n) + (u === store.uid ? ' <span class="badge n">Perangkat ini</span>' : '') + '</span>' + (u !== store.uid ? '<button class="x" data-revoke="' + u + '">Cabut</button>' : '') + '</li>';
    }).join('');
    return '<div class="panel glass"><h3>Perangkat panitia</h3><p class="muted" style="margin:0">Tidak ada akun. Perangkat panitia dikenali otomatis. Untuk menambah panitia, buat kode undangan lalu masukkan kode itu di HP panitia baru.</p>' +
      '<ul class="pairs" style="margin-top:8px">' + rows + '</ul>' +
      '<div class="btns"><button class="btn primary" data-invite>Buat kode undangan</button><button class="btn" data-newrecovery>Buat kode pemulihan baru</button></div>' +
      '<p class="hint">Kode undangan berlaku 15 menit dan hanya sekali pakai. Kode pemulihan dipakai jika semua perangkat panitia hilang atau datanya terhapus. Simpan di tempat aman.</p></div>';
  }
  function showCode(title, code, note){
    $('dlgBody').innerHTML = '<h2>' + esc(title) + '</h2><p class="muted">' + note + '</p><div class="bigcode">' + esc(fmtCode(code)) + '</div><div class="btns"><button class="btn primary" data-copycode="' + code + '">Salin kode</button><button class="btn" data-close>Tutup</button></div>';
    $('dlg').showModal();
  }
  function makeRecovery(){
    var code = randCode(12);
    return store.getSecrets().then(function(sec){
      var p = [];
      var und = (sec && sec.undangan) || {};
      Object.keys(und).forEach(function(k){ if (und[k] && und[k].pemulihan) p.push(store.setSecret('undangan/' + k, null)); });
      return Promise.all(p);
    }).catch(function(){}).then(function(){ return store.setSecret('undangan/' + code, {exp:4102444800000, pemulihan:true, dibuat:Date.now()}); })
      .then(function(){ showCode('Kode pemulihan', code, 'Catat dan simpan kode ini di tempat aman, misalnya di catatan pribadi pengurus. Kode ini bisa mendaftarkan perangkat baru sebagai panitia kapan saja. Kode pemulihan sebelumnya tidak berlaku lagi.'); });
  }

  // ---------- Profil ----------
  function profile(id){
    var p = byId(id), mine = matches().filter(function(m){ return m.a.indexOf(id) > -1 || m.b.indexOf(id) > -1; });
    var won = function(m){ return (m.a.indexOf(id) > -1) === (m.sa > m.sb); };
    var w = mine.filter(won).length, partners = {};
    mine.forEach(function(m){ var tm = m.a.indexOf(id) > -1 ? m.a : m.b, q = tm.filter(function(x){ return x !== id; })[0]; if (!q) return; partners[q] = partners[q] || {n:0, w:0}; partners[q].n++; if (won(m)) partners[q].w++; });
    var best = Object.keys(partners).map(function(k){ return [k, partners[k]]; }).filter(function(e){ return e[1].n >= 2; })
      .sort(function(a,b){ return b[1].w / b[1].n - a[1].w / a[1].n || b[1].n - a[1].n; })[0];
    var h = [1500].concat(arr(p.hist).map(function(x){ return x.r; }));
    var mn = Math.min.apply(null, h) - 10, mx = Math.max.apply(null, h) + 10;
    var pts = h.map(function(r, i){ return ((i / (h.length - 1 || 1)) * 300).toFixed(1) + ',' + (66 - ((r - mn) / (mx - mn)) * 60).toFixed(1); }).join(' ');
    var last = mine.slice(-5).reverse().map(function(m){
      var inA = m.a.indexOf(id) > -1, tm = inA ? m.a : m.b, op = inA ? m.b : m.a, my = inA ? m.sa : m.sb, th = inA ? m.sb : m.sa;
      var mate = tm.filter(function(x){ return x !== id; })[0];
      return '<li><span><span class="' + (won(m) ? 'w' : 'l') + '">' + (won(m) ? 'M' : 'K') + '</span> ' + (mate ? 'bersama ' + esc(nm(mate)) + ' ' : '') + 'melawan ' + op.map(nm).map(esc).join(' / ') + '</span><span>' + my + '–' + th + '</span></li>';
    }).join('');
    $('dlgBody').innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><h2>' + esc(p.name) + '</h2><span class="muted">' + (p.guest ? 'Tamu' : 'Anggota') + (presentMap()[id] ? ', hadir hari ini' : '') + '</span></div><button class="btn" data-close>Tutup</button></div>' +
      '<div class="kv"><div><b>' + p.rating + '</b><span>rating</span></div><div><b>' + mine.length + '</b><span>total main</span></div><div><b>' + (mine.length ? Math.round(w / mine.length * 100) : 0) + '%</b><span>menang</span></div><div><b>' + games(id) + '</b><span>main hari ini</span></div></div>' +
      '<h3>Perjalanan rating</h3><svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label="Grafik rating"><polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>' +
      '<p style="margin:10px 0">' + (best ? 'Pasangan terbaik: <b>' + esc(nm(best[0])) + '</b>, menang ' + best[1].w + ' dari ' + best[1].n + ' pertandingan.' : 'Belum cukup data untuk pasangan terbaik.') + '</p>' +
      '<h3>Lima pertandingan terakhir</h3><ul class="res">' + (last || '<li>Belum ada pertandingan.</li>') + '</ul>';
    $('dlg').showModal();
  }

  // ---------- Turnamen ----------
  function newTd(){ return {name:'', fmt:'Gugur', jenis:'ganda', picked:{}, ext:[], pairs:[], order:[], affect:false}; }
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
    if (!list.length) return '<div class="panel glass empty-state center"><h2>Belum ada turnamen</h2><p class="muted">' + (A ? 'Buat turnamen di tab Buat turnamen.' : 'Turnamen yang dibuat panitia akan muncul di sini.') + '</p></div>';
    return '<div class="tcards">' + list.map(function(t){
      var ent = arr(t.entries).map(function(e){ return arr(e).map(function(p){ return esc(p.name); }).join(' / '); });
      var link = t.linked ? (t.affect ? 'Terhubung, memengaruhi rating' : 'Terhubung, rating terpisah') : 'Data terpisah';
      return '<div class="tcard glass"><span class="tag ' + (t.status === 'Berlangsung' ? 'live' : '') + '">' + esc(t.status) + '</span> <span class="tag">' + link + '</span>' +
        '<b style="margin-top:8px">' + esc(t.name) + '</b><p class="muted" style="margin:4px 0 0">' + esc(t.fmt) + ', ' + ent.length + ' ' + (t.jenis === 'ganda' ? 'pasangan' : 'peserta') + '</p>' +
        '<details class="tdet"><summary>Daftar unggulan</summary><ol>' + ent.map(function(e){ return '<li>' + e + '</li>'; }).join('') + '</ol></details>' +
        (A ? '<div class="btns"><button class="btn" data-tstatus="' + t.id + '">' + (t.status === 'Pendaftaran' ? 'Mulai turnamen' : t.status === 'Berlangsung' ? 'Tandai selesai' : 'Buka lagi') + '</button><button class="btn danger" data-tdel="' + t.id + '">Hapus</button></div>' : '') + '</div>';
    }).join('') + '</div><p class="hint" style="margin-top:14px">Pencatatan skor per pertandingan turnamen akan ditambahkan pada versi berikutnya.</p>';
  }
  function viewTBaru(){
    var list = members().sort(function(a,b){ return a.name.localeCompare(b.name); });
    var ent = entries(), ganda = td.jenis === 'ganda', paired = {};
    td.pairs.forEach(function(p){ p.forEach(function(i){ paired[i] = 1; }); });
    var free = allT().filter(function(id){ return !paired[id]; });
    var opt = function(sel){ return free.map(function(id, i){ return '<option value="' + id + '" ' + (i === sel ? 'selected' : '') + '>' + esc(tName(id)) + '</option>'; }).join(''); };
    var linked = Object.keys(td.picked).length > 0;
    return '<div class="grid2"><div class="panel glass"><h3>Info turnamen</h3>' +
      '<div class="form"><input data-td="name" value="' + esc(td.name) + '" placeholder="Nama turnamen" aria-label="Nama turnamen" maxlength="60"></div>' +
      '<div class="form"><select id="tFmt" aria-label="Format">' + ['Gugur','Round robin','Grup lalu gugur','Americano'].map(function(f){ return '<option ' + (td.fmt === f ? 'selected' : '') + '>' + f + '</option>'; }).join('') + '</select>' +
      '<select id="tJenis" aria-label="Jenis"><option value="ganda" ' + (ganda ? 'selected' : '') + '>Ganda</option><option value="tunggal" ' + (!ganda ? 'selected' : '') + '>Tunggal</option></select></div>' +
      '<h3 style="margin-top:16px">Peserta dari anggota mabar</h3><p class="muted" style="margin:0">Opsional. Biarkan kosong jika turnamen tidak berhubungan dengan mabar.</p>' +
      '<div class="checks">' + list.map(function(m){ return '<label><input type="checkbox" data-tpick="' + m.id + '" ' + (td.picked[m.id] ? 'checked' : '') + '>' + esc(m.name) + '</label>'; }).join('') + '</div>' +
      '<h3 style="margin-top:16px">Peserta dari luar</h3><div class="form"><input id="extName" placeholder="Nama peserta" maxlength="24"><button class="btn" data-addext>Tambah</button></div>' +
      '<ul class="pairs" style="margin-top:6px">' + td.ext.map(function(e){ return '<li><span>' + esc(e.name) + '</span><button class="x" data-delext="' + e.id + '">Hapus</button></li>'; }).join('') + '</ul>' +
      '<label class="opt" style="margin-top:10px;' + (linked ? '' : 'opacity:.5') + '"><input type="checkbox" data-affect ' + (td.affect ? 'checked' : '') + ' ' + (linked ? '' : 'disabled') + '><span><b>Hasil turnamen memengaruhi rating mabar</b><span class="muted">Biarkan mati jika level atau format turnamen berbeda dengan mabar.</span></span></label></div>' +
      '<div class="panel glass"><h3>' + (ganda ? 'Pasangan dan unggulan' : 'Urutan unggulan') + '</h3><p class="muted" style="margin:0">' + (ganda ? 'Panitia memasangkan peserta, lalu mengatur urutan unggulan dengan tombol panah.' : 'Atur urutan unggulan dengan tombol panah.') + '</p>' +
      (ganda ? '<div class="form"><select id="tp1" aria-label="Peserta pertama">' + opt(0) + '</select><select id="tp2" aria-label="Peserta kedua">' + opt(1) + '</select><button class="btn primary" data-addtpair ' + (free.length < 2 ? 'disabled' : '') + '>Pasangkan</button></div>' : '') +
      '<ol class="pairs seeds" style="margin-top:10px">' + (ent.map(function(x, i){ return '<li><span>' + (i+1) + '. ' + entryName(x) + '</span><button class="mini" data-mv="' + i + ':-1" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Naikkan">↑</button><button class="mini" data-mv="' + i + ':1" ' + (i === ent.length - 1 ? 'disabled' : '') + ' aria-label="Turunkan">↓</button>' + (ganda ? '<button class="x" data-delpairt="' + i + '">Pisahkan</button>' : '') + '</li>'; }).join('') || '<li class="muted">Belum ada.</li>') + '</ol>' +
      (ganda && free.length ? '<p class="hint">Belum berpasangan: ' + free.map(tName).map(esc).join(', ') + '</p>' : '') +
      '<div class="btns"><button class="btn primary" data-createt>Buat turnamen</button></div></div></div>';
  }

  // ---------- Install banner ----------
  var deferredPrompt = null;
  function isStandalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function renderInstall(){
    var el = $('install'), dismissed = false;
    try { dismissed = localStorage.getItem('install-dismissed') === '1'; } catch(e){}
    if (VIEW || isStandalone() || dismissed){ el.hidden = true; return; }
    var share = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';
    if (deferredPrompt){
      el.innerHTML = '<div><b>Pasang aplikasi ini</b><span>Buka langsung dari layar utama, tanpa browser.</span></div><button class="btn primary" data-install>Instal</button><button class="x" data-dismiss-install aria-label="Tutup">✕</button>';
      el.hidden = false;
    } else if (isIOS()){
      el.innerHTML = '<div><b>Pasang di layar utama</b><span>Di Safari, ketuk tombol Bagikan ' + share + ', lalu pilih “Tambahkan ke Layar Utama”.</span></div><button class="x" data-dismiss-install aria-label="Tutup">✕</button>';
      el.hidden = false;
    } else el.hidden = true;
  }
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferredPrompt = e; renderInstall(); });
  window.addEventListener('appinstalled', function(){ deferredPrompt = null; renderInstall(); toast('Aplikasi terpasang.'); });

  // ---------- Render ----------
  function isTyping(){ var a = document.activeElement; return a && a.matches && a.matches('#app input[type=text],#app input:not([type]),#app input[type=number],#app select,#app textarea'); }
  function render(){
    ui.pendingRender = false;
    renderTop();
    if (!store.ready){ $('subnav').innerHTML = ''; $('app').innerHTML = '<p class="muted">Memuat…</p>'; return; }
    if (store.error && store.error !== ui.lastErr){ ui.lastErr = store.error; toast(store.error); }
    if (!st().settings){ $('subnav').innerHTML = ''; $('app').innerHTML = viewSetup(); return; }
    if (!VIEW && !store.isAdmin){ $('subnav').innerHTML = ''; $('app').innerHTML = store.uid ? viewClaim() : viewSetup(); return; }
    renderNav();
    var v = {sesi:viewSesi, klasemen:viewKlasemen, anggota:viewAnggota, pengaturan:viewPengaturan, bagikan:viewBagikan, tlist:viewTList, tbaru:viewTBaru}[ui.tab];
    $('app').innerHTML = v();
  }
  function softRender(){ if (isTyping()) ui.pendingRender = true; else render(); }
  document.addEventListener('focusout', function(){ setTimeout(function(){ if (ui.pendingRender && !isTyping()) render(); }, 50); });

  // ---------- Actions ----------
  function saveMatch(c){
    var m = c.match, g = gameState(m.pts), sa = g.s[0], sb = g.s[1];
    var ea = expA(m.a, m.b), d = Math.round(24 * ((sa > sb ? 1 : 0) - ea)), t = Date.now(), paths = {};
    paths['matches/' + uid('g')] = {sess:todayStr(), a:m.a, b:m.b, sa:sa, sb:sb, t:t, start:m.start, court:c.id, delta:d};
    function upd(ids, delta){ ids.forEach(function(i){ var p = byId(i), r = (p.rating || 1500) + delta; paths['members/' + i + '/rating'] = r; paths['members/' + i + '/hist'] = arr(p.hist).concat([{t:t, r:r}]).slice(-300); }); }
    upd(m.a, d); upd(m.b, -d);
    paths['courts/' + c.id + '/match'] = null;
    store.update(paths);
    return d;
  }
  function setPresent(id, on){
    var p = st().present, base = p && p.date === todayStr() ? Object.assign({}, p.list || {}) : {};
    if (on) base[id] = Date.now(); else delete base[id];
    return store.update({present:{date:todayStr(), list:base}});
  }
  function sampleData(){
    var names = ['Fajar','Rizky','Bagas','Fikri','Dani','Yusuf','Ilham','Reza','Gilang','Tegar','Andre','Farhan','Nadia','Putri'];
    var mem = {}, skill = {}, ms = {}, ids = [];
    names.forEach(function(n){ var id = uid('m'); ids.push(id); mem[id] = {name:n, rating:1500, hist:[], guest:false, joined:Date.now()}; skill[id] = 1330 + Math.random() * 380; });
    var a2 = function(x){ return (mem[x[0]].rating + mem[x[1]].rating) / 2; };
    for (var w = 3; w >= 1; w--){
      var day = new Date(Date.now() - w * 7 * 864e5), sess = todayStr(day), t = day.setHours(19, 0, 0, 0);
      var pres = ids.filter(function(){ return Math.random() < .82; });
      for (var k = 0; k < 13; k++){
        var four = pres.slice().sort(function(){ return Math.random() - .5; }).slice(0, 4);
        var A = [four[0], four[3]], B = [four[1], four[2]];
        var sk = function(x){ return (skill[x[0]] + skill[x[1]]) / 2; };
        var winA = Math.random() < 1 / (1 + Math.pow(10, (sk(B) - sk(A)) / 400));
        var lo = 9 + Math.floor(Math.random() * 11), sa = winA ? 21 : lo, sb = winA ? lo : 21;
        var e = 1 / (1 + Math.pow(10, (a2(B) - a2(A)) / 400)), d = Math.round(24 * ((winA ? 1 : 0) - e));
        t += 14 * MIN;
        A.forEach(function(i){ mem[i].rating += d; mem[i].hist.push({t:t, r:mem[i].rating}); });
        B.forEach(function(i){ mem[i].rating -= d; mem[i].hist.push({t:t, r:mem[i].rating}); });
        ms[uid('g')] = {sess:sess, a:A, b:B, sa:sa, sb:sb, t:t, start:t - 13 * MIN, court:1 + k % 3, delta:d};
      }
    }
    var list = {}; ids.slice(0, 11).forEach(function(id){ list[id] = Date.now() - (30 + Math.floor(Math.random() * 20)) * MIN; });
    return {members:mem, matches:ms, present:{date:todayStr(), list:list}};
  }
  function download(name, text){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }
  function setTheme(m){
    if (m === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', m);
    try { localStorage.setItem('skor-tema', m); } catch(e){}
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', m === 'dark' ? '#0F1828' : '#1E4F8A');
  }
  try { var tm = localStorage.getItem('skor-tema'); if (tm && tm !== 'auto') setTheme(tm); } catch(e){}

  document.addEventListener('click', function(e){
    var t = e.target.closest('button');
    if (!t) return;
    var d = t.dataset, A = store.isAdmin;
    if (d.mode){ ui.mode = d.mode; ui.tab = d.mode === 'mabar' ? 'sesi' : 'tlist'; return render(); }
    if (d.themeSet){ setTheme(d.themeSet); return renderTop(); }
    if (d.tab){ ui.tab = d.tab; return render(); }
    if (d.period){ ui.period = d.period; return render(); }
    if (d.sort){ ui.sortBy = d.sort; return render(); }
    if (d.profile) return profile(d.profile);
    if (t.hasAttribute('data-close')) return $('dlg').close();
    if (t.hasAttribute('data-install')){ if (deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.finally(function(){ deferredPrompt = null; renderInstall(); }); } return; }
    if (t.hasAttribute('data-dismiss-install')){ try { localStorage.setItem('install-dismissed', '1'); } catch(err){} return renderInstall(); }
    if (t.hasAttribute('data-share-link')){
      var url = viewerUrl();
      if (navigator.share) navigator.share({title: cfg().name || 'Skor Mabar', text:'Lihat skor langsung dan antrean mabar:', url:url}).catch(function(){});
      else window.open('https://wa.me/?text=' + encodeURIComponent('Lihat skor dan antrean mabar: ' + url), '_blank');
      return;
    }
    if (t.hasAttribute('data-share-rank')) return shareRank();

    if (t.hasAttribute('data-copylink') || d.copycode){
      var txt = d.copycode ? fmtCode(d.copycode) : viewerUrl();
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ toast('Tersalin.'); }).catch(function(){ prompt('Salin teks ini:', txt); });
      return;
    }
    if (t.hasAttribute('data-qrfull')){
      $('dlgBody').innerHTML = '<div class="center"><h2>' + esc(cfg().name || 'Skor langsung') + '</h2><p class="muted">Pindai untuk melihat skor langsung. Tidak perlu instal aplikasi.</p><div class="qrbox big">' + qrSvg(viewerUrl()) + '</div><p class="url">' + esc(viewerUrl()) + '</p><div class="btns" style="justify-content:center"><button class="btn" data-close>Tutup</button></div></div>';
      $('dlg').classList.add('wide'); $('dlg').showModal(); return;
    }
    if (t.hasAttribute('data-claim')){
      var code = normCode($('claimCode').value), errc = $('claimErr');
      if (!code){ $('claimCode').focus(); return; }
      t.disabled = true; errc.hidden = true;
      store.claim(code, $('devName').value.trim()).then(function(){ toast('Perangkat terdaftar sebagai panitia.'); render(); })
        .catch(function(){ errc.textContent = 'Kode tidak berlaku. Periksa kembali, atau minta kode undangan baru.'; errc.hidden = false; t.disabled = false; });
      return;
    }
    if (t.hasAttribute('data-setup') && !st().settings && !VIEW){
      var s0 = readSettings(), sample = $('sample') && $('sample').checked, dev = ($('devName') && $('devName').value.trim()) || 'Perangkat pendiri';
      var paths = {settings:s0};
      if (store.mode === 'cloud'){ paths['owners/' + store.uid] = 'pendiri'; paths['ownerNames/' + store.uid] = {name:dev, at:Date.now()}; }
      if (sample){ var sd = sampleData(); paths.members = sd.members; paths.matches = sd.matches; paths.present = sd.present; }
      t.disabled = true;
      store.update(paths).then(function(){ ui.tab = 'sesi'; render(); toast('Komunitas siap.'); if (store.mode === 'cloud') makeRecovery(); })
        .catch(function(){ t.disabled = false; toast('Gagal menyimpan. Mungkin komunitas ini sudah disiapkan perangkat lain.'); });
      return;
    }

    if (!A) return;
    // --- Panitia ---
    if (t.hasAttribute('data-invite')){
      var ic = randCode(6);
      store.setSecret('undangan/' + ic, {exp:Date.now() + 15 * MIN, dibuat:Date.now()}).then(function(){
        showCode('Kode undangan panitia', ic, 'Di HP panitia baru, buka aplikasi panitia, lalu masukkan kode ini. Berlaku 15 menit dan hanya sekali pakai.');
      }).catch(function(){ toast('Gagal membuat kode.'); });
      return;
    }
    if (t.hasAttribute('data-newrecovery')){ makeRecovery(); return; }
    if (d.revoke){ if (!confirm('Cabut akses panitia dari perangkat ini?')) return; var rv = {}; rv['owners/' + d.revoke] = null; rv['ownerNames/' + d.revoke] = null; store.update(rv); return render(); }
    if (t.hasAttribute('data-savesettings')){ store.update({settings:readSettings()}); toast('Pengaturan tersimpan.'); return render(); }
    if (d.compose){ store.update({['courts/' + d.compose + '/draft']:{a:[0,0], b:[0,0]}}); ui.draftCourt = +d.compose; ui.activeSlot = ['a',0]; return render(); }
    if (d.slot){
      var sp = d.slot.split(':'), c = court(sp[0]); if (!c || !c.draft) return;
      c.draft[sp[1]][+sp[2]] = 0; ui.draftCourt = c.id; ui.activeSlot = [sp[1], +sp[2]];
      store.update({['courts/' + c.id + '/draft']:c.draft}); return render();
    }
    if (d.pick){
      var c2 = court(ui.draftCourt); if (!c2 || !c2.draft) return;
      var s2 = ui.activeSlot; if (!s2 || c2.draft[s2[0]][s2[1]]) s2 = firstEmpty(c2); if (!s2) return;
      c2.draft[s2[0]][s2[1]] = d.pick; ui.activeSlot = firstEmpty(c2);
      store.update({['courts/' + c2.id + '/draft']:c2.draft}); return render();
    }
    if (d.swapsides){ var c3 = court(d.swapsides); store.update({['courts/' + c3.id + '/draft']:{a:c3.draft.b, b:c3.draft.a}}); return render(); }
    if (d.cancel){ store.update({['courts/' + d.cancel + '/draft']:null}); if (ui.draftCourt == d.cancel){ ui.draftCourt = null; ui.activeSlot = null; } return render(); }
    if (d.start){
      var c4 = court(d.start);
      store.update({['courts/' + c4.id]:{match:{a:c4.draft.a, b:c4.draft.b, pts:[], start:Date.now()}}});
      ui.draftCourt = null; ui.activeSlot = null; toast('Lapangan ' + c4.id + ' dimulai.'); return render();
    }
    if (d.point){
      var pp = d.point.split(':'), c5 = court(pp[0]); if (!c5 || !c5.match) return;
      if (gameState(c5.match.pts).done) return;
      if (navigator.vibrate) navigator.vibrate(20);
      store.update({['courts/' + c5.id + '/match/pts']:c5.match.pts.concat([+pp[1]])}); return render();
    }
    if (d.undo){ var c6 = court(d.undo); store.update({['courts/' + c6.id + '/match/pts']:c6.match.pts.slice(0, -1)}); return render(); }
    if (d.finish){
      var c7 = court(d.finish), g = gameState(c7.match.pts);
      if (g.s[0] === g.s[1]){ toast('Skor masih sama. Tambah poin dulu atau batalkan pertandingan.'); return; }
      if (!g.done && !confirm('Gim belum mencapai ' + (cfg().target || 21) + ' poin. Simpan dengan skor ' + g.s[0] + '–' + g.s[1] + '?')) return;
      var dl = saveMatch(c7);
      toast('Hasil tersimpan. Rating tim ' + (dl >= 0 ? 'biru +' + dl : 'merah +' + (-dl)) + '.');
      return render();
    }
    if (d.abort){ if (!confirm('Batalkan pertandingan di Lapangan ' + d.abort + '? Skor tidak disimpan.')) return; store.update({['courts/' + d.abort + '/match']:null}); return render(); }
    if (d.present){
      var id = d.present, on = !presentMap()[id];
      if (!on && onCourt()[id]){ toast('Pemain sedang bermain.'); return; }
      var upd = {};
      if (!on) courts().forEach(function(cc){ if (cc.draft && cc.draft.a.concat(cc.draft.b).indexOf(id) > -1){ upd['courts/' + cc.id + '/draft'] = {a:cc.draft.a.map(function(x){ return x === id ? 0 : x; }), b:cc.draft.b.map(function(x){ return x === id ? 0 : x; })}; } });
      if (Object.keys(upd).length) store.update(upd);
      setPresent(id, on); return render();
    }
    if (t.hasAttribute('data-addplayer')){
      var n = $('newName').value.trim(); if (!n){ $('newName').focus(); return; }
      var mid = uid('m'), pl = {}; pl['members/' + mid] = {name:n, rating:1500, hist:[], guest:$('newType').value === 'tamu', joined:Date.now()};
      store.update(pl); setPresent(mid, true); toast(n + ' ditambahkan dan ditandai hadir.'); render(); $('newName').focus(); return;
    }
    if (d.delmember){ if (!confirm('Hapus ' + nm(d.delmember) + '?')) return; setPresent(d.delmember, false); store.update({['members/' + d.delmember]:null}); return render(); }
    if (t.hasAttribute('data-export')){ var ex = JSON.parse(JSON.stringify(st())); delete ex.owners; delete ex.ownerNames; download('skor-mabar-cadangan-' + todayStr() + '.json', JSON.stringify(ex, null, 2)); return; }
    if (t.hasAttribute('data-wipe')){ if (prompt('Ketik HAPUS untuk menghapus semua pemain, pertandingan, dan turnamen. Pengaturan dan perangkat panitia tetap.') !== 'HAPUS') return; store.update({members:null, matches:null, courts:null, present:null, tournaments:null}); toast('Data dihapus.'); return render(); }
    // Turnamen
    if (t.hasAttribute('data-addext')){ var en = $('extName').value.trim(); if (!en){ $('extName').focus(); return; } td.ext.push({id:uid('x'), name:en}); render(); $('extName').focus(); return; }
    if (d.delext){ td.ext = td.ext.filter(function(x){ return x.id !== d.delext; }); td.pairs = td.pairs.filter(function(p){ return p.indexOf(d.delext) < 0; }); return render(); }
    if (t.hasAttribute('data-addtpair')){ var p1 = $('tp1').value, p2 = $('tp2').value; if (!p1 || !p2 || p1 === p2){ toast('Pilih dua peserta yang berbeda.'); return; } td.pairs.push([p1, p2]); return render(); }
    if (d.delpairt){ td.pairs.splice(+d.delpairt, 1); return render(); }
    if (d.mv){ var mv = d.mv.split(':').map(Number), L = td.jenis === 'ganda' ? td.pairs : td.order, i = mv[0], j = mv[0] + mv[1]; var tmp = L[i]; L[i] = L[j]; L[j] = tmp; return render(); }
    if (t.hasAttribute('data-createt')){
      var ent = entries();
      if (!td.name.trim()){ toast('Isi nama turnamen.'); return; }
      if (ent.length < 2){ toast(td.jenis === 'ganda' ? 'Susun minimal 2 pasangan.' : 'Tambahkan minimal 2 peserta.'); return; }
      var tid = uid('t'), tp = {};
      tp['tournaments/' + tid] = {name:td.name.trim(), fmt:td.fmt, jenis:td.jenis, status:'Pendaftaran', created:Date.now(),
        linked:Object.keys(td.picked).length > 0, affect:td.affect,
        entries:ent.map(function(x){ return (Array.isArray(x) ? x : [x]).map(function(id){ return {id:id, name:tName(id)}; }); })};
      store.update(tp); td = newTd(); ui.tab = 'tlist'; toast('Turnamen dibuat.'); return render();
    }
    if (d.tstatus){ var tt = st().tournaments[d.tstatus], next = tt.status === 'Pendaftaran' ? 'Berlangsung' : tt.status === 'Berlangsung' ? 'Selesai' : 'Berlangsung'; store.update({['tournaments/' + d.tstatus + '/status']:next}); return render(); }
    if (d.tdel){ if (!confirm('Hapus turnamen ini?')) return; store.update({['tournaments/' + d.tdel]:null}); return render(); }
  });

  document.addEventListener('change', function(e){
    var x = e.target;
    if (x.id === 'importFile' && x.files[0]){
      var r = new FileReader();
      r.onload = function(){ try { var obj = JSON.parse(r.result); if (!obj.settings) throw 0; if (!confirm('Ganti data pemain, pertandingan, dan turnamen dengan isi cadangan ini?')) return; store.update({settings:obj.settings, members:obj.members || null, matches:obj.matches || null, courts:obj.courts || null, present:obj.present || null, tournaments:obj.tournaments || null}); toast('Data dipulihkan.'); render(); } catch(err){ toast('File cadangan tidak valid.'); } };
      r.readAsText(x.files[0]); return;
    }
    if (x.matches('[data-tpick]')){ var id = x.dataset.tpick; if (x.checked) td.picked[id] = 1; else { delete td.picked[id]; td.pairs = td.pairs.filter(function(p){ return p.indexOf(id) < 0; }); } if (!Object.keys(td.picked).length) td.affect = false; return render(); }
    if (x.matches('[data-affect]')) td.affect = x.checked;
    if (x.id === 'tFmt') td.fmt = x.value;
    if (x.id === 'tJenis'){ td.jenis = x.value; render(); }
  });
  document.addEventListener('input', function(e){ if (e.target.matches('[data-td="name"]')) td.name = e.target.value; });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    var map = {extName:'[data-addext]', newName:'[data-addplayer]', claimCode:'[data-claim]'};
    var sel = map[e.target.id]; if (sel){ e.preventDefault(); var b = document.querySelector(sel); if (b) b.click(); }
  });
  $('dlg').addEventListener('click', function(e){ if (e.target === $('dlg')) $('dlg').close(); });
  $('dlg').addEventListener('close', function(){ $('dlg').classList.remove('wide'); });

  store.onChange(softRender);
  setInterval(function(){ if (ui.tab === 'sesi' && ui.mode === 'mabar') softRender(); }, 30000);
  render(); renderInstall();
  store.init();
})();
