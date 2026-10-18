// Shared game primitives used by spells, enemy AI and the turn loop.
import { T, ENEMIES, KING, ORTH } from './data.js';
import { rint } from './rng.js';

export const key = (x, y) => x + ',' + y;
export const unkey = (k) => k.split(',').map(Number);
export const inb = (g, x, y) => x >= 0 && y >= 0 && x < g.map.w && y < g.map.h;
export const tile = (g, x, y) => (inb(g, x, y) ? g.map.t[y * g.map.w + x] : T.WALL);
export const setTile = (g, x, y, v) => { if (inb(g, x, y)) g.map.t[y * g.map.w + x] = v; };
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export function emit(g, ev) {
  if (g.quiet) return;
  g.events.push(ev);
}

export const isWall = (g, x, y) => tile(g, x, y) === T.WALL || !!g.fx.wall[key(x, y)];
export const blocksSight = (g, x, y) => isWall(g, x, y);
export const unitAt = (g, x, y) => g.units.find((u) => u.x === x && u.y === y && u.hp > 0);
export const heroAt = (g, x, y) => g.hero.x === x && g.hero.y === y;
export const occupied = (g, x, y) => heroAt(g, x, y) || !!unitAt(g, x, y);
export const enemies = (g) => g.units.filter((u) => u.team === 'enemy' && u.hp > 0);
export const allies = (g) => g.units.filter((u) => u.team === 'ally' && u.hp > 0);

// Spikes are "armed" on the turn they will be up at the end of the current round.
export const spikesUp = (g, x, y, turn = g.turn) => (turn + x + y) % 2 === 0;

// Can a walker stand here (ignoring units)?
export function standable(g, x, y) {
  if (!inb(g, x, y)) return false;
  const t = tile(g, x, y);
  return t !== T.WALL && t !== T.PIT && !g.fx.wall[key(x, y)];
}
// Tiles an enemy is willing to step on during normal movement.
export function enemySafe(g, x, y) {
  if (!standable(g, x, y)) return false;
  const t = tile(g, x, y);
  if (t === T.LAVA) return false;
  if (t === T.SPIKES && spikesUp(g, x, y, g.turn + 1)) return false;
  if (g.fx.burn[key(x, y)]) return false;
  if (g.fx.trap[key(x, y)] && !g.fx.trap[key(x, y)].known) return true;
  return true;
}

export function freeTiles(g, { avoidHero = 0, safeOnly = true, noSpells = true } = {}) {
  const out = [];
  for (let y = 0; y < g.map.h; y++)
    for (let x = 0; x < g.map.w; x++) {
      if (!standable(g, x, y)) continue;
      if (safeOnly && tile(g, x, y) !== T.FLOOR) continue;
      if (occupied(g, x, y)) continue;
      if (avoidHero && manhattan(x, y, g.hero.x, g.hero.y) < avoidHero) continue;
      if (noSpells && spellAt(g, x, y)) continue;
      if (g.fx.trap[key(x, y)]) continue;
      out.push([x, y]);
    }
  return out;
}

export const spellAt = (g, x, y) => g.board.find((b) => b.x === x && b.y === y);
export const ghostAt = (g, x, y) => g.recharge.find((b) => b.x === x && b.y === y);

// Walk from (x,y) in dir up to range tiles; stops at walls. Returns tiles (not including origin).
export function ray(g, x, y, dx, dy, range = 99, stopAtUnit = false) {
  const out = [];
  for (let i = 1; i <= range; i++) {
    const nx = x + dx * i, ny = y + dy * i;
    if (!inb(g, nx, ny) || isWall(g, nx, ny)) break;
    out.push([nx, ny]);
    if (stopAtUnit && unitAt(g, nx, ny)) break;
  }
  return out;
}
export function firstEnemyInRay(g, x, y, dx, dy, range = 99) {
  for (const [nx, ny] of ray(g, x, y, dx, dy, range)) {
    const u = unitAt(g, nx, ny);
    if (u) return u.team === 'enemy' ? u : null;
  }
  return null;
}
export function enemiesInRay(g, x, y, dx, dy, range = 99) {
  return ray(g, x, y, dx, dy, range).map(([nx, ny]) => unitAt(g, nx, ny)).filter((u) => u && u.team === 'enemy');
}
export function nearestEnemy(g, x, y, maxDist = 99, exclude = null) {
  let best = null, bd = 1e9;
  for (const u of enemies(g)) {
    if (u === exclude) continue;
    const d = manhattan(x, y, u.x, u.y);
    if (d <= maxDist && d < bd) { bd = d; best = u; }
  }
  return best;
}

