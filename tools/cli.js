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
import { reachOf, intentMap, intentTiles, dangerMap } from '../src/core/ai.js';
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
  if (g.fx.corpse[k]) return 'x';
  return ' ';
}

function overlays(g) {
  return { danger: dangerMap(g), intent: intentMap(g) };
}

// Danger char: digit = damage landing here next enemy phase; x = telegraph landing later; | = projectile/charge
// path (step in and YOU become the target); D = shade spawns here.
function overlayChar(g, x, y, O) {
  const k = key(x, y);
  if (tile(g, x, y) === T.WALL) return '#';
  if (g.doomMark && g.doomMark[0] === x && g.doomMark[1] === y) return 'D';
  const d = O.danger[k];
  if (d) return String(Math.min(9, d));
  const it = O.intent[k];
  if (it && !it.path && it.delay > 1) return 'x';
  if (it && it.path) return '|';
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
           , slime (roots you 1 turn) | & burning (1 dmg at end of turn) | x corpse | T bear trap | t caltrops
  danger : N = N damage lands on this square at the next enemy phase (telegraphed; move off it!)
           x = telegraphed strike landing in 2+ enemy phases | | = path of a telegraphed shot/charge: step into it and
           it hits YOU instead of its target square | D = shade spawns here
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
    const it = u.intent, tl = intentTiles(g, u);
    const where = it.kind === 'line' || it.kind === 'charge'
      ? `${it.kind === 'charge' ? 'charges' : 'shoots'} ${dirName(it.dir)}, hitting the first thing in line${tl.length ? ` (now (${tl[tl.length - 1].join(',')}))` : ''}`
      : `strikes ${tl.length > 3 ? tl.length + ' squares' : tl.map((t) => '(' + t.join(',') + ')').join(' ')}`;
    s += `\n      TELEGRAPH: ${where} for ${it.dmg}, in ${it.delay} enemy phase(s)${u.stun > 0 ? ' — will be CANCELLED (stunned)' : ''}`;
  } else s += '\n      no telegraph (will move, then telegraph if you are in its reach)';
  const reach = reachOf(g, u);
  if (reach.length && reach.length <= 12) s += `\n      reach now: ${reach.map((t) => '(' + t.join(',') + ')').join(' ')}`;
  if (u.boss) s += `\n      boss timer ${u.timer}` + bossHint(u);
  return s;
}
function bossHint(u) {
  const tn = u.timer + 1;
  switch (u.type) {
    case 'bone_tyrant': return tn % 4 === 0 ? ' — will raise skeletons next turn' : ` — raises skeletons every 4th turn (next in ${4 - (u.timer % 4)})`;
    case 'mother_slug': return tn % 3 === 0 ? ' — will telegraph a slime bomb on you next turn' : '';
    case 'frost_colossus': return tn % 3 === 0 ? ' — will telegraph a 3x3 slam on you next turn' : '';
    case 'pit_lord': return tn % 3 === 0 ? ' — will telegraph a fire line through you next turn' : tn % 5 === 1 ? ' — will summon imps next turn' : '';
    case 'orc_warlord': return tn % 5 === 0 ? ' — may summon goblins next turn' : ' — telegraphs a charge on even turns when you share its row/column';
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

function adjacentSummary(g, L) {
  const h = g.hero, O = overlays(g);
  const out = [];
  for (const [name, [dx, dy]] of Object.entries(DIRS)) {
    const x = h.x + dx, y = h.y + dy;
    const u = unitAt(g, x, y);
    let s;
    if (u && u.team === 'enemy') s = `blocked by ${L[u.id]} ${nameOf(u)} — illegal (no melee)`;
    else if (u) s = `swap with ally ${L[u.id]}`;
    else if (!standable(g, x, y)) s = 'blocked (' + tileName(g, x, y) + ') — illegal';
    else {
      s = `move to (${x},${y})`;
      const hz = hazardChar(g, x, y);
      if (hz !== ' ') s += ` [${tileName(g, x, y).split(', spell')[0]}]`;
      const c = cellAt(g, x, y);
      if (c && cellReady(g, x, y)) s += ` — CASTS ${SPELLS[g.hero.deck[c.slot].id].name} facing ${name}`;
      else if (c) s += ' — quiet move (tile spent)';
      if (tile(g, x, y) === T.ICE) s += ' — ICE: you keep sliding';
      const n = O.danger[key(x, y)], it = O.intent[key(x, y)];
      if (n) s += ` — DANGER: ${n} dmg lands here next enemy phase`;
      else if (it && it.path) s += ' — in a telegraphed shot/charge path (you would be hit)';
      else if (it) s += ` — telegraphed strike in ${it.delay} phases`;
    }
    out.push(`  ${name.padEnd(5)}: ${s}`);
  }
  const n = O.danger[key(h.x, h.y)];
  out.push(`  wait : stay at (${h.x},${h.y})${n ? ` — DANGER: ${n} dmg lands here next enemy phase` : ''}${g.cls === 'ranger' ? ' — Steady Aim' : ''}`);
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
    if (g.doomMark) out.push(`DOOM: a shade will spawn at (${g.doomMark[0]},${g.doomMark[1]}) (D) after the next enemy phase.`);
  }
  out.push(heroBlock(g));
  if (g.phase === 'play') {
    out.push('YOUR OPTIONS:');
    out.push(adjacentSummary(g, L));
  } else if (g.phase === 'draft') {
    out.push(`FLOOR CLEARED${g.draft.swift ? ' — SWIFT (extra option)' : ''}. Choose a draft: node tools/cli.js draft <i> [slot]` +
      (g.hero.deck.length >= g.hero.slots ? '  (deck full: give the slot number 1..' + g.hero.deck.length + ' to replace)' : ''));
    g.draft.opts.forEach((o, i) => {
      if (o.kind === 'empower') { const d = g.hero.deck[o.slot]; out.push(`  ${i}: EMPOWER *${o.slot + 1} ${SPELLS[d.id].name} (+1 damage/effect, cooldown -1)`); }
      else out.push(`  ${i}: NEW SPELL ${SPELLS[o.id].name} [cd ${SPELLS[o.id].cd}] — ${SPELLS[o.id].desc}`);
    });
    out.push(`  -1: skip (heal 1 extra)` + (g.hero.rerolls ? ` | reroll available (${g.hero.rerolls}): node tools/cli.js reroll` : ''));
  } else if (g.phase === 'relic') {
    out.push('BOSS DEFEATED. Choose a relic: node tools/cli.js relic <i>');
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
export function describeEvents(g, evs, pre, L) {
  const nm = (id) => { const u = pre.get(id) || g.units.find((v) => v.id === id); return u ? `${L[id] || '?'} ${nameOf(u)}` : `#${id}`; };
  const at = (x, y) => { for (const [id, u] of pre) if (u.x === x && u.y === y) return nm(id); return null; };
  const out = [];
  for (const e of evs) {
    switch (e.t) {
      case 'heromove': out.push(`You ${e.dash ? 'dash/slide' : 'move'} to (${e.to[0]},${e.to[1]}).`); break;
      case 'cast': out.push(`You CAST ${SPELLS[e.id].name} facing ${dirName(e.dir)} from (${e.x},${e.y}).`); break;
      case 'hit': out.push(`  ${nm(e.id)} takes ${e.n} damage.`); break;
      case 'death': out.push(`  ${ENEMIES[e.type] || ALLIES[e.type] ? nm(e.id) : e.type} dies at (${e.x},${e.y}).`); break;
      case 'hurt': out.push(`  YOU take ${e.n} damage!`); break;
      case 'heal': out.push(`  You heal ${e.n}.`); break;
      case 'text': out.push(`  [${e.s}] at (${e.x},${e.y})`); break;
      case 'move': out.push(`${nm(e.id)} ${e.push ? 'is pushed' : e.dash ? 'dashes' : 'moves'} (${e.from[0]},${e.from[1]}) -> (${e.to[0]},${e.to[1]}).`); break;
      case 'lunge': out.push(`${nm(e.id)} strikes (${e.to[0]},${e.to[1]}).`); break;
      case 'bolt': { const who = at(e.from[0], e.from[1]); if (who) out.push(`${who} shoots toward (${e.to[0]},${e.to[1]}).`); break; }
      case 'aoe': out.push(`  Area effect on ${e.tiles.length} squares.`); break;
      case 'spawn': out.push(`${nm(e.id)} appears at (${e.x},${e.y}).`); break;
      case 'intent': out.push(`${nm(e.id)} TELEGRAPHS an attack (see X/x squares).`); break;
      case 'spellback': out.push(`A spell returns to the board at (${e.x},${e.y}).`); break;
      case 'bonk': out.push(`  Collision at (${e.x},${e.y}).`); break;
      case 'fall': out.push(`  Something falls into the pit at (${e.x},${e.y}).`); break;
      case 'cleared': out.push(`*** FLOOR CLEARED${e.swift ? ' (SWIFT)' : ''} — +${e.embers} embers ***`); break;
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
        const ok = act(g, a);
        if (!ok) { console.log(`ILLEGAL: ${a} is blocked — no turn spent.`); break; }
        s.history.push(a);
        const L = { ...L0, ...letters(s) };
        if (g.floor === floor) Object.assign(L0, L);
        console.log(`--- ${a.toUpperCase()} (turn ${g.floorTurns}) ---`);
        console.log(describeEvents(g, g.events, pre1, L).join('\n') || '(nothing happened)');
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
