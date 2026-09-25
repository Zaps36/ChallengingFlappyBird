/**
 * game.js — mesin utama: state machine, update, collision, render.
 *
 * Kelas ini sengaja tidak menyentuh DOM sama sekali (kecuali canvas ctx).
 * Semua komunikasi ke UI lewat `hooks`, supaya logika game bisa diuji
 * headless dan UI bisa diganti tanpa menyentuh gameplay.
 */

import {
  W, H, FLOOR_Y, CEIL_Y, BIRD, PIPE, ENEMY, BOSS, COIN, GEM,
  POWERUPS, POWERUP_DURATION, POWERUP_SPAWN_CHANCE, POWERUP_MIN_GAP_PIPES,
  COMBO, WEAPON, DASH, MAGNET, DIFFICULTIES, BIOMES, BIOME_EVERY,
  WIND, LOWGRAV, SHAKE_MAX, MAX_DT, REVIVE_IFRAMES,
} from './config.js';
import {
  clamp, rand, randInt, chance, weightedPick, circleRect, circleCircle, roundRect,
} from './utils.js';
import { Bird } from './entities/bird.js';
import { Pipe } from './entities/pipe.js';
import { Enemy, pickEnemyKind, pickEnemyY } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { Pickup } from './entities/pickup.js';
import { Projectile } from './entities/projectile.js';
import { Particles } from './particles.js';
import { Background } from './background.js';
import { getSkin } from './skins.js';

const POWER_LIST = Object.values(POWERUPS);

export class Game {
  constructor({ ctx, audio, store, missions, hooks = {} }) {
    this.ctx = ctx;
    this.audio = audio;
    this.store = store;
    this.missions = missions;
    this.hooks = hooks;

    this.bird = new Bird();
    this.particles = new Particles();
    this.bg = new Background(0);
    this.bg.onThunder = () => this.audio.play('thunder');

    this.state = 'menu';
    this.t = 0;
    this.last = 0;
    this.running = false;
    this.diff = DIFFICULTIES[store.data.difficulty] || DIFFICULTIES.classic;

    this.resetRun(true);
  }

  /* =====================================================================
   * SETUP
   * ===================================================================*/

  get skinId() { return this.store.equipped; }
  get maxAmmo() { return WEAPON.ammo + this.store.upgradeLevel('ammo') * WEAPON.ammoPerUpgrade; }
  get magnetRadius() { return MAGNET.radius + this.store.upgradeLevel('magnet') * MAGNET.radiusPerUpgrade; }
  get dashCooldown() { return Math.max(1.2, DASH.cooldown - this.store.upgradeLevel('dash') * DASH.cooldownPerUpgrade); }

  resetRun(soft = false) {
    this.pipes = [];
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.boss = null;
    this.particles.clear();

    this.score = 0;
    this.runCoins = 0;
    this.pipesPassed = 0;
    this.kills = 0;
    this.closeCalls = 0;
    this.dashCount = 0;
    this.powerupsTaken = 0;
    this.gemsTaken = 0;
    this.bossesKilled = 0;

    this.combo = 0;
    this.comboTimer = 0;
    this.comboMax = 0;

    this.buffs = { double: 0, shield: 0, magnet: 0 };

    this.ammo = this.maxAmmo;
    this.ammoTimer = 0;
    this.shootCd = 0;

    this.dashT = 0;
    this.dashCd = 0;

    this.invulnT = 0;
    this.revives = this.store.upgradeLevel('revive');

    this.enemyTimer = 0;
    this.pipesSinceEnemy = 0;
    this.pipesSincePowerup = 99;
    this.nextBossPipes = BOSS.firstAtPipes;
    this.bossIndex = 0;
    this.bossWarnT = 0;
    this.bossPending = false;

    this.wind = 0;
    this.windTimer = 0;

    this.shake = 0;
    this.hitstop = 0;
    this.deadT = 0;
    this.overSent = false;
    this.deathReason = '';
    this.runTime = 0;

    this.biomeIndex = 0;
    this.biome = BIOMES[0];
    if (!soft) this.bg.setBiome(this.biome);

    this.bird.reset(H * 0.42);
  }

  /** Mulai run baru (masuk state "ready"). */
  start(diffId) {
    if (diffId && DIFFICULTIES[diffId]) {
      this.diff = DIFFICULTIES[diffId];
      this.store.setDifficulty(diffId);
    }
    this.resetRun();
    this.setState('ready');
    this.audio.setBiome(this.biome.id);
    this.audio.setIntensity(0);
    this.audio.startMusic(this.biome.id);
  }

  toMenu() {
    this.resetRun();
    this.setState('menu');
    this.audio.stopMusic();
  }

  setState(s) {
    this.state = s;
    if (this.hooks.onState) this.hooks.onState(s);
  }

  /* =====================================================================
   * INPUT
   * ===================================================================*/

  flap() {
    if (this.state === 'ready') {
      this.setState('play');
      this.bird.flap();
      this.audio.play('flap');
      return;
    }
    if (this.state !== 'play') return;
    const mul = this.biome.mod === 'lowgrav' ? LOWGRAV.flapMul : 1;
    this.bird.flap(mul);
    this.audio.play('flap');
    this.particles.burst(this.bird.x - 10, this.bird.y + 8, 3, {
      color: 'rgba(255,255,255,0.7)', rMin: 1.5, rMax: 3,
      spMin: 20, spMax: 80, grav: 40, lifeMin: 0.18, lifeMax: 0.34, angle: Math.PI * 0.5,
    });
  }

