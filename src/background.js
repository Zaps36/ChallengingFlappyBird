/**
 * background.js — langit, parallax, tanah, dan cuaca per biome.
 * Termasuk crossfade halus saat biome berganti dan overlay gelap
 * (spotlight) untuk biome malam.
 */

import { W, H, FLOOR_Y, BIOMES, DARK } from './config.js';
import { rand, randInt, clamp, withAlpha, vGradient } from './utils.js';

const FADE_TIME = 1.1;

export class Background {
  constructor(biomeIndex = 0) {
    this.cur = BIOMES[biomeIndex % BIOMES.length];
    this.prev = null;
    this.fade = 1;

    this.stars = Array.from({ length: 70 }, () => ({
      x: rand(0, W), y: rand(0, FLOOR_Y - 60), r: rand(0.6, 1.9), tw: rand(0, 6.28), sp: rand(0.15, 0.6),
    }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: rand(0, W + 120), y: rand(40, FLOOR_Y * 0.55), s: rand(0.6, 1.5), p: rand(0.1, 0.3), seed: randInt(0, 999),
    }));
    this.rain = Array.from({ length: 110 }, () => ({
      x: rand(0, W), y: rand(0, H), len: rand(9, 22), sp: rand(620, 980),
    }));
    this.dust = Array.from({ length: 46 }, () => ({
      x: rand(0, W), y: rand(0, FLOOR_Y), r: rand(0.8, 2.6), sp: rand(6, 26), ph: rand(0, 6.28),
    }));

