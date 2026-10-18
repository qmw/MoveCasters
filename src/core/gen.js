// Floor generation: room layout, hazards, enemies, spell placement.
import { T, BIOMES, ENEMIES, ORTH, FLOORS_PER_BIOME } from './data.js';
import { rnd, rint, pick, shuffle } from './rng.js';
import { key, inb, tile, setTile, standable, manhattan, makeUnit, freeTiles, occupied } from './engine.js';

function connected(g, sx, sy) {
  const seen = new Set([key(sx, sy)]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of ORTH) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (seen.has(k) || !standable(g, nx, ny) || tile(g, nx, ny) === T.LAVA) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  let total = 0;
  for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++) if (standable(g, x, y) && tile(g, x, y) !== T.LAVA) total++;
  return seen.size === total;
}

const LAYOUTS = ['pillars', 'cross', 'rooms', 'scatter', 'ring', 'open'];

function carve(g, layout) {
  const { w, h } = g.map;
  const wall = (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) setTile(g, x, y, T.WALL); };
  switch (layout) {
    case 'pillars':
      for (let y = 2; y < h - 2; y += 3) for (let x = 2; x < w - 2; x += 3) if (rnd(g) < 0.75) wall(x, y);
      break;
    case 'cross': {
      const cx = w >> 1, cy = h >> 1;
      for (let i = -1; i <= 1; i++) { wall(cx + i, cy - 2); wall(cx + i, cy + 2); }
      wall(cx - 3, cy); wall(cx + 3, cy);
      break;
    }
    case 'rooms': {
      const cy = (h >> 1) - 1;
      for (let x = 1; x < w - 1; x++) if (x % 4 !== 2) wall(x, cy);
      for (let i = 0; i < 2; i++) wall(1 + rint(g, w - 2), cy + 2 + rint(g, h - cy - 4));
      break;
    }
    case 'scatter':
      for (let i = 0; i < Math.floor(w * h * 0.08); i++) wall(1 + rint(g, w - 2), 1 + rint(g, h - 4));
      break;
    case 'ring': {
      const cx = w >> 1, cy = (h >> 1) - 1;
      for (const [dx, dy] of [[-2, -2], [-1, -2], [1, -2], [2, -2], [-2, 2], [-1, 2], [1, 2], [2, 2], [-2, -1], [2, -1], [-2, 1], [2, 1]]) wall(cx + dx, cy + dy);
      break;
    }
    default:
      for (let i = 0; i < 3; i++) wall(1 + rint(g, w - 2), 1 + rint(g, h - 4));
  }
}

function sprinkle(g, type, chance, avoid) {
  const { w, h } = g.map;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (tile(g, x, y) !== T.FLOOR || manhattan(x, y, avoid[0], avoid[1]) < 3) continue;
      if (rnd(g) < chance) {
        setTile(g, x, y, type);
        // hazards like to clump
        if (type !== T.PIT && rnd(g) < 0.5) {
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

export function buildFloor(g) {
  const floor = g.floor;
  const biome = biomeFor(g, floor);
  const B = BIOMES[biome];
  const inBiome = ((floor - 1) % FLOORS_PER_BIOME) + 1;
  const boss = inBiome === FLOORS_PER_BIOME;
  g.biome = biome;
  g.fx = { burn: {}, slime: {}, wall: {}, trap: {}, corpse: {} };
  g.units = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const w = boss ? 9 : 8 + rint(g, 3), h = boss ? 11 : 9 + rint(g, 3);
    g.map = { w, h, t: new Array(w * h).fill(T.FLOOR) };
    for (let x = 0; x < w; x++) { setTile(g, x, 0, T.WALL); setTile(g, x, h - 1, T.WALL); }
    for (let y = 0; y < h; y++) { setTile(g, 0, y, T.WALL); setTile(g, w - 1, y, T.WALL); }
    const start = [w >> 1, h - 2];
    carve(g, boss ? pick(g, ['open', 'pillars']) : pick(g, LAYOUTS));
    setTile(g, start[0], start[1], T.FLOOR);
    const hz = B.hazards || {};
    if (hz.pit) sprinkle(g, T.PIT, hz.pit, start);
    if (hz.spikes) sprinkle(g, T.SPIKES, hz.spikes, start);
    if (hz.ice) sprinkle(g, T.ICE, hz.ice, start);
    if (hz.lava) sprinkle(g, T.LAVA, hz.lava, start);
    if (!connected(g, start[0], start[1])) continue;
    g.hero.x = start[0]; g.hero.y = start[1];
    break;
  }
  g.board = []; g.recharge = [];
  if (biome === 'swamp') for (let i = 0; i < B.slimeStart; i++) { const t = freeTiles(g, { avoidHero: 3 }); if (t.length) { const p = pick(g, t); g.fx.slime[key(p[0], p[1])] = 99; } }
  for (let i = 0; i < 2 + rint(g, 2); i++) { const t = freeTiles(g, { avoidHero: 2 }); if (t.length) { const p = pick(g, t); g.fx.corpse[key(p[0], p[1])] = 1; } }

  // ---- enemies
  const d = g.depth;
  const spots = () => freeTiles(g, { avoidHero: 4 }).filter(([, y]) => y < g.map.h - 3);
  if (boss) {
    const u = makeUnit(g, B.boss, g.map.w >> 1, 2);
    if (d >= 5) { u.hp = u.maxHp = Math.ceil(u.hp * 1.25); }
    u.timer = 0;
  }
  let budget = boss ? 1 + floor * 0.15 : 2.6 + floor * 0.55;
  if (d >= 1) budget += 1;
  const roster = B.roster.filter(([, min]) => min <= inBiome).map(([t]) => t);
  if (d >= 6 && !roster.includes('goblin')) { const s = spots(); if (s.length) { const p = pick(g, s); makeUnit(g, 'goblin', p[0], p[1]); } }
  let guard = 0;
  while (budget > 0.6 && guard++ < 30) {
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
  // face the hero
  for (const u of g.units) u.facing = [0, 1];

  // ---- spells: deck goes onto the board
  const deck = g.hero.deck;
  const order = shuffle(g, deck.map((_, i) => i));
  order.forEach((slot, n) => {
    let tiles = freeTiles(g, { avoidHero: 2 }).filter(([x, y]) => g.board.every((b) => manhattan(b.x, b.y, x, y) >= 2));
    if (n === 0) {
      const near = tiles.filter(([x, y]) => manhattan(x, y, g.hero.x, g.hero.y) <= 3);
      if (near.length) tiles = near;
    }
    if (!tiles.length) tiles = freeTiles(g, { avoidHero: 1 });
    if (!tiles.length) return;
    const [x, y] = pick(g, tiles);
    g.board.push({ slot, x, y });
  });

  const nEnemies = g.units.filter((u) => u.team === 'enemy').length;
  g.par = (boss ? 30 : 14 + 2 * nEnemies) + (g.hero.relics.includes('swift_boots') ? 6 : 0) - (d >= 3 ? 4 : 0);
  g.floorTurns = 0;
  g.floorDmg = 0;
  g.doomMark = null;
  g.isBoss = boss;
  g.hero.block = 0; g.hero.steelUsed = false; g.hero.riposte = 0; g.hero.root = 0; g.hero.invis = 0;
  g.hero.valor = 0; g.hero.lich = 0; g.hero.harvested = false; g.echoUsed = false;
  g.turn = 0;
}
