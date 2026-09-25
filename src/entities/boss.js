/**
 * boss.js — "MECHA OWL", bos yang muncul berkala.
 * Hanya bisa dibunuh dengan tembakan bulu, jadi pemain wajib memakai
 * mekanik tembak, bukan cuma menghindar.
 *
 * Pola serangan berputar: spread -> aimed burst -> laser sweep -> minion call
 */

import { BOSS, W, FLOOR_Y } from '../config.js';
import { clamp, rand, withAlpha, roundRect } from '../utils.js';
import { Projectile } from './projectile.js';

const PATTERNS = ['spread', 'burst', 'laser', 'minions'];

export class Boss {
  constructor(index = 0) {
    this.index = index;
    this.maxHp = Math.min(BOSS.hpMax, BOSS.hp + index * BOSS.hpPerBoss);
    this.hp = this.maxHp;
    this.w = BOSS.w;
    this.h = BOSS.h;
    this.x = W + 120;
    this.y = 260;
    this.r = Math.max(this.w, this.h) * 0.42;   // untuk cek tabrakan kasar
    this.state = 'enter';                        // enter | fight | leave | dying
    this.t = 0;
    this.fightT = 0;
    this.phase = 0;
    this.patternIdx = -1;
    this.patternT = 0;
    this.actionT = 0;
    this.burstLeft = 0;
    this.laser = null;
    this.wantMinions = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.defeated = false;
    this.bobPhase = rand(0, Math.PI * 2);
  }

  get enraged() { return this.hp / this.maxHp <= 0.4; }
  get rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

  /** @returns {Projectile[]} */
  update(dt, bird, diff) {
    this.t += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    const out = [];

    if (this.state === 'enter') {
      this.x += (BOSS.x - this.x) * Math.min(1, dt * 2.2);
      this.y += (300 - this.y) * Math.min(1, dt * 2.2);
      if (Math.abs(this.x - BOSS.x) < 3) {
        this.state = 'fight';
        this.patternT = 0.8;
      }
      return out;
    }

    if (this.state === 'dying') {
      this.y += 120 * dt;
      this.x += 26 * dt;
      if (this.t - this.deathT > 1.5) this.dead = true;
      return out;
    }

    if (this.state === 'leave') {
      this.x += 240 * dt;
      if (this.x > W + 160) this.dead = true;
      return out;
    }

    /* ---- fight ---- */
    this.fightT += dt;
    if (this.fightT > BOSS.timeout) {
      this.state = 'leave';
      return out;
    }

    const rage = this.enraged ? 1.35 : 1;
    this.bobPhase += dt * BOSS.bobSpeed * rage;
    const track = (bird.y - this.y) * 0.5;
    this.y = clamp(
      300 + Math.sin(this.bobPhase) * BOSS.bobAmp + track * 0.25,
      90, FLOOR_Y - 70,
    );
    this.x = BOSS.x + Math.sin(this.t * 1.3) * 12;

    // laser aktif
    if (this.laser) {
      this.laser.t += dt;
      if (this.laser.state === 'charge') {
        this.laser.y = clamp(this.laser.y + (bird.y - this.laser.y) * Math.min(1, dt * 2.4), 60, FLOOR_Y - 40);
        if (this.laser.t >= BOSS.laserCharge) {
          this.laser.state = 'fire';
          this.laser.t = 0;
          this.laser.justFired = true;
        }
      } else if (this.laser.t >= BOSS.laserFire) {
        this.laser = null;
      }
    }

    // burst tembakan beruntun
    if (this.burstLeft > 0) {
      this.actionT -= dt;
      if (this.actionT <= 0) {
        this.actionT = 0.16;
        this.burstLeft--;
        out.push(...this.aimed(bird, diff));
      }
    }

    // ganti pola
    this.patternT -= dt;
    if (this.patternT <= 0 && !this.laser && this.burstLeft === 0) {
      this.patternIdx = (this.patternIdx + 1) % PATTERNS.length;
      const p = PATTERNS[this.patternIdx];
      this.patternT = (p === 'minions' ? 2.6 : 2.2) / rage;
      switch (p) {
        case 'spread':
          out.push(...this.spread(diff));
          break;
        case 'burst':
          this.burstLeft = this.enraged ? 5 : 3;
          this.actionT = 0;
          break;
        case 'laser':
          this.laser = { state: 'charge', t: 0, y: this.y, justFired: false };
          break;
        case 'minions':
          this.wantMinions = this.enraged ? 2 : 1;
          break;
        default:
          break;
      }
    }
    return out;
  }

