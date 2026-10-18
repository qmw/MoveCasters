// Floor generation: open arena, overlay hazards, enemies, and the spell floor (every tile holds a deck spell).
import { T, BIOMES, ENEMIES, ORTH, FLOORS_PER_BIOME } from './data.js';
import { rnd, rint, pick } from './rng.js';
import { key, tile, setTile, manhattan, makeUnit, freeTiles } from './engine.js';
import { spellFreq } from './spells.js';

function sprinkle(g, type, chance, avoid) {
  const { w, h } = g.map;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (tile(g, x, y) !== T.FLOOR || manhattan(x, y, avoid[0], avoid[1]) < 3) continue;
      if (rnd(g) < chance) {
        setTile(g, x, y, type);
        if (rnd(g) < 0.5) {
          const [dx, dy] = pick(g, ORTH);
          if (tile(g, x + dx, y + dy) === T.FLOOR && manhattan(x + dx, y + dy, avoid[0], avoid[1]) >= 3) setTile(g, x + dx, y + dy, type);
        }
      }
    }
}

export function biomeFor(g, floor) {
  const bi = Math.floor((floor - 1) / FLOORS_PER_BIOME);
  return ['crypt', g.path || 'swamp', 'warrens', 'inferno'][bi];
}

// Weighted assignment of deck slots to every walkable tile. Each spell appears at least twice,
// and we avoid long clumps of the same spell so every step offers a real choice.
export function layCells(g) {
  const { w, h } = g.map;
  const deck = g.hero.deck;
  g.cells = new Array(w * h).fill(null);
  const spots = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tile(g, x, y) !== T.WALL) spots.push([x, y]);
  const weights = deck.map((d) => spellFreq(d.id));
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = new Array(deck.length).fill(0);
  for (const [x, y] of spots) {
    const around = ORTH.map(([dx, dy]) => g.cells[(y + dy) * w + x + dx]).filter(Boolean).map((c) => c.slot);
    let slot = 0;
    for (let tries = 0; tries < 4; tries++) {
      let r = rnd(g) * total;
      slot = 0;
      while (r >= weights[slot]) { r -= weights[slot]; slot++; }
      if (around.filter((s) => s === slot).length < 2) break;
    }
    g.cells[y * w + x] = { slot, cd: 0 };
    counts[slot]++;
  }
  // guarantee every spell at least twice
  deck.forEach((_, slot) => {
    while (counts[slot] < 2) {
      const big = counts.indexOf(Math.max(...counts));
      const cand = g.cells.map((c, i) => (c && c.slot === big ? i : -1)).filter((i) => i >= 0);
      const i = pick(g, cand);
      g.cells[i].slot = slot; counts[big]--; counts[slot]++;
    }
  });
}

export function buildFloor(g) {
  const floor = g.floor;
  const biome = biomeFor(g, floor);
  const B = BIOMES[biome];
  const inBiome = ((floor - 1) % FLOORS_PER_BIOME) + 1;
  const boss = inBiome === FLOORS_PER_BIOME;
  g.biome = biome;
  g.fx = { burn: {}, slime: {}, wall: {}, trap: {}, corpse: {}, pit: {} };
  g.units = [];
  // interior size: 7x7 .. 8x9 (+1 wall border on each side)
  const iw = boss ? 8 : 7 + rint(g, 2), ih = boss ? 9 : 7 + rint(g, 3);
  const w = iw + 2, h = ih + 2;
  g.map = { w, h, t: new Array(w * h).fill(T.FLOOR) };
  for (let x = 0; x < w; x++) { setTile(g, x, 0, T.WALL); setTile(g, x, h - 1, T.WALL); }
  for (let y = 0; y < h; y++) { setTile(g, 0, y, T.WALL); setTile(g, w - 1, y, T.WALL); }
  const start = [w >> 1, h - 2];
  g.hero.x = start[0]; g.hero.y = start[1];
  const hz = B.hazards || {};
  if (hz.spikes) sprinkle(g, T.SPIKES, hz.spikes, start);
  if (hz.ice) sprinkle(g, T.ICE, hz.ice, start);
  if (B.slimeStart) for (let i = 0; i < B.slimeStart; i++) { const t = freeTiles(g, { avoidHero: 3 }); if (t.length) { const p = pick(g, t); g.fx.slime[key(p[0], p[1])] = 99; } }
  if (hz.burn) for (let i = 0; i < hz.burn; i++) { const t = freeTiles(g, { avoidHero: 3 }); if (t.length) { const p = pick(g, t); g.fx.burn[key(p[0], p[1])] = 99; } }
  for (let i = 0; i < 2 + rint(g, 2); i++) { const t = freeTiles(g, { avoidHero: 2 }); if (t.length) { const p = pick(g, t); g.fx.corpse[key(p[0], p[1])] = 1; } }

  // ---- enemies
  const d = g.depth;
  const spots = () => freeTiles(g, { avoidHero: 4 }).filter(([, y]) => y < g.map.h - 3);
  if (boss) {
    const u = makeUnit(g, B.boss, g.map.w >> 1, 2);
    if (d >= 5) { u.hp = u.maxHp = Math.ceil(u.hp * 1.25); }
    u.timer = 0;
  }
  let budget = boss ? 1 + floor * 0.15 : (2.6 + floor * 0.55) * (1.6 + 0.3 * floor) * (biome === 'warrens' ? 0.8 : 1) * (biome === 'frozen' ? 1.2 : 1);
  if (d >= 1) budget += 1;
  const roster = B.roster.filter(([, min]) => min <= inBiome).map(([t]) => t);
  if (d >= 6 && !roster.includes('goblin')) { const s = spots(); if (s.length) { const p = pick(g, s); makeUnit(g, 'goblin', p[0], p[1]); } }
  let guard = 0;
  const cap = boss ? 6 : Math.round(5 + floor * 0.6);
  while (budget > 0.6 && guard++ < 40 && g.units.length < cap) {
    const type = pick(g, roster);
    const cost = ENEMIES[type].cost;
    if (cost > budget + 0.4) { if (roster.every((t) => ENEMIES[t].cost > budget + 0.4)) break; continue; }
    const s = spots();
    if (!s.length) break;
    const [x, y] = pick(g, s);
    const u = makeUnit(g, type, x, y);
    if (d >= 2 && rnd(g) < 0.3) { u.hp++; u.maxHp++; u.elite = true; }
    budget -= cost;
  }
  for (const u of g.units) u.facing = [0, 1];

  layCells(g);

  const nEnemies = g.units.filter((u) => u.team === 'enemy').length;
  g.par = (boss ? 30 : 12 + 2 * nEnemies) + (g.hero.relics.includes('swift_boots') ? 6 : 0) - (d >= 3 ? 4 : 0);
  g.floorTurns = 0;
  g.floorDmg = 0;
  g.doomMark = null;
  g.isBoss = boss;
  g.hero.block = 0; g.hero.steelUsed = false; g.hero.riposte = 0; g.hero.root = 0; g.hero.invis = 0;
  g.hero.lich = 0; g.hero.harvested = false; g.echoUsed = false;
  g.turn = 0;
  // Into-the-Breach style reinforcements: a telegraphed emergence square every 2 turns
  g.reinfLeft = boss ? 0 : 4 + Math.floor(floor / 3);
  g.emerge = null;
}
