// Canvas board renderer with an event timeline for animations.
import { T, ENEMIES, ALLIES, CLASSES } from '../core/data.js';
import { SPELLS } from '../core/spells.js';
import { intentMap, intentTiles, reachOf } from '../core/ai.js';
import { key, spikesUp, tile } from '../core/engine.js';
import { sprite, spellIcon, drawFit } from './sprites.js';
import { sfx } from './audio.js';

export const SLOT_COLORS = ['#ff7a5c', '#ffd25a', '#7ee06a', '#5ac8ff', '#c58cff', '#ff8fd0', '#ffffff'];
const BIOME_TINT = { crypt: null, swamp: '#3d8a3a', frozen: '#4a8ad8', warrens: '#a8743a', inferno: '#c0301c' };
const tintCache = new Map();
function tinted(img, color) {
  if (!img || !img.complete || !img.naturalWidth) return img;
  const k = img.src + color;
  if (tintCache.has(k)) return tintCache.get(k);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = 0.55;
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  c.naturalWidth = c.width; c.naturalHeight = c.height; c.complete = true;
  tintCache.set(k, c);
  return c;
}
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.ts = 48;
    this.g = null;
    this.fx = [];
    this.busy = false;
    this.hover = null;
    this.showDanger = true;
    this.shake = 0;
    this.speed = 1;
    this.last = performance.now();
    const loop = (t) => { this.draw(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setGame(g) { this.g = g; this.fx = []; this.syncAll(); }

  syncAll() {
    const g = this.g;
    this.vis = { hero: { x: g.hero.x, y: g.hero.y, px: g.hero.x, py: g.hero.y, flash: 0, lunge: null }, units: new Map() };
    for (const u of g.units) this.vis.units.set(u.id, this.mkVis(u));
  }
  mkVis(u) { return { id: u.id, type: u.type, team: u.team, x: u.x, y: u.y, px: u.x, py: u.y, hp: u.hp, maxHp: u.maxHp, alpha: 1, flash: 0, dying: 0, lunge: null }; }
  syncSoft() {
    const g = this.g, seen = new Set();
    for (const u of g.units) {
      seen.add(u.id);
      const v = this.vis.units.get(u.id);
      if (v) Object.assign(v, { x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, alpha: 1, dying: 0 });
      else this.vis.units.set(u.id, this.mkVis(u));
    }
    for (const id of [...this.vis.units.keys()]) if (!seen.has(id)) this.vis.units.delete(id);
    this.vis.hero.x = g.hero.x; this.vis.hero.y = g.hero.y;
  }

  resize(availW, availH) {
    if (!this.g) return;
    const { w, h } = this.g.map;
    const ts = Math.max(20, Math.floor(Math.min(availW / w, availH / (h + 0.4))));
    this.ts = ts;
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.c.width = Math.round(w * ts * dpr);
    this.c.height = Math.round((h + 0.4) * ts * dpr);
    this.c.style.width = w * ts + 'px';
    this.c.style.height = (h + 0.4) * ts + 'px';
    this.oy = 0.4 * ts;
  }

  tileAtPx(px, py) {
    const x = Math.floor(px / this.ts), y = Math.floor((py - this.oy) / this.ts);
    if (!this.g || x < 0 || y < 0 || x >= this.g.map.w || y >= this.g.map.h) return null;
    return [x, y];
  }

  // ---- timeline -------------------------------------------------------------
  async play(events) {
    this.busy = true;
    const steps = [];
    for (const e of events) {
      const prev = steps[steps.length - 1];
      if (e.t === 'move' && prev && prev[0].t === 'move' && !prev.some((p) => p.id === e.id)) prev.push(e);
      else steps.push([e]);
    }
    for (const step of steps) {
      let dur = 0;
      for (const e of step) dur = Math.max(dur, this.apply(e));
      if (dur > 0) await new Promise((r) => setTimeout(r, dur / this.speed));
    }
    this.syncSoft();
    this.busy = false;
  }

  float(x, y, s, c, big = false) { this.fx.push({ k: 'float', x, y, s, c, t0: performance.now(), dur: 900, big }); }

  apply(e) {
    const V = this.vis, now = performance.now();
    const U = (id) => V.units.get(id);
    switch (e.t) {
      case 'heromove': V.hero.x = e.to[0]; V.hero.y = e.to[1]; sfx('step'); return e.dash ? 55 : 85;
      case 'move': { const u = U(e.id); if (u) { u.x = e.to[0]; u.y = e.to[1]; } return e.push ? 70 : 75; }
      case 'lunge': { const u = U(e.id); if (u) u.lunge = { to: e.to, t0: now }; sfx('swing'); return 110; }
      case 'hit': { const u = U(e.id); if (u) { u.hp -= e.n; u.flash = 1; } this.float(e.x, e.y, '-' + e.n, '#fff'); sfx('hit'); return 70; }
      case 'hurt': V.hero.flash = 1; this.shake = 7; this.float(e.x, e.y, '-' + e.n, '#ff4d4d', true); if (e.src) this.float(e.x, e.y + 0.45, e.src.toUpperCase(), '#ffb0b0'); sfx('hurt'); return 160;
      case 'heal': this.float(e.x, e.y, '+' + e.n, '#7dff6b'); sfx('heal'); return 60;
      case 'death': { const u = U(e.id); if (u) u.dying = now; sfx('death'); return 80; }
      case 'bolt': { const d = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]); const dur = 70 + d * 14; this.fx.push({ k: 'bolt', ...e, t0: now, dur }); sfx('bolt'); return dur; }
      case 'aoe': this.fx.push({ k: 'aoe', tiles: e.tiles, c: e.c, t0: now, dur: 260 }); sfx('boom'); return 120;
      case 'text': this.float(e.x, e.y, e.s, e.c); return 40;
      case 'cast': this.float(e.x, e.y - 0.4, SPELLS[e.id].name.toUpperCase(), CLASSES[SPELLS[e.id].cls].color, true); sfx('cast'); return 90;
      case 'spawn': { const u = this.g.units.find((v) => v.id === e.id); if (u && !U(u.id)) { const v = this.mkVis(u); v.alpha = 0; V.units.set(u.id, v); } sfx('spawn'); return 70; }
      case 'fall': this.float(e.x, e.y, 'FELL', '#c8a26b'); return 60;
      case 'bonk': this.shake = Math.max(this.shake, 3); return 40;
      case 'herodeath': sfx('die'); return 500;
      case 'cleared': sfx('clear'); return 250;
      case 'intent': sfx('warn'); return 60;
      case 'spellback': this.fx.push({ k: 'ring', x: e.x, y: e.y, t0: now, dur: 400 }); return 0;
      default: return 0;
    }
  }

  // ---- drawing ----------------------------------------------------------------
  draw(now) {
    const g = this.g;
    if (!g || !this.vis) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx, ts = this.ts, { w, h } = g.map;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0810';
    ctx.fillRect(0, 0, w * ts, (h + 0.4) * ts);
    let sx = 0, sy = 0;
    if (this.shake > 0.2) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.002, dt); }
    ctx.translate(sx, this.oy + sy);
    const X = (x) => x * ts, Y = (y) => y * ts;

    // tiles
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = tile(g, x, y);
        const k = key(x, y);
        if (t === T.WALL) {
          const open = (ax, ay) => ax >= 0 && ay >= 0 && ax < w && ay < h && tile(g, ax, ay) !== T.WALL;
          if (open(x, y + 1)) { drawFit(ctx, sprite('wall_mid'), X(x), Y(y), ts, ts); continue; }
          ctx.fillStyle = '#1c1524'; ctx.fillRect(X(x), Y(y), ts, ts);
          ctx.fillStyle = '#3d3049';
          const e = Math.max(2, ts / 12);
          if (open(x, y - 1)) ctx.fillRect(X(x), Y(y), ts, e);
          if (open(x - 1, y)) ctx.fillRect(X(x), Y(y), e, ts);
          if (open(x + 1, y)) ctx.fillRect(X(x) + ts - e, Y(y), e, ts);
          continue;
        }
        const hv = hash(x, y, g.floor);
        const fname = hv % 100 < 82 ? 'floor_1' : 'floor_' + (2 + (hv % 7));
        drawFit(ctx, sprite(fname), X(x), Y(y), ts, ts);
        if (t === T.PIT) { ctx.fillStyle = '#000'; ctx.fillRect(X(x), Y(y), ts, ts); drawFit(ctx, sprite('hole'), X(x), Y(y), ts, ts); }
        else if (t === T.SPIKES) {
          const up = spikesUp(g, x, y, g.turn + 1);
          const img = sprite('floor_spikes_anim', up ? 3 * 167 : 0);
          drawFit(ctx, img, X(x), Y(y), ts, ts);
          if (up) { ctx.fillStyle = 'rgba(255,60,60,0.18)'; ctx.fillRect(X(x), Y(y), ts, ts); }
        } else if (t === T.ICE) {
          ctx.fillStyle = 'rgba(160,220,255,0.45)'; ctx.fillRect(X(x), Y(y), ts, ts);
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(X(x) + ts * 0.15, Y(y) + ts * 0.2, ts * 0.3, ts * 0.06); ctx.fillRect(X(x) + ts * 0.55, Y(y) + ts * 0.65, ts * 0.25, ts * 0.06);
        } else if (t === T.LAVA) {
          const p = 0.5 + 0.5 * Math.sin(now / 300 + x * 1.3 + y);
          ctx.fillStyle = `rgb(${200 + 40 * p},${60 + 50 * p},20)`; ctx.fillRect(X(x), Y(y), ts, ts);
          ctx.fillStyle = 'rgba(255,230,120,0.6)'; ctx.fillRect(X(x) + ((now / 40 + hv) % ts), Y(y) + ts * 0.5, ts * 0.12, ts * 0.08);
        }
        if (g.fx.slime[k]) { ctx.fillStyle = 'rgba(90,200,70,0.42)'; ctx.beginPath(); ctx.ellipse(X(x) + ts / 2, Y(y) + ts / 2, ts * 0.42, ts * 0.32, 0, 0, 7); ctx.fill(); }
        if (g.fx.corpse[k]) drawFit(ctx, sprite('skull'), X(x) + ts * 0.25, Y(y) + ts * 0.3, ts * 0.5, ts * 0.5);
        const tr = g.fx.trap[k];
        if (tr) drawFit(ctx, sprite(tr.type === 'bear' ? 'weapon_saw_sword' : 'floor_spikes_anim', 999), X(x) + ts * 0.2, Y(y) + ts * 0.2, ts * 0.6, ts * 0.6);
      }
    // biome tint
    const tint = BIOME_TINT[g.biome];
    if (tint) {
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, w * ts, h * ts);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // temp walls + burning
    for (const k of Object.keys(g.fx.wall)) {
      const [x, y] = k.split(',').map(Number);
      drawFit(ctx, sprite(g.cls === 'hexer' ? 'skull' : 'crate'), X(x), Y(y) - ts * 0.3, ts, ts * 1.3, true);
      this.label(ctx, X(x) + ts - 4, Y(y) + 10, g.fx.wall[k], '#c8a26b', 'right');
    }
    for (const k of Object.keys(g.fx.burn)) {
      const [x, y] = k.split(',').map(Number);
      for (let i = 0; i < 3; i++) {
        const f = (now / 120 + i * 2.1 + x) % 1;
        ctx.fillStyle = i % 2 ? 'rgba(255,200,60,0.85)' : 'rgba(255,90,30,0.8)';
        const fx = X(x) + ts * (0.2 + 0.3 * i), fy = Y(y) + ts * (0.85 - 0.5 * f);
        ctx.fillRect(fx, fy, ts * 0.14, ts * 0.14 * (1 - f) + 2);
      }
      ctx.fillStyle = 'rgba(255,90,30,0.18)'; ctx.fillRect(X(x), Y(y), ts, ts);
    }

    // the spell floor: every tile holds a deck spell
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    const hx0 = g.hero.x, hy0 = g.hero.y;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const cell = g.cells[y * w + x];
        if (!cell || tile(g, x, y) === T.PIT || g.fx.wall[key(x, y)]) continue;
        const d = g.hero.deck[cell.slot]; if (!d) continue;
        const col = SLOT_COLORS[cell.slot % SLOT_COLORS.length];
        const icon = spellIcon(d.id, SPELLS[d.id].icon, now);
        const isHero = x === hx0 && y === hy0;
        if (cell.cd > 0) {
          ctx.globalAlpha = 0.22;
          drawFit(ctx, icon, X(x) + ts * 0.22, Y(y) + ts * 0.22, ts * 0.56, ts * 0.56);
          ctx.globalAlpha = 1;
          if (!isHero) this.label(ctx, X(x) + ts / 2, Y(y) + ts * 0.62, cell.cd + '', '#bfb2d2', 'center', 11);
          continue;
        }
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55 + 0.2 * pulse; ctx.lineWidth = Math.max(1.5, ts / 22);
        const m = ts * 0.08;
        ctx.strokeRect(X(x) + m, Y(y) + m, ts - 2 * m, ts - 2 * m);
        ctx.fillStyle = col; ctx.globalAlpha = 0.24; ctx.fillRect(X(x) + m, Y(y) + m, ts - 2 * m, ts - 2 * m);
        ctx.globalAlpha = 0.9;
        drawFit(ctx, icon, X(x) + ts * 0.21, Y(y) + ts * 0.21, ts * 0.58, ts * 0.58);
        ctx.globalAlpha = 1;
        if (d.lv) this.label(ctx, X(x) + ts - 5, Y(y) + 12, '+', '#ffcf5a', 'right', 12);
        if (!this.busy && g.phase === 'play' && Math.abs(x - hx0) + Math.abs(y - hy0) === 1) this.arrow(ctx, X(x) + ts / 2, Y(y) + ts / 2, x - hx0, y - hy0, col);
      }

    // threats & intents
    const showThreat = this.showDanger && !this.busy && g.phase === 'play';
    if (showThreat) {
      const im = intentMap(g);
      const p = 0.5 + 0.5 * Math.sin(now / 160);
      for (const [k, it] of Object.entries(im)) {
        const [x, y] = k.split(',').map(Number);
        if (it.path) { ctx.fillStyle = 'rgba(255,60,60,0.13)'; ctx.fillRect(X(x) + 1, Y(y) + 1, ts - 2, ts - 2); continue; }
        const soon = it.delay <= 1;
        ctx.fillStyle = soon ? `rgba(255,30,30,${0.3 + 0.15 * p})` : 'rgba(255,150,30,0.3)';
        ctx.fillRect(X(x) + 1, Y(y) + 1, ts - 2, ts - 2);
        ctx.strokeStyle = soon ? '#ff5050' : '#ffae3d'; ctx.lineWidth = 2;
        ctx.setLineDash(soon ? [] : [4, 3]); ctx.strokeRect(X(x) + 2, Y(y) + 2, ts - 4, ts - 4); ctx.setLineDash([]);
        // crosshair
        ctx.strokeStyle = soon ? 'rgba(255,220,220,0.8)' : 'rgba(255,220,150,0.8)'; ctx.lineWidth = 1.5;
        const cx = X(x) + ts / 2, cy = Y(y) + ts / 2, r = ts * 0.2;
        ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
        this.label(ctx, X(x) + ts - 4, Y(y) + 12, it.dmg + '', '#fff', 'right', 11);
        if (!soon) this.label(ctx, X(x) + 4, Y(y) + 12, it.delay + 't', '#ffe0a0', 'left', 9);
      }
      // attack lines from each attacker to its target
      for (const u of g.units) {
        if (u.team !== 'enemy' || !u.intent || u.intent.kind === 'area') continue;
        const tl = intentTiles(g, u);
        const end = u.intent.kind === 'rel' ? [u.x + u.intent.offs[0][0], u.y + u.intent.offs[0][1]] : tl[tl.length - 1];
        if (!end) continue;
        ctx.strokeStyle = 'rgba(255,90,90,0.75)'; ctx.lineWidth = Math.max(2, ts / 16); ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(X(u.x) + ts / 2, Y(u.y) + ts / 2); ctx.lineTo(X(end[0]) + ts / 2, Y(end[1]) + ts / 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (g.emerge) {
        const [x, y] = g.emerge;
        const p2 = 0.5 + 0.5 * Math.sin(now / 140);
        ctx.fillStyle = `rgba(120,60,20,${0.45 + 0.2 * p2})`;
        ctx.beginPath(); ctx.ellipse(X(x) + ts / 2, Y(y) + ts * 0.6, ts * 0.4, ts * 0.25, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffae3d'; ctx.lineWidth = 2; ctx.stroke();
        this.label(ctx, X(x) + ts / 2, Y(y) + ts * 0.35, '▲', '#ffae3d', 'center', 11);
      }
      if (g.doomMark) {
        const [x, y] = g.doomMark;
        ctx.strokeStyle = `rgba(180,90,255,${0.5 + 0.5 * Math.sin(now / 120)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(X(x) + ts / 2, Y(y) + ts / 2, ts * 0.35, 0, 7); ctx.stroke();
      }
    }

    // hover highlight: enemy pattern
    if (this.hover && !this.busy) {
      const [hx, hy] = this.hover;
      const u = g.units.find((v) => v.x === hx && v.y === hy && v.team === 'enemy');
      if (u) {
        const tiles = reachOf(g, u);
        ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2;
        for (const [x, y] of tiles) ctx.strokeRect(X(x) + 4, Y(y) + 4, ts - 8, ts - 8);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(X(hx) + 0.5, Y(hy) + 0.5, ts - 1, ts - 1);
    }

    // move preview (hover on an adjacent square)
    if (this.preview && !this.busy) {
      const p = this.preview;
      ctx.strokeStyle = CLASSES[g.cls].color; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.strokeRect(X(p.hero[0]) + 3, Y(p.hero[1]) + 3, ts - 6, ts - 6); ctx.setLineDash([]);
      for (const m of p.marks) {
        if (m.from) { ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(m.from[0]) + ts / 2, Y(m.from[1]) + ts / 2); ctx.lineTo(X(m.x) + ts / 2, Y(m.y) + ts / 2); ctx.stroke(); }
      }
    }

    // units sorted by y, hero included
    const k = 1 - Math.pow(0.0005, dt);
    const list = [...this.vis.units.values()];
    for (const v of list) { v.px += (v.x - v.px) * k * 1.6; v.py += (v.y - v.py) * k * 1.6; if (Math.abs(v.x - v.px) < 0.01) v.px = v.x; if (Math.abs(v.y - v.py) < 0.01) v.py = v.y; }
    const H = this.vis.hero;
    H.px += (H.x - H.px) * k * 1.6; H.py += (H.y - H.py) * k * 1.6;
    const drawables = list.map((v) => ({ v, y: v.py })).concat([{ hero: true, y: H.py }]).sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.hero) this.drawHero(ctx, now);
      else this.drawUnit(ctx, d.v, now);
    }

    if (this.preview && !this.busy) {
      for (const m of this.preview.marks) this.label(ctx, X(m.x) + ts / 2, Y(m.y) + ts * (0.25 + (m.dy || 0)), m.s, m.c, 'center', 12);
      if (this.preview.heroDmg > 0) this.label(ctx, X(this.preview.hero[0]) + ts / 2, Y(this.preview.hero[1]) + ts * 0.25, '-' + this.preview.heroDmg, '#ff4d4d', 'center', 12);
    }
    // fx
    this.fx = this.fx.filter((f) => now - f.t0 < f.dur);
    for (const f of this.fx) {
      const p = (now - f.t0) / f.dur;
      if (f.k === 'aoe') {
        ctx.fillStyle = f.c; ctx.globalAlpha = 0.55 * (1 - p);
        for (const [x, y] of f.tiles) ctx.fillRect(X(x) + 2, Y(y) + 2, ts - 4, ts - 4);
        ctx.globalAlpha = 1;
      } else if (f.k === 'bolt') {
        const q = Math.min(1, p * 1.15);
        const x = f.from[0] + (f.to[0] - f.from[0]) * q, y = f.from[1] + (f.to[1] - f.from[1]) * q;
        ctx.strokeStyle = f.c; ctx.lineWidth = ts * 0.12; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(X(f.from[0]) + ts / 2 + (X(x) - X(f.from[0])) * 0.6, Y(f.from[1]) + ts / 2 + (Y(y) - Y(f.from[1])) * 0.6); ctx.lineTo(X(x) + ts / 2, Y(y) + ts / 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.arc(X(x) + ts / 2, Y(y) + ts / 2, ts * 0.14, 0, 7); ctx.fill();
      } else if (f.k === 'ring') {
        ctx.strokeStyle = '#ffcf5a'; ctx.globalAlpha = 1 - p; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(f.x) + ts / 2, Y(f.y) + ts / 2, ts * (0.2 + 0.4 * p), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.k === 'float') {
        ctx.globalAlpha = Math.min(1, 2 - 2 * p);
        this.label(ctx, X(f.x) + ts / 2, Y(f.y) - ts * 0.1 - p * ts * 0.7, f.s, f.c, 'center', f.big ? 13 : 11);
        ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  arrow(ctx, cx, cy, dx, dy, col) {
    const ts = this.ts, len = ts * 0.5;
    const ex = cx + dx * len, ey = cy + dy * len;
    ctx.fillStyle = col;
    ctx.beginPath();
    const px = -dy, py = dx, s = ts * 0.13;
    ctx.moveTo(ex + dx * s, ey + dy * s); ctx.lineTo(ex + px * s, ey + py * s); ctx.lineTo(ex - px * s, ey - py * s); ctx.closePath();
    ctx.fill();
  }

  label(ctx, x, y, s, c, align = 'center', size = 10) {
    const fs = Math.max(8, Math.round(size * this.ts / 48));
    ctx.font = `${fs}px 'Press Start 2P', monospace`;
    ctx.textAlign = align;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(s, x, y);
    ctx.fillStyle = c; ctx.fillText(s, x, y);
  }

  bodyRect(img, big) {
    const ts = this.ts;
    if (!img || !img.naturalWidth) return null;
    const scale = Math.min((big ? ts * 1.45 : ts) / (big ? 32 : 16), (big ? 1.7 : 1.22) * ts / img.naturalHeight);
    return { w: img.naturalWidth * scale, h: img.naturalHeight * scale };
  }

  lungeOffset(l, now) {
    if (!l) return [0, 0];
    const p = (now - l.t0) / 160;
    if (p >= 1) return [0, 0];
    const a = Math.sin(p * Math.PI) * 0.35;
    return [l.dx * a, l.dy * a];
  }

  drawUnit(ctx, v, now) {
    const g = this.g, ts = this.ts;
    const u = g.units.find((q) => q.id === v.id);
    const def = ENEMIES[v.type] || ALLIES[v.type] || {};
    let alpha = v.alpha;
    if (v.alpha < 1) v.alpha = Math.min(1, v.alpha + 0.08);
    if (v.dying) { alpha = Math.max(0, 1 - (now - v.dying) / 250); if (alpha <= 0) { this.vis.units.delete(v.id); return; } }
    if (v.lunge && !v.lunge.dx) { v.lunge.dx = v.lunge.to[0] - v.x; v.lunge.dy = v.lunge.to[1] - v.y; const m = Math.hypot(v.lunge.dx, v.lunge.dy) || 1; v.lunge.dx /= m; v.lunge.dy /= m; }
    const [ox, oy] = this.lungeOffset(v.lunge, now);
    const sx = (v.px + ox) * ts, sy = (v.py + oy) * ts;
    let img = sprite(def.sprite, now + v.id * 137);
    if (def.tint) img = tinted(img, def.tint);
    if (v.flash > 0) { img = tinted(img, '#ffffff'); v.flash -= 0.12; }
    const r = this.bodyRect(img, def.big);
    ctx.globalAlpha = alpha * (v.type === 'shade' ? 0.75 : 1);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts * 0.88, ts * (def.big ? 0.5 : 0.3), ts * 0.1, 0, 0, 7); ctx.fill();
    if (r) {
      const flip = g.hero.x < v.x;
      ctx.save();
      ctx.translate(sx + ts / 2, sy + ts * 0.95);
      if (flip) ctx.scale(-1, 1);
      if (u && u.stun > 0) ctx.rotate(Math.sin(now / 200) * 0.06);
      ctx.drawImage(img, -r.w / 2, -r.h, r.w, r.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (!u || v.dying) return;
    const top = sy + ts * 0.95 - (r ? r.h : ts) - 4;
    // hp pips
    if (u.team === 'enemy' && !u.boss) {
      const n = u.maxHp, pw = Math.max(3, ts / 10), gap = 1, tw = n * (pw + gap);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = '#000'; ctx.fillRect(sx + ts / 2 - tw / 2 + i * (pw + gap) - 1, top - 1, pw + 2, pw + 2);
        ctx.fillStyle = i < u.hp ? (u.elite ? '#ffcf5a' : '#ff4d4d') : '#3a2030';
        ctx.fillRect(sx + ts / 2 - tw / 2 + i * (pw + gap), top, pw, pw);
      }
    } else if (u.team === 'ally') {
      this.label(ctx, sx + ts / 2, top + 6, u.hp + (u.life ? ' · ' + u.life : ''), '#7de0c8', 'center', 8);
    }
    // statuses
    let sxo = sx + 3;
    const tag = (s, c) => { this.label(ctx, sxo, sy + ts - 3, s, c, 'left', 8); sxo += ts * 0.28; };
    if (u.stun > 0) tag('Z', '#ffe66b');
    if (u.root > 0) tag('#', '#7dff6b');
    if (u.poison > 0) tag('P', '#7dff6b');
    if (u.curse > 0) tag('C', '#c58cff');
    if (u.mark > 0) tag('M', '#ff6b6b');
    if (ENEMIES[u.type]?.shield) {
      ctx.fillStyle = '#8ecbff';
      const [fx, fy] = u.facing;
      const cx = sx + ts / 2 + fx * ts * 0.42, cy = sy + ts / 2 + fy * ts * 0.42;
      ctx.fillRect(cx - (fy ? ts * 0.3 : ts * 0.05), cy - (fx ? ts * 0.3 : ts * 0.05), fy ? ts * 0.6 : ts * 0.1, fx ? ts * 0.6 : ts * 0.1);
    }
  }

  drawHero(ctx, now) {
    const g = this.g, ts = this.ts, H = this.vis.hero, h = g.hero;
    if (H.lunge && !H.lunge.dx) { H.lunge.dx = H.lunge.to[0] - H.x; H.lunge.dy = H.lunge.to[1] - H.y; }
    const [ox, oy] = this.lungeOffset(H.lunge, now);
    const sx = (H.px + ox) * ts, sy = (H.py + oy) * ts;
    const moving = Math.abs(H.x - H.px) + Math.abs(H.y - H.py) > 0.05;
    const base = CLASSES[g.cls].sprite;
    let img = sprite(base + (moving ? '_run' : '_idle'), now, moving ? 12 : 6);
    if (H.flash > 0) { img = tinted(img, '#ff3030'); H.flash -= 0.05; }
    if (g.phase === 'dead') img = sprite(base + '_hit') || img;
    const r = this.bodyRect(img, false);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts * 0.88, ts * 0.3, ts * 0.1, 0, 0, 7); ctx.fill();
    // hero ring
    ctx.strokeStyle = CLASSES[g.cls].color; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts * 0.88, ts * 0.38, ts * 0.13, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    if (h.invis > 0) ctx.globalAlpha = 0.4;
    if (r) {
      ctx.save();
      ctx.translate(sx + ts / 2, sy + ts * 0.95);
      if (H.face === -1) ctx.scale(-1, 1);
      ctx.drawImage(img, -r.w / 2, -r.h, r.w, r.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (H.x !== H.lastX) { if (H.x < (H.lastX ?? H.x)) H.face = -1; else if (H.x > (H.lastX ?? H.x)) H.face = 1; H.lastX = H.x; }
    let sxo = sx + 3;
    const tag = (s, c) => { this.label(ctx, sxo, sy + ts - 3, s, c, 'left', 8); sxo += ts * 0.3; };
    if (h.block > 0) tag('◆' + h.block, '#8ecbff');
    if (h.root > 0) tag('#', '#7dff6b');
    if (h.riposte) tag('R', '#fff36b');
    if (h.valor > 0 || h.lich > 0) tag('↑', '#ffd700');
    if (h.aim) tag('+1', '#d9f0a3');
  }
}
