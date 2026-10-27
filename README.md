# Skor Mabar

Aplikasi web (PWA) untuk komunitas olahraga raket (badminton, pickleball, tenis, padel): skor langsung per lapangan, antrean main, absensi, klasemen per mabar, profil pemain dengan rating, dan daftar turnamen.

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

Buka `http://localhost:8080` (atau alamat yang ditampilkan `serve`). Isi form **Siapkan komunitas**, lalu tekan **Simpan dan mulai**.

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
  KOMUNITAS_ID: null,
  FIREBASE_CONFIG: {
    apiKey: "AIza....",
    authDomain: "skor-mabar.firebaseapp.com",
    databaseURL: "https://skor-mabar-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "skor-mabar",
    appId: "1:1234567890:web:abcdef"
  }
};
```

`KOMUNITAS_ID` biarkan `null`. Dengan begitu satu alamat aplikasi bisa dipakai banyak komunitas, masing-masing dengan kode komunitas sendiri (lihat **Banyak komunitas** di langkah 5). Isi dengan kode tertentu hanya jika aplikasi ini khusus untuk satu komunitas.

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

1. Di HP atau tablet panitia, buka alamat aplikasi (misalnya `https://skor-mabar.web.app`). Muncul layar **Komunitas**.
2. Di **Buat komunitas baru**, isi nama komunitas (misalnya `PB Sadewa`) lalu tekan **Buat**. Aplikasi membuat kode komunitas unik, misalnya `pb-sadewa-k7m2`.
3. Isi form **Siapkan komunitas**: nama komunitas dan nama perangkat ini. Tempat (GOR) tidak diisi di sini, melainkan di setiap mabar, karena satu komunitas bisa berpindah-pindah GOR.
4. Tekan **Simpan dan mulai**. Muncul **kode pemulihan**: catat dan simpan di tempat aman. Kode ini dipakai jika semua perangkat panitia hilang atau datanya terhapus.

Selanjutnya aplikasi panitia selalu membuka komunitas terakhir. Tombol **Komunitas** di bagian atas dipakai untuk berpindah komunitas, membuat komunitas lain, atau bergabung ke komunitas lain.

### Banyak komunitas dalam satu aplikasi

Komunitas A (misalnya mabar di GOR Sadewa) dan komunitas B (di GOR Funminton) bisa memakai alamat aplikasi yang sama pada waktu yang sama tanpa saling mengganggu:

- Setiap komunitas membuat komunitasnya sendiri lewat **Buat komunitas baru**, sehingga punya kode komunitas berbeda.
- **Data terpisah sepenuhnya:** pemain, mabar, klasemen, turnamen, panitia, dan wasit. Panitia komunitas A tidak bisa melihat atau mengubah komunitas B dari aplikasinya, dan aturan database menolak perubahan dari perangkat yang bukan panitia atau wasit komunitas itu.
- **QR penonton berisi kode komunitas** (`lihat.html?k=pb-sadewa-k7m2`), jadi penonton komunitas A hanya melihat mabar komunitas A.
- Satu HP bisa terdaftar di beberapa komunitas dan berpindah lewat tombol **Komunitas**.

Catatan: semua komunitas di satu proyek Firebase berbagi batas sekitar 100 koneksi bersamaan pada paket gratis. Jika beberapa komunitas sering main di jam yang sama dengan banyak penonton, pertimbangkan paket Blaze, atau proyek Firebase terpisah (alamat aplikasi dan `config.js` sendiri) untuk setiap komunitas.

### Menambah panitia dan wasit

Ada dua peran perangkat:

| Peran | Bisa melakukan |
|---|---|
| **Panitia** | Semuanya: membuat dan menyelesaikan mabar, absensi, pemain, turnamen, pengaturan, mengundang dan mencabut perangkat |
| **Wasit** | Hanya di mabar yang sedang berlangsung: menyusun pemain di lapangan, mencatat skor, menyimpan hasil. Wasit bisa melihat klasemen dan absensi, tetapi tidak bisa mengubahnya |

