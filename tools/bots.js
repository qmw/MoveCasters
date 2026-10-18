// Shared bot logic for tools/sim.js (and anything else that wants a headless player).
// Bots never touch src/ state except through the public game API (act / chooseDraft / ...).
import { newRun, act, chooseDraft, chooseRelic, choosePath } from '../src/core/game.js';
import { SPELLS, spellsOf } from '../src/core/spells.js';
import { ENEMIES, T } from '../src/core/data.js';
import { threatOf, intentMap } from '../src/core/ai.js';
import { key, tile, standable, enemies, spikesUp, manhattan, unitAt } from '../src/core/engine.js';

export const ACTIONS = ['up', 'down', 'left', 'right', 'wait'];

// ---- small deterministic RNG for bot decisions (keeps runs reproducible) ----
export function botRng(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clone = (g) => { const c = JSON.parse(JSON.stringify(g)); c.quiet = true; return c; };

// ---- draft policy: prefer damage spells / empower ----------------------------
const DMG_RE = /takes \d|deal \d|deals \d|for \d|\d damage|hit the|slain/i;
export const isDamageSpell = (id) => DMG_RE.test(SPELLS[id].desc);
const spellValue = (id) => (isDamageSpell(id) ? 3 : 1);

export function draftChoice(g) {
  const h = g.hero, opts = g.draft.opts;
  const full = h.deck.length >= h.slots;
  let worstSlot = 0;
  h.deck.forEach((d, i) => { if (spellValue(d.id) + d.lv < spellValue(h.deck[worstSlot].id) + h.deck[worstSlot].lv) worstSlot = i; });
  const worstVal = spellValue(h.deck[worstSlot].id) + h.deck[worstSlot].lv;
  let best = -1, bestV = 0, slot = null;
  opts.forEach((o, i) => {
    let v;
    if (o.kind === 'empower') v = isDamageSpell(h.deck[o.slot].id) ? 3.5 : 2;
    else v = full ? spellValue(o.id) - worstVal : spellValue(o.id);
    if (v > bestV) { bestV = v; best = i; slot = o.kind === 'spell' && full ? worstSlot : null; }
  });
  return [best, slot];
}

// ---- state evaluation ---------------------------------------------------------
function heroDanger(g) {
  const h = g.hero;
  if (h.invis > 0) return 0;
  let d = 0;
  for (const u of enemies(g)) {
    if (threatOf(g, u).some(([x, y]) => x === h.x && y === h.y)) d += ENEMIES[u.type].dmg || 1;
  }
  const im = intentMap(g)[key(h.x, h.y)];
  if (im) d += im.dmg * (im.delay <= 1 ? 1 : 0.4);
  return d;
}

// BFS walking distances from the hero (units ignored; lava/pits/walls block).
function distMap(g) {
  const h = g.hero, W = g.map.w;
  const dist = new Int16Array(W * g.map.h).fill(99);
  dist[h.y * W + h.x] = 0;
  let fr = [[h.x, h.y]];
  for (let d = 1; d < 30 && fr.length; d++) {
    const nx = [];
    for (const [x, y] of fr) {
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const a = x + dx, b = y + dy;
        if (!standable(g, a, b) || dist[b * W + a] <= d || tile(g, a, b) === T.LAVA) continue;
        dist[b * W + a] = d; nx.push([a, b]);
      }
    }
    fr = nx;
  }
  return dist;
}

// Spell opportunities, computed once per real turn: for every spell tile and entry direction, what would
// casting it right now achieve? The eval then rewards routing toward the best approach squares.
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function castGain(a, b) {
  let v = 0;
  const after = new Map(b.units.filter((u) => u.team === 'enemy').map((u) => [u.id, u]));
  for (const u of a.units) {
    if (u.team !== 'enemy' || u.hp <= 0) continue;
    const w = u.boss ? 1.6 : 1;
    const v2 = after.get(u.id);
    if (!v2 || v2.hp <= 0) v += (u.hp + 1.5) * w;
    else {
      v += Math.max(0, u.hp - v2.hp) * w;
      if (v2.stun > u.stun) v += 0.6 * w;
      if (v2.root > u.root) v += 0.3 * w;
      if (v2.poison > u.poison) v += 0.5 * Math.min(v2.poison, v2.hp);
      if (v2.curse > u.curse) v += 0.6;
    }
  }
  v += Math.max(0, b.hero.block - a.hero.block) * 0.8 + Math.max(0, b.hero.hp - a.hero.hp) * 1.2;
  if (b.phase === 'dead') v -= 10;
  return v;
}
export function spellOpportunities(g) {
  const opps = [];
  for (const b of g.board) {
    if (unitAt(g, b.x, b.y)) continue;
    for (const [name, [dx, dy]] of Object.entries(DIRV)) {
      const ax = b.x - dx, ay = b.y - dy;
      if (!standable(g, ax, ay) || tile(g, ax, ay) === T.LAVA) continue;
      const occ = unitAt(g, ax, ay);
      if (occ && !(g.hero.x === ax && g.hero.y === ay)) continue;
      const c = clone(g);
      c.hero.x = ax; c.hero.y = ay; c.hero.root = 0;
      const before = clone(c);
      if (!act(c, name)) continue;
      const v = castGain(before, c);
      if (v > 0.5) opps.push({ x: ax, y: ay, v });
    }
  }
  return opps;
}

