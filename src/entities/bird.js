/** bird.js — burung pemain: fisika, rotasi, animasi sayap, render skin. */

import { BIRD } from '../config.js';
import { clamp, damp } from '../utils.js';
import { drawBird } from '../skins.js';

export class Bird {
  constructor() {
    this.reset();
  }

  reset(y = 300) {
    this.x = BIRD.x;
    this.baseX = BIRD.x;
    this.y = y;
    this.r = BIRD.r;
    this.vy = 0;
    this.rot = 0;
    this.wingPhase = 0;
    this.wingSpeed = 7;
    this.alive = true;
    this.trail = [];
  }

  flap(mul = 1) {
    this.vy = BIRD.flap * mul;
    this.wingSpeed = 26;
  }

  /**
   * @param {number} dt
   * @param {{gravityMul?:number, wind?:number, dashing?:boolean, frozen?:boolean}} env
   */
  update(dt, env = {}) {
    const gMul = env.gravityMul ?? 1;

    if (env.frozen) {
      // mode "ready": burung mengambang di tempat
      this.wingPhase += dt * 9;
      this.rot = damp(this.rot, Math.sin(this.wingPhase * 0.4) * 0.12, 8, dt);
      return;
    }

    this.vy += BIRD.gravity * gMul * dt;
    if (env.dashing) this.vy = Math.min(this.vy, 40);
    this.vy = clamp(this.vy, BIRD.maxRise, BIRD.maxFall);
    this.y += this.vy * dt;

    // dash menggeser burung sedikit ke depan, lalu kembali
    const targetX = this.baseX + (env.dashing ? 46 : 0);
    this.x = damp(this.x, targetX, env.dashing ? 16 : 6, dt);

    // angin (biome badai) ikut menggeser burung
    if (env.wind) this.x = clamp(this.x + env.wind * dt * 0.25, 60, 250);
    else if (!env.dashing) this.x = damp(this.x, this.baseX, 3, dt);

    // rotasi mengikuti kecepatan vertikal
    const target = clamp(this.vy / 620, -0.55, 1.25) * (env.dashing ? 0.25 : 1);
    this.rot = damp(this.rot, target, 9, dt);

    // sayap: cepat sesaat setelah flap, lalu melambat
    this.wingSpeed = damp(this.wingSpeed, 7, 4, dt);
    this.wingPhase += dt * this.wingSpeed;

    // jejak posisi untuk efek dash / motion blur
    this.trail.push({ x: this.x, y: this.y, rot: this.rot });
    if (this.trail.length > 9) this.trail.shift();
  }

  /** Titik keluar proyektil (ujung paruh). */
  muzzle() {
    return { x: this.x + this.r * 1.6, y: this.y + this.r * 0.1 };
  }

  draw(ctx, o = {}) {
    const t = o.t || 0;
    const skinId = o.skinId || 'default';

    // afterimage saat dash
    if (o.dashing) {
      for (let i = 0; i < this.trail.length; i += 2) {
        const p = this.trail[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        drawBird(ctx, skinId, { r: this.r, rot: p.rot, wingPhase: this.wingPhase, t, alpha: 0.1 + i * 0.03 });
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const blink = o.invuln && !o.shielded ? (Math.sin(t * 30) > 0 ? 0.35 : 1) : 1;
    drawBird(ctx, skinId, { r: this.r, rot: this.rot, wingPhase: this.wingPhase, t, alpha: blink });
    ctx.restore();

    // gelembung pelindung
    if (o.shielded) {
      const pulse = 1 + Math.sin(t * 8) * 0.06;
      ctx.save();
      ctx.globalAlpha = o.shieldFading ? (Math.sin(t * 22) > 0 ? 0.35 : 0.85) : 0.85;
      ctx.strokeStyle = '#6fd6ff';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#6fd6ff';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 1.95 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.16;
      ctx.fillStyle = '#6fd6ff';
      ctx.fill();
      ctx.restore();
    }
  }
}

export default Bird;