Batasan wasit dijaga oleh aturan database, bukan hanya disembunyikan di tampilan.

1. Di perangkat panitia: **Pengaturan → Undang wasit** (atau **Undang panitia**). Muncul QR, kode komunitas, dan kode undangan 6 huruf yang berlaku 15 menit dan sekali pakai. Buat satu undangan untuk setiap HP.
2. Di HP baru:
   - **Android:** pindai QR undangan, isi nama perangkat (misalnya `HP Wasit Lapangan 2`), lalu **Daftarkan**.
   - **iPhone/iPad:** pasang aplikasinya dulu ke layar utama, buka dari ikonnya, lalu di layar **Komunitas → Gabung** isi kode komunitas dan kode undangan.
3. Daftar perangkat panitia dan wasit terlihat di **Pengaturan**, dan aksesnya bisa dicabut dari sana, misalnya setelah acara selesai.

Jika HP panitia hilang atau data browsernya terhapus, buka aplikasi di perangkat baru, pilih **Gabung**, lalu masukkan kode komunitas dan **kode pemulihan**.

### Beberapa wasit di satu mabar: "Lapangan saya"

Di tab **Lapangan**, setiap panitia dan wasit bisa memilih lapangan yang dipegangnya lewat baris **Lapangan saya** (misalnya hanya *Lap. 2*). Setelah dipilih:

- Lapangan miliknya tampil paling atas, dan hanya lapangan itu yang punya tombol susun pemain dan skor. Lapangan lain hanya menampilkan skor, jadi tidak ada salah tekan.
- Setiap lapangan diberi label **Dipegang: HP Wasit 2**. Jika ada dua perangkat memegang lapangan yang sama, muncul peringatan, karena dua orang yang mencatat skor di lapangan yang sama bisa membuat ketukan hilang.
- Pilihan ini tersimpan di HP masing-masing dan bisa diubah kapan saja. Jika tidak ada yang dipilih, semua lapangan bisa dikelola.

### Wasit berganti di lapangan yang sama

Misalnya di Lapangan 1, pertandingan pertama diwasiti A dan pertandingan kedua diwasiti C:

- **Cara wasit sendiri:** setelah **Simpan hasil**, wasit A melepas *Lap. 1* di baris **Lapangan saya**, lalu wasit C memilih *Lap. 1* di HP-nya.
- **Cara panitia:** di kartu Lapangan 1, panitia menekan **Lepas** di samping nama HP A, lalu memilih HP C di **+ Tunjuk wasit…**. Perubahan ini langsung berlaku di HP A dan HP C, tanpa mereka perlu melakukan apa pun. Cara ini juga berguna jika wasit lupa melepas lapangan atau sudah pulang.
- **Cara perangkat tetap:** satu tablet ditaruh di setiap lapangan dan diserahkan dari wasit ke wasit. Tidak ada yang perlu diubah di aplikasi.

Nama perangkat yang menyimpan hasil tercatat sebagai **wasit** di setiap pertandingan. Nama ini tampil di kartu lapangan saat pertandingan berjalan ("Wasit: HP Wasit C"), di daftar **Hasil pertandingan** di bawah klasemen, dan di profil pemain. Karena itu, beri nama perangkat yang jelas saat mendaftar, misalnya `HP Wasit Budi`.

Skor di setiap lapangan disimpan terpisah, jadi wasit Lapangan 1 dan Lapangan 2 bisa mencatat bersamaan dan semua penonton melihat keduanya bergerak langsung.

### Berpindah antara Mabar dan Turnamen

Di bagian atas aplikasi selalu ada tombol **Mabar** dan **Turnamen**. Ketuk untuk berpindah kapan saja, termasuk di tampilan penonton.

### Membuat mabar baru

Setiap sesi main dibuat sebagai satu **mabar** tersendiri, dengan klasemennya sendiri.