export function evalState(g, opps = null) {
  if (g.phase === 'dead') return -1e6;
  const h = g.hero;
  if (g.phase !== 'play') return 1e5 + h.hp * 300 + h.maxHp * 50;
  let s = h.hp * 120 + Math.min(h.block, 4) * 35;
  if (g.cls === 'knight' && !h.steelUsed) s += 45;
  if (h.riposte) s += 30;
  const es = enemies(g);
  let ehp = 0, nearest = 99;
  for (const u of es) {
    ehp += u.boss ? u.hp * 1.6 : u.hp;
    if (u.stun > 0) s += 6;
    s += Math.min(u.poison, u.hp) * 12;
    if (u.curse > 0) s += 6;
    const d = manhattan(u.x, u.y, h.x, h.y);
    if (d < nearest) nearest = d;
  }
  s -= ehp * 28 + es.length * 40;
  s -= heroDanger(g) * 55;
  const t = tile(g, h.x, h.y);
  if (t === T.SPIKES && spikesUp(g, h.x, h.y, g.turn + 1) && !h.relics.includes('spiked_boots')) s -= 40;
  if (g.fx.burn[key(h.x, h.y)] && g.cls !== 'pyro') s -= 40;
  if (h.root > 0) s -= 8;
  const dm = distMap(g), W = g.map.w;
  let sd = 25;
  for (const b of g.board) sd = Math.min(sd, dm[b.y * W + b.x]);
  s -= Math.min(sd, 12) * 3;
  if (opps && opps.length) {
    let best = 0;
    for (const o of opps) best = Math.max(best, o.v * 14 - Math.min(dm[o.y * W + o.x], 20) * 5);
    s += best;
  }
  if (es.length) s -= Math.min(nearest, 12) * 3;
  if (g.doomMark && manhattan(g.doomMark[0], g.doomMark[1], h.x, h.y) <= 1) s -= 20;
  return s;
}

// ---- per-turn analysis (1-ply) used by every bot for metrics -------------------
const tookHit = (a, b) => b.phase === 'dead' || b.stats.dmgTaken > a.stats.dmgTaken || b.hero.block < a.hero.block ||
  (b.hero.steelUsed && !a.hero.steelUsed) || (a.hero.riposte && !b.hero.riposte && b.phase === 'play' && a.floor === b.floor);

export function expand(g, opps = null) {
  const out = [];
  for (const a of ACTIONS) {
    const c = clone(g);
    if (!act(c, a)) continue;
    out.push({ a, s: c, score: evalState(c, opps), hit: tookHit(g, c) });
  }
  return out;
}

export function analyse(children) {
  const safe = children.filter((c) => !c.hit);
  let dense = false;
  if (safe.length >= 2) {
    const sc = safe.map((c) => c.score);
    dense = Math.max(...sc) - Math.min(...sc) >= 20;
  }
  return { safe2: safe.length >= 2, dense, forced: safe.length === 0 };
}

// ---- bots ---------------------------------------------------------------------
export function chooseRandom(g, children, rng) {
  return children[Math.floor(rng() * children.length)].a;
}

export function chooseGreedy(g, children, rng) {
  let best = null, bs = -Infinity;
  for (const c of children) { const v = c.score + rng() * 2; if (v > bs) { bs = v; best = c; } }
  return best.a;
}

