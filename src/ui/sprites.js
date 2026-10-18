// Sprite loading + drawing helpers for the 0x72 frames and generated icons.
import { SPRITES } from './manifest.js';
import { GEN } from './gen-manifest.js';

const cache = new Map();

function frameNames(name) {
  if (name in SPRITES) return SPRITES[name] ? Array.from({ length: SPRITES[name] }, (_, i) => `${name}_f${i}`) : [name];
  if (name + '_anim' in SPRITES) return frameNames(name + '_anim');
  if (/_f\d+$/.test(name)) return [name];
  return [];
}

function load(src) {
  if (cache.has(src)) return cache.get(src);
  const img = new Image();
  img.src = src;
  cache.set(src, img);
  return img;
}

export function preloadAll() {
  const imgs = [];
  for (const [name, n] of Object.entries(SPRITES)) {
    for (const f of n ? Array.from({ length: n }, (_, i) => `${name}_f${i}`) : [name]) imgs.push(load(`assets/0x72/frames/${f}.png`));
  }
  for (const p of Object.values(GEN)) imgs.push(load(p));
  return Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
}

// Animated frame for a sprite name at time t (ms).
export function sprite(name, t = 0, fps = 6) {
  const fr = frameNames(name);
  if (!fr.length) return null;
  const f = fr[Math.floor((t / 1000) * fps) % fr.length];
  return load(`assets/0x72/frames/${f}.png`);
}

export const genImage = (key) => (GEN[key] ? load(GEN[key]) : null);

// Spell icon: generated art if present, else the tileset item.
export function spellIcon(id, iconName, t = 0) {
  return genImage('spell_' + id) || sprite(iconName, t);
}

// Draw an image fitted into box (dx,dy,dw,dh) keeping aspect, anchored bottom-center.
export function drawFit(ctx, img, dx, dy, dw, dh, anchorBottom = false) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const s = Math.min(dw / img.naturalWidth, dh / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, dx + (dw - w) / 2, anchorBottom ? dy + dh - h : dy + (dh - h) / 2, w, h);
}

// Small canvas with an icon, for DOM use.
export function iconCanvas(img, size = 32, bg = null) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const draw = () => {
    ctx.clearRect(0, 0, size, size);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
    drawFit(ctx, img, 2, 2, size - 4, size - 4);
  };
  if (img && !img.complete) img.addEventListener('load', draw, { once: true });
  draw();
  return c;
}
