#!/usr/bin/env node
// Headless balance simulator.
//   node tools/sim.js --bot planner --runs 100 --cls knight --depth 0 [--grimoire all] [--seed 1]
//   options: --cls all | knight,pyro,... ; --bot random|greedy|planner ; --no-frozen (Frozen path locked)
//            --plies 5 --beam 16 (planner search) ; --workers N ; --out report.json ; --quiet (no table)
//            --set ENEMIES.bone_tyrant.hp=9 (repeatable; tweak any number in data.js/spells.js for a what-if run)
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playRun } from './bots.js';
import * as DATA from '../src/core/data.js';
import { CLASS_ORDER } from '../src/core/data.js';
import { SPELLS } from '../src/core/spells.js';

// --set PATH=VALUE: mutate exported data tables (objects are mutable even though bindings are not).
function applySets(sets) {
  const roots = { ...DATA, SPELLS };
  for (const [path, val] of sets || []) {
    const parts = path.split('.');
    let o = roots[parts[0]];
    for (const p of parts.slice(1, -1)) o = o?.[p];
    if (!o) throw new Error('bad --set path ' + path);
    o[parts[parts.length - 1]] = isNaN(+val) ? val : +val;
  }
}

if (!isMainThread) {
  let applied = false;
  parentPort.on('message', (job) => {
    if (job === 'exit') process.exit(0);
    if (!applied) { applySets(job.sets); applied = true; }
    let rec;
    try { rec = playRun(job); } catch (e) { rec = { error: String(e && e.stack || e), seed: job.seed, cls: job.cls }; }
    parentPort.postMessage(rec);
  });
} else main();

function parseArgs(argv) {
  const o = { bot: 'planner', runs: 100, cls: 'knight', depth: 0, grimoire: 'none', seed: 1, frozen: true, plies: 5, beam: 16, sets: [],
    workers: Math.max(1, cpus().length - 1), out: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    switch (a) {
      case '--bot': o.bot = v; i++; break;
      case '--runs': o.runs = +v; i++; break;
      case '--cls': o.cls = v; i++; break;
      case '--depth': o.depth = +v; i++; break;
      case '--grimoire': o.grimoire = v; i++; break;
      case '--seed': o.seed = +v; i++; break;
      case '--plies': o.plies = +v; i++; break;
      case '--beam': o.beam = +v; i++; break;
      case '--workers': o.workers = +v; i++; break;
      case '--out': o.out = v; i++; break;
      case '--set': { const [k, val] = v.split('='); o.sets.push([k, val]); i++; break; }
      case '--no-frozen': o.frozen = false; break;
      case '--frozen': o.frozen = true; break;
      case '--quiet': o.quiet = true; break;
      case '-h': case '--help':
        console.log('usage: node tools/sim.js --bot planner|greedy|random --runs N --cls knight|all|a,b --depth D [--grimoire all] [--seed S] [--no-frozen] [--plies 5 --beam 16] [--set ENEMIES.x.hp=9] [--out file.json]');
        process.exit(0);
    }
  }
  return o;
}

async function runJobs(jobs, nWorkers) {
  const results = [];
  const n = Math.min(nWorkers, jobs.length);
  let next = 0, done = 0;
  const file = fileURLToPath(import.meta.url);
  await new Promise((resolve, reject) => {
    for (let w = 0; w < n; w++) {
      const wk = new Worker(file);
      const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else wk.postMessage('exit'); };
      wk.on('message', (rec) => {
        results.push(rec); done++;
        if (process.stderr.isTTY) process.stderr.write(`\r${done}/${jobs.length}`);
        if (done === jobs.length) resolve();
        feed();
      });
      wk.on('error', reject);
      feed();
    }
  });
  if (process.stderr.isTTY) process.stderr.write('\n');
  return results;
}

const pct = (a, b) => (b ? (100 * a) / b : 0);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[s.length >> 1]; };

