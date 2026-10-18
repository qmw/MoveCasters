#!/usr/bin/env node
// Text-mode MoveCasters for playtesting by humans and AI agents. Stateless between calls: state lives in a JSON save.
//
//   node tools/cli.js new --cls knight --seed 42 --save /tmp/mc.json [--depth 0] [--grimoire all] [--no-frozen]
//   node tools/cli.js act up [left left wait ...] --save /tmp/mc.json   (up|down|left|right|wait, or u/d/l/r/w)
//   node tools/cli.js draft <i|-1> [slot] --save ...     (-1 = skip, heals 1; slot = deck slot to replace when full)
//   node tools/cli.js reroll --save ...
//   node tools/cli.js relic <i> --save ...
//   node tools/cli.js path frozen|swamp --save ...
//   node tools/cli.js look --save ...                    (re-print the current screen)
//   node tools/cli.js help
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { newRun, act, chooseDraft, rerollDraft, chooseRelic, choosePath } from '../src/core/game.js';
import { T, CLASSES, ENEMIES, ALLIES, RELICS, BIOMES, DIRS, TOTAL_FLOORS } from '../src/core/data.js';
import { SPELLS, spellsOf, spellCd, spellFreq } from '../src/core/spells.js';
import { reachOf, intentMap, intentTiles, dangerMap, dangerTiles } from '../src/core/ai.js';
import { key, tile, unitAt, enemies, allies, spikesUp, standable, cellAt, cellReady } from '../src/core/engine.js';

const PATTERN_TEXT = {
  orth1: 'hits the 4 orthogonal neighbours',
  diag1: 'hits the 4 diagonal neighbours',
  king: 'hits all 8 neighbours',
  knight: 'hits chess-knight L-squares (jumps walls)',
  lob2: 'lobs at squares exactly 2 away orthogonally (over obstacles)',
  line: 'shoots along rows/columns, range 4, blocked by walls/units',
  charge: 'charges along a clear row/column, range 3, hits for 2',
  none: 'does not attack',
};
const MOVE_TEXT = { orth: 'moves 1 orth', diag: 'moves 1 diagonal', king: 'moves 1 any dir', knight: 'leaps like a chess knight', phase: 'drifts 1 any dir through walls' };