1. Mode **Mabar** → tab **Daftar mabar** → **+ Mabar baru**.
2. Isi nama, lokasi GOR (misalnya `GOR Sadewa`; terisi otomatis dari mabar sebelumnya dan bisa diganti), tanggal, cabang, jenis (ganda atau tunggal), jumlah lapangan, dan aturan skor. Aturan otomatis terisi sesuai cabang:

   | Cabang | Aturan bawaan | Bisa diubah |
   |---|---|---|
   | Badminton | 21 poin, maks 30, ganda | Target dan batas poin |
   | Pickleball | 11 poin rally, ganda | Target dan batas poin |
   | Tenis | 1 set 6 game, advantage, tiebreak, tunggal | Jumlah set (1 / best of 3), game per set (4 / 6 / 8), advantage atau golden point, tiebreak |
   | Padel | 1 set 6 game, golden point, tiebreak, ganda | Sama seperti tenis |

3. Centang **Salin daftar hadir** jika pesertanya kurang lebih sama dengan mabar sebelumnya.
4. Tekan **Buat mabar**. Aplikasi langsung membuka tab **Absensi** untuk menandai yang hadir.

Mabar lama tetap tersimpan di daftar. Tekan **Selesaikan** jika sesi sudah usai (mabar selesai tidak bisa diubah, tetapi bisa dibuka lagi), atau **Hapus** untuk membuangnya.

### Alur dalam satu mabar

1. **Absensi** → nyalakan sakelar hadir untuk yang datang. Pemain baru atau tamu bisa langsung ditambahkan di sini.
2. **Lapangan** → di lapangan kosong tekan **Susun pertandingan**, lalu pilih pemain dari dropdown di setiap kolom. Dropdown hanya berisi pemain di antrean, diurutkan dari yang paling sedikit main dan paling lama menunggu, lengkap dengan jumlah main dan lama menunggu.
3. **Mulai main** → catat poin dengan **+1 Biru** dan **+1 Merah**. Untuk tenis dan padel, aplikasi otomatis menghitung 15–30–40, deuce atau golden point, game, set, dan tiebreak.
4. Setelah pertandingan selesai, tekan **Simpan hasil**.
5. **Klasemen** → peringkat hanya untuk mabar ini: menang, kalah, persentase menang, dan selisih poin (atau selisih game untuk tenis dan padel).

### Membuat turnamen baru

Mode **Turnamen** → **+ Turnamen baru** → isi nama, cabang, format, jenis, peserta, lalu susun pasangan dan unggulan.

### Rating pemain

Setiap pemain punya rating yang berlanjut lintas mabar. Rating tidak dipakai untuk klasemen, hanya sebagai acuan panitia saat menyusun tim dan ditampilkan di profil pemain.

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

Buka tab **Bagikan** di mode Mabar aplikasi panitia. Di sana ada:

- **QR** yang mengarah ke tampilan penonton (`.../lihat.html`), berisi daftar semua mabar dan turnamen. Cetak dan tempel di GOR.
- **QR per mabar** (tombol QR di daftar mabar atau di dalam mabar) yang langsung membuka skor mabar itu.
- **Tampilkan layar penuh**: QR besar untuk ditunjukkan di tablet saat sesi dimulai.
- **Salin tautan** dan **Bagikan**: untuk dikirim ke grup WhatsApp.

Penonton tidak perlu instal apa pun. Tampilan penonton berisi daftar mabar, skor langsung, antrean, klasemen per mabar, pemain hadir, dan turnamen, semuanya diperbarui otomatis.

---

## Memperbarui aplikasi

1. Ubah file yang diperlukan.
2. Buka `sw.js`, naikkan versinya, misalnya `skor-mabar-v3` → `skor-mabar-v4`. Tanpa langkah ini, HP anggota tetap memakai versi lama yang tersimpan.
3. Terbitkan ulang (`firebase deploy` atau unggah ke GitHub).
4. Anggota mendapat versi baru setelah menutup lalu membuka kembali aplikasinya.

---

## Menghapus komunitas

