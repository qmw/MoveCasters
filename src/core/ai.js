// Enemy + ally behaviour. Rule: an enemy attacks if the hero is inside its threat pattern, otherwise it moves.
import { ENEMIES, ORTH, DIAG, KING, KNIGHT, T } from './data.js';
import {
  key, inb, tile, setTile, isWall, unitAt, heroAt, occupied, enemies, allies, standable, enemySafe, manhattan,
  damageUnit, hurtHero, emit, makeUnit, randomFree, freeTiles, ray, spellAt, trapCheck, firstEnemyInRay, killUnit,
} from './engine.js';
import { rint } from './rng.js';
import { SPELLS, spellCd } from './spells.js';

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

// Is this enemy going to act (attack) next enemy phase?
export const willAct = (u) => u.stun <= 0 && !(ENEMIES[u.type].slow && !u.slowReady);

export function threatOf(g, u) {
  if (u.team !== 'enemy' || !willAct(u)) return [];
  const def = ENEMIES[u.type];
  if (u.intent) return [];
  return patternTiles(g, effectivePattern(u), u.x, u.y, def.range || 4);
}

// key -> count of enemies that will hit that square, plus intents (telegraphed area attacks)
export function dangerMap(g) {
  const m = {};
  for (const u of enemies(g)) for (const [x, y] of threatOf(g, u)) m[key(x, y)] = (m[key(x, y)] || 0) + 1;
  return m;
}
export function intentMap(g) {
  const m = {};
  for (const u of enemies(g)) if (u.intent) for (const [x, y] of u.intent.tiles) m[key(x, y)] = { dmg: u.intent.dmg, delay: u.intent.delay };
  return m;
}

const inPattern = (g, u, tx, ty) => threatOf(g, u).some(([x, y]) => x === tx && y === ty);

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
  if (def.eater) {
    const b = spellAt(g, nx, ny);
    if (b) {
      g.board = g.board.filter((v) => v !== b);
      emit(g, { t: 'text', x: nx, y: ny, s: 'CHOMP', c: '#8fd16a' });
      scheduleRecharge(g, b.slot, 3);
    }
  }
  trapCheck(g, u);
}

export function scheduleRecharge(g, slot, extra = 0) {
  const d = g.hero.deck[slot];
  if (!d) return;
  const pos = randomFree(g, { avoidHero: 2 }) || [g.hero.x, g.hero.y];
  g.recharge.push({ slot, x: pos[0], y: pos[1], t: spellCd(g, d.id, d.lv) + extra });
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
  let goals = patternTiles(g, pat === 'line' || pat === 'charge' ? pat : pat, target.x, target.y, def.range || 4)
    .filter(([x, y]) => !(x === u.x && y === u.y) || true);
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
    if (def.eater && g.board.length) {
      step = pathStep(g, u, g.board.filter((b) => !occupied(g, b.x, b.y)).map((b) => [b.x, b.y]), steps);
    }
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
    if (target && inPattern(g, u, target.x, target.y)) return;
  }
}

function attack(g, u, target) {
  const def = ENEMIES[u.type];
  const dmg = def.dmg + (u.elite ? 0 : 0);
  const dx = Math.sign(target.x - u.x), dy = Math.sign(target.y - u.y);
  if (dx === 0 || dy === 0) u.facing = [dx, dy];
  if (effectivePattern(u) === 'charge' && manhattan(u.x, u.y, target.x, target.y) > 1) {
    // rush to the square adjacent to the target
    const tx = target.x - dx, ty = target.y - dy;
    emit(g, { t: 'move', id: u.id, from: [u.x, u.y], to: [tx, ty], dash: true });
    u.x = tx; u.y = ty;
    trapCheck(g, u);
    if (u.hp <= 0) return;
  }
  if (def.ranged || def.pattern === 'line') emit(g, { t: 'bolt', from: [u.x, u.y], to: [target.x, target.y], c: '#c7a6ff' });
  else emit(g, { t: 'lunge', id: u.id, x: u.x, y: u.y, to: [target.x, target.y] });
  if (target === g.hero) hurtHero(g, dmg, u, 'enemy');
  else damageUnit(g, target, dmg, u, 'enemy');
}

function shamanAct(g, u) {
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
  const spots = freeTiles(g, { avoidHero: 2, noSpells: false })
    .sort((a, b) => manhattan(a[0], a[1], near.x, near.y) - manhattan(b[0], b[1], near.x, near.y));
  for (let i = 0; i < n && i < spots.length; i++) {
    const u = makeUnit(g, type, spots[i][0], spots[i][1]);
    u.stun = 1;
    emit(g, { t: 'spawn', id: u.id, x: u.x, y: u.y });
  }
}

function areaAround(g, x, y) {
  const out = [];
  for (const [dx, dy] of [[0, 0], ...KING]) if (inb(g, x + dx, y + dy) && !isWall(g, x + dx, y + dy)) out.push([x + dx, y + dy]);
  return out;
}

