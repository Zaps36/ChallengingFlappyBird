/** pickup.js — koin, permata, dan power-up yang mengambang di jalur terbang. */

import { COIN, GEM, POWERUPS } from '../config.js';
import { rand, withAlpha } from '../utils.js';

export class Pickup {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'coin'|'gem'|'power'} kind
   * @param {string|null} power id power-up jika kind === 'power'
   */
  constructor(x, y, kind = 'coin', power = null) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.kind = kind;
    this.power = power;
    this.r = kind === 'gem' ? GEM.r : kind === 'power' ? 15 : COIN.r;
    this.value = kind === 'gem' ? GEM.value : COIN.value;
    this.phase = rand(0, Math.PI * 2);
    this.spin = rand(0, Math.PI * 2);
    this.dead = false;
    this.pulled = false;
    this.vx = 0;
    this.vy = 0;
  }

  /**
   * @param {object} magnet {active, x, y, radius, pull}
   */
  update(dt, worldVx, magnet) {
    this.phase += dt * 3;
    this.spin += dt * 3.2;

    if (magnet && magnet.active) {
      const dx = magnet.x - this.x;
      const dy = magnet.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < magnet.radius && this.kind !== 'power') {
        const f = magnet.pull * (1 - d / magnet.radius);
        this.vx += (dx / (d || 1)) * f * dt;
        this.vy += (dy / (d || 1)) * f * dt;
        this.pulled = true;
      }
    }
    if (!this.pulled) {
      this.vx = 0;
      this.vy = 0;
      this.y = this.baseY + Math.sin(this.phase) * 6;
    } else {
      this.y += this.vy * dt;
      this.baseY = this.y;
    }

    this.x += (this.vx - worldVx) * dt;
    if (this.x < -40) this.dead = true;
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.kind === 'coin') {
      const sx = Math.abs(Math.cos(this.spin)) * 0.85 + 0.15;
      ctx.shadowColor = '#ffd447';
      ctx.shadowBlur = 12;
      ctx.scale(sx, 1);
      const g = ctx.createLinearGradient(0, -this.r, 0, this.r);
      g.addColorStop(0, '#fff3bf');
      g.addColorStop(0.5, '#ffd43b');
      g.addColorStop(1, '#e8a90c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a97a06';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (sx > 0.5) {
        ctx.fillStyle = '#a97a06';
        ctx.font = `900 ${this.r * 1.2}px "Trebuchet MS", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 0.5);
      }
    } else if (this.kind === 'gem') {
      ctx.rotate(Math.sin(this.phase) * 0.22);
      ctx.shadowColor = '#c77dff';
      ctx.shadowBlur = 16;
      const r = this.r;
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#f3d9ff');
      g.addColorStop(0.5, '#c77dff');
      g.addColorStop(1, '#7b2cbf');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.15);
      ctx.lineTo(r * 0.92, -r * 0.2);
      ctx.lineTo(0, r * 1.15);
      ctx.lineTo(-r * 0.92, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha('#ffffff', 0.7);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      const def = POWERUPS[this.power] || POWERUPS.double;
      const pulse = 1 + Math.sin(t * 7) * 0.09;
      ctx.rotate(Math.sin(this.phase * 0.6) * 0.14);
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 20;
      // kapsul
      const g = ctx.createRadialGradient(0, -4, 2, 0, 0, this.r * 1.5);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, def.color);
      g.addColorStop(1, withAlpha(def.color, 0.15));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, this.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, this.r * pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // simbol digambar manual (bukan emoji) agar konsisten di semua font
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      const r = this.r * 0.62;
      if (this.power === 'double') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const a2 = a + Math.PI / 5;
          ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
        }
        ctx.closePath();
        ctx.fill();
      } else if (this.power === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.85, -r * 0.5);
        ctx.lineTo(r * 0.85, r * 0.25);
        ctx.quadraticCurveTo(r * 0.8, r, 0, r * 1.05);
        ctx.quadraticCurveTo(-r * 0.8, r, -r * 0.85, r * 0.25);
        ctx.lineTo(-r * 0.85, -r * 0.5);
        ctx.closePath();
        ctx.fill();
      } else {
        // magnet berbentuk U
        ctx.lineWidth = r * 0.5;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.62, Math.PI, 0, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.1);
        ctx.lineTo(-r * 0.62, r * 0.7);
        ctx.moveTo(r * 0.62, -r * 0.1);
        ctx.lineTo(r * 0.62, r * 0.7);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export default Pickup;
