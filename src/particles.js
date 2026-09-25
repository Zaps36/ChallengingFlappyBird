/** particles.js — sistem partikel ringan untuk juiciness (spark, api, teks skor, dll). */

import { rand, randInt, withAlpha, roundRect } from './utils.js';

const MAX = 700;

export class Particles {
  constructor() {
    this.list = [];
  }

  clear() { this.list.length = 0; }

  get count() { return this.list.length; }

  add(p) {
    if (this.list.length >= MAX) this.list.shift();
    const part = {
      x: 0, y: 0, vx: 0, vy: 0, r: 3, life: 0.5, max: 0.5,
      grav: 0, drag: 0.98, color: '#fff', type: 'spark',
      rot: 0, vr: 0, text: '', size: 14, worldLocked: true, glow: false,
      ...p,
    };
    part.max = part.life;
    this.list.push(part);
    return part;
  }

  /** Ledakan partikel sederhana. */
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.angle !== undefined ? opt.angle + rand(-0.6, 0.6) : rand(0, Math.PI * 2);
      const sp = rand(opt.spMin ?? 60, opt.spMax ?? 260);
      this.add({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(opt.rMin ?? 2, opt.rMax ?? 5),
        life: rand(opt.lifeMin ?? 0.3, opt.lifeMax ?? 0.7),
        color: Array.isArray(opt.color) ? opt.color[randInt(0, opt.color.length - 1)] : (opt.color || '#fff'),
        type: opt.type || 'spark',
        grav: opt.grav ?? 420,
        drag: opt.drag ?? 0.93,
        glow: opt.glow ?? false,
      });
    }
  }

  ring(x, y, opt = {}) {
    this.add({
      x, y, r: opt.r ?? 8, life: opt.life ?? 0.45, type: 'ring',
      color: opt.color || '#fff', vx: 0, vy: 0, grav: 0,
      size: opt.to ?? 60, glow: true, worldLocked: opt.worldLocked ?? true,
    });
  }

  text(x, y, str, opt = {}) {
    this.add({
      x, y, text: str, type: 'text',
      vx: opt.vx ?? 0, vy: opt.vy ?? -58, grav: 0, drag: 1,
      life: opt.life ?? 0.95, color: opt.color || '#fff',
      size: opt.size ?? 16, glow: true, worldLocked: opt.worldLocked ?? true,
    });
  }

  feathers(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      this.add({
        x, y, vx: rand(-140, 60), vy: rand(-220, -40),
        r: rand(3, 5.5), life: rand(0.7, 1.4), color,
        type: 'feather', grav: 260, drag: 0.97,
        rot: rand(0, 6.28), vr: rand(-7, 7),
      });
    }
  }

  /**
   * @param {number} dt
   * @param {number} worldVx kecepatan dunia (pipa) agar partikel ikut bergeser
   */
  update(dt, worldVx = 0) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += (p.vx - (p.worldLocked ? worldVx : 0)) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.x < -80) { list.splice(i, 1); }
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = Math.max(0, p.life / p.max);
      ctx.save();
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
      }
      switch (p.type) {
        case 'text': {
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.font = `900 ${p.size}px "Trebuchet MS", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          break;
        }
        case 'ring': {
          const rr = p.r + (p.size - p.r) * (1 - k);
          ctx.globalAlpha = k * 0.85;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 + 3 * k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'feather': {
          ctx.globalAlpha = k;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.9, p.r * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'square': {
          ctx.globalAlpha = k;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const s = p.r * 2 * (0.4 + k * 0.6);
          ctx.fillRect(-s / 2, -s / 2, s, s);
          break;
        }
        case 'streak': {
          ctx.globalAlpha = k * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.r;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.05 - 12, p.y + p.vy * 0.05);
          ctx.stroke();
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = k * 0.4;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (2 - k), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fire': {
          ctx.globalAlpha = k;
          const cold = withAlpha('#ff4d00', 1);
          ctx.fillStyle = k > 0.6 ? '#fff3bf' : k > 0.3 ? p.color : cold;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.6 + k * 0.9), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'bar': {
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          roundRect(ctx, p.x, p.y, p.size, p.r, p.r / 2);
          ctx.fill();
          break;
        }
        default: {
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.35 + k * 0.75), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}

export default Particles;