Panitia bisa menghapus komunitas yang dibuatnya sendiri:

1. **Pengaturan → Unduh cadangan** dulu jika datanya masih ingin disimpan.
2. **Pengaturan → Hapus komunitas ini**, lalu ketik kode komunitas (misalnya `pb-sadewa-k7m2`) sebagai konfirmasi.

Akibatnya:

- Semua data komunitas itu terhapus permanen: pemain, mabar, hasil, turnamen, perangkat panitia dan wasit, serta kode undangan.
- Tautan dan QR penonton menampilkan **Komunitas ini sudah dihapus**.
- HP panitia dan wasit lain juga melihat pesan yang sama, dan komunitas itu hilang dari daftar **Komunitas** di HP masing-masing.
- Kode komunitas itu tidak bisa dipakai ulang. Untuk mulai lagi, buat komunitas baru dengan kode baru.
- Komunitas lain tidak terpengaruh sama sekali.

Hanya perangkat **panitia** komunitas itu yang bisa menghapusnya. Wasit dan komunitas lain tidak bisa.

---

## Cadangan data

Tab **Pengaturan → Unduh cadangan (JSON)** menyimpan seluruh data komunitas. Lakukan berkala, terutama di mode lokal. Untuk memulihkan, pakai **Pulihkan dari cadangan**.

---

## Catatan dan batasan versi ini

- **Batas koneksi Firebase gratis:** sekitar 100 perangkat terhubung bersamaan, termasuk perangkat panitia dan TV.
- **iPhone:** getaran dari web tidak didukung. Fitur lain berjalan normal.
- **Tabrakan data:** jika dua perangkat mencatat skor di lapangan yang *sama* pada detik yang sama, satu ketukan bisa hilang. Pakai **Lapangan saya** agar satu lapangan dipegang satu wasit.
- **Wasit dan rating:** aturan database mengizinkan wasit memperbarui rating pemain saat menyimpan hasil. Undang wasit yang dipercaya, dan cabut aksesnya setelah acara.
- **Turnamen:** versi ini mencakup pendaftaran peserta, penyusunan pasangan, unggulan, dan status turnamen. Pencatatan skor per pertandingan turnamen dan bagan otomatis direncanakan di versi berikutnya.
- **Keamanan tanpa akun:** siapa pun yang memegang perangkat panitia bisa mengubah data. Kunci layar HP panitia, dan cabut akses perangkat yang hilang dari Pengaturan.
- **Belum ada:** notifikasi giliran main, absen mandiri lewat QR, dan aplikasi jam tangan.

---

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Tombol **Instal** tidak muncul di Android | Aplikasi harus dibuka lewat `https://`. Coba muat ulang halaman sekali, atau pakai menu ⋮ → Instal aplikasi. |
| Penonton melihat **Skor belum bisa dilihat dari HP lain** atau **Belum ada data** padahal panitia sudah main | Aplikasi masih mode lokal (di aplikasi panitia ada label kuning **Mode lokal**). Isi `FIREBASE_CONFIG` di `js/config.js`, terbitkan ulang, lalu siapkan komunitas lagi di HP panitia, karena data mode lokal tidak ikut pindah ke Firebase. |
| Muncul **Gagal memuat Firebase** | Periksa `js/config.js`, terutama tanda kutip, koma, dan `databaseURL`. |
| Muncul **Gagal masuk anonim** | Login Anonymous belum diaktifkan (langkah 2c). |
| HP panitia muncul layar **Daftarkan perangkat ini** | Perangkat ini belum terdaftar di komunitas itu, atau data browsernya terhapus. Masukkan kode undangan atau kode pemulihan. |
| Penonton melihat **Pindai QR dari panitia** | Tautan tidak berisi kode komunitas. Bagikan ulang QR atau tautan dari tab **Bagikan**. |
| Wasit mendapat **permission denied** saat mencatat skor | Aturan database versi baru belum dipasang, atau mabar sudah diselesaikan. Jalankan `firebase deploy` atau salin ulang `database.rules.json`. |
| Kode undangan ditolak | Sudah lewat 15 menit atau sudah dipakai. Buat kode baru. |
| Muncul **Gagal menyimpan: permission denied** | Aturan database belum terpasang. Jalankan `firebase deploy` atau salin `database.rules.json` ke tab Rules. |
| Perubahan file tidak terlihat di HP | Versi di `sw.js` belum dinaikkan. Naikkan versinya, terbitkan ulang, lalu tutup-buka aplikasi. |
| Data hilang di mode lokal | Data lokal terhapus jika riwayat browser dibersihkan. Pakai mode online atau rutin unduh cadangan. |