export function aggregate(recs) {
  const ok = recs.filter((r) => !r.error);
  const N = ok.length;
  const floors = ok.flatMap((r) => r.floors);
  const cleared = floors.filter((f) => f.cleared);
  const deathFloor = {}, deathBiome = {}, deathCause = {}, castCount = {}, killCredit = {}, hurtBy = {}, bossR = {}, bossK = {};
  const deckAtEnd = {};
  for (const r of ok) {
    if (!r.won) {
      deathFloor[r.floor] = (deathFloor[r.floor] || 0) + 1;
      deathBiome[r.biome] = (deathBiome[r.biome] || 0) + 1;
      deathCause[r.deathCause] = (deathCause[r.deathCause] || 0) + 1;
    }
    for (const [k, v] of Object.entries(r.casts)) castCount[k] = (castCount[k] || 0) + v;
    for (const [k, v] of Object.entries(r.kills)) killCredit[k] = (killCredit[k] || 0) + v;
    for (const [k, v] of Object.entries(r.hurtBy)) hurtBy[k] = (hurtBy[k] || 0) + v;
    for (const b of r.bossReached) bossR[b] = (bossR[b] || 0) + 1;
    for (const b of r.bossKilled) bossK[b] = (bossK[b] || 0) + 1;
    for (const d of r.deck) deckAtEnd[d.replace('+', '')] = (deckAtEnd[d.replace('+', '')] || 0) + 1;
  }
  const turns = ok.reduce((a, r) => a + r.turns, 0);
  const totalKills = Object.values(killCredit).reduce((a, b) => a + b, 0);
  const spellKills = Object.entries(killCredit).filter(([k]) => k.startsWith('spell:')).reduce((a, [, v]) => a + v, 0);
  const bosses = {};
  for (const b of Object.keys(bossR)) bosses[b] = { reached: bossR[b], killed: bossK[b] || 0, killRate: r1(pct(bossK[b] || 0, bossR[b])) };
  const perSpell = {};
  for (const id of new Set([...Object.keys(castCount), ...Object.keys(killCredit).filter((k) => k.startsWith('spell:')).map((k) => k.slice(6))])) {
    const c = castCount[id] || 0, k = killCredit['spell:' + id] || 0;
    perSpell[id] = { casts: c, kills: k, killsPerCast: r2(c ? k / c : 0), killShare: r1(pct(k, totalKills)), inFinalDeck: deckAtEnd[id] || 0 };
  }
  return {
    runs: N, errors: recs.length - N,
    winRate: r1(pct(ok.filter((r) => r.won).length, N)),
    meanFloor: r2(mean(ok.map((r) => r.floor))), medianDeathFloor: median(ok.filter((r) => !r.won).map((r) => r.floor)),
    deathFloorHist: deathFloor, deathsByBiome: deathBiome, deathsByCause: deathCause,
    closeCallPct: r1(pct(cleared.filter((f) => f.hpEnd <= 2).length, cleared.length)),
    meanTurnsPerFloor: r1(mean(cleared.map((f) => f.turns))),
    meanTurnsPerFloorAll: r1(mean(floors.map((f) => f.turns))),
    swiftPct: r1(pct(cleared.filter((f) => f.swift).length, cleared.length)),
    spellsPerFloor: r2(mean(floors.map((f) => f.casts))),
    dmgPerFloor: r2(mean(floors.map((f) => f.dmg))),
    perfectFloorPct: r1(pct(cleared.filter((f) => f.dmg === 0).length, cleared.length)),
    decisionDensity: r1(pct(ok.reduce((a, r) => a + r.dense, 0), turns)),
    twoSafePct: r1(pct(ok.reduce((a, r) => a + r.safe2, 0), turns)),
    forcedDamagePct: r1(pct(ok.reduce((a, r) => a + r.forced, 0), turns)),
    bosses,
    killShare: { spell: r1(pct(spellKills, totalKills)), bump: r1(pct(killCredit.bump || 0, totalKills)),
      other: r1(pct(totalKills - spellKills - (killCredit.bump || 0), totalKills)) },
    killCredit, hurtBy, perSpell,
    byBiomeFloor: Object.fromEntries(['crypt', 'swamp', 'frozen', 'warrens', 'inferno'].map((b) => {
      const fs = floors.filter((f) => f.biome === b);
      return [b, { floors: fs.length, dmg: r2(mean(fs.map((f) => f.dmg))), turns: r1(mean(fs.map((f) => f.turns))),
        casts: r2(mean(fs.map((f) => f.casts))), deathPct: r1(pct(fs.filter((f) => !f.cleared).length, fs.length)) }];
    }).filter(([, v]) => v.floors)),
    sampleErrors: recs.filter((r) => r.error).slice(0, 2).map((r) => r.error),
  };
}

