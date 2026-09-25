/**
 * ui.js — semua interaksi DOM: menu, shop, misi, HUD, game over.
 * Game engine tidak tahu apa-apa soal file ini; komunikasi lewat callback.
 */

import { SKINS, drawSkinPreview } from './skins.js';
import { UPGRADES, DIFFICULTIES, POWERUPS } from './config.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const SCREENS = {
  menu: '#screen-menu',
  shop: '#screen-shop',
  missions: '#screen-missions',
  howto: '#screen-howto',
  settings: '#screen-settings',
  pause: '#screen-pause',
  over: '#screen-over',
  none: null,
};

export class UI {
  /**
   * @param {object} deps {store, audio, missions, actions}
   * actions: {start, resume, quit, restart, openShop, closeShop, onSetting, reset}
   */
  constructor({ store, audio, missions, actions }) {
    this.store = store;
    this.audio = audio;
    this.missions = missions;
    this.actions = actions;
    this.current = 'menu';
    this.shopTab = 'skins';
    this.previewTimer = null;
    this.previews = [];
    this.hudCache = {};

    this.el = {
      hud: $('#hud'),
      score: $('#hud-score'),
      coins: $('#hud-coins'),
      ammo: $('#hud-ammo'),
      combo: $('#hud-combo'),
      comboLabel: $('#hud-combo-label'),
      comboFill: $('#hud-combo-fill'),
      buffs: $('#hud-buffs'),
      biome: $('#hud-biome'),
      dashFill: $('#hud-dash-fill'),
      dashBar: $('.dash-bar'),
      touch: $('#touch-controls'),
      menuHigh: $('#menu-highscore'),
      menuCoins: $('#menu-coins'),
      menuRuns: $('#menu-runs'),
      diffDesc: $('#diff-desc'),
      shopCoins: $('#shop-coins'),
      shopSkins: $('#shop-skins'),
      shopUpgrades: $('#shop-upgrades'),
      shopMsg: $('#shop-msg'),
      missionsCoins: $('#missions-coins'),
      missionsList: $('#missions-list'),
      missionsBadge: $('#missions-badge'),
      overScore: $('#over-score'),
      overBest: $('#over-best'),
      overCoins: $('#over-coins'),
      overDetails: $('#over-details'),
      overNewBest: $('#over-newbest'),
    };

    this.bindMenu();
    this.bindShop();
    this.bindMisc();
    this.refreshMenu();
    this.show('menu');
  }

  /* ============================ SCREENS ============================ */
  show(name) {
    this.current = name;
    for (const [key, sel] of Object.entries(SCREENS)) {
      if (!sel) continue;
      const node = $(sel);
      if (node) node.classList.toggle('hidden', key !== name);
    }
    const playing = name === 'none';
    this.el.hud.classList.toggle('hidden', !playing);
    this.el.hud.setAttribute('aria-hidden', String(!playing));
    this.el.touch.classList.toggle('hidden', !(playing && this.wantTouch()));

    if (name === 'shop') this.startPreviews();
    else this.stopPreviews();

    if (name === 'menu') this.refreshMenu();
    if (name === 'missions') this.renderMissions();
  }

