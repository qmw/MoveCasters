// Fuzz: random play with random decks drawn from every spell, to catch exceptions & invariants.
import { newRun, act, chooseDraft, chooseRelic, choosePath } from '../src/core/game.js';
import { SPELLS } from '../src/core/spells.js';
import { CLASS_ORDER } from '../src/core/data.js';
const ids = Object.keys(SPELLS);
const acts = ['up', 'down', 'left', 'right', 'wait'];
let errors = 0, turns = 0;
const N = +(process.argv[2] || 400);
for (let s = 0; s < N; s++) {
  const cls = CLASS_ORDER[s % 6];
  const g = newRun({ cls, seed: s * 7919, meta: { frozen: true, grimoire: Object.fromEntries(ids.map((i) => [i, true])) } });
  g.quiet = s % 2 === 0;
  g.hero.deck = Array.from({ length: 5 }, (_, i) => ({ id: ids[(s * 5 + i * 13) % ids.length], lv: i % 2 }));
  g.hero.maxHp = g.hero.hp = 60;
  g.board.forEach((b, i) => { b.slot = i; });
  g.recharge.push({ slot: 4, x: g.hero.x, y: g.hero.y, t: 1 });
  try {
    for (let i = 0; i < 4000; i++) {
      if (g.phase === 'play') { act(g, acts[Math.floor(Math.random() * 5)]); turns++; }
      else if (g.phase === 'draft') chooseDraft(g, 0, 0);
      else if (g.phase === 'relic') chooseRelic(g, 0);
      else if (g.phase === 'path') choosePath(g, s % 2 ? 'frozen' : 'swamp');
      else break;
      // invariants
      for (const u of g.units) if (u.hp <= 0) throw new Error('dead unit in list ' + u.type);
      const pos = new Set();
      for (const u of g.units) { const k = u.x + ',' + u.y; if (pos.has(k)) throw new Error('stacked units ' + u.type + ' at ' + k); pos.add(k); }
      if (pos.has(g.hero.x + ',' + g.hero.y)) throw new Error('unit on hero');
      if (g.map.t[g.hero.y * g.map.w + g.hero.x] === 1) throw new Error('hero in wall');
      const slots = [...g.board, ...g.recharge].map((b) => b.slot).sort((a, b) => a - b).join();
      if (slots !== g.hero.deck.map((_, i) => i).join() && g.phase === 'play') throw new Error('deck slots mismatch ' + slots);
    }
  } catch (e) {
    errors++;
    if (errors < 8) console.log('seed', s, cls, g.hero.deck.map((d) => d.id).join(','), '\n ', e.stack.split('\n').slice(0, 3).join('\n  '));
  }
}
console.log(`fuzz done: ${N} runs, ${turns} turns, ${errors} errors`);
