/**
 * enemy.js — entitas musuh.
 * 3 varian supaya pola hafalan pemain tidak pernah aman:
 *  - drone   : mengejar ketinggian burung, peluru terarah
 *  - spitter : bergerak sinus, menembak 3 peluru menyebar
 *  - bomber   : lambat & tebal, menjatuhkan bom bergravitasi
 */

import { ENEMY, W, PIPE, FLOOR_Y } from '../config.js';
import { clamp, damp, rand, randInt } from '../utils.js';
import { Projectile } from './projectile.js';

const KINDS = {
  drone:   { hp: 2, r: 17, color: '#845ef7', accent: '#d0bfff', speed: 1,    coin: 3, score: 2 },
  spitter: { hp: 2, r: 19, color: '#20c997', accent: '#c3fae8', speed: 0.86, coin: 4, score: 3 },
  bomber:  { hp: 3, r: 22, color: '#fa5252', accent: '#ffc9c9', speed: 0.68, coin: 5, score: 4 },
};

export class Enemy {
  constructor(y, kind = 'drone') {
    const k = KINDS[kind] || KINDS.drone;
    this.kind = kind;
    this.def = k;
    this.x = W + 60;
    this.y = y;
    this.r = k.r;
    this.hp = k.hp;
    this.maxHp = k.hp;
    this.vy = 0;
    this.phase = rand(0, Math.PI * 2);
    this.shootTimer = rand(1.1, 1.9);
    this.dead = false;
    this.hurtFlash = 0;
    this.spawnT = 0;
    this.wobble = rand(0.7, 1.3);
  }

  get coinDrop() { return this.def.coin; }
  get scoreKill() { return this.def.score; }

  /**
   * @returns {Projectile[]} peluru yang ditembakkan frame ini (bisa kosong)
   */
  update(dt, worldVx, bird, diff) {
    this.spawnT += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3.5);
    this.phase += dt * 2.2 * this.wobble;

    this.x -= (worldVx * 0.55 + ENEMY.speed * this.def.speed) * dt;

    if (this.kind === 'drone') {
      // homing ringan ke posisi vertikal burung
      const target = bird.y + Math.sin(this.phase) * 26;
      this.vy = damp(this.vy, clamp((target - this.y) * 2.2, -ENEMY.homing, ENEMY.homing), 4, dt);
    } else if (this.kind === 'spitter') {
      this.vy = Math.cos(this.phase) * ENEMY.driftAmp;
    } else {
      this.vy = Math.sin(this.phase * 0.5) * 22;
    }
    this.y = clamp(this.y + this.vy * dt, 60, FLOOR_Y - 46);

    if (this.x < -60) this.dead = true;

    // menembak
    const out = [];
    if (this.x < W - 20) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = rand(ENEMY.shootMin, ENEMY.shootMax) / (diff?.bulletMul || 1);
        out.push(...this.shoot(bird, diff));
      }
    }
    return out;
  }

  shoot(bird, diff) {
    const sp = ENEMY.bulletSpeed * (diff?.bulletMul || 1);
    const out = [];
    if (this.kind === 'bomber') {
      out.push(new Projectile({
        x: this.x, y: this.y + this.r * 0.6, vx: -40, vy: 40,
        r: 8, kind: 'bomb', grav: 340, hostile: true,
      }));
    } else if (this.kind === 'spitter') {
      for (const a of [-0.34, 0, 0.34]) {
        out.push(new Projectile({
          x: this.x - this.r, y: this.y,
          vx: -Math.cos(a) * sp * 0.92, vy: Math.sin(a) * sp * 0.92,
          r: ENEMY.bulletR, kind: 'bullet', hostile: true,
        }));
      }
    } else {
      const dx = bird.x - this.x;
      const dy = bird.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      out.push(new Projectile({
        x: this.x - this.r, y: this.y,
        vx: (dx / d) * sp, vy: (dy / d) * sp * 0.65,
        r: ENEMY.bulletR, kind: 'bullet', hostile: true,
      }));
    }
    return out;
  }

  /** @returns {boolean} true kalau mati */
  hit(dmg = 1) {
    this.hp -= dmg;
    this.hurtFlash = 1;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  draw(ctx, t) {
    const { color, accent } = this.def;
    const r = this.r;
    const flash = this.hurtFlash > 0;
    const appear = Math.min(1, this.spawnT * 3);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = appear;
    ctx.scale(0.7 + appear * 0.3, 0.7 + appear * 0.3);

    ctx.shadowColor = color;
    ctx.shadowBlur = flash ? 26 : 12;
    const body = flash ? '#fff' : color;

    if (this.kind === 'bomber') {
      // badan gemuk + rotor
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(-r * 0.2, -r * 1.5, r * 0.4, r * 0.6);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.4;
      const rot = Math.sin(t * 40) * r * 1.5;
      ctx.beginPath();
      ctx.moveTo(-rot, -r * 1.5);
      ctx.lineTo(rot, -r * 1.5);
      ctx.stroke();
      // hatch bom
      ctx.fillStyle = '#212529';
      ctx.fillRect(-r * 0.35, r * 0.6, r * 0.7, r * 0.3);
    } else if (this.kind === 'spitter') {
      // bulat berduri
      ctx.fillStyle = body;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.72;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a + t * 1.2) * rr, Math.sin(a + t * 1.2) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // drone: segitiga runcing menghadap kiri + sayap
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r * 1.25, 0);
      ctx.lineTo(r * 0.85, -r * 0.85);
      ctx.lineTo(r * 0.55, 0);
      ctx.lineTo(r * 0.85, r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      const flap = Math.sin(t * 16) * r * 0.45;
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.2);
      ctx.lineTo(r * 0.5, -r * 1.2 - flap);
      ctx.lineTo(r * 0.75, -r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, r * 0.2);
      ctx.lineTo(r * 0.5, r * 1.2 + flap);
      ctx.lineTo(r * 0.75, r * 0.25);
      ctx.closePath();
      ctx.fill();
    }

    // mata jahat
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff0033';
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.12, r * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // bar HP kecil
    if (this.maxHp > 1 && this.hp < this.maxHp) {
      const w = r * 2;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - w / 2, this.y - r - 12, w, 4);
      ctx.fillStyle = '#69db7c';
      ctx.fillRect(this.x - w / 2, this.y - r - 12, (w * this.hp) / this.maxHp, 4);
      ctx.restore();
    }
  }
}

/** Pilih varian musuh berdasarkan skor saat ini. */
export function pickEnemyKind(score) {
  const pool = ['drone'];
  if (score >= 18) pool.push('spitter');
  if (score >= 34) pool.push('bomber');
  if (score >= 60) pool.push('spitter', 'bomber');
  return pool[randInt(0, pool.length - 1)];
}

/** Y spawn yang tidak menempel pipa terdekat. */
export function pickEnemyY(pipes) {
  let y = rand(110, FLOOR_Y - 120);
  const near = pipes.find((p) => p.x > W - PIPE.w * 2);
  if (near) y = clamp(near.gapY + rand(-60, 60), 110, FLOOR_Y - 120);
  return y;
}

export { KINDS as ENEMY_KINDS };
export default Enemy;