// ---------------------------------------------------------------- save/load
function load(path) {
  if (!existsSync(path)) die(`no save at ${path} — start with: node tools/cli.js new --cls knight --seed 1 --save ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}
function save(path, s) { writeFileSync(path, JSON.stringify(s)); }
function die(msg) { console.log('ERROR: ' + msg); process.exit(1); }

// Stable per-floor letters for enemies (A..Z) and allies (a..z).
function letters(s) {
  const g = s.g;
  if (!s.letters || s.letters.floor !== g.floor) s.letters = { floor: g.floor, map: {}, nextE: 0, nextA: 0 };
  const L = s.letters;
  for (const u of g.units.slice().sort((a, b) => a.id - b.id)) {
    if (L.map[u.id]) continue;
    if (u.team === 'enemy') { L.map[u.id] = String.fromCharCode(65 + (L.nextE % 26)); L.nextE++; }
    else { L.map[u.id] = String.fromCharCode(97 + (L.nextA % 26)); L.nextA++; }
  }
  return L.map;
}
const nameOf = (u) => (ENEMIES[u.type] || ALLIES[u.type] || { name: u.type }).name;

// ---------------------------------------------------------------- board
// Two-letter spell codes, unique within the deck (initials, else first letters).
export function spellCodes(deck) {
  const used = new Set(), out = [];
  for (const d of deck) {
    const name = SPELLS[d.id].name.toUpperCase().replace(/[^A-Z ]/g, '');
    const words = name.split(' ').filter(Boolean);
    const cands = [];
    if (words.length > 1) cands.push(words[0][0] + words[1][0]);
    for (let i = 1; i < words.join('').length; i++) cands.push(words.join('')[0] + words.join('')[i]);
    cands.push('S' + out.length);
    const c = cands.find((x) => !used.has(x));
    used.add(c); out.push(c);
  }
  return out;
}

// Cell = 3-char content + 1 hazard char + 1 overlay char.
function cellContent(g, x, y, L, codes) {
  const h = g.hero;
  if (h.x === x && h.y === y) return ' @ ';
  const u = unitAt(g, x, y);
  if (u) return L[u.id] + ':' + (u.hp > 9 ? '+' : String(u.hp));
  const t = tile(g, x, y), k = key(x, y);
  if (t === T.WALL) return '###';
  if (g.fx.wall[k]) return 'W' + String(Math.min(99, g.fx.wall[k])).padStart(2, ' ');
  if (t === T.PIT) return 'pit';
  const c = cellAt(g, x, y);
  if (!c || !g.hero.deck[c.slot]) return ' . ';
  if (c.cd <= 0) return codes[c.slot] + (c.slot + 1);
  return (c.slot + 1) + '-' + Math.min(9, c.cd);
}

function hazardChar(g, x, y) {
  const t = tile(g, x, y), k = key(x, y);
  if (t === T.WALL) return '#';
  if (g.fx.trap[k]) return g.fx.trap[k].type === 'bear' ? 'T' : 't';
  if (g.fx.burn[k]) return '&';
  if (t === T.LAVA) return '%';
  if (t === T.SPIKES) return spikesUp(g, x, y, g.turn + 1) ? '^' : 'v';
  if (g.fx.slime[k]) return ',';
  if (t === T.ICE) return '~';
  if (g.fx.corpse[k]) return 'c';
  return ' ';
}

function overlays(g) {
  return { danger: dangerMap(g), intent: intentMap(g) };
}

// Danger char: digit = total damage landing here next enemy phase (swings, firing lines, boss areas and a
// reinforcement vent all summed via dangerMap); V = reinforcement vent only; : = strike landing in 2+ phases;
// D = shade spawns here.
function overlayChar(g, x, y, O) {
  const k = key(x, y);
  if (tile(g, x, y) === T.WALL) return '#';
  const vent = g.emerge && g.emerge[0] === x && g.emerge[1] === y;
  const d = O.danger[k] || 0;
  if (vent && d <= 1) return 'V';
  if (d) return String(Math.min(9, d));
  if (g.doomMark && g.doomMark[0] === x && g.doomMark[1] === y) return 'D';
  const it = O.intent[k];
  if (it && it.delay > 1) return ':';
  return ' ';
}

function renderBoard(g, L, codes) {
  const O = overlays(g);
  const { w, h } = g.map;
  const lines = [];
  let head = '   ';
  for (let x = 0; x < w; x++) head += String(x).padStart(3).padEnd(6);
  lines.push(head);
  for (let y = 0; y < h; y++) {
    let row = String(y).padStart(2) + ' ';
    for (let x = 0; x < w; x++) row += cellContent(g, x, y, L, codes) + hazardChar(g, x, y) + overlayChar(g, x, y, O) + ' ';
    lines.push(row);
  }
  return lines.join('\n');
}

const KEYTEXT = `Board key — each square is 5 chars: [content 3][hazard 1][danger 1]; x = column, y = row; up = y-1.
  content: CCn = READY spell tile (code CC, deck slot n; entering it casts it in your move direction)
           n-k = spent tile of slot n, ready again in k turns (walking on it is a quiet move)
           @ you | A:3 enemy letter : HP (+ = 10 or more) | a:2 ally | ### wall | Wk temp wall (k turns) | pit (temporary)
  hazard : ^ spikes UP after your next move (1 dmg) | v spikes down | ~ ice (you slide, casting every ready tile)
           , slime (the spell on this tile FIZZLES when you enter) | & burning (1 dmg at end of turn) | c corpse
           T bear trap | t caltrops
  danger : N = N total damage lands on this square at the next enemy phase if you end your move here (all telegraphs
           summed: melee swings, the WHOLE firing line of a shot/charge — it hits whoever is first on the line —, boss
           areas, and +1 for a reinforcement vent) | V = reinforcement vent (an enemy emerges here after the next enemy
           phase; standing on it blocks it but costs you 1 HP) | : = telegraphed strike landing in 2+ enemy phases
           D = shade (the Dark) spawns here
  Enemies act Into-the-Breach style: each enemy phase they strike their telegraphed squares (hitting anything there,
  even other enemies), then move, then telegraph a new strike at your current square. Stunning cancels a telegraph.
  You cannot move into enemies (no melee): all damage comes from the spells you step on.`;

function tileName(g, x, y) {
  const t = tile(g, x, y), k = key(x, y);
  const parts = [];
  if (t === T.WALL) parts.push('wall');
  else if (t === T.PIT) parts.push('pit');
  else if (t === T.SPIKES) parts.push(spikesUp(g, x, y, g.turn + 1) ? 'spikes (UP after your move: 1 dmg)' : 'spikes (down)');
  else if (t === T.ICE) parts.push('ice');
  else if (t === T.LAVA) parts.push('lava');
  else parts.push('floor');
  if (g.fx.wall[k]) parts.push(`temp wall ${g.fx.wall[k]}t`);
  if (g.fx.burn[k]) parts.push(`burning ${g.fx.burn[k]}t`);
  if (g.fx.slime[k]) parts.push('slime');
  if (g.fx.trap[k]) parts.push(g.fx.trap[k].type === 'bear' ? 'bear trap' : 'caltrops');
  if (g.fx.corpse[k]) parts.push('corpse');
  const c = cellAt(g, x, y);
  if (c && g.hero.deck[c.slot] && t !== T.WALL) parts.push(`spell ${SPELLS[g.hero.deck[c.slot].id].name} (slot ${c.slot + 1}) ${c.cd <= 0 ? 'READY' : 'spent, ready in ' + c.cd}`);
  return parts.join(', ');
}

function enemyLine(g, u, L) {
  const def = ENEMIES[u.type] || {};
  const st = [];
  if (u.stun > 0) st.push(`STUNNED ${u.stun}`);
  if (u.root > 0) st.push(`ROOTED ${u.root}`);
  if (u.poison > 0) st.push(`poison ${u.poison}`);
  if (u.curse > 0) st.push(`CURSED ${u.curse} (double dmg)`);
  if (u.mark > 0) st.push('marked (+1 dmg taken)');
  if (u.elite) st.push('elite');
  if (def.slow) st.push('slow (moves every other turn, telegraphs land 1 phase later)');
  if (def.shield) st.push(`shield faces ${dirName(u.facing)}`);
  let pat = PATTERN_TEXT[def.pattern] || def.pattern;
  if (def.pattern === 'charge' && u.root > 0) pat += ' (rooted: only adjacent)';
  let s = `  ${L[u.id]} ${def.name}${u.boss ? ' [BOSS]' : ''} at (${u.x},${u.y}) HP ${u.hp}/${u.maxHp}, dmg ${def.dmg}; ${pat}; ${MOVE_TEXT[def.move] || def.move}${def.speed ? ` x${def.speed}` : ''}`;
  if (st.length) s += ` | ${st.join(', ')}`;
  s += `\n      ${def.desc}`;
  if (u.intent) {
    const it = u.intent, tl = intentTiles(g, u), dl = dangerTiles(g, u);
    const where = it.kind === 'line' || it.kind === 'charge'
      ? `${it.kind === 'charge' ? 'charges' : 'shoots'} ${dirName(it.dir)}, hitting whoever is FIRST on the line ${dl.length ? `(${dl[0].join(',')})..(${dl[dl.length - 1].join(',')})` : ''}${tl.length ? `; currently that is (${tl[tl.length - 1].join(',')})` : ''}`
      : `strikes ${tl.length > 3 ? tl.length + ' squares' : tl.map((t) => '(' + t.join(',') + ')').join(' ')}`;
    s += `\n      TELEGRAPH: ${where} for ${it.dmg}, in ${it.delay} enemy phase(s)${u.stun > 0 ? ' — will be CANCELLED (stunned)' : ''}`;
  } else s += '\n      no telegraph (will move, then telegraph if you are in its reach)';
  const reach = reachOf(g, u);
  if (reach.length && reach.length <= 12) s += `\n      reach now: ${reach.map((t) => '(' + t.join(',') + ')').join(' ')}`;
  if (u.boss) s += `\n      BOSS SCHEDULE (timer ${u.timer})` + bossHint(u);
  return s;
}
// Boss schedule: the boss timer ticks at the start of each of its (unstunned) turns; a turn spent counting down a
// delayed telegraph does nothing else.
function bossHint(u) {
  const t = u.timer || 0;
  const nextIn = (period, rem = 0) => { for (let k = 1; k <= period; k++) if ((t + k) % period === rem) return k; return period; };
  const when = (k) => (k === 1 ? 'NEXT enemy phase' : `in ${k} enemy phases`);
  switch (u.type) {
    case 'bone_tyrant': return ` — raises skeletons ${when(nextIn(4))} (every 4th turn)`;
    case 'mother_slug': return ` — telegraphs a 3x3 slime bomb on you ${when(nextIn(3))} (lands 2 phases later); splits into Mudlings at half HP`;
    case 'frost_colossus': return ` — telegraphs a 3x3 slam on you ${when(nextIn(3))} (lands 2 phases later)`;
    case 'pit_lord': return ` — telegraphs a fire ${((t + nextIn(3)) / 3) % 2 ? 'ROW' : 'COLUMN'} through you ${when(nextIn(3))}; summons 2 imps ${when(nextIn(5, 1))}`;
    case 'orc_warlord': return ` — charges (3 dmg) along your row/column on even turns when aligned (next even turn ${when(nextIn(2))}); calls goblins ${when(nextIn(5))}`;
  }
  return '';
}
const dirName = (d) => (!d ? '?' : d[0] === 1 ? 'right' : d[0] === -1 ? 'left' : d[1] === 1 ? 'down' : 'up');

function heroBlock(g) {
  const h = g.hero, C = CLASSES[g.cls];
  const st = [];
  if (h.block) st.push(`block ${h.block}`);
  if (g.cls === 'knight') st.push(h.steelUsed ? 'Steel used' : 'Steel ready (next hit blocked)');
  if (h.root > 0) st.push(`ROOTED ${h.root} (your next move is wasted)`);
  if (h.invis > 0) st.push(`invisible ${h.invis}`);
  if (h.riposte) st.push('riposte ready');
  if (h.valor > 0) st.push(`valor ${h.valor}`);
  if (h.lich > 0) st.push(`lich ${h.lich}`);
  if (h.aim) st.push('steady aim (+1 next spell)');
  if (g.cls === 'hexer') st.push(h.harvested ? 'harvest used' : 'harvest ready');
  const lines = [];
  lines.push(`HERO ${C.name} at (${h.x},${h.y}) on ${tileName(g, h.x, h.y)} | HP ${h.hp}/${h.maxHp}` + (st.length ? ` | ${st.join(', ')}` : ''));
  lines.push(`  Passive: ${C.passive}`);
  if (h.relics.length) lines.push(`  Relics: ${h.relics.map((r) => `${RELICS[r].name} (${RELICS[r].desc})`).join('; ')}`);
  lines.push(`DECK / SPELL LEGEND (${h.deck.length}/${h.slots} slots):`);
  const codes = spellCodes(h.deck);
  h.deck.forEach((d, i) => {
    const S = SPELLS[d.id];
    let ready = 0, total = 0;
    if (g.cells) g.cells.forEach((c) => { if (c && c.slot === i) { total++; if (c.cd <= 0) ready++; } });
    lines.push(`  ${codes[i]}${i + 1} = ${S.name}${d.lv ? '+' : ''} [cooldown ${spellCd(g, d.id, d.lv)}, freq ${spellFreq(d.id)}] tiles ready ${ready}/${total} — ${S.desc}${d.lv ? ' (empowered)' : ''}`);
  });
  return lines.join('\n');
}

// For each action, replay the hero phase on a clone to see where you really end up (Charge, Swap, Vault, ice...)
// and what danger waits there (after your spell has stunned/killed whatever it hits).
function previewAction(g, a) {
  const c = JSON.parse(JSON.stringify(g));
  c.quiet = false;
  const before = new Map(c.units.filter((u) => u.team === 'enemy').map((u) => [u.id, u.hp]));
  if (!act(c, a, { heroOnly: true })) return null;
  const casts = c.events.filter((e) => e.t === 'cast').map((e) => SPELLS[e.id].name + ' ' + dirName(e.dir));
  let dmg = 0, kills = 0;
  for (const [id, hp] of before) { const u = c.units.find((v) => v.id === id); if (!u || u.hp <= 0) { kills++; dmg += hp; } else dmg += hp - u.hp; }
  const h = c.hero;
  let hazard = 0;
  if (tile(c, h.x, h.y) === T.SPIKES && spikesUp(c, h.x, h.y, c.turn + 1) && !h.relics.includes('spiked_boots')) hazard++;
  if (c.fx.burn[key(h.x, h.y)] && c.cls !== 'pyro' && !h.relics.includes('spiked_boots')) hazard++;
  return { x: h.x, y: h.y, casts, dmg, kills, danger: (dangerMap(c)[key(h.x, h.y)] || 0) + hazard, hazard, hpLoss: g.hero.hp - h.hp,
    fizzle: c.events.some((e) => e.t === 'text' && e.s === 'FIZZLE'), stuck: c.events.some((e) => e.t === 'text' && e.s === 'STUCK') };
}

function adjacentSummary(g, L) {
  const h = g.hero;
  const out = [];
  for (const name of ['up', 'down', 'left', 'right', 'wait']) {
    const [dx, dy] = DIRS[name] || [0, 0];
    const x = h.x + dx, y = h.y + dy;
    const u = name === 'wait' ? null : unitAt(g, x, y);
    let s;
    if (u && u.team === 'enemy') s = `blocked by ${L[u.id]} ${nameOf(u)} — illegal (no melee)`;
    else if (name !== 'wait' && !standable(g, x, y)) s = 'blocked (' + tileName(g, x, y) + ') — illegal';
    else {
      const p = previewAction(g, name);
      if (!p) { out.push(`  ${name.padEnd(5)}: illegal`); continue; }
      s = name === 'wait' ? `stay at (${h.x},${h.y})` : `move to (${x},${y})`;
      if (u) s += ` (swap with ally ${L[u.id]})`;
      const hz = name === 'wait' ? ' ' : hazardChar(g, x, y);
      if (hz !== ' ') s += ` [${tileName(g, x, y).split(', spell')[0]}]`;
      if (p.stuck) s += ' — ROOTED: you stay put';
      if (p.fizzle) s += ' — spell FIZZLES (slime)';
      if (p.casts.length) s += ` — CASTS ${p.casts.join(' + ')}`;
      else if (name !== 'wait' && !p.fizzle && !p.stuck) s += ' — quiet move (tile spent)';
      if (p.dmg || p.kills) s += ` (deals ${p.dmg}${p.kills ? `, kills ${p.kills}` : ''})`;
      if (p.x !== x || p.y !== y) { if (name !== 'wait' || p.x !== h.x || p.y !== h.y) s += ` — you END at (${p.x},${p.y})`; }
      if (p.hpLoss > 0) s += ` — you lose ${p.hpLoss} HP during your move`;
      s += p.danger ? ` — DANGER: ${p.danger} dmg on your end square this turn (${p.danger - p.hazard} telegraphed${p.hazard ? `, ${p.hazard} spikes/fire` : ''})` : ' — end square safe';
      if (name === 'wait' && g.cls === 'ranger') s += ' — Steady Aim';
    }
    out.push(`  ${name.padEnd(5)}: ${s}`);
  }
  return out.join('\n');
}

export function screen(s) {
  const g = s.g;
  const L = letters(s);
  const out = [];
  const B = BIOMES[g.biome];
  out.push(`=== FLOOR ${g.floor}/${TOTAL_FLOORS} — ${B.name}${g.isBoss ? ' (BOSS)' : ''} | turn ${g.floorTurns} / par ${g.par}` +
    (g.floorTurns >= g.par ? ' — THE DARK RISES (shades spawn)' : ` (${g.par - g.floorTurns} until the Dark)`) + ` | phase: ${g.phase} ===`);
  if (g.phase === 'play' || g.phase === 'dead' || g.phase === 'won') {
    out.push(renderBoard(g, L, spellCodes(g.hero.deck)));
    out.push(KEYTEXT);
    out.push('ENEMIES:');
    for (const u of enemies(g)) out.push(enemyLine(g, u, L));
    const al = allies(g);
    if (al.length) {
      out.push('ALLIES:');
      for (const a of al) out.push(`  ${L[a.id]} ${nameOf(a)} at (${a.x},${a.y}) HP ${a.hp}${a.life ? `, ${a.life} turns left` : ''} — ${(ALLIES[a.type] || {}).desc || ''}`);
    }
    if (g.emerge) out.push(`REINFORCEMENTS: an enemy emerges at (${g.emerge[0]},${g.emerge[1]}) (V) after the next enemy phase. Standing there blocks it but costs you 1 HP.`);
    if (g.reinfLeft > 0) out.push(`  Reinforcements still to come this floor: ${g.reinfLeft} (a new vent opens every few turns while real enemies remain).`);
    if (g.doomMark) out.push(`DOOM: a shade will spawn at (${g.doomMark[0]},${g.doomMark[1]}) (D) after the next enemy phase. Shades vanish when no other enemy remains.`);
  }
  out.push(heroBlock(g));
  if (g.phase === 'play') {
    out.push('YOUR OPTIONS:');
    out.push(adjacentSummary(g, L));
  } else if (g.phase === 'draft') {
    out.push(`FLOOR CLEARED${g.draft.swift ? ' — SWIFT (extra draft option)' : ''}${g.lastFlawless ? ' — FLAWLESS (+1 ember)' : ''}. HP ${g.hero.hp}/${g.hero.maxHp}. Choose a draft: node tools/cli.js draft <i> [slot]` +
      (g.hero.deck.length >= g.hero.slots ? '  (deck full: give the slot number 1..' + g.hero.deck.length + ' to replace)' : ''));
    g.draft.opts.forEach((o, i) => {
      if (o.kind === 'empower') { const d = g.hero.deck[o.slot]; out.push(`  ${i}: EMPOWER *${o.slot + 1} ${SPELLS[d.id].name} (+1 damage/effect, cooldown -1)`); }
      else out.push(`  ${i}: NEW SPELL ${SPELLS[o.id].name} [cd ${SPELLS[o.id].cd}] — ${SPELLS[o.id].desc}`);
    });
    out.push(`  -1: skip (heal 1)` + (g.hero.rerolls ? ` | reroll available (${g.hero.rerolls}): node tools/cli.js reroll` : ''));
  } else if (g.phase === 'relic') {
    out.push('BOSS DEFEATED. Choose a relic: node tools/cli.js relic <i>   (choosing any relic also heals you 2)');
    g.relicOpts.forEach((id, i) => out.push(`  ${i}: ${RELICS[id].name} — ${RELICS[id].desc}`));
  } else if (g.phase === 'path') {
    out.push('Choose your path: node tools/cli.js path swamp   (Rot Swamp: slime, pits, slugs, spitters, mudlings)');
    out.push('                  node tools/cli.js path frozen  (Frozen Vault: ice sliding, frost zombies, wraiths)');
  } else if (g.phase === 'dead' || g.phase === 'won') {
    const sm = g.summary || {};
    out.push(`RUN OVER — ${g.phase === 'won' ? 'VICTORY!' : 'YOU DIED'} on floor ${g.floor}. Kills ${sm.kills}, spells cast ${sm.spellsCast}, turns ${sm.turns}, embers ${sm.embers}, bosses ${(sm.bossKills || []).join(', ') || 'none'}.`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- events → text
// heroEnd = number of events produced by the hero phase (from a heroOnly replay); later events are the enemy phase.
export function describeEvents(g, evs, pre, L, heroEnd = Infinity) {
  const pos = new Map([...pre].map(([id, u]) => [id, { ...u }]));
  for (const u of g.units) if (!pos.has(u.id)) pos.set(u.id, { ...u });
  const nm = (id) => { const u = pos.get(id); return u ? `${L[id] || '?'} ${nameOf(u)}` : `#${id}`; };
  const at = (x, y) => { for (const [id, u] of pos) if (u.x === x && u.y === y && !u.dead) return id; return null; };
  const out = [];
  let lastCast = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    const heroPhase = i < heroEnd;
    if (i === heroEnd) out.push('(enemy phase)');
    switch (e.t) {
      case 'heromove': out.push(`You ${e.dash ? 'dash/slide' : 'move'} to (${e.to[0]},${e.to[1]}).`); break;
      case 'cast': lastCast = SPELLS[e.id].name; out.push(`You CAST ${lastCast} facing ${dirName(e.dir)} from (${e.x},${e.y}).`); break;
      case 'hit': out.push(`  ${nm(e.id)} takes ${e.n} damage.`); break;
      case 'death': { const u = pos.get(e.id); if (u) u.dead = true; out.push(`  ${ENEMIES[e.type] || ALLIES[e.type] ? nm(e.id) : e.type} dies at (${e.x},${e.y}).`); break; }
      case 'hurt': {
        let src = e.src;
        const prev = evs.slice(0, i).reverse().find((v) => v.t !== 'hit');
        if (prev && prev.t === 'text' && prev.s === 'BLOCKED') src = 'reinforcement vent (you blocked an emerging enemy)';
        else if (src === 'blast') src = prev && prev.t === 'aoe' ? 'boss area attack' : 'blast';
        else if (!src && prev && prev.t === 'aoe' && evs.slice(0, i).some((v) => v.t === 'death' && ENEMIES[v.type]?.explode)) src = 'Wogol explosion';
        else if (src === 'self') src = `your own ${lastCast || 'spell'}`;
        out.push(`  YOU take ${e.n} damage${src ? ` from ${src}` : ''}!`);
        break;
      }
      case 'heal': out.push(`  You heal ${e.n}.`); break;
      case 'text': out.push(`  [${e.s}] at (${e.x},${e.y})`); break;
      case 'move': { const u = pos.get(e.id); out.push(`${nm(e.id)} ${e.push ? 'is pushed' : e.dash ? 'dashes' : 'moves'} (${e.from[0]},${e.from[1]}) -> (${e.to[0]},${e.to[1]}).`); if (u) { u.x = e.to[0]; u.y = e.to[1]; } break; }
      case 'lunge': out.push(`${nm(e.id)} strikes (${e.to[0]},${e.to[1]}).`); break;
      case 'bolt': {
        if (heroPhase) break; // your spell's projectile; its hits are listed below the cast
        const id = at(e.from[0], e.from[1]);
        if (id === null) break;
        const u = pos.get(id);
        const verb = ENEMIES[u.type]?.healer ? 'heals' : u.team === 'ally' ? 'fires at' : 'shoots';
        const tgt = at(e.to[0], e.to[1]);
        out.push(`${nm(id)} ${verb} ${tgt !== null ? nm(tgt) + ' ' : ''}at (${e.to[0]},${e.to[1]}).`);
        break;
      }
      case 'aoe': if (!heroPhase) out.push(`  Area strike on ${e.tiles.length} squares.`); break;
      case 'spawn': { const u = g.units.find((v) => v.id === e.id); if (u) pos.set(e.id, { ...u }); out.push(`${nm(e.id)} appears at (${e.x},${e.y}).`); break; }
      case 'intent': out.push(`${nm(e.id)} TELEGRAPHS an attack (see danger digits).`); break;
      case 'bonk': out.push(`  Collision at (${e.x},${e.y}).`); break;
      case 'fall': out.push(`  Something falls into the pit at (${e.x},${e.y}).`); break;
      case 'cleared': out.push(`*** FLOOR CLEARED${e.swift ? ' — SWIFT (beat par: +1 ember, +1 draft option)' : ''}${e.flawless ? ' — FLAWLESS (no damage: +1 ember)' : ''} — +${e.embers} embers total${g.isBoss ? ' — boss down: pick a relic (heals 2)' : ''} ***`); break;
      case 'herodeath': out.push('*** YOU DIED ***'); break;
      case 'floor': out.push(`*** Entering floor ${e.floor} ***`); break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- commands
function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (['no-frozen', 'frozen', 'json'].includes(k)) o[k] = true; else o[k] = argv[++i];
    } else o._.push(a);
  }
  return o;
}
const ALIASES = { u: 'up', d: 'down', l: 'left', r: 'right', w: 'wait', n: 'up', s: 'down', e: 'right', '.': 'wait' };