  spread(diff) {
    const out = [];
    const n = this.enraged ? 7 : 5;
    const sp = 200 * (diff?.bulletMul || 1);
    for (let i = 0; i < n; i++) {
      const a = Math.PI - 0.55 + (i / (n - 1)) * 1.1;
      out.push(new Projectile({
        x: this.x - this.w * 0.4, y: this.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 7, kind: 'plasma', hostile: true,
      }));
    }
    return out;
  }

  aimed(bird, diff) {
    const dx = bird.x - (this.x - this.w * 0.4);
    const dy = bird.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 300 * (diff?.bulletMul || 1);
    return [new Projectile({
      x: this.x - this.w * 0.4, y: this.y,
      vx: (dx / d) * sp, vy: (dy / d) * sp,
      r: 6, kind: 'bullet', hostile: true,
    })];
  }

  /** Band bahaya laser ketika sedang menembak, atau null. */
  laserBand() {
    if (this.laser && this.laser.state === 'fire') {
      return { y: this.laser.y - BOSS.laserH / 2, h: BOSS.laserH };
    }
    return null;
  }

  hit(dmg = 1) {
    if (this.state !== 'fight' && this.state !== 'enter') return false;
    this.hp -= dmg;
    this.hurtFlash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.deathT = this.t;
      this.defeated = true;
      this.laser = null;
      this.burstLeft = 0;
      return true;
    }
    return false;
  }

  draw(ctx, t) {
    // laser
    if (this.laser) {
      const ly = this.laser.y;
      ctx.save();
      if (this.laser.state === 'charge') {
        const k = this.laser.t / BOSS.laserCharge;
        ctx.globalAlpha = 0.35 + Math.sin(t * 40) * 0.2;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(this.x, ly);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.25 * k;
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(0, ly - BOSS.laserH / 2, this.x, BOSS.laserH);
      } else {
        const k = 1 - this.laser.t / BOSS.laserFire;
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = '#ff2d55';
        ctx.shadowBlur = 30;
        const g = ctx.createLinearGradient(0, ly - BOSS.laserH / 2, 0, ly + BOSS.laserH / 2);
        g.addColorStop(0, withAlpha('#ff2d55', 0));
        g.addColorStop(0.5, '#fff');
        g.addColorStop(1, withAlpha('#ff2d55', 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, ly - (BOSS.laserH / 2) * (0.6 + k * 0.6), this.x, BOSS.laserH * (0.6 + k * 0.6));
      }
      ctx.restore();
    }

    const dying = this.state === 'dying';
    ctx.save();
    ctx.translate(this.x, this.y);
    if (dying) {
      ctx.rotate(Math.sin(t * 22) * 0.16 + (this.t - this.deathT) * 0.8);
      ctx.globalAlpha = Math.max(0, 1 - (this.t - this.deathT) / 1.5);
    }

    const base = this.hurtFlash > 0 ? '#ffffff' : this.enraged ? '#c92a2a' : '#343a40';
    const accent = this.enraged ? '#ff8787' : '#4dd4ff';

    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;

    // cincin berputar
    ctx.save();
    ctx.rotate(this.t * (this.enraged ? 1.8 : 0.9));
    ctx.strokeStyle = withAlpha(accent, 0.55);
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, this.w * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // badan heksagonal
    ctx.fillStyle = base;
    ctx.beginPath();
    const hw = this.w / 2;
    const hh = this.h / 2;
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-hw * 0.5, -hh);
    ctx.lineTo(hw * 0.6, -hh);
    ctx.lineTo(hw, -hh * 0.3);
    ctx.lineTo(hw, hh * 0.3);
    ctx.lineTo(hw * 0.6, hh);
    ctx.lineTo(-hw * 0.5, hh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // meriam depan
    ctx.fillStyle = '#495057';
    roundRect(ctx, -hw - 16, -10, 20, 20, 5);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // mata kembar
    const blink = Math.sin(t * 9) > -0.8 ? 1 : 0.25;
    ctx.globalAlpha = blink;
    ctx.fillStyle = this.enraged ? '#ffd43b' : '#ff3b3b';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.ellipse(-hw * 0.1, s * hh * 0.34, 10, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // "bulu" pelat di belakang
    ctx.shadowBlur = 0;
    ctx.fillStyle = withAlpha(accent, 0.3);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hw * 0.7, i * hh * 0.55);
      ctx.lineTo(hw + 26 + Math.sin(t * 6 + i) * 6, i * hh * 0.85);
      ctx.lineTo(hw * 0.7, i * hh * 0.55 + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export default Boss;
