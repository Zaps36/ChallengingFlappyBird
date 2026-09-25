/**
 * skins.js — database skin burung.
 *
 * Semua skin digambar secara prosedural (path kanvas), jadi tidak butuh
 * file gambar. Kalau nanti mau pakai sprite .png, cukup isi `spriteUrl`
 * pada skin — renderer otomatis memakai gambar itu dan mengabaikan
 * gambar geometrisnya. Lihat README bagian "Mengganti aset".
 */

import { withAlpha, roundRect } from './utils.js';

const imgCache = new Map();
function getSprite(url) {
  if (!url || typeof Image === 'undefined') return null;
  if (imgCache.has(url)) {
    const rec = imgCache.get(url);
    return rec.ok ? rec.img : null;
  }
  const img = new Image();
  const rec = { img, ok: false };
  img.onload = () => { rec.ok = true; };
  img.onerror = () => { rec.ok = false; };
  img.src = url;
  imgCache.set(url, rec);
  return null;
}

/* ---------------------------------------------------------------
 * Renderer dasar: badan + sayap + mata + paruh + ekor.
 * ctx sudah di-translate ke pusat burung dan dirotasi.
 * ------------------------------------------------------------- */
function drawBase(ctx, p, s) {
  const r = s.r;
  const wing = Math.sin(s.wingPhase) * 0.95;

  // ekor
  ctx.fillStyle = p.wing;
  ctx.beginPath();
  ctx.moveTo(-r * 0.75, -r * 0.1);
  ctx.lineTo(-r * 1.7, -r * 0.55 - wing * 2);
  ctx.lineTo(-r * 1.6, r * 0.45 - wing * 2);
  ctx.closePath();
  ctx.fill();

  // badan
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, p.body);
  g.addColorStop(1, p.body2 || p.body);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.18, r, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.outline) {
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // perut
  if (p.belly) {
    ctx.fillStyle = p.belly;
    ctx.beginPath();
    ctx.ellipse(r * 0.12, r * 0.34, r * 0.72, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // sayap
  ctx.save();
  ctx.translate(-r * 0.12, r * 0.05);
  ctx.rotate(wing * 0.55);
  ctx.fillStyle = p.wing;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.68, r * 0.42, -0.2, 0, Math.PI * 2);
  ctx.fill();
  if (p.wingLine) {
    ctx.strokeStyle = p.wingLine;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();

  // paruh
  ctx.fillStyle = p.beak;
  ctx.beginPath();
  ctx.moveTo(r * 0.95, -r * 0.1);
  ctx.lineTo(r * 1.72, r * 0.06);
  ctx.lineTo(r * 0.95, r * 0.3);
  ctx.closePath();
  ctx.fill();

  // mata
  if (p.visor) {
    ctx.fillStyle = p.visor;
    roundRect(ctx, r * 0.1, -r * 0.52, r * 0.95, r * 0.4, r * 0.16);
    ctx.fill();
    ctx.fillStyle = p.eye || '#fff';
    const sx = (Math.sin(s.t * 6) * 0.5 + 0.5) * r * 0.55;
    ctx.fillRect(r * 0.14 + sx, -r * 0.46, r * 0.16, r * 0.28);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.46, -r * 0.34, r * 0.33, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.eye || '#181818';
    ctx.beginPath();
    ctx.arc(r * 0.56, -r * 0.34, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------------------------------------------------------
 * Database skin
 * ------------------------------------------------------------- */
export const SKINS = [
  {
    id: 'default',
    name: 'Si Kuning',
    flavor: 'Klasik. Tidak pernah salah.',
    price: 0,
    spriteUrl: null,
    palette: { body: '#ffe066', body2: '#f4b400', beak: '#ff8b3d', wing: '#f0a52a', belly: '#fff3bf', eye: '#20232e', outline: 'rgba(120,70,0,0.35)' },
    emit: null,
  },
  {
    id: 'crimson',
    name: 'Red Flash',
    flavor: 'Meninggalkan jejak merah saat melesat.',
    price: 50,
    spriteUrl: null,
    palette: { body: '#ff6b6b', body2: '#c92a2a', beak: '#ffd43b', wing: '#e03131', belly: '#ffc9c9', eye: '#2b0000', outline: 'rgba(90,0,0,0.4)' },
    emit: { type: 'streak', color: '#ff6b6b', rate: 26 },
  },
  {
    id: 'golden',
    name: 'Golden Bird',
    flavor: 'Berkilau. Investasi terbaik unggas.',
    price: 200,
    spriteUrl: null,
    palette: { body: '#ffe9a3', body2: '#e0a800', beak: '#fff3bf', wing: '#f7c500', belly: '#fff9db', eye: '#4a3200', outline: 'rgba(120,80,0,0.5)' },
    glow: '#ffd447',
    emit: { type: 'sparkle', color: '#ffe066', rate: 16 },
  },
  {
    id: 'ninja',
    name: 'Jade Ninja',
    flavor: 'Pipa tidak pernah melihatnya datang.',
    price: 350,
    spriteUrl: null,
    palette: { body: '#343a40', body2: '#1b1f24', beak: '#adb5bd', wing: '#212529', belly: '#495057', eye: '#51cf66', outline: 'rgba(0,0,0,0.5)' },
    emit: { type: 'smoke', color: 'rgba(120,140,130,0.5)', rate: 10 },
    extra(ctx, s) {
      const r = s.r;
      ctx.fillStyle = '#51cf66';
      ctx.fillRect(-r * 0.1, -r * 0.62, r * 1.05, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.6);
      ctx.lineTo(-r * 1.5, -r * 0.5 + Math.sin(s.t * 9) * r * 0.35);
      ctx.lineTo(-r * 1.45, -r * 0.16 + Math.sin(s.t * 9 + 0.6) * r * 0.35);
      ctx.lineTo(-r * 0.1, -r * 0.38);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'robot',
    name: 'Cyber Byte',
    flavor: '01000110 01001100 01000001 01010000',
    price: 500,
    spriteUrl: null,
    palette: { body: '#ced4da', body2: '#868e96', beak: '#fab005', wing: '#adb5bd', belly: '#e9ecef', visor: '#0b7285', eye: '#66f5ff', outline: 'rgba(20,40,60,0.6)' },
    glow: '#66f5ff',
    emit: { type: 'spark', color: '#66f5ff', rate: 12 },
    extra(ctx, s) {
      const r = s.r;
      ctx.strokeStyle = '#66f5ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.95);
      ctx.lineTo(-r * 0.35, -r * 1.5);
      ctx.stroke();
      ctx.fillStyle = Math.sin(s.t * 10) > 0 ? '#ff6b6b' : '#66f5ff';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 1.58, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'ghost',
    name: 'Arwah Pipa',
    flavor: 'Katanya dulu dia mati di skor 3.',
    price: 650,
    spriteUrl: null,
    alpha: 0.62,
    palette: { body: '#e7f5ff', body2: '#a5d8ff', beak: '#74c0fc', wing: '#d0ebff', belly: '#f8f9fa', eye: '#1864ab', outline: 'rgba(200,230,255,0.7)' },
    glow: '#a5d8ff',
    emit: { type: 'wisp', color: 'rgba(200,230,255,0.6)', rate: 14 },
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    flavor: 'Jejak api. Sayang tidak bisa bangkit lagi.',
    price: 900,
    spriteUrl: null,
    palette: { body: '#ffa94d', body2: '#e8590c', beak: '#ffe066', wing: '#f76707', belly: '#ffd8a8', eye: '#5c2000', outline: 'rgba(120,40,0,0.5)' },
    glow: '#ff922b',
    emit: { type: 'fire', color: '#ff922b', rate: 44 },
    extra(ctx, s) {
      const r = s.r;
      ctx.fillStyle = withAlpha('#ffd43b', 0.75);
      for (let i = 0; i < 3; i++) {
        const o = Math.sin(s.t * 12 + i) * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.2 + i * r * 0.28, -r * 0.9);
        ctx.lineTo(-r * 0.05 + i * r * 0.28, -r * 1.55 + o);
        ctx.lineTo(r * 0.1 + i * r * 0.28, -r * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  {
    id: 'glitch',
    name: 'Glitch',
    flavor: 'ERR0R: bird n0t f0und. Skin paling mahal.',
    price: 1400,
    spriteUrl: null,
    palette: { body: '#f8f9fa', body2: '#adb5bd', beak: '#f06595', wing: '#dee2e6', belly: '#fff', eye: '#000', outline: 'rgba(0,0,0,0.4)' },
    emit: { type: 'rgb', color: '#ff00c8', rate: 30 },
    wrap(ctx, s, base) {
      // RGB split: dua lapis offset (aditif) + lapis utama di atasnya
      const o = Math.sin(s.t * 33) > 0.7 ? 3.4 : 1.3;
      const a = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.translate(-o, 0);
      ctx.globalAlpha = a * 0.5;
      base(ctx, s);
      ctx.restore();
      ctx.save();
      ctx.translate(o, 0.8);
      ctx.globalAlpha = a * 0.5;
      base(ctx, s);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      base(ctx, s);
    },
  },
];

export const SKIN_MAP = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const getSkin = (id) => SKIN_MAP[id] || SKIN_MAP.default;

/**
 * Gambar burung dengan skin tertentu.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id skin id
 * @param {{r:number, rot:number, wingPhase:number, t:number, alpha?:number}} s
 */
export function drawBird(ctx, id, s) {
  const skin = getSkin(id);
  const st = { r: s.r, rot: s.rot || 0, wingPhase: s.wingPhase || 0, t: s.t || 0 };

  ctx.save();
  ctx.globalAlpha = (s.alpha ?? 1) * (skin.alpha ?? 1);

  if (skin.glow) {
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 18;
  }

  const sprite = getSprite(skin.spriteUrl);
  const paint = (c, ss) => {
    if (sprite) {
      const w = ss.r * 2.9;
      const h = ss.r * 2.2;
      c.drawImage(sprite, -w / 2, -h / 2, w, h);
    } else {
      drawBase(c, skin.palette, ss);
      if (skin.extra) skin.extra(c, ss);
    }
  };

  if (skin.wrap) skin.wrap(ctx, st, paint);
  else paint(ctx, st);

  ctx.restore();
}

/** Preview untuk kartu di shop (kanvas kecil, tanpa rotasi). */
export function drawSkinPreview(ctx, id, w, h, t = 0) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 - 2, h / 2);
  const r = Math.min(w, h) * 0.3;
  drawBird(ctx, id, { r, rot: -0.1, wingPhase: t * 7, t });
  ctx.restore();
}
