/** projectile.js — peluru musuh (hostile) dan tembakan bulu milik burung. */

import { W, H, FLOOR_Y } from '../config.js';
import { withAlpha } from '../utils.js';

export class Projectile {
  /**
   * @param {object} o {x,y,vx,vy,r,kind,hostile,grav,dmg}
   */
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, r: 6, kind: 'bullet',
      hostile: true, grav: 0, dmg: 1, dead: false, age: 0, spin: 0,
    }, o);
  }

  update(dt, worldVx) {
    this.age += dt;
    this.vy += this.grav * dt;
    // peluru musuh ikut terbawa arus dunia, bulu burung tidak
    this.x += (this.vx - (this.hostile ? worldVx * 0.35 : 0)) * dt;
    this.y += this.vy * dt;
    this.spin += dt * 12;
    if (this.x < -30 || this.x > W + 60 || this.y > H + 40 || this.y < -120) this.dead = true;
    if (this.kind === 'bomb' && this.y > FLOOR_Y - 4) this.dead = true;
  }

  draw(ctx, t) {
    ctx.save();
    switch (this.kind) {
      case 'feather': {
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.sin(this.age * 22) * 0.35);
        ctx.shadowColor = '#fff3bf';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#fff9db';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.r * 1.9, this.r * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f0a52a';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-this.r * 1.8, 0);
        ctx.lineTo(this.r * 1.8, 0);
        ctx.stroke();
        break;
      }
      case 'bomb': {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin * 0.3);
        ctx.fillStyle = '#343a40';
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#868e96';
        ctx.fillRect(-2, -this.r - 5, 4, 6);
        const blink = Math.sin(t * 18) > 0;
        ctx.fillStyle = blink ? '#ff6b6b' : '#ffd43b';
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -this.r - 7, 2.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'plasma': {
        ctx.shadowColor = '#c77dff';
        ctx.shadowBlur = 16;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 1.7);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.4, '#e0aaff');
        g.addColorStop(1, withAlpha('#7b2cbf', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 1.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        // peluru standar dengan ekor
        ctx.strokeStyle = withAlpha('#ff6b6b', 0.4);
        ctx.lineWidth = this.r * 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 0.035, this.y - this.vy * 0.035);
        ctx.stroke();
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffe3e3';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

export default Projectile;
