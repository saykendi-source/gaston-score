# Skor Mabar

Aplikasi web (PWA) untuk komunitas olahraga raket: skor langsung per lapangan, antrean main, absensi, klasemen dengan rating Elo, profil pemain, dan daftar turnamen.

Aplikasi ini terdiri dari dua halaman:

| Halaman | Untuk siapa | Cara akses |
|---|---|---|
| `index.html` (aplikasi panitia) | Panitia atau admin | Dipasang di HP atau tablet panitia |
| `lihat.html` (tampilan penonton) | Peserta dan penonton | Cukup pindai QR atau buka tautan, tanpa instal dan tanpa akun |

**Tidak ada akun dan kata sandi.** Perangkat yang pertama kali menyiapkan komunitas otomatis menjadi perangkat panitia. Panitia lain ditambahkan dengan kode undangan. Penonton hanya bisa melihat dan tidak bisa mengubah data apa pun.

Ada dua mode data:

| Mode | Kapan dipakai | Data tersimpan di |
|---|---|---|
| **Lokal** (bawaan) | Mencoba aplikasi di satu perangkat | Browser perangkat itu |
| **Online** | Penonton melihat skor dari HP masing-masing | Firebase Realtime Database |

---

## Isi folder

```
skor-mabar/
├── index.html              Aplikasi panitia (yang dipasang)
├── lihat.html              Tampilan penonton (dibuka dari QR atau tautan)
├── manifest.webmanifest    Nama, ikon, dan warna aplikasi saat dipasang
├── sw.js                   Service worker (cache agar cepat dan tahan sinyal lemah)
├── css/style.css           Tampilan (tema terang dan gelap)
├── js/config.js            ← SATU-SATUNYA file yang perlu Anda ubah
├── js/store.js             Penyimpanan data (lokal / Firebase)
├── js/app.js               Logika aplikasi
├── js/qrcode.js            Pembuat QR (pustaka MIT, Kazuhiko Arase)
├── icons/                  Ikon aplikasi
├── firebase.json           Pengaturan Firebase Hosting
└── database.rules.json     Aturan keamanan database
```

---

## Langkah 1. Coba di komputer (mode lokal)

Aplikasi harus dibuka lewat server, tidak bisa dengan klik dua kali file `index.html`, karena fitur pemasangan butuh alamat `http://localhost` atau `https://`.

Pilih salah satu:

```bash
# Jika ada Python
cd skor-mabar
python -m http.server 8080

# Jika ada Node.js
cd skor-mabar
npx serve .
```

Buka `http://localhost:8080` (atau alamat yang ditampilkan `serve`). Isi form **Siapkan komunitas**, centang **Isi dengan data contoh** untuk mencoba, lalu tekan **Simpan dan mulai**.

Di mode lokal, tampilan penonton `http://localhost:8080/lihat.html` hanya bisa dicoba di browser yang sama, misalnya di tab lain. Penonton dari HP lain baru bisa melihat setelah mode online aktif.

---

## Langkah 2. Siapkan Firebase (mode online)

Paket gratis Firebase (Spark) sudah cukup untuk komunitas dengan kurang dari 100 perangkat yang membuka aplikasi bersamaan.

### 2a. Buat proyek

1. Buka <https://console.firebase.google.com> dan masuk dengan akun Google.
2. Klik **Tambah proyek**, beri nama (misalnya `skor-mabar`). Google Analytics boleh dimatikan.
3. Di halaman proyek, klik ikon **Web** (`</>`) untuk menambah aplikasi web. Beri nama, **jangan** centang Firebase Hosting dulu, lalu klik **Daftarkan aplikasi**.
4. Salin objek `firebaseConfig` yang ditampilkan. Ini dipakai di langkah 3.

### 2b. Buat database

1. Menu **Build → Realtime Database → Buat database**.
2. Lokasi: **Singapore (asia-southeast1)**, paling dekat dengan Indonesia.
3. Pilih **Mulai dalam mode terkunci**. Aturan yang benar akan dipasang otomatis di langkah 4.
4. Salin alamat database di bagian atas, bentuknya seperti `https://skor-mabar-default-rtdb.asia-southeast1.firebasedatabase.app`.

### 2c. Aktifkan login anonim

Perangkat panitia dikenali lewat login anonim, jadi tidak ada akun yang perlu dibuat.

1. Menu **Build → Authentication → Mulai**.
2. Tab **Sign-in method**, pilih **Anonymous**, aktifkan, lalu **Simpan**.

Selesai. Tidak perlu membuat pengguna apa pun.

---

## Langkah 3. Isi `js/config.js`

Buka `js/config.js` dan ganti `FIREBASE_CONFIG: null` dengan konfigurasi dari langkah 2a. Pastikan ada baris `databaseURL` dari langkah 2b.