  shoot() {
    if (this.state !== 'play') return;
    if (this.shootCd > 0) return;
    if (this.ammo <= 0) {
      this.audio.play('deny');
      this.particles.text(this.bird.x + 26, this.bird.y - 22, 'Amunisi habis!', { color: '#ff8787', size: 12, life: 0.6 });
      this.shootCd = 0.3;
      return;
    }
    const m = this.bird.muzzle();
    this.ammo--;
    this.shootCd = WEAPON.cooldown;
    this.bullets.push(new Projectile({
      x: m.x, y: m.y, vx: WEAPON.speed, vy: this.bird.vy * 0.1,
      r: WEAPON.r, kind: 'feather', hostile: false, dmg: WEAPON.dmg,
    }));
    this.bird.vy -= 22;                       // recoil kecil, terasa "berbobot"
    this.audio.play('shoot');
    this.particles.burst(m.x, m.y, 4, {
      color: ['#fff9db', '#ffd43b'], rMin: 1.4, rMax: 3, spMin: 40, spMax: 150,
      grav: 120, lifeMin: 0.15, lifeMax: 0.3, angle: 0,
    });
  }

  dash() {
    if (this.state !== 'play') return;
    if (this.dashCd > 0 || this.dashT > 0) {
      if (this.dashCd > 0) this.audio.play('deny');
      return;
    }
    this.dashT = DASH.duration;
    this.dashCd = this.dashCooldown;
    this.dashCount++;
    this.bird.vy = Math.min(this.bird.vy, DASH.lift);
    this.audio.play('dash');
    this.shakeIt(5);
    this.particles.ring(this.bird.x, this.bird.y, { r: 6, to: 70, color: '#7affd5', life: 0.4 });
    this.particles.burst(this.bird.x - 14, this.bird.y, 14, {
      color: ['#7affd5', '#ffffff', '#3fb8e8'], rMin: 1.5, rMax: 4,
      spMin: 80, spMax: 320, grav: 0, lifeMin: 0.2, lifeMax: 0.45, angle: Math.PI, glow: true,
    });
  }

  togglePause(force) {
    if (this.state === 'play' && force !== false) {
      this.setState('pause');
      this.audio.stopMusic();
    } else if (this.state === 'pause' && force !== true) {
      this.setState('play');
      this.audio.startMusic(this.biome.id);
    }
  }

  /* =====================================================================
   * LOOP
   * ===================================================================*/

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    const step = (ts) => {
      if (!this.running) return;
      if (!this.last) this.last = ts;
      const raw = (ts - this.last) / 1000;
      this.last = ts;
      this.tick(clamp(raw, 0, MAX_DT));
      this.render();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stopLoop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  /** Satu langkah simulasi (dipakai juga oleh test headless). */
  tick(dt) {
    this.t += dt;

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      dt *= 0.22;
    }
    this.shake = Math.max(0, this.shake - dt * 42);

    switch (this.state) {
      case 'menu':
        this.bird.y = H * 0.42 + Math.sin(this.t * BIRD.hoverSpeed) * BIRD.hoverAmp;
        this.bird.update(dt, { frozen: true });
        this.bg.update(dt, 46);
        this.particles.update(dt, 46);
        break;

      case 'ready':
        this.bird.y = H * 0.42 + Math.sin(this.t * BIRD.hoverSpeed) * BIRD.hoverAmp;
        this.bird.update(dt, { frozen: true });
        this.bg.update(dt, 60);
        this.particles.update(dt, 60);
        break;

      case 'play':
        this.updatePlay(dt);
        break;

      case 'dead':
        this.updateDead(dt);
        break;

      case 'pause':
      default:
        break;
    }

    if (this.hooks.onHud && (this.state === 'play' || this.state === 'ready')) {
      this.hooks.onHud(this.hudData());
    }
  }

  /* =====================================================================
   * UPDATE: PLAY
   * ===================================================================*/

  get worldVx() {
    const prog = this.pipesPassed;
    let v = Math.min(PIPE.speedMax, PIPE.speed + prog * PIPE.speedPerScore) * this.diff.speedMul;
    if (this.biome.mod === 'wind') v += this.wind;
    if (this.dashT > 0) v *= DASH.worldBoost;
    return Math.max(70, v);
  }

  get gapSize() {
    return Math.max(PIPE.gapMin, PIPE.gap - this.pipesPassed * PIPE.gapPerScore + this.diff.gapBonus);
  }

  get pipeSpacing() {
    return Math.max(PIPE.spacingMin, PIPE.spacing - this.pipesPassed * PIPE.spacingPerScore);
  }

  get multiplier() {
    return Math.min(COMBO.maxMult, 1 + Math.floor(this.combo / COMBO.perStep));
  }

  get invulnerable() {
    return this.buffs.shield > 0 || this.dashT > 0 || this.invulnT > 0;
  }

  updatePlay(dt) {
    this.runTime += dt;
    const vx = this.worldVx;

    /* ---- timer & buff ---- */
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);

    if (this.ammo < this.maxAmmo) {
      this.ammoTimer += dt * (this.boss ? 1 / BOSS.ammoRegenMul : 1);
      if (this.ammoTimer >= WEAPON.regen) {
        this.ammoTimer = 0;
        this.ammo++;
        this.particles.text(this.bird.x - 4, this.bird.y - 30, '+1 🪶', { color: '#fff9db', size: 12, life: 0.55 });
      }
    } else {
      this.ammoTimer = 0;
    }

    for (const k of Object.keys(this.buffs)) {
      if (this.buffs[k] > 0) {
        this.buffs[k] = Math.max(0, this.buffs[k] - dt);
        if (this.buffs[k] === 0) {
          this.particles.text(this.bird.x, this.bird.y - 40, `${POWERUPS[k].name} habis`, { color: '#ced4da', size: 12 });
        }
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.particles.text(this.bird.x, this.bird.y - 46, 'COMBO PUTUS', { color: '#ff8787', size: 13 });
        this.combo = 0;
      }
    }

