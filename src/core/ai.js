// Enemy + ally behaviour, Into-the-Breach style:
// each enemy phase an enemy RESOLVES its telegraphed attack (hitting whatever stands there), then MOVES,
// then TELEGRAPHS a new attack (u.intent) at the hero. Stun cancels the telegraph.
import { ENEMIES, ORTH, DIAG, KING, KNIGHT, T } from './data.js';
import {
  key, inb, tile, setTile, isWall, unitAt, heroAt, occupied, enemies, allies, standable, enemySafe, manhattan,
  damageUnit, hurtHero, emit, makeUnit, randomFree, freeTiles, ray, spoilCell, trapCheck, firstEnemyInRay, killUnit,
} from './engine.js';
import { rint } from './rng.js';

const STEPS = { orth: ORTH, diag: DIAG, king: KING, knight: KNIGHT, phase: KING };

// Tiles threatened by a pattern centred at (x,y). Line patterns are blocked by walls and units (not the hero).
export function patternTiles(g, pattern, x, y, range = 4) {
  const out = [];
  const add = (dx, dy) => { const nx = x + dx, ny = y + dy; if (inb(g, nx, ny)) out.push([nx, ny]); };
  switch (pattern) {
    case 'orth1': ORTH.forEach(([dx, dy]) => add(dx, dy)); break;
    case 'diag1': DIAG.forEach(([dx, dy]) => add(dx, dy)); break;
    case 'king': KING.forEach(([dx, dy]) => add(dx, dy)); break;
    case 'knight': KNIGHT.forEach(([dx, dy]) => add(dx, dy)); break;
    case 'lob2': ORTH.forEach(([dx, dy]) => { if (!isWall(g, x + dx * 2, y + dy * 2)) add(dx * 2, dy * 2); }); break;
    case 'line':
    case 'charge':
      for (const [dx, dy] of ORTH) {
        for (let i = 1; i <= range; i++) {
          const nx = x + dx * i, ny = y + dy * i;
          if (!inb(g, nx, ny) || isWall(g, nx, ny)) break;
          if (pattern === 'charge' && i > 1 && !standable(g, nx - dx, ny - dy)) break;
          out.push([nx, ny]);
          const u = unitAt(g, nx, ny);
          if (u) break;
        }
      }
      break;
  }
  return out;
}

export function effectivePattern(u) {
  const def = ENEMIES[u.type];
  if (def.pattern === 'charge' && u.root > 0) return 'orth1';
  return def.pattern;
}

// Where this enemy could telegraph an attack from its current square (its "reach").
export function reachOf(g, u) {
  if (u.team !== 'enemy') return [];
  return patternTiles(g, effectivePattern(u), u.x, u.y, ENEMIES[u.type].range || 4);
}
const inReach = (g, u, tx, ty) => reachOf(g, u).some(([x, y]) => x === tx && y === ty);
// Back-compat alias used by older tools.
export const threatOf = reachOf;

// Walk a line from (x,y): returns tiles up to and including the first unit (or hero, unless ignoreHero).
function lineTiles(g, x, y, dx, dy, range, ignoreHero = false) {
  const out = [];
  for (let i = 1; i <= range; i++) {
    const nx = x + dx * i, ny = y + dy * i;
    if (!inb(g, nx, ny) || isWall(g, nx, ny)) break;
    out.push([nx, ny]);
    if (unitAt(g, nx, ny) || (!ignoreHero && heroAt(g, nx, ny))) break;
  }
  return out;
}
// Squares where the hero would be hit if he ends his move there (line/charge: anywhere along the firing line).
export function dangerTiles(g, u) {
  const it = u.intent;
  if (!it) return [];
  if (it.kind === 'line' || it.kind === 'charge') return lineTiles(g, u.x, u.y, it.dir[0], it.dir[1], it.range + (it.kind === 'charge' ? 1 : 0), true);
  return intentTiles(g, u);
}

