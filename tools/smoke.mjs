/**
 * tools/smoke.mjs — smoke test headless (tanpa browser).
 *
 * Menjalankan Game sungguhan dengan stub Canvas2D + bot autopilot untuk
 * memastikan tidak ada runtime error di update maupun render: pipa, musuh,
 * peluru, power-up, semua biome, boss, revive, sampai game over.
 *
 * Jalankan: node tools/smoke.mjs
 */

/* ---------------- stub lingkungan browser ---------------- */
const gradient = { addColorStop() {} };
function makeCtx() {
  const target = { canvas: { width: 480, height: 720 } };
  return new Proxy(target, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

globalThis.performance = globalThis.performance || { now: () => Date.now() };

const { default: store } = await import('../src/storage.js');
const { AudioEngine } = await import('../src/audio.js');
const { Missions } = await import('../src/missions.js');
const { Game } = await import('../src/game.js');
const { SKINS } = await import('../src/skins.js');
const { UPGRADES, BIOMES } = await import('../src/config.js');

const ctx = makeCtx();
const audio = new AudioEngine({ sfx: false, music: false });
const missions = new Missions(store);

const seen = { states: new Set(), biomes: new Set(), overs: [], bosses: 0, revives: 0, buffs: new Set() };
const game = new Game({
  ctx,
  audio,
  store,
  missions,
  hooks: {
    onState: (s) => seen.states.add(s),
    onHud: () => {},
    onBiome: (b) => seen.biomes.add(b.id),
    onBuff: (id) => seen.buffs.add(id),
    onGameOver: (s) => seen.overs.push(s),
    onRevive: () => { seen.revives++; },
  },
});

const DT = 1 / 60;
let frames = 0;

/** Autopilot sederhana: incar celah pipa, sejajarkan diri dengan boss. */
function bot(g, opt = {}) {
  const b = g.bird;
  let target = 360;
  const pipe = g.pipes.find((p) => p.right > b.x - 10);
  if (g.boss && g.boss.state === 'fight') target = g.boss.y;
  else if (pipe) target = pipe.gapY - 6;
  else {
    const pick = g.pickups.find((p) => p.x > b.x && p.x < b.x + 140);
    if (pick) target = pick.y;
  }
  if (b.y > target + 6) g.flap();
  if (opt.shoot && frames % (g.boss ? 8 : 22) === 0) g.shoot();
  if (opt.dash && frames % 260 === 0) g.dash();
}

function run(n, opt = {}) {
  for (let i = 0; i < n; i++) {
    frames++;
    if (game.state === 'ready') game.flap();
    if (game.state === 'play') bot(game, opt);
    game.tick(DT);
    game.render();
    if (game.state === 'dead' && game.overSent && opt.restart) {
      game.start(opt.diff || 'classic');
    }
  }
}

/* ---------------- FASE 1: run normal sampai mati beberapa kali ---------------- */
console.log('• fase 1: run normal + mati + restart');
game.start('classic');
run(60 * 90, { shoot: true, dash: true, restart: true, diff: 'classic' });
console.log(`  frame=${frames} gameOver=${seen.overs.length} skor terakhir=${seen.overs.at(-1)?.score ?? '-'}`);
if (seen.overs.length === 0) throw new Error('tidak ada game over — alur mati tidak teruji');

/* ---------------- FASE 2: mode nightmare ---------------- */
console.log('• fase 2: nightmare');
game.start('nightmare');
run(60 * 40, { shoot: true, dash: true, restart: true, diff: 'nightmare' });

/* ---------------- FASE 3: chill + Second Wind (revive) ---------------- */
console.log('• fase 3: chill + second wind');
store.data.upgrades.revive = 1;
game.start('chill');
run(60 * 40, { shoot: true, dash: true, restart: true, diff: 'chill' });
console.log(`  revive terpakai=${seen.revives}`);

/* ---------------- FASE 4: immortal, kejar semua biome + banyak boss ---------------- */
console.log('• fase 4: immortal — semua biome + boss');
store.data.upgrades.revive = 0;
game.start('classic');
game.die = function immortal() { this.invulnT = 0.4; };
run(60 * 60 * 6, { shoot: true, dash: true });
seen.bosses = game.bossesKilled;
console.log(`  pipa=${game.pipesPassed} skor=${game.score} boss dikalahkan=${game.bossesKilled}`);
console.log(`  biome dikunjungi=${[...seen.biomes].join(', ') || '(belum)'}`);

const missingBiomes = BIOMES.map((b) => b.id).slice(1).filter((id) => !seen.biomes.has(id));
if (missingBiomes.length) console.log(`  ⚠ biome belum tersentuh: ${missingBiomes.join(', ')}`);
if (game.bossesKilled === 0) throw new Error('boss tidak pernah dikalahkan — alur boss tidak teruji');

/* ---------------- FASE 5: ekonomi & shop ---------------- */
console.log('• fase 5: ekonomi, skin, upgrade, misi');
store.data.coins = 99999;
for (const s of SKINS) {
  const res = store.buySkin(s.id, s.price);
  if (res === 'poor') throw new Error(`gagal beli skin ${s.id}`);
  if (!store.equip(s.id)) throw new Error(`gagal equip skin ${s.id}`);
  game.render();
}
for (const u of UPGRADES) {
  for (let l = 0; l < u.max; l++) {
    const res = store.buyUpgrade(u.id, u.prices[l], u.max);
    if (res !== 'ok') throw new Error(`gagal upgrade ${u.id} lvl ${l}: ${res}`);
  }
  if (store.buyUpgrade(u.id, 0, u.max) !== 'max') throw new Error(`${u.id} seharusnya sudah max`);
}
// paksa set misi baru (misi hari ini mungkin sudah selesai di fase sebelumnya)
store.data.missions = null;
missions.ensureToday();
if (missions.list.length !== 3) throw new Error('misi harian harus 3 buah');
const before = store.coins;
for (const m of missions.list) missions.track(m.key, m.goal * 2);
if (!missions.allDone) throw new Error('misi tidak selesai padahal progres melebihi target');
if (store.coins <= before) throw new Error('hadiah misi tidak masuk');
console.log(`  semua skin dibeli (${SKINS.length}), semua trinket max, misi selesai (+${store.coins - before} koin)`);

/* ---------------- FASE 6: render semua state ---------------- */
console.log('• fase 6: render tiap state');
game.toMenu();
run(60);
game.start('classic');
run(30);
game.togglePause(true);
run(30);
game.togglePause(false);
run(30);
delete game.die;
Object.getPrototypeOf(game).die.call(game, 'test');
run(120);

const states = [...seen.states].sort().join(', ');
console.log(`  state teruji: ${states}`);
for (const need of ['menu', 'ready', 'play', 'pause', 'dead']) {
  if (!seen.states.has(need)) throw new Error(`state '${need}' tidak pernah aktif`);
}

/* ---------------- selesai ---------------- */
store.reset();
console.log(`\n✅ SMOKE TEST LULUS — ${frames} frame disimulasikan tanpa error`);
console.log(`   game over: ${seen.overs.length} · boss: ${seen.bosses} · revive: ${seen.revives} · power-up dipakai: ${[...seen.buffs].join(',') || '-'}`);
