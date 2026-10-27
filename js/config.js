/*
  KONFIGURASI APLIKASI
  --------------------
  KOMUNITAS_ID   : nama unik komunitas (huruf kecil, angka, tanda minus).
                   Satu proyek Firebase bisa dipakai beberapa komunitas
                   dengan ID berbeda.
  FIREBASE_CONFIG: biarkan null untuk MODE LOKAL (data hanya tersimpan di
                   perangkat ini, cocok untuk mencoba). Isi dengan konfigurasi
                   dari Firebase Console untuk MODE ONLINE (data tersinkron ke
                   semua HP anggota). Lihat README.md langkah 3.
*/
window.APP_CONFIG = {
  KOMUNITAS_ID: 'GASTON',
   FIREBASE_CONFIG: {
    apiKey: "AIzaSyBQNtXwsL2MUmz_LIcJyxwv2oIkX4V5Is4",
    authDomain: "skor-mabar-umy.firebaseapp.com",
    databaseURL: "https://skor-mabar-umy-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "skor-mabar-umy",
    appId: "1:1234567890:web:abcdef"
  }

  /* Contoh setelah diisi:
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyBQNtXwsL2MUmz_LIcJyxwv2oIkX4V5Is4",
    authDomain: "skor-mabar-umy.firebaseapp.com",
    databaseURL: "https://skor-mabar-umy-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "skor-mabar-umy",
    appId: "1:1234567890:web:abcdef"
  }
  */
};