    /* ---- biome ---- */
    const bi = Math.floor(this.pipesPassed / BIOME_EVERY) % BIOMES.length;
    if (bi !== this.biomeIndex) {
      this.biomeIndex = bi;
      this.biome = BIOMES[bi];
      this.bg.setBiome(this.biome);
      this.audio.setBiome(this.biome.id);
      this.audio.play('biome');
      this.particles.text(W / 2, H * 0.3, this.biome.name.toUpperCase(), { color: '#ffd447', size: 22, life: 1.6, worldLocked: false, vy: -18 });
      if (this.hooks.onBiome) this.hooks.onBiome(this.biome);
    }

    if (this.biome.mod === 'wind') {
      this.windTimer -= dt;
      if (this.windTimer <= 0) {
        this.windTimer = WIND.changeEvery;
        this.wind = rand(WIND.min, WIND.max);
      }
    } else {
      this.wind = 0;
      this.windTimer = 0;
    }

    /* ---- burung ---- */
    this.bird.update(dt, {
      gravityMul: (this.biome.mod === 'lowgrav' ? LOWGRAV.gravityMul : 1) * this.diff.gravityMul,
      wind: this.biome.mod === 'wind' ? this.wind : 0,
      dashing: this.dashT > 0,
    });
    this.emitSkinTrail(dt);

    /* ---- spawning ---- */
    if (!this.boss && !this.bossPending) this.spawnPipes();
    this.spawnEnemies(dt);
    this.updateBossFlow(dt);

    /* ---- entitas ---- */
    this.updatePipes(dt, vx);
    this.updatePickups(dt, vx);
    this.updateEnemies(dt, vx);
    this.updateBullets(dt, vx);

    this.bg.update(dt, vx, this.wind);
    this.particles.update(dt, vx * 0.6);

    /* ---- musik makin intens ---- */
    this.audio.setIntensity(clamp(this.pipesPassed / 60 + (this.boss ? 0.45 : 0), 0, 1));

