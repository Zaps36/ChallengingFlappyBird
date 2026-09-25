# 🐤 Challenging Flappy Bird

Flappy Bird yang dibikin **tidak membosankan**: ada musuh yang menembak, boss, power-up,
biome yang mengubah aturan fisika, combo multiplier, dash, tembak balik, ekonomi koin,
vanity shop, dan misi harian.

**HTML5 Canvas + CSS3 + Vanilla JavaScript (ES6 modules). Tanpa framework, tanpa
build step, tanpa backend, dan tanpa satu pun file gambar/audio** — semua visual
digambar lewat path kanvas dan semua suara disintesis dengan Web Audio API.
Jadi repo ini ringan dan bisa langsung di-host di GitHub Pages.

---

## 🎮 Kontrol

| Aksi | Tombol |
|---|---|
| Flap (terbang) | `Space` / `↑` / `W` / klik / tap |
| Tembak bulu 🪶 | `F` / `J` / `K` / klik kanan / tombol sentuh |
| Dash 💨 | `Shift` / `D` / `→` / tombol sentuh |
| Pause | `P` / `Esc` |
| Mulai / ulangi dari menu | `Space` / `Enter` |

Di perangkat sentuh, tombol **tembak** dan **dash** muncul otomatis
(bisa dipaksa tampil dari menu **Opsi** untuk testing di desktop).

---

## ✨ Fitur

### Sesuai spesifikasi
- **Core gameplay** — gravitasi konstan, flap, pipa atas/bawah bergerak ke kiri,
  **celah menyempit** seiring progres (198px → 118px) dan kecepatan naik (168 → 320 px/s).
- **Enemy entity** — muncul tiap ±10 pipa atau ±17 detik, bergerak ke kiri sambil
  naik-turun / mengejar ketinggian burung (*homing* ringan), menembak proyektil
  setiap 2–3 detik, hilang setelah melewati batas kiri layar.
- **Power-ups** (aktif **8 detik**, mengambang di antara pipa):
  - ⭐ **Double Score** — semua perolehan skor ×2
  - 🛡️ **Immunity** — kebal pipa, musuh, peluru, laser (ada gelembung pelindung + kedip saat mau habis)
  - 🧲 **Coin Magnet** — menarik semua koin/permata di layar (radius bisa di-upgrade)
- **Economy** — 1 pipa = 1 koin, koin acak di jalur terbang, membunuh musuh memberi koin ekstra.
- **Vanity Shop** — beli & pasang skin, harga sesuai spesifikasi untuk *Red Flash* (50)
  dan *Golden Bird* (200), plus 5 skin tambahan.
- **Game states** — Main Menu (judul, Start, Shop, High Score), Gameplay + HUD
  (skor, koin, durasi power-up aktif), Shop (Buy/Equip/Back), Game Over
  (skor akhir, koin didapat, Restart).
- **Persistensi** — `localStorage`: koin, skin yang dimiliki & terpasang, high score,
  upgrade, statistik, misi harian, dan preferensi audio.

### Tambahan kreatif (bagian "anti-bosen")
| Fitur | Kenapa ada |
|---|---|
| 🪶 **Tembak balik** (amunisi terbatas, regen otomatis) | menghindar terus itu pasif; sekarang pemain punya jawaban |
| 🎯 **Parry** — bulu bisa menembak jatuh peluru musuh | momen "NICE!" yang bikin senyum |
| 💨 **Dash** — kebal sesaat, dunia melesat 2,6×, **menabrak musuh = musuh hancur** | skill expression + jalan keluar dari situasi mustahil |
| 🔥 **Combo & multiplier x1–x5** | combo hangus kalau 4,2 detik tidak dapat poin → memaksa agresif, bukan aman terus |
| 😨 **Close Call** | lewat mepet bibir pipa dapat bonus skor. Berani = untung |
| 🌍 **6 biome bergilir tiap 20 pipa** | Fajar → Siang → **Senja** (pipa bergerak vertikal) → **Malam** (gelap, hanya spotlight di sekitar burung) → **Badai** (angin acak menggeser burung + kilat) → **Void** (gravitasi 60%) |
| 👹 **Boss "Mecha Owl"** (pipa ke-25, lalu tiap 32 pipa) | 4 pola serangan: spread, burst terarah, **laser sweep** dengan telegraph, dan memanggil drone. **Hanya bisa mati kalau ditembak** — jadi mekanik tembak wajib dipakai |
| 👾 **3 varian musuh** | drone (homing) → spitter (spread 3 arah, dari 18 pipa) → bomber (bom bergravitasi, dari 34 pipa) |
| 💎 **Permata** (5 koin) | variasi target selain koin biasa |
| 🎚️ **3 tingkat kesulitan** | Chill (celah +26px, koin ×0,6) / Classic / Nightmare (celah −20px, musuh agresif, **koin ×2**) |
| 🛠️ **Trinket (upgrade)** | Kantong Bulu, Kumparan Magnet, Turbin Mini, dan **Second Wind** (revive sekali per run) |
| 📅 **Misi harian** | 3 misi acak-deterministik per hari (seed tanggal), hadiah koin langsung masuk |
| 🎵 **Musik & SFX prosedural** | bassline + lead yang skalanya berubah per biome dan makin rapat saat progres/boss |
| 🧃 **Game feel** | screen shake, hit-stop, partikel, bulu berhamburan saat mati, floating text, speed line saat dash, parallax 4 lapis, crossfade biome |