// Absolute squares the current telegraph will strike (recomputed live: relative intents follow the attacker).
export function intentTiles(g, u) {
  const it = u.intent;
  if (!it) return [];
  switch (it.kind) {
    case 'rel': return it.offs.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => inb(g, x, y) && !isWall(g, x, y));
    case 'line': case 'charge': return lineTiles(g, u.x, u.y, it.dir[0], it.dir[1], it.range);
    case 'area': return it.tiles;
  }
  return [];
}

// key -> total damage landing there on the NEXT enemy phase.
export function dangerMap(g) {
  const m = {};
  for (const u of enemies(g)) {
    if (!u.intent || u.intent.delay > 1) continue;
    for (const [x, y] of dangerTiles(g, u)) m[key(x, y)] = (m[key(x, y)] || 0) + u.intent.dmg;
  }
  if (g.emerge) { const k = key(g.emerge[0], g.emerge[1]); m[k] = (m[k] || 0) + 1; }
  return m;
}
// key -> {dmg, delay, path} for every telegraph (for rendering; path = squares a projectile/charge travels through).
export function intentMap(g) {
  const m = {};
  for (const u of enemies(g)) {
    if (!u.intent) continue;
    const tiles = dangerTiles(g, u);
    tiles.forEach(([x, y]) => {
      const k = key(x, y);
      const path = false;
      const prev = m[k];
      if (!prev || (prev.path && !path)) m[k] = { dmg: (prev && !prev.path ? prev.dmg : 0) + (path ? 0 : u.intent.dmg), delay: u.intent.delay, path, from: u.id };
      else if (!path) prev.dmg += u.intent.dmg;
    });
  }
  return m;
}

// ---- Movement ---------------------------------------------------------------
function canEnter(g, u, x, y) {
  if (!inb(g, x, y)) return false;
  if (occupied(g, x, y)) return false;
  const def = ENEMIES[u.type] || {};
  if (def.move === 'phase') return tile(g, x, y) !== T.PIT && x > 0 && y > 0 && x < g.map.w - 1 && y < g.map.h - 1;
  return enemySafe(g, x, y);
}

// BFS toward any goal tile. Returns first step [x,y] or null.
function pathStep(g, u, goals, steps) {
  const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
  if (!goalSet.size) return null;
  if (goalSet.has(key(u.x, u.y))) return null;
  const prev = new Map([[key(u.x, u.y), null]]);
  let frontier = [[u.x, u.y]];
  for (let depth = 0; depth < 40 && frontier.length; depth++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !canEnter(g, u, nx, ny)) continue;
        prev.set(k, [x, y]);
        if (goalSet.has(k)) {
          let cur = [nx, ny];
          while (true) {
            const p = prev.get(key(cur[0], cur[1]));
            if (p[0] === u.x && p[1] === u.y) return cur;
            cur = p;
          }
        }
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}

function greedyStep(g, u, tx, ty, steps, away = false) {
  let best = null, bd = manhattan(u.x, u.y, tx, ty);
  for (const [dx, dy] of steps) {
    const nx = u.x + dx, ny = u.y + dy;
    if (!canEnter(g, u, nx, ny)) continue;
    const d = manhattan(nx, ny, tx, ty);
    if (away ? d > bd : d < bd) { bd = d; best = [nx, ny]; }
  }
  return best;
}

function moveUnitTo(g, u, nx, ny) {
  const def = ENEMIES[u.type] || {};
  const fx = u.x, fy = u.y;
  const dx = Math.sign(nx - fx), dy = Math.sign(ny - fy);
  if (dx || dy) u.facing = Math.abs(nx - fx) >= Math.abs(ny - fy) ? [dx, 0] : [0, dy];
  u.x = nx; u.y = ny;
  emit(g, { t: 'move', id: u.id, from: [fx, fy], to: [nx, ny] });
  if (def.slime) g.fx.slime[key(fx, fy)] = 6;
  if (def.icy && tile(g, fx, fy) === T.FLOOR) setTile(g, fx, fy, T.ICE);
  if (def.eater) spoilCell(g, nx, ny, 5); // ticks once in this turn's upkeep
  trapCheck(g, u);
}