    /* ---- tabrakan ---- */
    this.checkCollisions();
  }

  emitSkinTrail(dt) {
    const skin = getSkin(this.skinId);
    if (!skin.emit) return;
    this._emitAcc = (this._emitAcc || 0) + dt * skin.emit.rate * (this.dashT > 0 ? 2.2 : 1);
    while (this._emitAcc >= 1) {
      this._emitAcc -= 1;
      const bx = this.bird.x - this.bird.r * 1.1;
      const by = this.bird.y + rand(-5, 7);
      const e = skin.emit;
      switch (e.type) {
        case 'fire':
          this.particles.add({ x: bx, y: by, vx: rand(-60, -10), vy: rand(-30, 30), r: rand(2.5, 5), life: rand(0.3, 0.6), color: e.color, type: 'fire', grav: -40, glow: true });
          break;
        case 'sparkle':
          this.particles.add({ x: bx + rand(-8, 8), y: by, vx: rand(-40, 10), vy: rand(-40, 40), r: rand(1, 2.4), life: rand(0.3, 0.7), color: e.color, type: 'spark', grav: 0, glow: true });
          break;
        case 'streak':
          this.particles.add({ x: bx, y: by, vx: -120, vy: rand(-10, 10), r: rand(2, 3.6), life: 0.22, color: e.color, type: 'streak', grav: 0 });
          break;
        case 'smoke':
          this.particles.add({ x: bx, y: by, vx: rand(-30, 0), vy: rand(-18, 6), r: rand(3, 6), life: rand(0.4, 0.8), color: e.color, type: 'smoke', grav: -20 });
          break;
        case 'spark':
          this.particles.add({ x: bx, y: by, vx: rand(-90, -20), vy: rand(-60, 60), r: rand(1, 2.2), life: 0.25, color: e.color, type: 'spark', grav: 200, glow: true });
          break;
        case 'wisp':
          this.particles.add({ x: bx, y: by, vx: rand(-40, 0), vy: rand(-26, -4), r: rand(2, 4.5), life: rand(0.5, 0.9), color: e.color, type: 'smoke', grav: -30 });
          break;
        case 'rgb':
          this.particles.add({ x: bx, y: by, vx: rand(-140, -40), vy: rand(-30, 30), r: rand(1.5, 3.5), life: 0.2, color: chance(0.5) ? '#ff0040' : '#00ffe0', type: 'square', grav: 0, rot: rand(0, 3) });
          break;
        default:
          break;
      }
    }
  }

  /* ---------------- PIPA ---------------- */
  spawnPipes() {
    const last = this.pipes[this.pipes.length - 1];
    if (last && W - last.x < this.pipeSpacing) return;

    const gapH = this.gapSize;
    const min = PIPE.margin + gapH / 2;
    const max = FLOOR_Y - PIPE.margin - gapH / 2;
    let gapY = rand(min, max);
    // hindari lompatan ekstrem dari pipa sebelumnya supaya tetap fair
    if (last) gapY = clamp(gapY, last.gapY - 165, last.gapY + 165);
    gapY = clamp(gapY, min, max);

    const drift = this.biome.mod === 'drift' && chance(0.7);
    const pipe = new Pipe(W + 8, gapY, gapH, drift);
    this.pipes.push(pipe);

    this.pipesSincePowerup++;
    // power-up mengambang di antara pipa
    if (this.pipesSincePowerup >= POWERUP_MIN_GAP_PIPES && chance(POWERUP_SPAWN_CHANCE)) {
      this.pipesSincePowerup = 0;
      const def = weightedPick(POWER_LIST);
      this.pickups.push(new Pickup(
        pipe.x + PIPE.w + this.pipeSpacing * 0.45,
        clamp(gapY + rand(-40, 40), 90, FLOOR_Y - 80),
        'power', def.id,
      ));
    } else if (chance(COIN.chance)) {
      // klaster koin: garis, busur, atau kolom
      const n = randInt(1, COIN.clusterMax);
      const cx = pipe.x + PIPE.w + this.pipeSpacing * 0.42;
      const cy = clamp(gapY + rand(-30, 30), 80, FLOOR_Y - 70);
      const shape = randInt(0, 2);
      for (let i = 0; i < n; i++) {
        const ox = shape === 2 ? 0 : i * 26;
        const oy = shape === 0 ? 0 : shape === 1 ? Math.sin(i * 0.9) * 26 : i * 28;
        this.pickups.push(new Pickup(cx + ox, clamp(cy + oy, 70, FLOOR_Y - 60), 'coin'));
      }
      if (chance(GEM.chance)) {
        this.pickups.push(new Pickup(cx + rand(30, 90), clamp(cy + rand(-50, 50), 70, FLOOR_Y - 60), 'gem'));
      }
    }
  }

  updatePipes(dt, vx) {
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const p = this.pipes[i];
      p.update(dt, vx);

      if (!p.scored && p.centerX < this.bird.x) {
        p.scored = true;
        this.pipesPassed++;
        this.pipesSinceEnemy++;
        this.addCombo(1);
        this.addScore(1, p.centerX, p.gapY);
        this.gainCoins(1, false);

        // close call: lewat mepet bibir pipa
        const clearTop = (this.bird.y - this.bird.r) - p.gapTop;
        const clearBot = p.gapBottom - (this.bird.y + this.bird.r);
        const clearance = Math.min(clearTop, clearBot);
        if (clearance >= 0 && clearance < PIPE.nearMiss) {
          this.closeCalls++;
          this.addCombo(1);
          this.score += 2 * (this.buffs.double > 0 ? 2 : 1);
          this.audio.play('nearMiss');
          this.particles.text(this.bird.x + 34, this.bird.y, 'CLOSE CALL! +2', { color: '#4ad6ff', size: 15 });
          this.particles.ring(this.bird.x, this.bird.y, { r: 10, to: 46, color: '#4ad6ff', life: 0.35 });
          this.shakeIt(3);
        }
        if (this.hooks.onScore) this.hooks.onScore(this.score);
      }

      if (p.right < -20) this.pipes.splice(i, 1);
    }
  }

  /* ---------------- PICKUP ---------------- */
  updatePickups(dt, vx) {
    const magnet = {
      active: this.buffs.magnet > 0,
      x: this.bird.x, y: this.bird.y,
      radius: this.magnetRadius, pull: MAGNET.pull,
    };
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt, vx, magnet);
      if (p.dead) { this.pickups.splice(i, 1); continue; }

      if (circleCircle(this.bird.x, this.bird.y, this.bird.r + 4, p.x, p.y, p.r)) {
        this.pickups.splice(i, 1);
        this.collect(p);
      }
    }
  }

  collect(p) {
    if (p.kind === 'power') {
      const def = POWERUPS[p.power];
      this.buffs[p.power] = POWERUP_DURATION;
      this.powerupsTaken++;
      this.audio.play('power');
      this.addCombo(1);
      this.particles.text(p.x, p.y - 20, `${def.icon} ${def.name}!`, { color: def.color, size: 16, life: 1.1 });
      this.particles.ring(p.x, p.y, { r: 8, to: 90, color: def.color, life: 0.5 });
      this.particles.burst(p.x, p.y, 18, { color: [def.color, '#ffffff'], spMin: 60, spMax: 240, grav: 0, lifeMin: 0.3, lifeMax: 0.6, glow: true });
      this.shakeIt(4);
      if (this.hooks.onBuff) this.hooks.onBuff(p.power);
      return;
    }

    const isGem = p.kind === 'gem';
    if (isGem) this.gemsTaken++;
    this.gainCoins(p.value, true);
    this.addCombo(1);
    this.addScore(isGem ? 2 : 1, p.x, p.y, true);
    this.audio.play(isGem ? 'gem' : 'coin');
    this.particles.burst(p.x, p.y, isGem ? 14 : 8, {
      color: isGem ? ['#e0aaff', '#ffffff', '#c77dff'] : ['#ffd43b', '#fff3bf'],
      rMin: 1.5, rMax: 3.4, spMin: 40, spMax: 190, grav: 140,
      lifeMin: 0.25, lifeMax: 0.5, glow: true,
    });
  }

  /* ---------------- MUSUH ---------------- */
  spawnEnemies(dt) {
    if (this.boss || this.bossPending) return;
    if (this.pipesPassed < ENEMY.minScore) return;
    this.enemyTimer += dt;

    const rate = this.diff.enemyRateMul;
    const byPipes = this.pipesSinceEnemy >= Math.round(ENEMY.everyPipes * rate);
    const byTime = this.enemyTimer >= ENEMY.everySeconds * rate;
    if (!byPipes && !byTime) return;
    if (this.enemies.length >= ENEMY.maxAlive) return;

    this.enemyTimer = 0;
    this.pipesSinceEnemy = 0;
    const kind = pickEnemyKind(this.pipesPassed);
    const e = new Enemy(pickEnemyY(this.pipes), kind);
    this.enemies.push(e);
    this.audio.play('alert');
    this.particles.text(W - 40, e.y - 34, '⚠ MUSUH', { color: '#ff8787', size: 13, life: 1.1 });
    if (this.hooks.onEnemy) this.hooks.onEnemy(kind);
  }

  updateEnemies(dt, vx) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const shots = e.update(dt, vx, this.bird, this.diff);
      if (shots.length) this.bullets.push(...shots);
      if (e.dead && e.hp > 0) {
        // keluar layar tanpa dibunuh: tetap beri sedikit skor karena berhasil dilewati
        this.addScore(1, e.x, e.y);
        this.gainCoins(1, false);
        this.enemies.splice(i, 1);
        continue;
      }
      if (e.dead) this.enemies.splice(i, 1);
    }
  }

  killEnemy(e, viaDash = false) {
    this.kills++;
    this.addCombo(2);
    this.addScore(e.scoreKill, e.x, e.y);
    this.gainCoins(e.coinDrop, true);
    this.audio.play('kill');
    this.shakeIt(viaDash ? 9 : 7);
    this.hitstop = 0.05;
    this.particles.burst(e.x, e.y, 26, {
      color: [e.def.color, e.def.accent, '#ffffff'], rMin: 2, rMax: 5.5,
      spMin: 60, spMax: 330, grav: 260, lifeMin: 0.3, lifeMax: 0.75, glow: true,
    });
    this.particles.ring(e.x, e.y, { r: 10, to: 70, color: e.def.accent, life: 0.4 });
    this.particles.text(e.x, e.y - 26, `+${e.coinDrop} 🪙`, { color: '#ffd43b', size: 14 });
    // koin fisik agar magnet terasa berguna
    for (let i = 0; i < Math.min(3, e.coinDrop); i++) {
      const c = new Pickup(e.x + rand(-16, 16), e.y + rand(-16, 16), 'coin');
      c.pulled = true;
      c.vx = rand(-60, 60);
      c.vy = rand(-120, -20);
      this.pickups.push(c);
    }
  }

  /* ---------------- BOSS ---------------- */
  updateBossFlow(dt) {
    // trigger
    if (!this.boss && !this.bossPending && this.pipesPassed >= this.nextBossPipes) {
      this.bossPending = true;
      this.bossWarnT = 2.2;
      this.audio.play('bossWarn');
      this.shakeIt(6);
      if (this.hooks.onBossWarn) this.hooks.onBossWarn();
    }

    if (this.bossPending) {
      this.bossWarnT -= dt;
      if (this.bossWarnT <= 0) {
        this.bossPending = false;
        this.boss = new Boss(this.bossIndex);
        this.bullets = this.bullets.filter((b) => !b.hostile);
      }
      return;
    }

    if (!this.boss) return;

    // selama duel boss pipa berhenti, jadi koin tetap mengalir supaya
    // pemain punya sesuatu untuk dikejar (dan magnet tetap berguna)
    this.bossCoinT = (this.bossCoinT || 0) - dt;
    if (this.bossCoinT <= 0) {
      this.bossCoinT = BOSS.coinEvery;
      this.pickups.push(new Pickup(W + 20, rand(90, FLOOR_Y - 80), chance(0.12) ? 'gem' : 'coin'));
    }

    const b = this.boss;
    const shots = b.update(dt, this.bird, this.diff);
    if (shots.length) this.bullets.push(...shots);

    if (b.laser && b.laser.justFired) {
      b.laser.justFired = false;
      this.audio.play('laserFire');
      this.shakeIt(10);
    }
    if (b.laser && b.laser.state === 'charge' && !b._chargeSfx) {
      b._chargeSfx = true;
      this.audio.play('laserCharge', { dur: BOSS.laserCharge });
    }
    if (!b.laser) b._chargeSfx = false;

    if (b.wantMinions > 0) {
      for (let i = 0; i < b.wantMinions; i++) {
        if (this.enemies.length < ENEMY.maxAlive + 1) {
          this.enemies.push(new Enemy(rand(120, FLOOR_Y - 140), 'drone'));
        }
      }
      b.wantMinions = 0;
      this.particles.text(b.x - 60, b.y - 60, 'MEMANGGIL DRONE!', { color: '#ff8787', size: 13, life: 1.2 });
    }

    if (b.state === 'dying' && !b._rewarded) {
      b._rewarded = true;
      this.bossesKilled++;
      this.bossIndex++;
      this.addCombo(5);
      this.addScore(BOSS.scoreKill, b.x, b.y);
      this.gainCoins(BOSS.coinDrop, true);
      this.audio.play('bossDown');
      this.shakeIt(SHAKE_MAX);
      this.hitstop = 0.12;
      this.particles.text(W / 2, H * 0.34, 'BOSS DOWN!', { color: '#ffd447', size: 26, life: 1.8, worldLocked: false, vy: -14 });
      this.particles.text(W / 2, H * 0.34 + 28, `+${BOSS.coinDrop} 🪙`, { color: '#69db7c', size: 16, life: 1.6, worldLocked: false, vy: -14 });
      for (let i = 0; i < 5; i++) {
        this.particles.ring(b.x + rand(-30, 30), b.y + rand(-30, 30), { r: 6, to: rand(70, 160), color: i % 2 ? '#ffd43b' : '#ff6b6b', life: rand(0.4, 0.9) });
      }
      this.particles.burst(b.x, b.y, 60, {
        color: ['#ffd43b', '#ff6b6b', '#ffffff', '#4dd4ff'], rMin: 2, rMax: 7,
        spMin: 80, spMax: 460, grav: 220, lifeMin: 0.4, lifeMax: 1.1, glow: true,
      });
      for (let i = 0; i < 6; i++) {
        const c = new Pickup(b.x + rand(-40, 40), b.y + rand(-40, 40), chance(0.4) ? 'gem' : 'coin');
        c.pulled = true;
        c.vx = rand(-140, -40);
        c.vy = rand(-160, 40);
        this.pickups.push(c);
      }
      this.bullets = this.bullets.filter((x) => !x.hostile);
    }

    if (b.dead) {
      this.boss = null;
      this.nextBossPipes = this.pipesPassed + BOSS.everyPipes;
      if (this.hooks.onBossEnd) this.hooks.onBossEnd();
    }
  }

  /* ---------------- PROYEKTIL ---------------- */
  updateBullets(dt, vx) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, vx);
      if (b.dead) { this.bullets.splice(i, 1); continue; }

      // peluru musuh hanya bergerak; yang aktif "mencari target" adalah bulu
      if (b.hostile) continue;

      // bulu vs musuh
      let consumed = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (circleCircle(b.x, b.y, b.r, e.x, e.y, e.r)) {
          consumed = true;
          const died = e.hit(b.dmg);
          if (died) this.killEnemy(e);
          else {
            this.audio.play('shieldHit');
            this.particles.burst(b.x, b.y, 8, { color: ['#ffffff', e.def.accent], spMin: 40, spMax: 180, grav: 120, lifeMin: 0.15, lifeMax: 0.35 });
          }
          break;
        }
      }

      // bulu vs boss
      if (!consumed && this.boss && (this.boss.state === 'fight' || this.boss.state === 'enter')) {
        const r = this.boss.rect;
        if (circleRect(b.x, b.y, b.r, r.x, r.y, r.w, r.h)) {
          consumed = true;
          this.boss.hit(b.dmg);
          this.audio.play('shieldHit');
          this.shakeIt(3);
          this.particles.burst(b.x, b.y, 10, { color: ['#ffffff', '#4dd4ff'], spMin: 60, spMax: 220, grav: 60, lifeMin: 0.15, lifeMax: 0.4, glow: true });
        }
      }

      // bulu vs peluru musuh (menangkis)
      if (!consumed) {
        for (let j = this.bullets.length - 1; j >= 0; j--) {
          const o = this.bullets[j];
          if (!o.hostile || o.dead || o === b) continue;
          if (circleCircle(b.x, b.y, b.r + 2, o.x, o.y, o.r)) {
            o.dead = true;
            consumed = true;
            this.audio.play('shieldHit');
            this.particles.burst(o.x, o.y, 10, { color: ['#ffffff', '#ffd43b'], spMin: 50, spMax: 200, grav: 80, lifeMin: 0.15, lifeMax: 0.35, glow: true });
            this.particles.text(o.x, o.y - 18, 'NICE!', { color: '#ffd43b', size: 12, life: 0.5 });
            break;
          }
        }
      }

      if (consumed) b.dead = true;
    }

    // buang semua proyektil mati SEKARANG, sebelum cek tabrakan burung.
    // (kalau tidak, peluru yang baru ditangkis masih bisa membunuh pemain
    //  di frame yang sama — bug yang sangat menjengkelkan.)
    if (this.bullets.some((b) => b.dead)) {
      this.bullets = this.bullets.filter((b) => !b.dead);
    }
  }

  /* =====================================================================
   * COLLISION
   * ===================================================================*/

  checkCollisions() {
    const b = this.bird;

    // tanah & langit-langit
    if (b.y + b.r >= FLOOR_Y) {
      b.y = FLOOR_Y - b.r;
      if (!this.invulnerable) return this.die('Menabrak tanah');
      b.vy = Math.min(b.vy, -260);
    }
    if (b.y < CEIL_Y) {
      if (!this.invulnerable) return this.die('Terbang terlalu tinggi');
      b.y = CEIL_Y;
      b.vy = Math.max(b.vy, 60);
    }

    // pipa
    for (const p of this.pipes) {
      if (p.right < b.x - b.r - 4 || p.x > b.x + b.r + 4) continue;
      for (const r of p.rects()) {
        if (circleRect(b.x, b.y, b.r * 0.92, r.x, r.y, r.w, r.h)) {
          if (this.invulnerable) {
            if (this.dashT > 0 || this.buffs.shield > 0) {
              this.particles.burst(b.x + b.r, b.y, 5, { color: ['#ffffff'], spMin: 30, spMax: 120, grav: 40, lifeMin: 0.1, lifeMax: 0.25 });
            }
          } else {
            return this.die('Menabrak pipa');
          }
        }
      }
    }

    // musuh
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!circleCircle(b.x, b.y, b.r, e.x, e.y, e.r * 0.92)) continue;
      if (this.dashT > 0) {
        e.hp = 0;
        e.dead = true;
        this.killEnemy(e, true);
        this.particles.text(b.x + 30, b.y - 30, 'RAM!', { color: '#7affd5', size: 16 });
      } else if (this.buffs.shield > 0) {
        e.hp = 0;
        e.dead = true;
        this.killEnemy(e);
        this.audio.play('shieldHit');
      } else if (this.invulnT > 0) {
        // kebal sesaat: musuh cuma terpental sedikit
        e.x += 30;
      } else {
        return this.die('Ditabrak musuh');
      }
    }

    // peluru musuh
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const p = this.bullets[i];
      if (!p.hostile) continue;
      if (!circleCircle(b.x, b.y, b.r * 0.9, p.x, p.y, p.r)) continue;
      if (this.invulnerable) {
        this.bullets.splice(i, 1);
        this.audio.play('shieldHit');
        this.particles.burst(p.x, p.y, 8, { color: ['#6fd6ff', '#ffffff'], spMin: 40, spMax: 170, grav: 60, lifeMin: 0.12, lifeMax: 0.3, glow: true });
      } else {
        return this.die(p.kind === 'bomb' ? 'Kena bom' : 'Kena peluru');
      }
    }

    // boss: badan + laser
    if (this.boss && this.boss.state !== 'dying' && this.boss.state !== 'leave') {
      const r = this.boss.rect;
      if (circleRect(b.x, b.y, b.r, r.x, r.y, r.w, r.h) && !this.invulnerable) {
        return this.die('Ditabrak boss');
      }
      const band = this.boss.laserBand();
      if (band && b.x < this.boss.x && b.y + b.r > band.y && b.y - b.r < band.y + band.h) {
        if (!this.invulnerable) return this.die('Terpanggang laser');
      }
    }
    return undefined;
  }

  /* =====================================================================
   * SKOR, KOIN, COMBO
   * ===================================================================*/

  addCombo(n = 1) {
    const before = this.multiplier;
    this.combo += n;
    this.comboTimer = COMBO.decay;
    this.comboMax = Math.max(this.comboMax, this.combo);
    const after = this.multiplier;
    if (after > before) {
      this.audio.play('combo', { level: after });
      this.particles.text(this.bird.x, this.bird.y - 52, `COMBO x${after}!`, { color: '#ff922b', size: 18, life: 1 });
      this.particles.ring(this.bird.x, this.bird.y, { r: 12, to: 60, color: '#ff922b', life: 0.4 });
    }
  }

  addScore(base, x = this.bird.x, y = this.bird.y, quiet = false) {
    const mult = this.multiplier;
    const dbl = this.buffs.double > 0 ? 2 : 1;
    const gain = Math.max(1, Math.round(base * mult * dbl));
    this.score += gain;
    if (!quiet || gain > 2) {
      this.particles.text(x, y - 14, `+${gain}`, {
        color: dbl > 1 ? '#ffd447' : '#ffffff',
        size: 13 + Math.min(10, gain),
      });
    }
    if (this.hooks.onScorePump) this.hooks.onScorePump(gain);
  }

  gainCoins(n) {
    this.runCoins += n;
    if (this.hooks.onCoins) this.hooks.onCoins(this.runCoins);
  }

  shakeIt(v) {
    if (!this.store.settings.shake) return;
    this.shake = Math.min(SHAKE_MAX, this.shake + v);
  }

  /* =====================================================================
   * MATI / REVIVE
   * ===================================================================*/

  die(reason) {
    if (this.state !== 'play') return;

    if (this.revives > 0) {
      this.revives--;
      this.invulnT = REVIVE_IFRAMES;
      this.bird.vy = -420;
      this.bird.y = clamp(this.bird.y, 80, FLOOR_Y - 60);
      this.bullets = this.bullets.filter((b) => !b.hostile);
      this.enemies.forEach((e) => { e.x += 120; });
      this.audio.play('revive');
      this.shakeIt(12);
      this.hitstop = 0.1;
      this.particles.text(W / 2, H * 0.36, 'SECOND WIND!', { color: '#69db7c', size: 24, life: 1.6, worldLocked: false, vy: -16 });
      this.particles.ring(this.bird.x, this.bird.y, { r: 10, to: 180, color: '#69db7c', life: 0.7 });
      this.particles.burst(this.bird.x, this.bird.y, 34, {
        color: ['#69db7c', '#ffffff', '#b2f2bb'], spMin: 80, spMax: 380, grav: 120,
        lifeMin: 0.3, lifeMax: 0.8, glow: true,
      });
      if (this.hooks.onRevive) this.hooks.onRevive();
      return;
    }

    this.deathReason = reason;
    this.setState('dead');
    this.deadT = 0;
    this.overSent = false;
    this.bird.alive = false;
    this.bird.vy = -260;
    this.audio.play('hurt');
    this.audio.stopMusic();
    this.shakeIt(SHAKE_MAX);
    this.hitstop = 0.14;

    const skin = getSkin(this.skinId);
    this.particles.feathers(this.bird.x, this.bird.y, 16, skin.palette.body);
    this.particles.burst(this.bird.x, this.bird.y, 24, {
      color: ['#ffffff', skin.palette.body, '#ff8787'], spMin: 60, spMax: 300,
      grav: 420, lifeMin: 0.4, lifeMax: 0.9,
    });
    this.particles.ring(this.bird.x, this.bird.y, { r: 8, to: 120, color: '#ff6b6b', life: 0.5 });
  }

  updateDead(dt) {
    this.deadT += dt;
    // burung jatuh dramatis
    this.bird.vy = Math.min(this.bird.vy + BIRD.gravity * 1.1 * dt, BIRD.maxFall);
    this.bird.y = Math.min(this.bird.y + this.bird.vy * dt, FLOOR_Y - this.bird.r);
    this.bird.rot = Math.min(this.bird.rot + dt * 4.2, Math.PI / 2);
    this.particles.update(dt, 0);
    this.bg.update(dt, 0);

    if (!this.overSent && this.deadT > 0.8) {
      this.overSent = true;
      this.finishRun();
    }
  }

  finishRun() {
    const raw = Math.round(this.runCoins);
    const total = Math.max(0, Math.round(raw * this.diff.coinMul));
    const isBest = this.store.submitScore(this.score, this.diff.id);
    this.store.addCoins(total);
    this.store.bumpStats({
      runs: 1, pipes: this.pipesPassed, coins: total, kills: this.kills,
      bosses: this.bossesKilled, closeCalls: this.closeCalls,
      dashes: this.dashCount, powerups: this.powerupsTaken,
      playtime: Math.round(this.runTime),
    });

    // misi harian
    let completed = [];
    const m = this.missions;
    if (m) {
      m.ensureToday();
      completed = completed.concat(
        m.track('pipes', this.pipesPassed),
        m.track('coins', total),
        m.track('kills', this.kills),
        m.track('score', this.score),
        m.track('closeCalls', this.closeCalls),
        m.track('powerups', this.powerupsTaken),
        m.track('dashes', this.dashCount),
        m.track('bosses', this.bossesKilled),
        m.track('gems', this.gemsTaken),
        m.track('comboMax', this.comboMax),
      );
    }

    const summary = {
      score: this.score,
      best: this.store.data.highScore,
      isBest,
      rawCoins: raw,
      coinMul: this.diff.coinMul,
      coins: total,
      pipes: this.pipesPassed,
      kills: this.kills,
      closeCalls: this.closeCalls,
      bosses: this.bossesKilled,
      comboMax: this.comboMax,
      gems: this.gemsTaken,
      reason: this.deathReason,
      diff: this.diff,
      missions: completed,
      time: this.runTime,
    };
    if (this.hooks.onGameOver) this.hooks.onGameOver(summary);
    return summary;
  }

  /* =====================================================================
   * HUD DATA
   * ===================================================================*/

  hudData() {
    const buffs = Object.keys(this.buffs)
      .filter((k) => this.buffs[k] > 0)
      .map((k) => ({
        id: k,
        icon: POWERUPS[k].icon,
        name: POWERUPS[k].name,
        left: this.buffs[k],
        pct: this.buffs[k] / POWERUP_DURATION,
      }));
    return {
      score: this.score,
      coins: Math.round(this.runCoins),
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      combo: this.combo,
      mult: this.multiplier,
      comboPct: clamp(this.comboTimer / COMBO.decay, 0, 1),
      buffs,
      dashPct: 1 - clamp(this.dashCd / this.dashCooldown, 0, 1),
      dashReady: this.dashCd <= 0,
      biome: this.biome.name,
      revives: this.revives,
    };
  }

  /* =====================================================================
   * RENDER
   * ===================================================================*/

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (this.shake > 0.4) {
      ctx.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);
    }

    this.bg.drawSky(ctx);

    for (const p of this.pipes) p.draw(ctx, this.biome.pipe);
    this.bg.drawGround(ctx);

    for (const p of this.pickups) p.draw(ctx, this.t);
    for (const e of this.enemies) e.draw(ctx, this.t);
    if (this.boss) this.boss.draw(ctx, this.t);
    for (const b of this.bullets) b.draw(ctx, this.t);

    // magnet aura
    if (this.buffs.magnet > 0) {
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(this.t * 6) * 0.05;
      ctx.strokeStyle = '#ff7ad9';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(this.bird.x, this.bird.y, this.magnetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.bird.draw(ctx, {
      t: this.t,
      skinId: this.skinId,
      shielded: this.buffs.shield > 0,
      shieldFading: this.buffs.shield > 0 && this.buffs.shield < 2,
      invuln: this.invulnT > 0,
      dashing: this.dashT > 0,
    });

    this.particles.draw(ctx);
    this.bg.drawWeather(ctx, this.wind);
    this.bg.drawOverlay(ctx, this.bird);

    // speed lines saat dash
    if (this.dashT > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const y = (i * 71 + (this.t * 900) % 71) % H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rand(50, 150), y);
        ctx.stroke();
      }
      ctx.restore();
    }

    this.drawBossUI(ctx);
    this.drawStatePrompts(ctx);

    ctx.restore();
  }

  drawBossUI(ctx) {
    if (this.bossPending) {
      const blink = Math.sin(this.t * 14) > 0;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = blink ? 'rgba(255,60,80,0.22)' : 'rgba(255,60,80,0.1)';
      ctx.fillRect(0, H * 0.3, W, 82);
      ctx.fillStyle = blink ? '#fff' : '#ff6b6b';
      ctx.font = '900 34px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠ BOSS ⚠', W / 2, H * 0.3 + 30);
      ctx.font = '700 14px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#ffe3e3';
      ctx.fillText('tembak dengan bulu (F / J) untuk membunuhnya!', W / 2, H * 0.3 + 62);
      ctx.restore();
    }

    const b = this.boss;
    if (!b || b.state === 'dying' || b.state === 'leave') return;
    const pad = 26;
    const w = W - pad * 2;
    const h = 12;
    // sengaja di y=126: di bawah label biome + meter combo (HUD DOM),
    // dan di atas daftar buff. Jangan naikkan tanpa menggeser .hud-buffs.
    const y = 126;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, pad, y, w, h, 6);
    ctx.fill();
    const k = clamp(b.hp / b.maxHp, 0, 1);
    const g = ctx.createLinearGradient(pad, 0, pad + w, 0);
    g.addColorStop(0, b.enraged ? '#ff922b' : '#ff6b6b');
    g.addColorStop(1, b.enraged ? '#ffd43b' : '#ff8787');
    ctx.fillStyle = g;
    roundRect(ctx, pad, y, Math.max(2, w * k), h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, pad, y, w, h, 6);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '800 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`MECHA OWL ${'★'.repeat(Math.min(5, b.index + 1))}`, pad, y - 3);
    ctx.textAlign = 'right';
    ctx.fillText(`${b.hp}/${b.maxHp}`, pad + w, y - 3);
    ctx.restore();
  }

  drawStatePrompts(ctx) {
    if (this.state === 'ready') {
      const pulse = 0.65 + Math.sin(this.t * 5) * 0.35;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#fff';
      ctx.font = '900 22px "Trebuchet MS", sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.strokeText('KLIK / SPACE UNTUK TERBANG', W / 2, H * 0.58);
      ctx.fillText('KLIK / SPACE UNTUK TERBANG', W / 2, H * 0.58);
      ctx.globalAlpha = 1;
      ctx.font = '700 13px "Trebuchet MS", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.strokeText('F = tembak   •   Shift = dash', W / 2, H * 0.58 + 30);
      ctx.fillText('F = tembak   •   Shift = dash', W / 2, H * 0.58 + 30);

      // panah turun ke burung
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffd447';
      const ay = this.bird.y + 52 + Math.sin(this.t * 5) * 5;
      ctx.beginPath();
      ctx.moveTo(this.bird.x, ay - 10);
      ctx.lineTo(this.bird.x - 9, ay + 4);
      ctx.lineTo(this.bird.x + 9, ay + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (this.state === 'pause') {
      ctx.save();
      ctx.fillStyle = 'rgba(4,7,18,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (this.state === 'dead') {
      ctx.save();
      ctx.globalAlpha = clamp(this.deadT * 1.2, 0, 0.55);
      ctx.fillStyle = '#2b0008';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

export default Game;
