/** pipe.js — pipa penghalang. Bisa "drift" (naik-turun) di biome tertentu. */

import { PIPE, H, FLOOR_Y, DRIFT } from '../config.js';
import { clamp, rand } from '../utils.js';

export class Pipe {
  /**
   * @param {number} x posisi awal (kanan layar)
   * @param {number} gapY titik tengah celah
   * @param {number} gapH tinggi celah
   * @param {boolean} drift apakah pipa bergerak vertikal
   */
  constructor(x, gapY, gapH, drift = false) {
    this.x = x;
    this.w = PIPE.w;
    this.gapY = gapY;
    this.baseGapY = gapY;
    this.gapH = gapH;
    this.scored = false;
    this.drift = drift;
    this.driftPhase = rand(0, Math.PI * 2);
    this.driftDir = Math.random() < 0.5 ? -1 : 1;
  }

  get gapTop() { return this.gapY - this.gapH / 2; }
  get gapBottom() { return this.gapY + this.gapH / 2; }
  get right() { return this.x + this.w; }
  get centerX() { return this.x + this.w / 2; }

  update(dt, vx) {
    this.x -= vx * dt;
    if (this.drift) {
      this.driftPhase += dt * (DRIFT.speed / 24) * this.driftDir;
      const min = PIPE.margin + this.gapH / 2;
      const max = FLOOR_Y - PIPE.margin - this.gapH / 2;
      this.gapY = clamp(this.baseGapY + Math.sin(this.driftPhase) * DRIFT.range, min, max);
    }
  }

  /** Dua kotak tabrakan: pipa atas & bawah. */
  rects() {
    const top = { x: this.x, y: -220, w: this.w, h: this.gapTop + 220 };
    const bot = { x: this.x, y: this.gapBottom, w: this.w, h: H - this.gapBottom };
    return [top, bot];
  }

  draw(ctx, colors) {
    const [lite, mid, dark] = colors;
    const capH = 26;
    const capOver = 5;

    const body = (y, h) => {
      if (h <= 0) return;
      // gradient horizontal supaya pipa terlihat silindris
      const g = ctx.createLinearGradient(this.x, 0, this.x + this.w, 0);
      g.addColorStop(0, dark);
      g.addColorStop(0.22, lite);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fillRect(this.x, y, this.w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.x + 0.75, y, this.w - 1.5, h);
    };

    const cap = (y) => {
      const x = this.x - capOver;
      const w = this.w + capOver * 2;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, dark);
      g.addColorStop(0.2, lite);
      g.addColorStop(0.6, mid);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, capH);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, capH - 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 4, y + 3, 5, capH - 6);
    };

    const gt = this.gapTop;
    const gb = this.gapBottom;
    body(-220, gt + 220 - capH);
    cap(gt - capH);
    body(gb + capH, H - gb - capH);
    cap(gb);

    // indikator arah untuk pipa yang bergerak
    if (this.drift) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff';
      const cy = this.gapY;
      const dir = Math.cos(this.driftPhase) * this.driftDir >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(this.centerX, cy + dir * 13);
      ctx.lineTo(this.centerX - 6, cy + dir * 4);
      ctx.lineTo(this.centerX + 6, cy + dir * 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

export default Pipe;