// What should this enemy chase? Decoys pull aggro; invisible heroes are lost.
function targetOf(g, u) {
  const decoy = allies(g).filter((a) => a.type === 'decoy').sort((a, b) => manhattan(a.x, a.y, u.x, u.y) - manhattan(b.x, b.y, u.x, u.y))[0];
  if (decoy && (g.hero.invis > 0 || manhattan(decoy.x, decoy.y, u.x, u.y) <= manhattan(g.hero.x, g.hero.y, u.x, u.y) + 2)) return decoy;
  if (g.hero.invis > 0) return null;
  return g.hero;
}

function goalsFor(g, u, target) {
  const def = ENEMIES[u.type];
  const pat = def.pattern === 'none' ? 'orth1' : def.pattern;
  // patterns are symmetric, so "tiles from which target is in pattern" == pattern around target
  let goals = patternTiles(g, pat, target.x, target.y, def.range || 4);
  if (def.ranged) {
    const far = goals.filter(([x, y]) => manhattan(x, y, target.x, target.y) >= 2);
    if (far.length) goals = far;
  }
  return goals;
}

function moveEnemy(g, u) {
  const def = ENEMIES[u.type];
  if (u.root > 0) return;
  const steps = STEPS[def.move] || ORTH;
  const speed = def.speed || 1;
  for (let s = 0; s < speed; s++) {
    let step = null;
    const target = targetOf(g, u);
    if (!step && def.healer && target) {
      // keep ~3 squares from the hero, near allies
      const opts = [[u.x, u.y], ...steps.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => canEnter(g, u, x, y))];
      opts.sort((a, b) => Math.abs(manhattan(a[0], a[1], target.x, target.y) - 3) - Math.abs(manhattan(b[0], b[1], target.x, target.y) - 3));
      if (opts[0][0] !== u.x || opts[0][1] !== u.y) step = opts[0];
    } else if (!step && target) {
      const goals = goalsFor(g, u, target);
      if (goals.some(([x, y]) => x === u.x && y === u.y)) return;
      step = pathStep(g, u, goals, steps) || greedyStep(g, u, target.x, target.y, steps);
    } else if (!step) {
      const opts = steps.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => canEnter(g, u, x, y));
      if (opts.length && rint(g, 2)) step = opts[rint(g, opts.length)];
    }
    if (!step) return;
    moveUnitTo(g, u, step[0], step[1]);
    if (u.hp <= 0) return;
    if (target && inReach(g, u, target.x, target.y)) return;
  }
}

// Telegraph an attack on the target if it is in reach.
function planAttack(g, u, dmgOverride) {
  const def = ENEMIES[u.type];
  const target = targetOf(g, u);
  if (!target || !def.dmg || !inReach(g, u, target.x, target.y)) return false;
  const dx = target.x - u.x, dy = target.y - u.y;
  const pat = effectivePattern(u);
  const dmg = dmgOverride || def.dmg;
  const delay = def.slow ? 2 : 1;
  if (pat === 'line' || pat === 'charge') u.intent = { kind: pat, dir: [Math.sign(dx), Math.sign(dy)], range: def.range || 4, dmg, delay };
  else if (!def.ranged) {
    // ITB-style swing: the target square plus the two squares beside it (relative to the attacker),
    // so the only clean dodge is stepping straight away.
    const offs = [[dx, dy]];
    if (Math.abs(dx) + Math.abs(dy) === 1) offs.push([dx - dy, dy + dx], [dx + dy, dy - dx]);
    else if (Math.abs(dx) === 1 && Math.abs(dy) === 1) offs.push([dx, 0], [0, dy]);
    u.intent = { kind: 'rel', offs, dmg, delay };
  } else u.intent = { kind: 'rel', offs: [[dx, dy]], dmg, delay };
  if (dx === 0 || dy === 0) u.facing = [Math.sign(dx), Math.sign(dy)];
  return true;
}

function strike(g, u, x, y, dmg, melee) {
  if (heroAt(g, x, y)) hurtHero(g, dmg, melee ? u : null, melee ? 'enemy' : 'area');
  const v = unitAt(g, x, y);
  if (v && v !== u) damageUnit(g, v, dmg, u, 'enemy');
}

