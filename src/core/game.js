// Run state machine and turn loop. Pure & deterministic given the seed.
import { T, DIRS, CLASSES, RELICS, TOTAL_FLOORS, FLOORS_PER_BIOME } from './data.js';
import { rnd, rint, pick, shuffle, hashSeed } from './rng.js';
import {
  key, tile, standable, unitAt, enemies, allies, emit, damageUnit, hurtHero, healHero, spikesUp, manhattan,
  randomFree, makeUnit, ghostAt, spellAt, occupied,
} from './engine.js';
import { SPELLS, spellsOf } from './spells.js';
import { enemyTurn, allyTurn, scheduleRecharge } from './ai.js';
import { buildFloor, biomeFor } from './gen.js';

export const VERSION = 1;

// meta: { blessings: {id:true}, grimoire: {spellId:true}, relics: {id:true}, frozen: bool }
export function newRun({ cls = 'knight', seed = Date.now(), depth = 0, meta = {}, daily = false } = {}) {
  const C = CLASSES[cls];
  const bl = meta.blessings || {};
  let maxHp = C.hp + (bl.vigor1 ? 1 : 0) + (bl.vigor2 ? 1 : 0) - (depth >= 10 ? 1 : 0);
  const g = {
    v: VERSION, seed: typeof seed === 'number' ? seed >>> 0 : hashSeed(seed), cls, depth, daily,
    meta: { blessings: { ...bl }, grimoire: { ...(meta.grimoire || {}) }, relics: { ...(meta.relics || {}) }, frozen: !!meta.frozen },
    floor: 1, path: null, phase: 'play', events: [], nextId: 1, turn: 0,
    hero: {
      x: 0, y: 0, hp: maxHp, maxHp, block: 0, root: 0, invis: 0, riposte: 0, valor: 0, lich: 0, aim: 0,
      deck: C.starters.slice(0, depth >= 9 ? 3 : 4).map((id) => ({ id, lv: 0 })), slots: 5, relics: [],
      rerolls: bl.reroll ? 1 : 0,
    },
    stats: { kills: 0, killsByType: {}, bossKills: [], dmgTaken: 0, spellsCast: 0, swift: 0, perfectFloors: 0,
      floorsCleared: 0, turns: 0, embers: 0, seen: {}, castsByFloor: [], hpByFloor: [], turnsByFloor: [] },
  };
  g.rs = g.seed;
  buildFloor(g);
  return g;
}

export const healBetween = (g) => Math.max(0, 1 + (g.meta.blessings.second_wind ? 1 : 0) - (g.depth >= 4 ? 1 : 0));

// ---- hero ---------------------------------------------------------------------
function castFromBoard(g, b, dx, dy, depthN) {
  g.board = g.board.filter((v) => v !== b);
  const d = g.hero.deck[b.slot];
  if (!d) return;
  const S = SPELLS[d.id];
  const h = g.hero;
  let P = d.lv + (h.relics.includes('glass_lens') ? 1 : 0);
  if (h.aim) { P += 1; h.aim = 0; }
  g.stats.spellsCast++;
  g.floorCasts = (g.floorCasts || 0) + 1;
  emit(g, { t: 'cast', id: d.id, x: h.x, y: h.y, dir: [dx, dy] });
  const times = h.relics.includes('echo_stone') && !g.echoUsed ? 2 : 1;
  g.echoUsed = true;
  const c = { dx, dy, P, lv: d.lv, moveHero: (x, y, mdx, mdy) => enterTile(g, x, y, mdx, mdy, depthN + 1, true) };
  for (let i = 0; i < times && g.phase === 'play'; i++) S.cast(g, c);
  scheduleRecharge(g, b.slot);
}

function enterTile(g, x, y, dx, dy, depthN = 0, dash = false) {
  const h = g.hero;
  const from = [h.x, h.y];
  h.x = x; h.y = y;
  emit(g, { t: 'heromove', from, to: [x, y], dash });
  const t = tile(g, x, y);
  if (t === T.LAVA) hurtHero(g, 2, null, 'lava');
  if (g.fx.slime[key(x, y)] && g.cls !== 'hexer') { h.root = 1; emit(g, { t: 'text', x, y, s: 'STUCK', c: '#7dff6b' }); }
  if (g.cls === 'hexer' && g.fx.corpse[key(x, y)] && !h.harvested && h.hp < h.maxHp) {
    delete g.fx.corpse[key(x, y)];
    h.harvested = true;
    healHero(g, 1);
  }
  if (g.phase !== 'play') return;
  const b = spellAt(g, x, y);
  if (b && depthN < 5) castFromBoard(g, b, dx, dy, depthN);
  // sliding on ice: keep going while we are on ice and nothing moved us
  if (g.phase === 'play' && h.x === x && h.y === y && tile(g, x, y) === T.ICE && depthN < 30) {
    const nx = x + dx, ny = y + dy;
    if (standable(g, nx, ny) && !occupied(g, nx, ny)) enterTile(g, nx, ny, dx, dy, depthN + 1, true);
  }
}