function resolveIntent(g, u) {
  const it = u.intent;
  u.intent = null;
  if (it.kind === 'charge') {
    const [dx, dy] = it.dir;
    let hitHero = false;
    for (const [x, y] of it.tiles) {
      if (heroAt(g, x, y)) { hitHero = true; break; }
      const v = unitAt(g, x, y);
      if (v) { damageUnit(g, v, it.dmg, u, 'enemy'); break; }
      if (!enemySafe(g, x, y)) break;
      emit(g, { t: 'move', id: u.id, from: [u.x, u.y], to: [x, y], dash: true });
      u.x = x; u.y = y;
    }
    if (hitHero) { emit(g, { t: 'lunge', id: u.id, x: u.x, y: u.y, to: [g.hero.x, g.hero.y] }); hurtHero(g, it.dmg, u, 'enemy'); }
    return;
  }
  emit(g, { t: 'aoe', tiles: it.tiles, c: it.color || '#ff5a1f' });
  for (const [x, y] of it.tiles) {
    if (heroAt(g, x, y)) hurtHero(g, it.dmg, null, 'area');
    const v = unitAt(g, x, y);
    if (v && v.team === 'ally') damageUnit(g, v, it.dmg, null, 'blast');
    if (it.slime) g.fx.slime[key(x, y)] = 6;
    if (it.ice && tile(g, x, y) === T.FLOOR) setTile(g, x, y, T.ICE);
    if (it.fire) g.fx.burn[key(x, y)] = 2;
  }
}

function bossAct(g, u) {
  u.timer++;
  if (u.intent) {
    if (--u.intent.delay > 0) return;
    resolveIntent(g, u);
    return;
  }
  const h = g.hero;
  const hidden = h.invis > 0;
  const tm = u.timer;
  const telegraph = (tiles, extra) => { u.intent = { tiles, delay: 1, ...extra }; emit(g, { t: 'intent', id: u.id }); };
  switch (u.type) {
    case 'bone_tyrant':
      if (tm % 4 === 0) { summon(g, 'skeleton', g.depth >= 5 ? 3 : 2, u); return; }
      break;
    case 'mother_slug':
      if (!u.split && u.hp <= u.maxHp / 2) { u.split = true; summon(g, 'mudling', 2, u); return; }
      if (tm % 3 === 0 && !hidden) { telegraph(areaAround(g, h.x, h.y), { dmg: 2, slime: true, delay: 2, color: '#7dff6b' }); return; }
      break;
    case 'frost_colossus':
      if (tm % 3 === 0 && !hidden) { telegraph(areaAround(g, h.x, h.y), { dmg: 2, ice: true, delay: 2, color: '#9fd8ff' }); return; }
      break;
    case 'orc_warlord': {
      const aligned = (h.x === u.x || h.y === u.y) && manhattan(h.x, h.y, u.x, u.y) > 1;
      if (aligned && tm % 2 === 0 && !hidden) {
        const dir = [Math.sign(h.x - u.x), Math.sign(h.y - u.y)];
        const tiles = ray(g, u.x, u.y, dir[0], dir[1], 8);
        if (tiles.length) { telegraph(tiles, { kind: 'charge', dir, dmg: 3 }); return; }
      }
      if (tm % 5 === 0) { summon(g, 'goblin', 1 + (g.depth >= 5 ? 1 : 0), u); return; }
      break;
    }
    case 'pit_lord':
      if (tm % 3 === 0 && !hidden) {
        const tiles = [];
        if ((tm / 3) % 2) for (let x = 0; x < g.map.w; x++) { if (!isWall(g, x, h.y)) tiles.push([x, h.y]); }
        else for (let y = 0; y < g.map.h; y++) { if (!isWall(g, h.x, y)) tiles.push([h.x, y]); }
        telegraph(tiles, { dmg: 2, fire: true, color: '#ff3b1f' });
        return;
      }
      if (tm % 5 === 1) { summon(g, 'imp', 2, u); return; }
      break;
  }
  const target = targetOf(g, u);
  if (target && inPattern(g, u, target.x, target.y)) { attack(g, u, target); return; }
  moveEnemy(g, u);
}

export function enemyTurn(g, u) {
  if (u.hp <= 0) return;
  const def = ENEMIES[u.type];
  if (u.stun > 0) { u.stun--; if (u.root > 0) u.root--; return; }
  if (def.slow) {
    if (!u.slowReady) { u.slowReady = true; return; }
    u.slowReady = false;
  }
  if (def.boss) { bossAct(g, u); if (u.root > 0) u.root--; return; }
  if (def.healer) {
    if (!shamanAct(g, u)) moveEnemy(g, u);
    if (u.root > 0) u.root--;
    return;
  }
  const h = g.hero;
  if (h.invis <= 0 && inPattern(g, u, h.x, h.y)) attack(g, u, h);
  else {
    const ally = allies(g).find((a) => inPattern(g, u, a.x, a.y) && a.type !== 'geode') || allies(g).find((a) => inPattern(g, u, a.x, a.y));
    if (ally) attack(g, u, ally);
    else moveEnemy(g, u);
  }
  if (u.root > 0) u.root--;
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