function resolveIntent(g, u) {
  const it = u.intent;
  u.intent = null;
  const tiles = intentTiles(g, { ...u, intent: it });
  if (it.kind === 'rel') {
    const [x, y] = tiles[0] || [u.x + it.offs[0][0], u.y + it.offs[0][1]];
    if (ENEMIES[u.type].ranged) emit(g, { t: 'bolt', from: [u.x, u.y], to: [x, y], c: '#7dff6b' });
    else emit(g, { t: 'lunge', id: u.id, x: u.x, y: u.y, to: [x, y] });
    for (const [tx, ty] of tiles) strike(g, u, tx, ty, it.dmg, !ENEMIES[u.type].ranged);
  } else if (it.kind === 'line') {
    const end = tiles[tiles.length - 1];
    if (!end) return;
    emit(g, { t: 'bolt', from: [u.x, u.y], to: end, c: '#c7a6ff' });
    strike(g, u, end[0], end[1], it.dmg, false);
  } else if (it.kind === 'charge') {
    const [dx, dy] = it.dir;
    for (let i = 0; i <= it.range; i++) {
      const nx = u.x + dx, ny = u.y + dy;
      if (!inb(g, nx, ny) || isWall(g, nx, ny)) { emit(g, { t: 'bonk', x: u.x, y: u.y }); return; }
      if (heroAt(g, nx, ny) || unitAt(g, nx, ny)) {
        emit(g, { t: 'lunge', id: u.id, x: u.x, y: u.y, to: [nx, ny] });
        strike(g, u, nx, ny, it.dmg, true);
        return;
      }
      if (i === it.range) return;
      emit(g, { t: 'move', id: u.id, from: [u.x, u.y], to: [nx, ny], dash: true });
      u.x = nx; u.y = ny;
      trapCheck(g, u);
      if (u.hp <= 0) return;
    }
  } else if (it.kind === 'area') {
    emit(g, { t: 'aoe', tiles, c: it.color || '#ff5a1f' });
    for (const [x, y] of tiles) {
      strike(g, u, x, y, it.dmg, false);
      if (it.slime) g.fx.slime[key(x, y)] = 6;
      if (it.ice && tile(g, x, y) === T.FLOOR) setTile(g, x, y, T.ICE);
      if (it.fire) g.fx.burn[key(x, y)] = 2;
    }
  }
}

function shamanAct(g, u) {
  if (u.timer % 2) return false; // heals every other turn
  const hurt = enemies(g).filter((v) => v !== u && v.hp < v.maxHp && manhattan(v.x, v.y, u.x, u.y) <= 5)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (hurt) {
    hurt.hp += 1;
    emit(g, { t: 'bolt', from: [u.x, u.y], to: [hurt.x, hurt.y], c: '#7dff6b' });
    emit(g, { t: 'text', x: hurt.x, y: hurt.y, s: '+1', c: '#7dff6b' });
    return true;
  }
  return false;
}

function summon(g, type, n, near) {
  const spots = freeTiles(g, { avoidHero: 2 })
    .sort((a, b) => manhattan(a[0], a[1], near.x, near.y) - manhattan(b[0], b[1], near.x, near.y));
  for (let i = 0; i < n && i < spots.length; i++) {
    const u = makeUnit(g, type, spots[i][0], spots[i][1]);
    u.stun = 1;
    u.minion = true;
    emit(g, { t: 'spawn', id: u.id, x: u.x, y: u.y });
  }
}

function areaAround(g, x, y) {
  const out = [];
  for (const [dx, dy] of [[0, 0], ...KING]) if (inb(g, x + dx, y + dy) && !isWall(g, x + dx, y + dy)) out.push([x + dx, y + dy]);
  return out;
}

