/**
 * main.js — bootstrap: kanvas, input, dan menyambung Game <-> UI.
 */

import { W, H } from './config.js';
import store from './storage.js';
import { AudioEngine } from './audio.js';
import { Missions } from './missions.js';
import { Game } from './game.js';
import { UI } from './ui.js';

/* ------------------------- KANVAS ------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

/* ------------------------- SISTEM ------------------------- */
const audio = new AudioEngine(store.settings);
const missions = new Missions(store);

let ui;
const game = new Game({
  ctx,
  audio,
  store,
  missions,
  hooks: {
    onState(state) {
      if (!ui) return;
      if (state === 'menu') ui.show('menu');
      else if (state === 'pause') ui.show('pause');
      else if (state === 'ready' || state === 'play') ui.show('none');
    },
    onHud(d) { if (ui) ui.updateHud(d); },
    onBiome(b) { if (ui) ui.flashBiome(b.name, true); },
    onBuff(id) { if (ui) ui.hintBuff(id); },
    onGameOver(summary) { if (ui) ui.showGameOver(summary); },
  },
});

ui = new UI({
  store,
  audio,
  missions,
  actions: {
    start(diff) {
      audio.unlock();
      game.start(diff);
      ui.flashBiome(game.biome.name, true);
    },
    restart() {
      audio.unlock();
      game.start(store.data.difficulty);
      ui.flashBiome(game.biome.name, true);
    },
    pause() { game.togglePause(true); },
    resume() { game.togglePause(false); },
    quit() { game.toMenu(); },
  },
});

/* ------------------------- INPUT ------------------------- */
const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const SHOOT_KEYS = new Set(['KeyF', 'KeyJ', 'KeyK']);
const DASH_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyD', 'ArrowRight']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

function playing() { return game.state === 'ready' || game.state === 'play'; }

window.addEventListener('keydown', (e) => {
  audio.unlock();

  if (FLAP_KEYS.has(e.code)) {
    e.preventDefault();
    if (e.repeat) return;
    if (playing()) game.flap();
    else if (game.state === 'menu') document.getElementById('btn-start').click();
    else if (game.state === 'dead' && ui.current === 'over') document.getElementById('btn-restart').click();
    return;
  }
  if (SHOOT_KEYS.has(e.code)) {
    e.preventDefault();
    if (playing()) game.shoot();
    return;
  }
  if (DASH_KEYS.has(e.code)) {
    e.preventDefault();
    if (e.repeat) return;
    if (playing()) game.dash();
    return;
  }
  if (PAUSE_KEYS.has(e.code)) {
    e.preventDefault();
    if (game.state === 'play') game.togglePause(true);
    else if (game.state === 'pause') game.togglePause(false);
    return;
  }
  if (e.code === 'Enter' && game.state === 'menu') {
    document.getElementById('btn-start').click();
  }
});

const stage = document.getElementById('stage');

stage.addEventListener('pointerdown', (e) => {
  audio.unlock();
  // abaikan klik yang mengenai tombol/overlay UI
  if (e.target.closest('button') || e.target.closest('.screen')) return;
  if (!playing()) return;
  if (e.button === 2) game.shoot();
  else game.flap();
});

stage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (playing()) game.shoot();
});

// tombol sentuh
function holdButton(id, fn) {
  const node = document.getElementById(id);
  if (!node) return;
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    audio.unlock();
    fn();
  };
  node.addEventListener('pointerdown', handler);
}
holdButton('btn-shoot', () => game.shoot());
holdButton('btn-dash', () => game.dash());

/* auto-pause saat tab disembunyikan */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') game.togglePause(true);
});
window.addEventListener('blur', () => {
  if (game.state === 'play') game.togglePause(true);
});

/* ------------------------- MULAI ------------------------- */
audio.setSfx(store.settings.sfx);
audio.setMusic(store.settings.music);
game.startLoop();

// buka layar "Cara Main" otomatis pada kunjungan pertama
if (!store.data.seenHowto) {
  store.markHowtoSeen();
  ui.show('howto');
}

// bantu debugging dari console
window.CFB = { game, store, audio, ui, missions };
