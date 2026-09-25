/**
 * missions.js — misi harian. Tiga misi acak-tapi-deterministik per hari
 * (seed dari tanggal), progres tersimpan di localStorage, hadiah koin
 * langsung masuk saat selesai.
 */

import { hashStr, seededRng, todayKey } from './utils.js';

export const MISSION_POOL = [
  { key: 'pipes',      icon: '🪵', kind: 'sum', goals: [25, 45, 70],  label: (n) => `Lewati ${n} pipa hari ini` },
  { key: 'coins',      icon: '🪙', kind: 'sum', goals: [30, 60, 100], label: (n) => `Kumpulkan ${n} koin` },
  { key: 'kills',      icon: '💥', kind: 'sum', goals: [3, 6, 10],    label: (n) => `Hancurkan ${n} musuh` },
  { key: 'score',      icon: '🏅', kind: 'max', goals: [15, 30, 50],  label: (n) => `Capai skor ${n} dalam satu run` },
  { key: 'closeCalls', icon: '😨', kind: 'sum', goals: [5, 10, 18],   label: (n) => `${n}x Close Call (lewat mepet)` },
  { key: 'powerups',   icon: '⭐', kind: 'sum', goals: [4, 7, 12],    label: (n) => `Ambil ${n} power-up` },
  { key: 'dashes',     icon: '💨', kind: 'sum', goals: [8, 14, 22],   label: (n) => `Pakai dash ${n} kali` },
  { key: 'bosses',     icon: '👹', kind: 'sum', goals: [1, 2, 3],     label: (n) => `Kalahkan ${n} boss` },
  { key: 'gems',       icon: '💎', kind: 'sum', goals: [2, 4, 7],     label: (n) => `Ambil ${n} permata` },
  { key: 'comboMax',   icon: '🔥', kind: 'max', goals: [10, 18, 28],  label: (n) => `Raih combo ${n}` },
];

const REWARD = [45, 75, 120];

export class Missions {
  constructor(store) {
    this.store = store;
    this.ensureToday();
  }

  ensureToday() {
    const date = todayKey();
    const cur = this.store.data.missions;
    if (cur && cur.date === date && Array.isArray(cur.items) && cur.items.length === 3) {
      this.items = cur.items;
      return;
    }
    this.items = this.generate(date);
    this.store.data.missions = { date, items: this.items };
    this.store.save();
  }

  generate(date) {
    const rng = seededRng(hashStr('cfb-mission-' + date));
    const pool = [...MISSION_POOL];
    const items = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(rng() * pool.length);
      const def = pool.splice(idx, 1)[0];
      const tier = Math.min(2, Math.floor(rng() * 3));
      items.push({
        key: def.key,
        tier,
        goal: def.goals[tier],
        reward: REWARD[tier],
        progress: 0,
        done: false,
      });
    }
    return items;
  }

  def(key) { return MISSION_POOL.find((m) => m.key === key); }

  get list() {
    return this.items.map((it) => {
      const d = this.def(it.key);
      return { ...it, icon: d.icon, text: d.label(it.goal), kind: d.kind };
    });
  }

  get allDone() { return this.items.every((i) => i.done); }
  get pendingCount() { return this.items.filter((i) => !i.done).length; }

  /**
   * Catat progres. Dipanggil dari game.
   * @returns {Array} misi yang baru saja selesai (untuk notifikasi + hadiah)
   */
  track(key, amount) {
    const completed = [];
    let dirty = false;
    for (const it of this.items) {
      if (it.key !== key || it.done) continue;
      const kind = this.def(key).kind;
      const next = kind === 'max' ? Math.max(it.progress, amount) : it.progress + amount;
      if (next === it.progress) continue;
      it.progress = Math.min(next, it.goal * 3);
      dirty = true;
      if (it.progress >= it.goal) {
        it.done = true;
        this.store.addCoins(it.reward);
        completed.push({ ...it, text: this.def(key).label(it.goal), icon: this.def(key).icon });
      }
    }
    if (dirty) {
      this.store.data.missions = { date: todayKey(), items: this.items };
      this.store.save();
    }
    return completed;
  }
}

export default Missions;
