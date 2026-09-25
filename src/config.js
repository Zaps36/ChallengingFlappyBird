/**
 * config.js — semua angka yang bisa di-tuning ada di sini.
 * Ubah nilai di file ini untuk mengatur balancing tanpa menyentuh logika game.
 */

/* ---------------- DUNIA ---------------- */
export const W = 480;          // lebar logis kanvas
export const H = 720;          // tinggi logis kanvas
export const GROUND_H = 84;    // tinggi tanah
export const CEIL_Y = -40;     // batas atas (burung mati kalau lebih tinggi dari ini)
export const FLOOR_Y = H - GROUND_H;

/* ---------------- BURUNG ---------------- */
export const BIRD = {
  x: 132,
  r: 14,
  gravity: 1750,
  flap: -450,
  maxFall: 780,
  maxRise: -520,
  rotDown: 1.6,
  hoverAmp: 9,
  hoverSpeed: 3.4,
};

/* ---------------- PIPA ---------------- */
export const PIPE = {
  w: 66,
  speed: 168,            // kecepatan awal (px/detik)
  speedMax: 320,
  speedPerScore: 1.45,   // pertambahan kecepatan per skor
  spacing: 238,          // jarak horizontal antar pipa (px)
  spacingMin: 186,
  spacingPerScore: 0.75,
  gap: 198,              // celah awal
  gapMin: 118,
  gapPerScore: 1.4,      // celah menyempit per skor
  margin: 74,            // jarak minimum celah dari langit/tanah
  nearMiss: 20,          // ambang "Close Call" (px)
};

/* ---------------- MUSUH ---------------- */
export const ENEMY = {
  r: 17,
  speed: 62,             // kecepatan tambahan ke kiri (di atas kecepatan dunia)
  hp: 2,
  homing: 74,            // kekuatan mengejar posisi vertikal burung
  driftAmp: 52,
  everyPipes: 10,        // spawn tiap N pipa
  everySeconds: 17,      // atau tiap N detik
  maxAlive: 2,
  shootMin: 2.0,
  shootMax: 3.0,
  bulletSpeed: 235,
  bulletR: 6,
  coinDrop: 3,
  scoreKill: 2,
  minScore: 6,           // musuh mulai muncul setelah skor ini
};

/* ---------------- BOSS ---------------- */
export const BOSS = {
  firstAtPipes: 25,      // boss pertama setelah N pipa
  everyPipes: 32,        // lalu tiap N pipa berikutnya
  hp: 8,
  hpPerBoss: 3,
  hpMax: 26,
  w: 92,
  h: 76,
  x: W - 108,
  bobAmp: 150,
  bobSpeed: 0.9,
  timeout: 26,           // boss kabur kalau tidak mati dalam N detik
  ammoRegenMul: 0.5,     // amunisi mengisi lebih cepat saat boss (biar adil)
  coinEvery: 1.3,        // spawn koin tiap N detik selama duel boss
  coinDrop: 30,
  scoreKill: 25,
  laserCharge: 0.95,
  laserFire: 0.4,
  laserH: 34,
};

/* ---------------- PICKUP ---------------- */
export const COIN = { r: 10, value: 1, chance: 0.62, clusterMax: 3 };
export const GEM = { r: 12, value: 5, chance: 0.1 };

export const POWERUP_DURATION = 8;   // detik (sesuai spesifikasi)
export const POWERUPS = {
  double: { id: 'double', name: 'Double Score', icon: '⭐', color: '#ffd447', weight: 34 },
  shield: { id: 'shield', name: 'Immunity', icon: '🛡️', color: '#6fd6ff', weight: 33 },
  magnet: { id: 'magnet', name: 'Coin Magnet', icon: '🧲', color: '#ff7ad9', weight: 33 },
};
export const POWERUP_SPAWN_CHANCE = 0.2;   // peluang per pipa
export const POWERUP_MIN_GAP_PIPES = 3;    // minimal jeda pipa antar power-up

/* ---------------- COMBO ---------------- */
export const COMBO = {
  decay: 4.2,        // detik tanpa poin sebelum combo hangus
  perStep: 4,        // butuh N combo untuk naik 1 multiplier
  maxMult: 5,
};

/* ---------------- SENJATA & DASH ---------------- */
export const WEAPON = {
  ammo: 3,
  ammoPerUpgrade: 1,
  regen: 1.5,        // detik per 1 amunisi
  cooldown: 0.22,
  speed: 540,
  r: 6,
  dmg: 1,
};

export const DASH = {
  duration: 0.24,
  cooldown: 4.0,
  cooldownPerUpgrade: 0.7,
  worldBoost: 2.6,   // dunia bergerak lebih cepat saat dash
  lift: -120,        // sedikit terangkat agar terasa "melesat"
};

export const MAGNET = { radius: 130, radiusPerUpgrade: 45, pull: 520 };