  wantTouch() {
    if (this.store.settings.forceTouch) return true;
    return typeof window !== 'undefined'
      && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);
  }

  click(fn) {
    return (ev) => {
      ev.preventDefault();
      this.audio.unlock();
      this.audio.play('ui');
      fn(ev);
    };
  }

  /* ============================ MENU ============================ */
  bindMenu() {
    $('#btn-start').addEventListener('click', this.click(() => {
      this.show('none');
      this.actions.start(this.store.data.difficulty);
    }));
    $('#btn-shop').addEventListener('click', this.click(() => {
      this.shopReturn = 'menu';
      this.renderShop();
      this.show('shop');
    }));
    $('#btn-missions').addEventListener('click', this.click(() => this.show('missions')));
    $('#btn-howto').addEventListener('click', this.click(() => { this.store.markHowtoSeen(); this.show('howto'); }));
    $('#btn-settings').addEventListener('click', this.click(() => { this.syncSettings(); this.show('settings'); }));
    $('#btn-howto-back').addEventListener('click', this.click(() => this.show('menu')));
    $('#btn-missions-back').addEventListener('click', this.click(() => this.show('menu')));
    $('#btn-settings-back').addEventListener('click', this.click(() => this.show('menu')));

    $$('.diff').forEach((btn) => {
      btn.addEventListener('click', this.click(() => {
        this.store.setDifficulty(btn.dataset.diff);
        this.refreshDiff();
      }));
    });
  }

  refreshMenu() {
    const d = this.store.data;
    this.el.menuHigh.textContent = d.highScore;
    this.el.menuCoins.textContent = d.coins;
    this.el.menuRuns.textContent = d.stats.runs;
    this.refreshDiff();
    this.refreshMissionBadge();
  }

  refreshDiff() {
    const cur = this.store.data.difficulty;
    $$('.diff').forEach((b) => b.classList.toggle('active', b.dataset.diff === cur));
    const def = DIFFICULTIES[cur] || DIFFICULTIES.classic;
    this.el.diffDesc.textContent = `${def.desc}  (koin x${def.coinMul})`;
  }

  refreshMissionBadge() {
    this.missions.ensureToday();
    const pending = this.missions.pendingCount;
    this.el.missionsBadge.classList.toggle('hidden', pending === 0);
    this.el.missionsBadge.textContent = pending || '';
  }

  /* ============================ SHOP ============================ */
  bindShop() {
    $('#btn-shop-back').addEventListener('click', this.click(() => {
      this.show(this.shopReturn || 'menu');
    }));
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', this.click(() => {
        this.shopTab = tab.dataset.tab;
        $$('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        this.el.shopSkins.classList.toggle('hidden', this.shopTab !== 'skins');
        this.el.shopUpgrades.classList.toggle('hidden', this.shopTab !== 'upgrades');
        this.msg('');
      }));
    });
  }

  msg(text, isErr = false) {
    this.el.shopMsg.textContent = text || '\u00a0';
    this.el.shopMsg.classList.toggle('err', isErr);
  }

  renderShop() {
    this.el.shopCoins.textContent = this.store.coins;
    this.renderSkins();
    this.renderUpgrades();
  }

  renderSkins() {
    const wrap = this.el.shopSkins;
    wrap.innerHTML = '';
    this.previews = [];

    for (const skin of SKINS) {
      const owned = this.store.owns(skin.id);
      const active = this.store.equipped === skin.id;

      const card = document.createElement('div');
      card.className = `card${owned ? ' owned' : ''}${active ? ' active' : ''}`;

      const cv = document.createElement('canvas');
      cv.width = 124;
      cv.height = 92;
      const cctx = cv.getContext('2d');
      card.appendChild(cv);
      this.previews.push({ ctx: cctx, id: skin.id, w: cv.width, h: cv.height, locked: !owned });

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = skin.name;
      card.appendChild(name);

      const flavor = document.createElement('div');
      flavor.className = 'flavor';
      flavor.textContent = skin.flavor;
      card.appendChild(flavor);

      const btn = document.createElement('button');
      if (active) {
        btn.className = 'btn btn-equipped';
        btn.textContent = '✓ Terpasang';
        btn.disabled = true;
      } else if (owned) {
        btn.className = 'btn';
        btn.textContent = 'Pakai';
        btn.addEventListener('click', this.click(() => {
          this.store.equip(skin.id);
          this.audio.play('buy');
          this.msg(`${skin.name} dipasang!`);
          this.renderShop();
        }));
      } else {
        const afford = this.store.coins >= skin.price;
        btn.className = `btn ${afford ? 'btn-buy' : ''}`;
        btn.textContent = `${skin.price} 🪙`;
        btn.addEventListener('click', this.click(() => {
          const res = this.store.buySkin(skin.id, skin.price);
          if (res === 'ok') {
            this.store.equip(skin.id);
            this.audio.play('buy');
            this.msg(`${skin.name} dibeli & dipasang! 🎉`);
          } else {
            this.audio.play('deny');
            this.msg(`Koin kurang ${skin.price - this.store.coins} lagi. Terbang dulu!`, true);
          }
          this.renderShop();
        }));
      }
      card.appendChild(btn);
      wrap.appendChild(card);
    }
    this.drawPreviews(0);
  }

  renderUpgrades() {
    const wrap = this.el.shopUpgrades;
    wrap.innerHTML = '';
    for (const up of UPGRADES) {
      const lvl = this.store.upgradeLevel(up.id);
      const maxed = lvl >= up.max;
      const price = maxed ? 0 : up.prices[lvl];

      const row = document.createElement('div');
      row.className = `row${maxed ? ' done' : ''}`;
      row.innerHTML = `
        <div class="ic">${up.icon}</div>
        <div class="body">
          <div class="title">${up.name} ${up.max > 1 ? `<small style="color:#93a4c6">Lv.${lvl}/${up.max}</small>` : ''}</div>
          <div class="desc">${maxed ? 'Sudah maksimal. Mantap.' : up.desc(lvl)}</div>
          ${up.max > 1 ? `<div class="pips">${Array.from({ length: up.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        </div>`;

      const btn = document.createElement('button');
      if (maxed) {
        btn.className = 'btn btn-equipped';
        btn.textContent = '✓ MAX';
        btn.disabled = true;
      } else {
        const afford = this.store.coins >= price;
        btn.className = `btn ${afford ? 'btn-buy' : ''}`;
        btn.textContent = `${price} 🪙`;
        btn.addEventListener('click', this.click(() => {
          const res = this.store.buyUpgrade(up.id, price, up.max);
          if (res === 'ok') {
            this.audio.play('buy');
            this.msg(`${up.name} ditingkatkan!`);
          } else if (res === 'poor') {
            this.audio.play('deny');
            this.msg(`Koin kurang ${price - this.store.coins} lagi.`, true);
          }
          this.renderShop();
        }));
      }
      row.appendChild(btn);
      wrap.appendChild(row);
    }
  }

  startPreviews() {
    if (this.previewTimer) return;
    const t0 = performance.now();
    const loop = () => {
      if (this.current !== 'shop') { this.previewTimer = null; return; }
      this.drawPreviews((performance.now() - t0) / 1000);
      this.previewTimer = requestAnimationFrame(loop);
    };
    this.previewTimer = requestAnimationFrame(loop);
  }

  stopPreviews() {
    if (this.previewTimer) cancelAnimationFrame(this.previewTimer);
    this.previewTimer = null;
  }

  drawPreviews(t) {
    for (const p of this.previews) {
      p.ctx.save();
      if (p.locked) p.ctx.globalAlpha = 0.45;
      drawSkinPreview(p.ctx, p.id, p.w, p.h, t);
      if (p.locked) {
        p.ctx.globalAlpha = 1;
        p.ctx.font = '700 26px "Trebuchet MS", sans-serif';
        p.ctx.textAlign = 'center';
        p.ctx.textBaseline = 'middle';
        p.ctx.fillText('🔒', p.w - 18, 16);
      }
      p.ctx.restore();
    }
  }

  /* ============================ MISI ============================ */
  renderMissions() {
    this.missions.ensureToday();
    this.el.missionsCoins.textContent = this.store.coins;
    const wrap = this.el.missionsList;
    wrap.innerHTML = '';
    for (const m of this.missions.list) {
      const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
      const row = document.createElement('div');
      row.className = `row${m.done ? ' done' : ''}`;
      row.innerHTML = `
        <div class="ic">${m.icon}</div>
        <div class="body">
          <div class="title">${m.text}</div>
          <div class="desc">${m.done ? `✓ Selesai — +${m.reward} 🪙 sudah masuk` : `${Math.min(m.progress, m.goal)} / ${m.goal} &nbsp;·&nbsp; hadiah ${m.reward} 🪙`}</div>
          <div class="prog"><i style="width:${pct}%"></i></div>
        </div>`;
      wrap.appendChild(row);
    }
    this.refreshMissionBadge();
  }

  /* ============================ SETTINGS ============================ */
  bindMisc() {
    $('#btn-pause').addEventListener('click', this.click(() => this.actions.pause()));
    $('#btn-resume').addEventListener('click', this.click(() => this.actions.resume()));
    $('#btn-quit').addEventListener('click', this.click(() => this.actions.quit()));
    $('#btn-restart').addEventListener('click', this.click(() => {
      this.show('none');
      this.actions.restart();
    }));
    $('#btn-over-menu').addEventListener('click', this.click(() => this.actions.quit()));
    $('#btn-over-shop').addEventListener('click', this.click(() => {
      this.shopReturn = 'over';
      this.renderShop();
      this.show('shop');
    }));

    const map = { '#set-sfx': 'sfx', '#set-music': 'music', '#set-shake': 'shake', '#set-flash': 'flash', '#set-touch': 'forceTouch' };
    for (const [sel, key] of Object.entries(map)) {
      const node = $(sel);
      node.addEventListener('change', () => {
        this.store.setSetting(key, node.checked);
        this.audio.unlock();
        if (key === 'sfx') this.audio.setSfx(node.checked);
        if (key === 'music') this.audio.setMusic(node.checked);
        if (key === 'forceTouch') this.el.touch.classList.toggle('hidden', !(this.current === 'none' && this.wantTouch()));
        this.audio.play('ui');
      });
    }

    $('#btn-reset').addEventListener('click', this.click(() => {
      if (this._resetArm) {
        this.store.reset();
        this.missions.ensureToday();
        this._resetArm = false;
        $('#btn-reset').textContent = '🗑️ Reset Progress';
        this.refreshMenu();
        this.syncSettings();
        this.audio.play('deny');
        this.show('menu');
      } else {
        this._resetArm = true;
        $('#btn-reset').textContent = '⚠️ Yakin? Klik lagi untuk hapus';
        setTimeout(() => {
          this._resetArm = false;
          const b = $('#btn-reset');
          if (b) b.textContent = '🗑️ Reset Progress';
        }, 4000);
      }
    }));
  }

  syncSettings() {
    const s = this.store.settings;
    $('#set-sfx').checked = !!s.sfx;
    $('#set-music').checked = !!s.music;
    $('#set-shake').checked = !!s.shake;
    $('#set-flash').checked = !!s.flash;
    $('#set-touch').checked = !!s.forceTouch;
  }

  /* ============================ HUD ============================ */
  updateHud(d) {
    const c = this.hudCache;
    if (d.score !== c.score) {
      this.el.score.textContent = d.score;
      this.el.score.classList.remove('pump');
      // reflow supaya animasi bisa diulang
      void this.el.score.offsetWidth;
      this.el.score.classList.add('pump');
      c.score = d.score;
    }
    if (d.coins !== c.coins) { this.el.coins.textContent = d.coins; c.coins = d.coins; }
    if (d.ammo !== c.ammo || d.maxAmmo !== c.maxAmmo) {
      this.el.ammo.textContent = `${d.ammo}/${d.maxAmmo}`;
      c.ammo = d.ammo; c.maxAmmo = d.maxAmmo;
    }

    const showCombo = d.combo > 0;
    if (showCombo !== c.showCombo) {
      this.el.combo.classList.toggle('hidden', !showCombo);
      c.showCombo = showCombo;
    }
    if (showCombo) {
      const label = `COMBO ${d.combo} · x${d.mult}`;
      if (label !== c.comboLabel) { this.el.comboLabel.textContent = label; c.comboLabel = label; }
      this.el.comboFill.style.transform = `scaleX(${d.comboPct.toFixed(3)})`;
    }

    this.el.dashFill.style.transform = `scaleX(${d.dashPct.toFixed(3)})`;
    if (d.dashReady !== c.dashReady) {
      this.el.dashBar.classList.toggle('ready', d.dashReady);
      c.dashReady = d.dashReady;
    }

    const key = d.buffs.map((b) => b.id).join(',');
    if (key !== c.buffKey) {
      this.el.buffs.innerHTML = '';
      this.buffNodes = {};
      for (const b of d.buffs) {
        const node = document.createElement('div');
        node.className = `buff ${b.id}`;
        node.innerHTML = `<span class="ic">${b.icon}</span><span class="t">0.0s</span><span class="meter"><i></i></span>`;
        this.el.buffs.appendChild(node);
        this.buffNodes[b.id] = { t: node.querySelector('.t'), m: node.querySelector('.meter i') };
      }
      c.buffKey = key;
    }
    for (const b of d.buffs) {
      const n = this.buffNodes && this.buffNodes[b.id];
      if (!n) continue;
      n.t.textContent = `${b.left.toFixed(1)}s`;
      n.m.style.width = `${(b.pct * 100).toFixed(1)}%`;
    }
  }

  /**
   * Label di tengah atas kanvas.
   * @param {string} text
   * @param {boolean} sticky true = jadi label tetap (nama biome),
   *                         false = tampil sementara lalu kembali ke label biome
   */
  flashBiome(text, sticky = true) {
    if (sticky) this.stickyLabel = text;
    this.el.biome.textContent = text;
    this.el.biome.classList.remove('flash');
    void this.el.biome.offsetWidth;
    this.el.biome.classList.add('flash');
    if (this._labelTimer) clearTimeout(this._labelTimer);
    if (!sticky) {
      this._labelTimer = setTimeout(() => {
        if (this.stickyLabel) this.el.biome.textContent = this.stickyLabel;
      }, 2000);
    }
  }

  /* ============================ GAME OVER ============================ */
  showGameOver(s) {
    this.el.overScore.textContent = s.score;
    this.el.overBest.textContent = s.best;
    this.el.overCoins.textContent = `+${s.coins}`;
    this.el.overNewBest.classList.toggle('hidden', !s.isBest);

    const rows = [];
    rows.push(['Penyebab', s.reason || '—']);
    rows.push(['Pipa dilewati', s.pipes]);
    if (s.kills) rows.push(['Musuh dihancurkan', s.kills]);
    if (s.bosses) rows.push(['Boss dikalahkan', s.bosses]);
    if (s.closeCalls) rows.push(['Close Call', s.closeCalls]);
    if (s.comboMax) rows.push(['Combo tertinggi', s.comboMax]);
    if (s.gems) rows.push(['Permata', s.gems]);
    rows.push(['Koin terkumpul', `${s.rawCoins} × ${s.coinMul} = ${s.coins}`]);

    this.el.overDetails.innerHTML = rows
      .map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`)
      .join('')
      + (s.missions || []).map((m) => `<li class="reward"><span>${m.icon} Misi selesai: ${m.text}</span><b>+${m.reward} 🪙</b></li>`).join('');

    this.refreshMenu();
    this.show('over');
  }

  /** Toast ringan memakai baris pesan shop (dipakai saat buff/boss). */
  hintBuff(id) {
    const def = POWERUPS[id];
    if (def) this.flashBiome(`${def.icon} ${def.name}`, false);
  }
}

export default UI;