export function bumpDamage(g, u) {
  const h = g.hero;
  let d = CLASSES[g.cls].bump;
  if (h.valor > 0) d += 2;
  if (h.lich > 0) d = Math.max(d, 3);
  if (g.cls === 'shadow' && (u.stun > 0 || u.root > 0)) d = Math.max(d, 3);
  return d;
}

// Returns false if the action was illegal (no turn spent).
export function act(g, action) {
  if (g.phase !== 'play') return false;
  g.events = [];
  const h = g.hero;
  if (action !== 'wait') {
    const [dx, dy] = DIRS[action];
    const tx = h.x + dx, ty = h.y + dy;
    const u = unitAt(g, tx, ty);
    if (h.root > 0) {
      h.root--;
      emit(g, { t: 'text', x: h.x, y: h.y, s: 'STUCK', c: '#7dff6b' });
    } else if (u && u.team === 'enemy') {
      emit(g, { t: 'herolunge', to: [tx, ty] });
      damageUnit(g, u, bumpDamage(g, u), h, 'bump');
      if (h.lich > 0) healHero(g, 1);
    } else if (u) {
      // swap with ally
      emit(g, { t: 'move', id: u.id, from: [tx, ty], to: [h.x, h.y] });
      u.x = h.x; u.y = h.y;
      enterTile(g, tx, ty, dx, dy);
    } else if (!standable(g, tx, ty)) {
      return false;
    } else {
      enterTile(g, tx, ty, dx, dy);
    }
  } else {
    if (h.root > 0) h.root--;
    if (g.cls === 'ranger') h.aim = 1;
  }
  g.stats.turns++;
  g.floorTurns++;
  if (checkEnd(g)) return true;
  // allies, then enemies
  for (const a of allies(g)) allyTurn(g, a);
  if (checkEnd(g)) return true;
  for (const u of enemies(g).slice()) {
    if (g.phase !== 'play') break;
    enemyTurn(g, u);
  }
  if (checkEnd(g)) return true;
  upkeep(g);
  checkEnd(g);
  return true;
}

function upkeep(g) {
  const h = g.hero;
  g.turn++;
  // burning ground
  for (const k of Object.keys(g.fx.burn)) {
    const [x, y] = k.split(',').map(Number);
    const u = unitAt(g, x, y);
    if (u && u.team === 'enemy') damageUnit(g, u, 1, null, 'burn');
    if (h.x === x && h.y === y && g.cls !== 'pyro' && !h.relics.includes('spiked_boots')) hurtHero(g, 1, null, 'burn');
    if (--g.fx.burn[k] <= 0) delete g.fx.burn[k];
  }
  for (const u of g.units.slice()) {
    if (u.hp <= 0) continue;
    if (u.poison > 0) { u.poison--; damageUnit(g, u, 1, null, 'poison'); }
    if (u.curse > 0) u.curse--;
  }
  // spikes
  if (tile(g, h.x, h.y) === T.SPIKES && spikesUp(g, h.x, h.y) && !h.relics.includes('spiked_boots')) hurtHero(g, 1, null, 'spikes');
  for (const u of g.units.slice()) if (tile(g, u.x, u.y) === T.SPIKES && spikesUp(g, u.x, u.y)) damageUnit(g, u, 1 + (h.relics.includes('spiked_boots') ? 1 : 0), null, 'spikes');
  for (const m of ['slime', 'wall']) for (const k of Object.keys(g.fx[m])) if (--g.fx[m][k] <= 0) delete g.fx[m][k];
  if (h.invis > 0) h.invis--;
  if (h.valor > 0) h.valor--;
  if (h.lich > 0) h.lich--;
  // spells recharge
  for (const r of g.recharge.slice()) {
    r.t--;
    if (r.t > 0) continue;
    if (!standable(g, r.x, r.y) || tile(g, r.x, r.y) !== T.FLOOR && tile(g, r.x, r.y) !== T.ICE) {
      const p = randomFree(g, { avoidHero: 2 }); if (p) { r.x = p[0]; r.y = p[1]; }
    }
    if (h.x === r.x && h.y === r.y) { r.t = 0; continue; }
    g.recharge = g.recharge.filter((v) => v !== r);
    g.board.push({ slot: r.slot, x: r.x, y: r.y });
    emit(g, { t: 'spellback', x: r.x, y: r.y });
  }
  // the Dark
  if (g.floorTurns >= g.par) {
    if (g.doomMark) {
      const [x, y] = g.doomMark;
      g.doomMark = null;
      if (!occupied(g, x, y)) { const u = makeUnit(g, 'shade', x, y); emit(g, { t: 'spawn', id: u.id, x, y }); }
    }
    const every = g.depth >= 8 ? 3 : 4;
    if ((g.floorTurns - g.par) % every === 0) {
      const p = randomFree(g, { avoidHero: 3, noSpells: false });
      if (p) g.doomMark = p;
    }
  }
}

function checkEnd(g) {
  if (g.phase === 'dead') { finishRun(g, false); return true; }
  if (g.phase !== 'play') return true;
  if (enemies(g).length === 0) { floorCleared(g); return true; }
  return false;
}