// Beam search over hero action sequences; enemies respond through act() itself (deterministic,
// same RNG stream as the real game, so predictions are exact).
export function choosePlanner(g, children, rng, { plies = 3, beam = 8, opps = null } = {}) {
  const roots = children.map((c) => ({ ...c, kids: [], depth: 1 }));
  let frontier = roots.filter((n) => n.s.phase === 'play');
  for (let p = 2; p <= plies && frontier.length; p++) {
    let next = [];
    for (const n of frontier) {
      for (const a of ACTIONS) {
        const c = clone(n.s);
        if (!act(c, a)) continue;
        let sc = evalState(c, opps);
        if (c.phase === 'dead') sc += p * 1000; else if (c.phase !== 'play') sc -= p * 500;
        const k = { a, s: c, score: sc, kids: [], depth: p };
        n.kids.push(k);
        next.push(k);
      }
    }
    // keep everything at ply 2, beam afterwards
    if (p >= 2) next.sort((a, b) => b.score - a.score);
    frontier = next.filter((n) => n.s.phase === 'play').slice(0, p === 2 && plies === 2 ? 99 : beam);
  }
  const val = (n) => (n.kids.length ? Math.max(...n.kids.map(val)) : n.score);
  let best = null, bs = -Infinity;
  for (const r of roots) {
    // blend: mostly the best reachable future, a little of the immediate state (robustness)
    const v = 0.85 * val(r) + 0.15 * r.score + rng() * 2;
    if (v > bs) { bs = v; best = r; }
  }
  return best.a;
}

// ---- event bookkeeping (kill credit, damage source) -----------------------------
const ALLY_TYPES = new Set(['thrall', 'geode', 'decoy']);

function snapshot(g) {
  const m = new Map();
  for (const u of g.units) m.set(u.id, { type: u.type, team: u.team, x: u.x, y: u.y, poison: u.poison, intent: !!u.intent });
  return m;
}

function unitInfo(id, pre, post) {
  if (pre.has(id)) return pre.get(id);
  const u = post.units.find((v) => v.id === id);
  return u ? { type: u.type, team: u.team } : null;
}

function hurtCause(evs, i, pre, post, preBurn) {
  for (let j = i - 1; j >= 0; j--) {
    const e = evs[j];
    if (e.t === 'text' || e.t === 'hit') continue;
    if (e.t === 'lunge') { const u = unitInfo(e.id, pre, post); return u ? u.type : 'enemy?'; }
    if (e.t === 'bolt') {
      const [fx, fy] = e.from;
      for (const v of pre.values()) if (v.x === fx && v.y === fy && v.team === 'enemy') return v.type;
      const u = post.units.find((v) => v.x === fx && v.y === fy);
      return u ? u.type : 'bolt?';
    }
    if (e.t === 'aoe') {
      const p = evs[j - 1];
      if (p && p.t === 'death' && ENEMIES[p.type] && ENEMIES[p.type].explode) return p.type + '_explosion';
      for (const v of pre.values()) if (v.intent) return v.type + '_area';
      if (evs.slice(0, j).some((x) => x.t === 'cast')) return 'self';
      return 'area?';
    }
    if (e.t === 'heromove') return 'lava';
    if (e.t === 'cast') return 'self';
    break;
  }
  const h = post.hero;
  if (tile(post, h.x, h.y) === T.SPIKES) return 'spikes';
  if (preBurn.has(key(h.x, h.y))) return 'burn';
  return 'other';
}

// Process events of one real act(); returns {kills:[credit], hurts:[[cause,n]], deathCause}
export function digestEvents(pre, preBurn, g) {
  const evs = g.events;
  let ctx = 'other';
  const kills = [], hurts = [];
  let deathCause = null, lastHurtCause = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    switch (e.t) {
      case 'cast': ctx = 'spell:' + e.id; break;
      case 'herolunge': ctx = 'bump'; break;
      case 'lunge': { const u = unitInfo(e.id, pre, g); ctx = u && u.team === 'ally' ? 'ally' : 'enemyphase'; break; }
      case 'move': if (!e.push && !e.dash) ctx = 'enemyphase'; break;
      case 'spawn': ctx = 'enemyphase'; break;
      case 'text': if (e.s === 'SNAP') ctx = 'spell:bear_trap'; else if (e.s === 'OUCH') ctx = 'spell:caltrops'; break;
      case 'death': {
        if (!ENEMIES[e.type] || ALLY_TYPES.has(e.type)) break;
        let c = ctx;
        if (c === 'enemyphase') {
          const p = pre.get(e.id);
          c = p && p.poison > 0 ? 'poison' : preBurn.has(key(e.x, e.y)) ? 'burn' : 'other';
        }
        kills.push(c);
        break;
      }
      case 'hurt': lastHurtCause = hurtCause(evs, i, pre, g, preBurn); hurts.push([lastHurtCause, e.n]); break;
      case 'herodeath': deathCause = lastHurtCause || 'other'; break;
    }
  }
  return { kills, hurts, deathCause };
}