export function printTable(results) {
  const cols = [
    ['class', (k) => k], ['win%', (k, a) => a.winRate], ['meanFl', (k, a) => a.meanFloor], ['medDeath', (k, a) => a.medianDeathFloor],
    ['close%', (k, a) => a.closeCallPct], ['turns/fl', (k, a) => a.meanTurnsPerFloor], ['swift%', (k, a) => a.swiftPct],
    ['casts/fl', (k, a) => a.spellsPerFloor], ['dmg/fl', (k, a) => a.dmgPerFloor], ['dense%', (k, a) => a.decisionDensity],
    ['forced%', (k, a) => a.forcedDamagePct], ['spellKill%', (k, a) => a.killShare.spell], ['otherKill%', (k, a) => a.killShare.other],
  ];
  const rows = Object.entries(results).map(([k, a]) => cols.map(([, f]) => String(f(k, a))));
  const head = cols.map(([h]) => h);
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r) => '| ' + r.map((c, i) => c.padStart(w[i])).join(' | ') + ' |';
  const out = [line(head), '|' + w.map((x) => '-'.repeat(x + 2)).join('|') + '|', ...rows.map(line)];
  out.push('');
  for (const [k, a] of Object.entries(results)) {
    const hist = Object.entries(a.deathFloorHist).sort((x, y) => +x[0] - +y[0]).map(([f, n]) => `F${f}:${n}`).join(' ');
    const bosses = Object.entries(a.bosses).map(([b, v]) => `${b} ${v.killed}/${v.reached} (${v.killRate}%)`).join(', ');
    const causes = Object.entries(a.deathsByCause).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([c, n]) => `${c}:${n}`).join(' ');
    const spells = Object.entries(a.perSpell).sort((x, y) => y[1].casts - x[1].casts)
      .map(([id, v]) => `${SPELLS[id]?.name || id} ${v.casts}c/${v.kills}k`).join(', ');
    out.push(`[${k}] deaths by floor: ${hist || '-'}`);
    out.push(`[${k}] bosses: ${bosses || '-'}`);
    out.push(`[${k}] death causes: ${causes || '-'}`);
    out.push(`[${k}] spells (casts/kills): ${spells}`);
    if (a.errors) out.push(`[${k}] ERRORS: ${a.errors} e.g. ${a.sampleErrors[0]}`);
  }
  return out.join('\n');
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const classes = o.cls === 'all' ? CLASS_ORDER : o.cls.split(',');
  const jobs = [];
  for (const cls of classes) for (let i = 0; i < o.runs; i++) {
    jobs.push({ bot: o.bot, cls, seed: (o.seed * 100003 + i * 7 + 1) >>> 0, depth: o.depth, grimoire: o.grimoire, frozen: o.frozen,
      plies: o.plies, beam: o.beam, sets: o.sets });
  }
  const t0 = Date.now();
  const recs = await runJobs(jobs, o.workers);
  const results = {};
  for (const cls of classes) results[cls] = aggregate(recs.filter((r) => r.cls === cls));
  if (classes.length > 1) results.ALL = aggregate(recs);
  const report = { config: { ...o, workers: undefined }, seconds: (Date.now() - t0) / 1000, results };
  if (o.out) writeFileSync(o.out, JSON.stringify(report, null, 2));
  if (!o.quiet) {
    console.log(`bot=${o.bot} runs=${o.runs}/class depth=${o.depth} grimoire=${o.grimoire} frozen=${o.frozen}` +
      (o.bot === 'planner' ? ` plies=${o.plies} beam=${o.beam}` : '') + (o.sets.length ? ` set=${o.sets.map((x) => x.join('=')).join(',')}` : '') + ` (${report.seconds}s)`);
    console.log(printTable(results));
  }
  if (!o.out) console.log('\nJSON:\n' + JSON.stringify(results));
}