// ---- floor transitions ----------------------------------------------------------
function floorCleared(g) {
  const s = g.stats;
  s.floorsCleared++;
  const swift = g.floorTurns <= g.par;
  if (swift) s.swift++;
  if (g.floorDmg === 0) s.perfectFloors++;
  s.castsByFloor.push(g.floorCasts || 0);
  s.hpByFloor.push(g.hero.hp);
  s.turnsByFloor.push(g.floorTurns);
  g.floorCasts = 0;
  let e = 1 + (swift ? 1 : 0) + (g.isBoss ? 3 : 0) + (g.hero.relics.includes('ember_heart') ? 1 : 0);
  s.embers += e;
  g.lastSwift = swift;
  emit(g, { t: 'cleared', swift, embers: e });
  if (g.floor >= TOTAL_FLOORS) { s.embers += 10 + g.depth * 2; finishRun(g, true); return; }
  g.phase = 'draft';
  g.draft = makeDraft(g, swift);
}

export function draftPool(g) {
  const inDeck = new Set(g.hero.deck.map((d) => d.id));
  return spellsOf(g.cls).filter((id) => !inDeck.has(id) && (SPELLS[id].tier !== 'l' || g.meta.grimoire[id]));
}

function makeDraft(g, swift) {
  const h = g.hero;
  let n = 3 + (g.meta.blessings.insight ? 1 : 0) + (h.relics.includes('lucky_coin') ? 1 : 0) + (swift ? 1 : 0) - (g.depth >= 7 ? 1 : 0);
  const pool = shuffle(g, draftPool(g));
  const opts = [];
  const upg = h.deck.map((d, i) => (d.lv ? -1 : i)).filter((i) => i >= 0);
  if (upg.length && rnd(g) < 0.6) opts.push({ kind: 'empower', slot: pick(g, upg) });
  while (opts.length < n && pool.length) opts.push({ kind: 'spell', id: pool.pop() });
  return { opts, swift };
}

export function rerollDraft(g) {
  if (g.phase !== 'draft' || g.hero.rerolls <= 0) return false;
  g.hero.rerolls--;
  g.draft = makeDraft(g, g.draft.swift);
  return true;
}

// choice: index into draft.opts or -1 to skip (skip heals 1 extra). slot: deck slot to replace when deck is full.
export function chooseDraft(g, choice, slot = null) {
  if (g.phase !== 'draft') return false;
  const h = g.hero;
  if (choice >= 0) {
    const o = g.draft.opts[choice];
    if (o.kind === 'empower') h.deck[o.slot].lv = 1;
    else if (h.deck.length < h.slots) h.deck.push({ id: o.id, lv: 0 });
    else { if (slot === null || slot < 0 || slot >= h.deck.length) return false; h.deck[slot] = { id: o.id, lv: 0 }; }
  } else healHero(g, 1);
  g.draft = null;
  healHero(g, healBetween(g));
  if (g.isBoss) {
    g.phase = 'relic';
    g.relicOpts = relicOptions(g);
    if (!g.relicOpts.length) afterRelic(g);
  } else nextFloor(g);
  return true;
}

export function relicPool(g) {
  return Object.keys(RELICS).filter((id) => (RELICS[id].base || g.meta.relics[id]) && !g.hero.relics.includes(id));
}
function relicOptions(g) {
  return shuffle(g, relicPool(g)).slice(0, 3);
}
export function chooseRelic(g, i) {
  if (g.phase !== 'relic') return false;
  const id = g.relicOpts[i];
  const h = g.hero;
  if (id) {
    h.relics.push(id);
    if (id === 'iron_heart') { h.maxHp += 2; healHero(g, 2); }
    if (id === 'extra_pocket') h.slots++;
    if (id === 'glass_lens') { h.maxHp = Math.max(1, h.maxHp - 2); h.hp = Math.min(h.hp, h.maxHp); }
  }
  g.relicOpts = null;
  healHero(g, 2);
  afterRelic(g);
  return true;
}
function afterRelic(g) {
  if (g.floor === FLOORS_PER_BIOME && g.meta.frozen) { g.phase = 'path'; return; }
  nextFloor(g);
}
export function choosePath(g, path) {
  if (g.phase !== 'path') return false;
  g.path = path === 'frozen' ? 'frozen' : 'swamp';
  nextFloor(g);
  return true;
}
function nextFloor(g) {
  g.floor++;
  g.phase = 'play';
  buildFloor(g);
  g.events = [{ t: 'floor', floor: g.floor }];
}

function finishRun(g, won) {
  if (g.summary) return;
  g.phase = won ? 'won' : 'dead';
  g.summary = {
    cls: g.cls, depth: g.depth, won, floor: g.floor, biome: g.biome, kills: g.stats.kills, killsByType: g.stats.killsByType,
    bossKills: g.stats.bossKills, perfectFloors: g.stats.perfectFloors, embers: g.stats.embers + (won ? 0 : 0),
    seen: g.stats.seen, spellsCast: g.stats.spellsCast, turns: g.stats.turns, daily: g.daily, seed: g.seed,
  };
}

export { biomeFor };