// ---- full run -------------------------------------------------------------------
export function playRun({ bot = 'planner', cls = 'knight', seed = 1, depth = 0, grimoire = 'none', frozen = true,
  plies = 3, beam = 8, maxFloorTurns = 250 } = {}) {
  const meta = { frozen, grimoire: {} };
  if (grimoire === 'all') for (const id of spellsOf(cls)) if (SPELLS[id].tier === 'l') meta.grimoire[id] = true;
  const g = newRun({ cls, seed, depth, meta });
  const rng = botRng(seed * 7919 + 13);
  const rec = {
    cls, seed, bot, won: false, floor: 1, biome: g.biome, deathCause: null, path: null,
    floors: [], turns: 0, safe2: 0, dense: 0, forced: 0,
    casts: {}, kills: {}, hurtBy: {}, bossReached: [], bossKilled: [], deck: [], relics: [],
  };
  let fl = null;
  const startFloor = () => {
    fl = { floor: g.floor, biome: g.biome, boss: g.isBoss, turns: 0, casts: 0, dmg: 0, hpStart: g.hero.hp,
      dmg0: g.stats.dmgTaken, casts0: g.stats.spellsCast, par: g.par };
    if (g.isBoss) rec.bossReached.push(enemies(g).find((u) => u.boss)?.type);
  };
  const endFloor = (cleared) => {
    fl.turns = g.floorTurns; fl.casts = g.stats.spellsCast - fl.casts0; fl.dmg = g.stats.dmgTaken - fl.dmg0;
    fl.hpEnd = g.hero.hp; fl.cleared = cleared; fl.swift = cleared && g.floorTurns <= g.par;
    delete fl.dmg0; delete fl.casts0;
    rec.floors.push(fl);
  };
  startFloor();
  let guard = 0;
  while (guard++ < 20000) {
    if (g.phase === 'play') {
      if (g.floorTurns >= maxFloorTurns) { rec.deathCause = 'stall'; endFloor(false); break; }
      const opps = bot === 'random' ? null : spellOpportunities(g);
      const children = expand(g, opps);
      const an = analyse(children);
      rec.turns++; if (an.safe2) rec.safe2++; if (an.dense) rec.dense++; if (an.forced) rec.forced++;
      let a;
      if (bot === 'random') a = chooseRandom(g, children, rng);
      else if (bot === 'greedy') a = chooseGreedy(g, children, rng);
      else a = choosePlanner(g, children, rng, { plies, beam, opps });
      const pre = snapshot(g), preBurn = new Set(Object.keys(g.fx.burn));
      act(g, a);
      const d = digestEvents(pre, preBurn, g);
      for (const e of g.events) if (e.t === 'cast') rec.casts[e.id] = (rec.casts[e.id] || 0) + 1;
      for (const k of d.kills) rec.kills[k] = (rec.kills[k] || 0) + 1;
      for (const [c, n] of d.hurts) rec.hurtBy[c] = (rec.hurtBy[c] || 0) + n;
      if (g.phase === 'dead') { rec.deathCause = d.deathCause; endFloor(false); break; }
      if (g.phase !== 'play') endFloor(true);
      if (g.phase === 'won') { rec.won = true; break; }
    } else if (g.phase === 'draft') {
      const [i, slot] = draftChoice(g);
      chooseDraft(g, i, slot);
      if (g.phase === 'play') startFloor();
    } else if (g.phase === 'relic') {
      chooseRelic(g, 0);
      if (g.phase === 'play') startFloor();
    } else if (g.phase === 'path') {
      rec.path = rng() < 0.5 ? 'swamp' : 'frozen';
      choosePath(g, rec.path);
      startFloor();
    } else break;
  }
  rec.floor = g.floor; rec.biome = g.biome;
  rec.bossKilled = g.stats.bossKills.slice();
  rec.deck = g.hero.deck.map((d) => d.id + (d.lv ? '+' : ''));
  rec.relics = g.hero.relics.slice();
  return rec;
}