```js
window.APP_CONFIG = {
  KOMUNITAS_ID: 'mabar-selasa',
  FIREBASE_CONFIG: {
    apiKey: "AIza....",
    authDomain: "skor-mabar.firebaseapp.com",
    databaseURL: "https://skor-mabar-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "skor-mabar",
    appId: "1:1234567890:web:abcdef"
  }
};
```

`KOMUNITAS_ID` boleh diganti, misalnya `pb-rajawali-2026`. Pakai nama yang tidak mudah ditebak, karena perangkat pertama yang menyiapkan komunitas dengan ID ini akan menjadi panitia. Segera lakukan langkah 5 setelah menerbitkan. Satu proyek Firebase bisa dipakai beberapa komunitas dengan ID berbeda, masing-masing di-hosting dengan `config.js` sendiri.

`apiKey` Firebase memang boleh terlihat publik. Yang melindungi data adalah aturan di `database.rules.json`.

---

## Langkah 4. Terbitkan (hosting)

### Pilihan A: Firebase Hosting (disarankan)

Butuh Node.js (unduh dari <https://nodejs.org>, pilih versi LTS).

```bash
npm install -g firebase-tools
firebase login
cd skor-mabar
firebase use --add          # pilih proyek dari langkah 2a, beri alias "default"
firebase deploy
```

Perintah `firebase deploy` sekaligus memasang aturan keamanan database dan menerbitkan aplikasi. Setelah selesai, alamat aplikasi ditampilkan, misalnya `https://skor-mabar.web.app`.

### Pilihan B: GitHub Pages

1. Buat repositori baru, unggah seluruh isi folder `skor-mabar`.
2. **Settings → Pages**, pilih branch `main` dan folder `/ (root)`, simpan.
3. Aturan database dipasang manual: buka **Realtime Database → tab Rules**, ganti isinya dengan isi file `database.rules.json`, lalu **Publikasikan**.

Alamatnya seperti `https://namaanda.github.io/skor-mabar/`.

---

## Langkah 5. Penggunaan pertama (panitia)

1. Di HP atau tablet panitia, buka alamat aplikasi (misalnya `https://skor-mabar.web.app`).
2. Isi form **Siapkan komunitas**: nama, cabang, tempat, jumlah lapangan, aturan poin, dan nama perangkat ini.
   - Badminton: target 21, batas 30.
   - Pickleball rally scoring: target 11 atau 15, batas 0.
3. Tekan **Simpan dan mulai**. Muncul **kode pemulihan**: catat dan simpan di tempat aman. Kode ini dipakai jika semua perangkat panitia hilang atau datanya terhapus.
4. Tambah anggota di tab **Anggota**.

### Menambah perangkat panitia lain

1. Di perangkat panitia yang sudah terdaftar: **Pengaturan → Buat kode undangan**. Muncul kode 6 huruf, berlaku 15 menit, sekali pakai.
2. Di HP panitia baru: buka alamat aplikasi. Karena belum terdaftar, muncul layar **Daftarkan perangkat panitia**. Masukkan kode tadi dan nama perangkat.
3. Daftar perangkat panitia terlihat di **Pengaturan**, dan akses perangkat lain bisa dicabut dari sana.

Jika HP panitia hilang atau data browsernya terhapus, buka aplikasi di perangkat baru lalu masukkan **kode pemulihan**. Kode pemulihan baru bisa dibuat di Pengaturan, dan kode lama otomatis tidak berlaku.

### Alur setiap sesi mabar

1. **Anggota** → nyalakan sakelar hadir untuk yang datang. Kehadiran otomatis kosong lagi esok hari.
2. **Sesi hari ini** → di lapangan kosong tekan **Susun pertandingan**, ketuk slot, lalu **Pilih** pemain dari antrean.
3. **Mulai main** → catat poin dengan tombol **+1 Biru** dan **+1 Merah**. Penonton melihat skor yang sama secara langsung.
4. Setelah gim selesai, tekan **Simpan hasil**. Rating dan klasemen diperbarui otomatis.

---

## Langkah 6. Pasang aplikasi panitia di HP dan tablet

Hanya panitia yang perlu memasang aplikasi.

### Android (Chrome)
Buka alamat aplikasi. Akan muncul banner **Pasang aplikasi ini → Instal**. Jika tidak muncul, ketuk menu ⋮ → **Instal aplikasi** atau **Tambahkan ke layar utama**.

### iPhone dan iPad (Safari)
Buka alamat aplikasi **di Safari**. Ketuk tombol **Bagikan** (kotak dengan panah ke atas) → **Tambahkan ke Layar Utama** → **Tambah**.

Penting untuk iPhone dan iPad: aplikasi yang dipasang ke layar utama punya penyimpanan terpisah dari Safari. Jadi siapkan komunitas atau masukkan kode undangan **setelah** aplikasinya dipasang, dari ikon di layar utama.

### Tablet panitia di GOR
- Pakai dalam posisi landscape.
- Android: aktifkan **Sematkan aplikasi** (Setelan → Keamanan → Penyematan aplikasi).
- iPad: aktifkan **Akses Terpandu** (Setelan → Aksesibilitas → Akses Terpandu).

---

## Langkah 7. Bagikan ke peserta dan penonton

Buka tab **Bagikan ke penonton** di aplikasi panitia. Di sana ada:

- **QR** yang mengarah ke tampilan penonton (`.../lihat.html`). Cetak dan tempel di GOR.
- **Tampilkan layar penuh**: QR besar untuk ditunjukkan di tablet saat sesi dimulai.
- **Salin tautan** dan **Bagikan**: untuk dikirim ke grup WhatsApp.

Penonton tidak perlu instal apa pun. Tampilan penonton berisi skor langsung, antrean, klasemen, daftar pemain, dan turnamen, dan diperbarui otomatis.

---

## Memperbarui aplikasi

1. Ubah file yang diperlukan.
2. Buka `sw.js`, naikkan versinya, misalnya `skor-mabar-v1` → `skor-mabar-v2`. Tanpa langkah ini, HP anggota tetap memakai versi lama yang tersimpan.
3. Terbitkan ulang (`firebase deploy` atau unggah ke GitHub).
4. Anggota mendapat versi baru setelah menutup lalu membuka kembali aplikasinya.

---

## Cadangan data

Tab **Pengaturan → Unduh cadangan (JSON)** menyimpan seluruh data komunitas. Lakukan berkala, terutama di mode lokal. Untuk memulihkan, pakai **Pulihkan dari cadangan**.

---

## Catatan dan batasan versi ini

- **Batas koneksi Firebase gratis:** sekitar 100 perangkat terhubung bersamaan, termasuk perangkat panitia dan TV.
- **iPhone:** getaran dari web tidak didukung. Fitur lain berjalan normal.
- **Tabrakan data:** jika dua panitia mengubah lapangan yang *sama* di detik yang sama, perubahan terakhir yang berlaku. Sebaiknya satu lapangan dipegang satu panitia.
- **Turnamen:** versi ini mencakup pendaftaran peserta, penyusunan pasangan, unggulan, dan status turnamen. Pencatatan skor per pertandingan turnamen dan bagan otomatis direncanakan di versi berikutnya.
- **Keamanan tanpa akun:** siapa pun yang memegang perangkat panitia bisa mengubah data. Kunci layar HP panitia, dan cabut akses perangkat yang hilang dari Pengaturan.
- **Belum ada:** notifikasi giliran main, absen mandiri lewat QR, dan aplikasi jam tangan.

---

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Tombol **Instal** tidak muncul di Android | Aplikasi harus dibuka lewat `https://`. Coba muat ulang halaman sekali, atau pakai menu ⋮ → Instal aplikasi. |
| Muncul **Gagal memuat Firebase** | Periksa `js/config.js`, terutama tanda kutip, koma, dan `databaseURL`. |
| Muncul **Gagal masuk anonim** | Login Anonymous belum diaktifkan (langkah 2c). |
| HP panitia muncul layar **Daftarkan perangkat panitia** | Perangkat ini belum terdaftar, atau data browsernya terhapus. Masukkan kode undangan dari panitia lain atau kode pemulihan. |
| Kode undangan ditolak | Sudah lewat 15 menit atau sudah dipakai. Buat kode baru. |
| Muncul **Gagal menyimpan: permission denied** | Aturan database belum terpasang. Jalankan `firebase deploy` atau salin `database.rules.json` ke tab Rules. |
| Perubahan file tidak terlihat di HP | Versi di `sw.js` belum dinaikkan. Naikkan versinya, terbitkan ulang, lalu tutup-buka aplikasi. |
| Data hilang di mode lokal | Data lokal terhapus jika riwayat browser dibersihkan. Pakai mode online atau rutin unduh cadangan. |

---

## Struktur data (untuk pengembang)

```
komunitas/{KOMUNITAS_ID}/
  settings      {name, sport, place, courts, target, cap, minMonthly}
  members/{id}  {name, rating, hist:[{t,r}], guest, joined}
  matches/{id}  {sess:"YYYY-MM-DD", a:[id,id], b:[id,id], sa, sb, t, start, court, delta}
  courts/{n}    {draft:{a:[id|0,id|0], b:[...]}} atau {match:{a, b, pts:[0|1,...], start}}
  present       {date:"YYYY-MM-DD", list:{memberId: waktuHadir}}
  tournaments/{id} {name, fmt, jenis, status, created, linked, affect, entries:[[{id,name}]]}
  owners/{uid}  kode yang dipakai untuk mendaftar ("pendiri" untuk perangkat pertama)
  ownerNames/{uid} {name, at}
rahasia/{KOMUNITAS_ID}/undangan/{kode}  {exp, pemulihan?}   (hanya bisa dibaca panitia)
```

Rating memakai Elo dengan K = 24. Rating tim adalah rata-rata rating kedua pemain, dan kedua pemain dalam satu tim menerima perubahan rating yang sama.