export function makeUnit(g, type, x, y, team = 'enemy', extra = {}) {
  const def = ENEMIES[type] || {};
  let hp = extra.hp ?? def.hp ?? 1;
  const u = {
    id: g.nextId++, type, x, y, hp, maxHp: hp, team,
    stun: 0, root: 0, poison: 0, curse: 0, mark: 0,
    facing: [0, 1], timer: 0, life: extra.life ?? 0, intent: null, boss: !!def.boss, ...extra,
  };
  u.maxHp = Math.max(u.maxHp, u.hp);
  g.units.push(u);
  if (team === 'enemy') g.stats.seen[type] = (g.stats.seen[type] || 0) + 1;
  return u;
}

// ---- Damage -----------------------------------------------------------------
// src: {x,y} position the damage comes from (for shields), kind: spell|bump|burn|poison|collide|enemy|blast
export function damageUnit(g, u, amount, src = null, kind = 'spell') {
  if (!u || u.hp <= 0 || amount <= 0) return 0;
  const def = ENEMIES[u.type] || {};
  if (def.shield && src && u.stun <= 0) {
    const dx = Math.sign(src.x - u.x), dy = Math.sign(src.y - u.y);
    if (dx * u.facing[0] + dy * u.facing[1] > 0 && (dx === 0 || dy === 0)) {
      emit(g, { t: 'text', x: u.x, y: u.y, s: 'BLOCK', c: '#ccc' });
      return 0;
    }
  }
  let n = amount + (u.mark > 0 ? 1 : 0);
  if (u.curse > 0) n *= 2;
  u.hp -= n;
  emit(g, { t: 'hit', id: u.id, x: u.x, y: u.y, n });
  if (u.hp <= 0) killUnit(g, u, kind);
  return n;
}

export function killUnit(g, u, kind) {
  u.hp = 0;
  const def = ENEMIES[u.type] || {};
  g.units = g.units.filter((v) => v !== u);
  emit(g, { t: 'death', id: u.id, x: u.x, y: u.y, type: u.type });
  if (u.team !== 'enemy') return;
  g.stats.kills++;
  g.turnKills = (g.turnKills || 0) + 1;
  g.stats.killsByType[u.type] = (g.stats.killsByType[u.type] || 0) + 1;
  if (u.boss) g.stats.bossKills.push(u.type);
  const k = key(u.x, u.y);
  if (standable(g, u.x, u.y)) g.fx.corpse[k] = 1;
  if (g.cls === 'pyro' && (kind === 'spell' || kind === 'burn')) g.fx.burn[k] = 3;
  if (g.hero.relics.includes('vampire_fang')) {
    g.hero.fang = (g.hero.fang || 0) + 1;
    if (g.hero.fang % 4 === 0) healHero(g, 1);
  }
  if (def.split) {
    const spots = ORTH.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => enemySafe(g, x, y) && !occupied(g, x, y));
    spots.slice(0, 2).forEach(([x, y]) => makeUnit(g, 'slimeling', x, y));
  }
  if (def.explode) {
    emit(g, { t: 'aoe', tiles: KING.map(([dx, dy]) => [u.x + dx, u.y + dy]), c: '#ff5a1f' });
    for (const [dx, dy] of KING) {
      const x = u.x + dx, y = u.y + dy;
      if (heroAt(g, x, y)) hurtHero(g, 1, null);
      const v = unitAt(g, x, y);
      if (v) damageUnit(g, v, 1, null, 'blast');
    }
  }
}

export function healHero(g, n) {
  const h = g.hero;
  const before = h.hp;
  h.hp = Math.min(h.maxHp, h.hp + n);
  if (h.hp > before) emit(g, { t: 'heal', x: h.x, y: h.y, n: h.hp - before });
}