---

## 🚀 Menjalankan

Karena memakai ES modules, buka lewat HTTP server (bukan `file://`):

```bash
git clone https://github.com/Zaps36/ChallengingFlappyBird.git
cd ChallengingFlappyBird
python3 -m http.server 8000
# buka http://localhost:8000
```

### Deploy ke GitHub Pages

Workflow `.github/workflows/pages.yml` menjalankan smoke test lalu men-deploy
root repo setiap push ke `main`. **Butuh satu langkah manual sekali saja:**

> **Settings → Pages → Source: `GitHub Actions`**

Sebelum langkah itu dilakukan, job *Deploy* akan gagal dengan
`Create Pages site failed: Resource not accessible by integration` — itu normal,
karena `GITHUB_TOKEN` tidak berhak membuat situs Pages sendiri. Setelah Pages
diaktifkan, jalankan ulang workflow (tab **Actions** → *Re-run jobs*) atau push lagi.

Game lalu hidup di `https://<username>.github.io/ChallengingFlappyBird/`.
Alternatif tanpa Actions: Pages → *Deploy from a branch* → `main` / `/ (root)`.

---

## 📁 Struktur

```
index.html            # shell + semua overlay UI (menu, shop, misi, pause, game over)
styles.css            # layout responsif + HUD
src/
  main.js             # bootstrap: kanvas (DPR-aware), input, sambungan Game ↔ UI
  config.js           # SEMUA angka balancing ada di sini
  game.js             # state machine, update, collision, render  (tidak menyentuh DOM)
  ui.js               # semua interaksi DOM (tidak tahu apa pun soal gameplay)
  storage.js          # localStorage + fallback memory
  audio.js            # sintesis SFX & musik (Web Audio API)
  skins.js            # database skin + renderer prosedural
  background.js       # langit, parallax, cuaca, spotlight biome
  particles.js        # sistem partikel
  missions.js         # misi harian
  utils.js            # matematika, random, collision helper
  entities/
    bird.js  pipe.js  enemy.js  boss.js  pickup.js  projectile.js
tools/
  smoke.mjs           # smoke test headless (lihat di bawah)
```

Pemisahan penting: **`game.js` tidak pernah menyentuh DOM** dan **`ui.js` tidak pernah
menyentuh gameplay**. Keduanya berkomunikasi lewat `hooks` dan `actions`. Karena itu
logika game bisa diuji tanpa browser.

---

## 🧪 Smoke test

```bash
node tools/smoke.mjs
```

Menjalankan `Game` yang sesungguhnya dengan stub Canvas2D + bot autopilot,
±32.000 frame, untuk memastikan tidak ada runtime error di seluruh alur:
mati & restart, ketiga tingkat kesulitan, revive Second Wind, keenam biome,
duel boss sampai tumbang, pembelian semua skin & trinket, penyelesaian misi,
dan render di setiap state.

---

## 🔧 Tuning & kustomisasi

**Balancing** — semua di `src/config.js`: gravitasi, kekuatan flap, kecepatan/celah pipa,
rate spawn musuh, HP & pola boss, durasi power-up, ambang combo, harga trinket, definisi biome.

**Menambah skin** — tambahkan objek ke `SKINS` di `src/skins.js`:

```js
{
  id: 'my-skin',
  name: 'Nama Skin',
  flavor: 'Deskripsi singkat.',
  price: 300,
  spriteUrl: null,                    // ← isi path .png untuk pakai gambar
  palette: { body: '#fff', body2: '#ccc', beak: '#f80', wing: '#ddd', belly: '#fff', eye: '#111' },
  glow: '#fff',                       // opsional: aura
  emit: { type: 'sparkle', color: '#fff', rate: 16 },  // opsional: jejak partikel
  extra(ctx, s) { /* dekorasi tambahan, opsional */ },
}
```

**Mengganti placeholder geometris dengan sprite** — isi `spriteUrl` pada skin
(mis. `'./assets/bird-gold.png'`). Renderer otomatis memakai gambar itu begitu
selesai dimuat, dan tetap jatuh kembali ke gambar geometris kalau gagal dimuat.
Ukuran gambar diskalakan ke `r*2.9 × r*2.2`.

---

## 🗺️ Roadmap yang masuk akal berikutnya

- Leaderboard lokal per tingkat kesulitan (sudah ada `bestByDiff` di save, belum ada UI-nya)
- Ghost replay run terbaik
- Boss kedua dengan pola berbeda (arena bergerak / pipa ikut menyerang)
- Sprite sheet opsional + toggle "retro mode"

---

## Lisensi

[MIT](LICENSE) — silakan pakai, modifikasi, dan pamerkan.