/* ---------------- KESULITAN ---------------- */
export const DIFFICULTIES = {
  chill: {
    id: 'chill', name: 'Chill', icon: '😌',
    desc: 'Celah lebih lebar, musuh santai. Untuk pemanasan.',
    speedMul: 0.88, gapBonus: 26, gravityMul: 0.92,
    enemyRateMul: 1.5, bulletMul: 0.82, coinMul: 0.6, scoreMul: 1,
  },
  classic: {
    id: 'classic', name: 'Classic', icon: '🐦',
    desc: 'Balance sesuai desain. Cara main yang dimaksudkan.',
    speedMul: 1, gapBonus: 0, gravityMul: 1,
    enemyRateMul: 1, bulletMul: 1, coinMul: 1, scoreMul: 1,
  },
  nightmare: {
    id: 'nightmare', name: 'Nightmare', icon: '💀',
    desc: 'Celah sempit, musuh agresif. Koin x2, buat yang nekat.',
    speedMul: 1.2, gapBonus: -20, gravityMul: 1.08,
    enemyRateMul: 0.62, bulletMul: 1.22, coinMul: 2, scoreMul: 1,
  },
};

/* ---------------- BIOME ----------------
 * Berganti tiap BIOME_EVERY skor. Tiap biome punya modifier gameplay
 * supaya run panjang tidak terasa monoton.
 */
export const BIOME_EVERY = 20;
export const BIOMES = [
  {
    id: 'dawn', name: 'Fajar', mod: null,
    sky: ['#2b3a72', '#7d6aa8', '#ffb37b'],
    cloud: 'rgba(255,225,215,0.55)', hill: '#3a3060', hill2: '#2a2348',
    pipe: ['#7fe08a', '#3fa35c', '#2b7a44'], ground: ['#caa46a', '#8d6a3c'], ink: '#fff',
  },
  {
    id: 'day', name: 'Siang Terik', mod: null,
    sky: ['#3aa0e8', '#8ed6f5', '#d9f4ff'],
    cloud: 'rgba(255,255,255,0.8)', hill: '#5bb36a', hill2: '#3f8f52',
    pipe: ['#8ce89a', '#45b366', '#2f8a4c'], ground: ['#e2c07f', '#a5813f'], ink: '#fff',
  },
  {
    id: 'sunset', name: 'Senja Bergerak', mod: 'drift',
    sky: ['#40265e', '#b2456a', '#ff9d5c'],
    cloud: 'rgba(255,190,170,0.5)', hill: '#4a2350', hill2: '#35163c',
    pipe: ['#ffb36b', '#e0713f', '#a84a25'], ground: ['#a9764f', '#6e4526'], ink: '#fff',
  },
  {
    id: 'night', name: 'Malam Gelap', mod: 'dark',
    sky: ['#05060f', '#0d1330', '#1b2350'],
    cloud: 'rgba(180,200,255,0.18)', hill: '#111634', hill2: '#0a0d22',
    pipe: ['#5fd6c2', '#2b9b8c', '#1b6b60'], ground: ['#2a3152', '#171c33'], ink: '#dfe9ff',
  },
  {
    id: 'storm', name: 'Badai Angin', mod: 'wind',
    sky: ['#16182b', '#2c3350', '#4a5372'],
    cloud: 'rgba(200,210,230,0.32)', hill: '#1d2238', hill2: '#141828',
    pipe: ['#9fb6c9', '#5d7488', '#3d505f'], ground: ['#4a4f63', '#2c3040'], ink: '#eaf2ff',
  },
  {
    id: 'void', name: 'Void Tanpa Gravitasi', mod: 'lowgrav',
    sky: ['#06000f', '#1a0733', '#3b0f52'],
    cloud: 'rgba(200,160,255,0.16)', hill: '#1a0a2e', hill2: '#10061f',
    pipe: ['#c79bff', '#7d43d6', '#4d2391'], ground: ['#2a1245', '#170a28'], ink: '#f0e2ff',
  },
];

export const WIND = { min: -46, max: 74, changeEvery: 2.6 };
export const LOWGRAV = { gravityMul: 0.6, flapMul: 0.78 };
export const DRIFT = { speed: 26, range: 58 };
export const DARK = { vignette: 0.86, spotlight: 168 };

/* ---------------- LAIN-LAIN ---------------- */
export const SHAKE_MAX = 16;
export const MAX_DT = 1 / 30;      // clamp delta time supaya tidak "teleport"
export const REVIVE_IFRAMES = 2.0; // kebal setelah Second Wind


/* ---------------- TRINKET (upgrade kecil di shop) ---------------- */
export const UPGRADES = [
  {
    id: 'ammo', icon: '🪶', name: 'Kantong Bulu', max: 3, prices: [120, 260, 480],
    desc: (lvl) => `Kapasitas amunisi ${WEAPON.ammo + lvl} → ${WEAPON.ammo + lvl + 1}`,
  },
  {
    id: 'magnet', icon: '🧲', name: 'Kumparan Magnet', max: 3, prices: [100, 220, 400],
    desc: (lvl) => `Jangkauan Coin Magnet +${MAGNET.radiusPerUpgrade}px (sekarang ${MAGNET.radius + lvl * MAGNET.radiusPerUpgrade}px)`,
  },
  {
    id: 'dash', icon: '💨', name: 'Turbin Mini', max: 3, prices: [140, 300, 520],
    desc: (lvl) => `Cooldown dash ${(DASH.cooldown - lvl * DASH.cooldownPerUpgrade).toFixed(1)}s → ${(DASH.cooldown - (lvl + 1) * DASH.cooldownPerUpgrade).toFixed(1)}s`,
  },
  {
    id: 'revive', icon: '🪽', name: 'Second Wind', max: 1, prices: [900],
    desc: () => 'Sekali per run: bangkit otomatis setelah mati dengan 2 detik kebal.',
  },
];