// attacker: unit or null. Returns damage actually taken.
export function hurtHero(g, n, attacker, kind = 'enemy') {
  const h = g.hero;
  if (n <= 0 || g.phase === 'dead') return 0;
  if (attacker && h.riposte && kind === 'enemy') {
    h.riposte = 0;
    emit(g, { t: 'text', x: h.x, y: h.y, s: 'RIPOSTE', c: '#fff36b' });
    damageUnit(g, attacker, 3, h, 'spell');
    return 0;
  }
  if (g.cls === 'knight' && !h.steelUsed) {
    h.steelUsed = true;
    emit(g, { t: 'text', x: h.x, y: h.y, s: 'STEEL', c: '#c9d4e8' });
    return 0;
  }
  if (h.block > 0) {
    const b = Math.min(h.block, n);
    h.block -= b; n -= b;
    emit(g, { t: 'text', x: h.x, y: h.y, s: 'BLOCK ' + b, c: '#8ecbff' });
    if (n <= 0) return 0;
  }
  h.hp -= n;
  g.stats.dmgTaken += n;
  g.floorDmg += n;
  emit(g, { t: 'hurt', x: h.x, y: h.y, n });
  if (attacker && h.relics.includes('thorn_mail') && cheb(attacker.x, attacker.y, h.x, h.y) <= 1) {
    damageUnit(g, attacker, 1, h, 'spell');
  }
  if (h.hp <= 0) {
    if (h.relics.includes('phylactery') && !h.phylUsed) {
      h.phylUsed = true; h.hp = 1;
      emit(g, { t: 'text', x: h.x, y: h.y, s: 'PHYLACTERY', c: '#7de0c8' });
    } else {
      h.hp = 0;
      g.phase = 'dead';
      emit(g, { t: 'herodeath', x: h.x, y: h.y });
    }
  }
  return n;
}

// ---- Movement / pushes --------------------------------------------------------
// Push unit by (dx,dy) up to dist tiles. Collisions deal damage. Pits kill non-bosses.
export function pushUnit(g, u, dx, dy, dist) {
  if (!u || u.hp <= 0) return;
  const collide = 1 + (g.cls === 'geo' ? 1 : 0);
  for (let i = 0; i < dist; i++) {
    const nx = u.x + dx, ny = u.y + dy;
    const other = unitAt(g, nx, ny);
    if (!inb(g, nx, ny) || isWall(g, nx, ny) || other || heroAt(g, nx, ny)) {
      emit(g, { t: 'bonk', x: u.x, y: u.y });
      damageUnit(g, u, collide, null, 'collide');
      if (other) damageUnit(g, other, collide, null, 'collide');
      return;
    }
    const fx = u.x, fy = u.y;
    u.x = nx; u.y = ny;
    emit(g, { t: 'move', id: u.id, from: [fx, fy], to: [nx, ny], push: true });
    const t = tile(g, nx, ny);
    if (t === T.PIT) {
      if (u.boss) { u.x = fx; u.y = fy; damageUnit(g, u, 3, null, 'collide'); return; }
      emit(g, { t: 'fall', x: nx, y: ny });
      killUnit(g, u, 'collide');
      return;
    }
    if (t === T.LAVA) { damageUnit(g, u, 2, null, 'burn'); if (u.hp <= 0) return; }
    trapCheck(g, u);
    if (u.hp <= 0) return;
  }
}

export function trapCheck(g, u) {
  const k = key(u.x, u.y);
  const tr = g.fx.trap[k];
  if (!tr || u.team !== 'enemy') return;
  delete g.fx.trap[k];
  emit(g, { t: 'text', x: u.x, y: u.y, s: tr.type === 'bear' ? 'SNAP' : 'OUCH', c: '#ffd36b' });
  if (tr.type === 'bear') { u.root = Math.max(u.root, 2); damageUnit(g, u, 2 + (tr.bonus || 0), null, 'spell'); }
  else { u.root = Math.max(u.root, 1); damageUnit(g, u, 1, null, 'spell'); }
}

export function randomFree(g, opts) {
  const tiles = freeTiles(g, opts);
  if (!tiles.length) return null;
  return tiles[rint(g, tiles.length)];
}