---

## Struktur data (untuk pengembang)

```
komunitas/{kodeKomunitas}/
  settings      {name}
  members/{id}  {name, rating, hist:[{t,r}], guest, joined}
  events/{id}   {type:"mabar", name, lokasi, date, sport, jenis, courts, status:"aktif"|"selesai", created,
                 rules:{type:"rally", target, cap} | {type:"tennis", sets, games, golden, tb},
                 present:{memberId: waktuHadir},
                 lap/{n}: {draft:{a:[...], b:[...]}, match:{a, b, pts:[0|1,...], start, by:{uid,name}}, pegang:{uid: namaPerangkat}}}
  matches/{id}  {ev, a:[id..], b:[id..], sa, sb, w:0|1, skor:"6–4", t, start, court, delta, wasit, wasitUid, mulaiOleh}
  dihapus       waktu penghapusan (jika komunitas sudah dihapus, hanya kunci ini yang tersisa)
  tournaments/{id} {name, sport, fmt, jenis, status, created, linked, affect, entries:[[{id,name}]]}
  owners/{uid}  kode yang dipakai mendaftar sebagai panitia ("pendiri" untuk perangkat pertama)
  ownerNames/{uid} {name, at}
  wasit/{uid}   kode yang dipakai mendaftar sebagai wasit
  wasitNames/{uid} {name, at}
rahasia/{kodeKomunitas}/undangan/{kode}  {exp, peran:"panitia"|"wasit", pemulihan?}   (hanya bisa dibaca panitia)
```

`sa` dan `sb` berisi total poin (rally) atau total game (tenis/padel), dipakai untuk kolom selisih di klasemen.

Rating memakai Elo dengan K = 24. Rating tim adalah rata-rata rating kedua pemain, dan kedua pemain dalam satu tim menerima perubahan rating yang sama.


---

## Catatan pembaruan

**v7:** panitia bisa melepas dan menunjuk wasit di setiap lapangan; nama wasit tercatat di setiap hasil pertandingan dan tampil di daftar **Hasil pertandingan**; isian tempat dipindah dari data komunitas ke setiap mabar; panitia bisa menghapus komunitasnya sendiri. Aturan database tidak berubah dari v6.

**v6:** banyak komunitas dalam satu aplikasi (layar **Komunitas**, kode komunitas di alamat), peran **wasit** terbatas, **Lapangan saya** dengan label perangkat pemegang, dan kolom **lokasi** di setiap mabar. **Aturan database berubah, jadi wajib dipasang ulang** (`firebase deploy` atau salin `database.rules.json` ke tab Rules). Jika Anda sudah memakai versi lama dengan `KOMUNITAS_ID` tertentu, data lama tetap ada: buka `index.html?k=kodelama` sekali di HP panitia, atau isi kode itu di `KOMUNITAS_ID`.

**v5:** pesan yang jelas di tampilan penonton saat aplikasi masih mode lokal atau gagal memuat data.

**v4:** opsi data contoh dihapus; pemilihan pemain di lapangan memakai dropdown berisi antrean.

**v3:**

Struktur data berubah (mabar kini disimpan per acara di `events`). Data dari versi sebelumnya tidak terbaca otomatis. Jika Anda sudah sempat memakai versi lama, hapus data lewat Pengaturan lalu mulai lagi.