    this.hillOff = 0;
    this.hill2Off = 0;
    this.groundOff = 0;
    this.t = 0;
    this.flash = 0;
    this.lightningT = rand(3, 7);
    this.onThunder = null;
  }

  setBiome(biome) {
    if (biome.id === this.cur.id) return;
    this.prev = this.cur;
    this.cur = biome;
    this.fade = 0;
  }

  update(dt, worldVx, wind = 0) {
    this.t += dt;
    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / FADE_TIME);

    this.hillOff = (this.hillOff + worldVx * 0.1 * dt) % (W * 2);
    this.hill2Off = (this.hill2Off + worldVx * 0.22 * dt) % (W * 2);
    this.groundOff = (this.groundOff + worldVx * dt) % 48;

    for (const c of this.clouds) {
      c.x -= worldVx * c.p * dt + 6 * dt;
      if (c.x < -140) {
        c.x = W + rand(20, 160);
        c.y = rand(40, FLOOR_Y * 0.55);
        c.s = rand(0.6, 1.5);
      }
    }
    for (const s of this.stars) s.tw += dt * s.sp * 4;

    const stormy = this.cur.id === 'storm';
    if (stormy) {
      for (const d of this.rain) {
        d.y += d.sp * dt;
        d.x -= (d.sp * 0.25 + wind * 1.4) * dt;
        if (d.y > H) { d.y = -20; d.x = rand(-40, W + 40); }
        if (d.x < -40) d.x = W + rand(0, 40);
      }
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = rand(4.5, 11);
        this.flash = 1;
        if (this.onThunder) this.onThunder();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.6);

    if (this.cur.id === 'void') {
      for (const d of this.dust) {
        d.ph += dt;
        d.x -= (worldVx * 0.12 + d.sp) * dt;
        d.y += Math.sin(d.ph) * 6 * dt;
        if (d.x < -10) { d.x = W + 10; d.y = rand(0, FLOOR_Y); }
      }
    }
  }

  /** Langit + parallax jauh. */
  drawSky(ctx) {
    if (this.prev && this.fade < 1) {
      this._sky(ctx, this.prev, 1);
      ctx.save();
      ctx.globalAlpha = this.fade;
      this._sky(ctx, this.cur, 1);
      ctx.restore();
    } else {
      this._sky(ctx, this.cur, 1);
    }
  }

  _sky(ctx, b, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = vGradient(ctx, 0, 0, FLOOR_Y, b.sky);
    ctx.fillRect(0, 0, W, FLOOR_Y + 2);

    const dark = b.id === 'night' || b.id === 'void';
    // bintang
    if (dark) {
      for (const s of this.stars) {
        ctx.globalAlpha = alpha * (0.35 + Math.abs(Math.sin(s.tw)) * 0.65);
        ctx.fillStyle = b.id === 'void' ? '#e5d5ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }

    // matahari / bulan
    const cx = W * 0.74;
    const cy = FLOOR_Y * 0.24;
    if (b.id === 'void') {
      // planet bergaris
      ctx.fillStyle = '#7048e8';
      ctx.shadowColor = '#b197fc';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = withAlpha('#e5d5ff', 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 58, 14, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.id === 'night') {
      ctx.fillStyle = '#f1f3f5';
      ctx.shadowColor = '#dbe4ff';
      ctx.shadowBlur = 34;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = withAlpha('#adb5bd', 0.5);
      ctx.beginPath(); ctx.arc(cx - 8, cy - 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 7, cy + 8, 7, 0, Math.PI * 2); ctx.fill();
    } else if (b.id !== 'storm') {
      const sun = b.id === 'sunset' ? '#ffe066' : '#fff8db';
      ctx.fillStyle = sun;
      ctx.shadowColor = b.id === 'sunset' ? '#ff922b' : '#fff3bf';
      ctx.shadowBlur = 50;
      ctx.beginPath();
      ctx.arc(cx, cy, b.id === 'sunset' ? 40 : 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // awan
    ctx.fillStyle = b.cloud;
    for (const c of this.clouds) this._cloud(ctx, c.x, c.y, c.s);

    // bukit jauh & dekat
    this._hills(ctx, b.hill2, FLOOR_Y - 60, 46, this.hillOff, 0.9);
    this._hills(ctx, b.hill, FLOOR_Y - 26, 60, this.hill2Off, 1.25);
    ctx.restore();
  }

  _cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, 34 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 24 * s, y + 4 * s, 24 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * s, y + 5 * s, 20 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 4 * s, y - 10 * s, 20 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _hills(ctx, color, baseY, amp, off, freq) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) {
      const k = (x + off) / W;
      const y = baseY - Math.sin(k * Math.PI * 2 * freq) * amp * 0.5
        - Math.sin(k * Math.PI * 5.3 * freq + 1.7) * amp * 0.28;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  /** Cuaca yang digambar di atas pipa tapi di bawah HUD. */
  drawWeather(ctx, wind) {
    if (this.cur.id === 'storm') {
      ctx.save();
      ctx.strokeStyle = 'rgba(200,225,255,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const d of this.rain) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + (wind > 0 ? -4 : 4) - 3, d.y + d.len);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (this.cur.id === 'void') {
      ctx.save();
      ctx.fillStyle = 'rgba(224,170,255,0.55)';
      for (const d of this.dust) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Tanah bergaris + rumput. */
  drawGround(ctx) {
    const b = this.cur;
    const [g1, g2] = b.ground;
    ctx.save();
    ctx.fillStyle = vGradient(ctx, 0, FLOOR_Y, H, [g1, g2]);
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // garis rumput atas
    ctx.fillStyle = withAlpha('#ffffff', 0.12);
    ctx.fillRect(0, FLOOR_Y, W, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = -this.groundOff; x < W; x += 48) {
      ctx.fillRect(x, FLOOR_Y + 8, 24, 5);
      ctx.fillRect(x + 24, FLOOR_Y + 22, 18, 4);
    }
    ctx.restore();
  }

  /** Overlay gelap + spotlight untuk biome malam, dan kilat badai. */
  drawOverlay(ctx, bird) {
    if (this.cur.id === 'night' && this.fade > 0.15) {
      const a = DARK.vignette * clamp(this.fade, 0, 1);
      const g = ctx.createRadialGradient(bird.x, bird.y, 20, bird.x, bird.y, DARK.spotlight);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, `rgba(2,4,12,${a * 0.5})`);
      g.addColorStop(1, `rgba(2,4,12,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

export default Background;