function main() {
  const o = parse(process.argv.slice(2));
  const cmd = o._[0];
  if (!cmd || cmd === 'help') { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); return; }
  const path = o.save || process.env.MC_SAVE || '/tmp/movecasters-cli.json';
  let s;
  if (cmd === 'new') {
    const cls = o.cls || 'knight';
    if (!CLASSES[cls]) die(`unknown class ${cls}; one of ${Object.keys(CLASSES).join(', ')}`);
    const meta = { frozen: !o['no-frozen'], grimoire: {} };
    if (o.grimoire === 'all') for (const id of spellsOf(cls)) if (SPELLS[id].tier === 'l') meta.grimoire[id] = true;
    else if (o.grimoire) for (const id of o.grimoire.split(',')) meta.grimoire[id] = true;
    const seed = o.seed !== undefined ? (isNaN(+o.seed) ? o.seed : +o.seed) : Date.now();
    s = { g: newRun({ cls, seed, depth: +(o.depth || 0), meta }), history: [] };
    console.log(`New run: ${CLASSES[cls].name}, seed ${seed}. Save: ${path}`);
  } else {
    s = load(path);
    const g = s.g;
    const L0 = { ...letters(s) };
    const pre = new Map(g.units.map((u) => [u.id, { ...u }]));
    if (cmd === 'act') {
      const acts = o._.slice(1).map((a) => ALIASES[a] || a);
      if (!acts.length) die('act needs a direction: up|down|left|right|wait');
      for (const a of acts) {
        if (!['up', 'down', 'left', 'right', 'wait'].includes(a)) die(`bad action ${a}`);
        if (g.phase !== 'play') { console.log(`(stopped: phase is ${g.phase})`); break; }
        const pre1 = new Map(g.units.map((u) => [u.id, { ...u }]));
        const floor = g.floor;
        const hc = JSON.parse(JSON.stringify(g));
        act(hc, a, { heroOnly: true });
        const heroEnd = hc.events.length;
        const ok = act(g, a);
        if (!ok) { console.log(`ILLEGAL: ${a} is blocked — no turn spent.`); break; }
        s.history.push(a);
        const L = { ...L0, ...letters(s) };
        if (g.floor === floor) Object.assign(L0, L);
        console.log(`--- ${a.toUpperCase()} (turn ${g.floorTurns}) ---`);
        console.log(describeEvents(g, g.events, pre1, L, heroEnd).join('\n') || '(nothing happened)');
      }
    } else if (cmd === 'draft') {
      if (g.phase !== 'draft') die(`not drafting (phase ${g.phase})`);
      const i = +o._[1];
      const slot = o._[2] !== undefined ? +o._[2] - 1 : null;
      if (!chooseDraft(g, i, slot)) die('draft failed — deck full? give slot 1..' + g.hero.deck.length);
      s.history.push(`draft ${i} ${slot ?? ''}`);
    } else if (cmd === 'reroll') {
      if (!rerollDraft(g)) die('cannot reroll');
      s.history.push('reroll');
    } else if (cmd === 'relic') {
      if (!chooseRelic(g, +o._[1])) die(`not choosing a relic (phase ${g.phase})`);
      s.history.push(`relic ${o._[1]}`);
    } else if (cmd === 'path') {
      if (!choosePath(g, o._[1])) die(`not choosing a path (phase ${g.phase})`);
      s.history.push(`path ${o._[1]}`);
    } else if (cmd !== 'look') die(`unknown command ${cmd}`);
  }
  save(path, s);
  console.log(o.json ? JSON.stringify(s.g) : screen(s));
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) main();
