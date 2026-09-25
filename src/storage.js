/**
 * storage.js — persistensi via localStorage.
 * Kalau localStorage tidak tersedia (private mode / non-browser),
 * otomatis fallback ke memory store supaya game tetap jalan.
 */

const KEY = 'cfb.save.v1';
const VERSION = 1;

const memory = new Map();
const backend = (() => {
  try {
    const t = '__cfb_probe__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    return {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
    };
  }
})();

function defaults() {
  return {
    version: VERSION,
    coins: 0,
    highScore: 0,
    bestByDiff: { chill: 0, classic: 0, nightmare: 0 },
    difficulty: 'classic',
    skins: ['default'],
    equipped: 'default',
    upgrades: { ammo: 0, magnet: 0, dash: 0, revive: 0 },
    stats: { runs: 0, pipes: 0, coins: 0, kills: 0, bosses: 0, closeCalls: 0, dashes: 0, powerups: 0, playtime: 0 },
    missions: null,
    settings: { sfx: true, music: true, shake: true, flash: true, forceTouch: false },
    seenHowto: false,
  };
}

/** Deep-ish merge supaya save lama tetap kompatibel saat skema bertambah. */
function merge(base, saved) {
  const out = { ...base };
  if (!saved || typeof saved !== 'object') return out;
  for (const k of Object.keys(base)) {
    const bv = base[k];
    const sv = saved[k];
    if (sv === undefined || sv === null) continue;
    if (Array.isArray(bv)) out[k] = Array.isArray(sv) ? sv.slice() : bv;
    else if (typeof bv === 'object' && typeof sv === 'object') out[k] = { ...bv, ...sv };
    else if (typeof bv === typeof sv) out[k] = sv;
  }
  if (saved.missions) out.missions = saved.missions;
  return out;
}

class Store {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = backend.getItem(KEY);
      return merge(defaults(), raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.warn('[storage] gagal membaca save, pakai default:', e);
      return defaults();
    }
  }

  save() {
    try {
      backend.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[storage] gagal menyimpan:', e);
    }
    return this.data;
  }

  /* ---------- koin ---------- */
  get coins() { return this.data.coins; }
  addCoins(n) {
    this.data.coins = Math.max(0, Math.round(this.data.coins + n));
    return this.save().coins;
  }
  spend(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  }

  /* ---------- skor ---------- */
  submitScore(score, diff) {
    const isBest = score > this.data.highScore;
    if (isBest) this.data.highScore = score;
    if (diff && score > (this.data.bestByDiff[diff] || 0)) this.data.bestByDiff[diff] = score;
    this.save();
    return isBest;
  }

  /* ---------- skin ---------- */
  owns(id) { return this.data.skins.includes(id); }
  buySkin(id, price) {
    if (this.owns(id)) return 'owned';
    if (!this.spend(price)) return 'poor';
    this.data.skins.push(id);
    this.save();
    return 'ok';
  }
  equip(id) {
    if (!this.owns(id)) return false;
    this.data.equipped = id;
    this.save();
    return true;
  }
  get equipped() { return this.data.equipped; }

  /* ---------- upgrade ---------- */
  upgradeLevel(id) { return this.data.upgrades[id] || 0; }
  buyUpgrade(id, price, maxLevel) {
    const lvl = this.upgradeLevel(id);
    if (lvl >= maxLevel) return 'max';
    if (!this.spend(price)) return 'poor';
    this.data.upgrades[id] = lvl + 1;
    this.save();
    return 'ok';
  }

  /* ---------- statistik ---------- */
  bumpStats(patch) {
    for (const [k, v] of Object.entries(patch)) {
      this.data.stats[k] = (this.data.stats[k] || 0) + v;
    }
    this.save();
  }

  /* ---------- settings ---------- */
  setSetting(k, v) {
    this.data.settings[k] = v;
    this.save();
  }
  get settings() { return this.data.settings; }

  setDifficulty(d) {
    this.data.difficulty = d;
    this.save();
  }

  markHowtoSeen() {
    this.data.seenHowto = true;
    this.save();
  }

  reset() {
    this.data = defaults();
    try { backend.removeItem(KEY); } catch { /* ignore */ }
    return this.save();
  }
}

export const store = new Store();
export default store;