function bossPlan(g, u) {
  const h = g.hero;
  const hidden = h.invis > 0;
  const tm = u.timer;
  const area = (tiles, extra) => { u.intent = { kind: 'area', tiles, delay: 1, ...extra }; emit(g, { t: 'intent', id: u.id }); };
  switch (u.type) {
    case 'bone_tyrant':
      if (tm % 4 === 0) { summon(g, 'skeleton', g.depth >= 5 ? 2 : 1, u); return; }
      break;
    case 'mother_slug':
      if (!u.split && u.hp <= u.maxHp / 2) { u.split = true; summon(g, 'mudling', 2, u); return; }
      if (tm % 3 === 0 && !hidden) { area(areaAround(g, h.x, h.y), { dmg: 2, slime: true, delay: 2, color: '#7dff6b' }); return; }
      break;
    case 'frost_colossus':
      if (tm % 3 === 0 && !hidden) { area(areaAround(g, h.x, h.y), { dmg: 2, ice: true, delay: 2, color: '#9fd8ff' }); return; }
      break;
    case 'orc_warlord': {
      const aligned = (h.x === u.x || h.y === u.y) && manhattan(h.x, h.y, u.x, u.y) > 1;
      if (aligned && tm % 2 === 0 && !hidden) { u.intent = { kind: 'charge', dir: [Math.sign(h.x - u.x), Math.sign(h.y - u.y)], range: 8, dmg: 3, delay: 1 }; return; }
      if (tm % 5 === 0) { summon(g, 'goblin', 1 + (g.depth >= 5 ? 1 : 0), u); return; }
      break;
    }
    case 'pit_lord':
      if (tm % 3 === 0 && !hidden) {
        const tiles = [];
        if ((tm / 3) % 2) for (let x = 0; x < g.map.w; x++) { if (!isWall(g, x, h.y)) tiles.push([x, h.y]); }
        else for (let y = 0; y < g.map.h; y++) { if (!isWall(g, h.x, y)) tiles.push([h.x, y]); }
        area(tiles, { dmg: 2, fire: true, color: '#ff3b1f' });
        return;
      }
      if (tm % 5 === 1) { summon(g, 'imp', 2, u); return; }
      break;
  }
  if (!planAttack(g, u)) { moveEnemy(g, u); planAttack(g, u); }
}

export function enemyTurn(g, u) {
  if (u.hp <= 0) return;
  const def = ENEMIES[u.type];
  const unroot = () => { if (u.root > 0) u.root--; };
  if (u.stun > 0) {
    u.stun--;
    if (u.intent) { u.intent = null; emit(g, { t: 'text', x: u.x, y: u.y, s: 'CANCELLED', c: '#ffe66b' }); }
    unroot();
    return;
  }
  u.timer = (u.timer || 0) + 1;
  if (u.intent) {
    if (--u.intent.delay > 0) { unroot(); return; }
    resolveIntent(g, u);
    if (u.hp <= 0 || g.phase !== 'play') return;
  }
  if (def.healer) { if (!shamanAct(g, u)) moveEnemy(g, u); unroot(); return; }
  if (def.boss) { bossPlan(g, u); unroot(); return; }
  if (!def.slow || u.timer % 2 === 0) moveEnemy(g, u);
  if (u.hp > 0) planAttack(g, u);
  unroot();
}

export function allyTurn(g, a) {
  if (a.hp <= 0) return;
  if (a.type === 'geode') {
    for (const [dx, dy] of ORTH) {
      const e = firstEnemyInRay(g, a.x, a.y, dx, dy, 5);
      if (e) { emit(g, { t: 'bolt', from: [a.x, a.y], to: [e.x, e.y], c: '#8ecbff' }); damageUnit(g, e, 1, a, 'spell'); }
    }
  } else if (a.type === 'thrall') {
    const adj = ORTH.map(([dx, dy]) => unitAt(g, a.x + dx, a.y + dy)).find((v) => v && v.team === 'enemy');
    if (adj) {
      emit(g, { t: 'lunge', id: a.id, x: a.x, y: a.y, to: [adj.x, adj.y] });
      damageUnit(g, adj, 1, a, 'spell');
    } else {
      const es = enemies(g);
      const goals = es.flatMap((e) => ORTH.map(([dx, dy]) => [e.x + dx, e.y + dy]));
      const step = pathStep(g, a, goals, ORTH);
      if (step) moveUnitTo(g, a, step[0], step[1]);
    }
  }
  if (a.life > 0 && --a.life <= 0) { emit(g, { t: 'death', id: a.id, x: a.x, y: a.y, type: a.type }); g.units = g.units.filter((v) => v !== a); }
}
