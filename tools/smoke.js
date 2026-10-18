import { newRun, act, chooseDraft, chooseRelic, choosePath } from '../src/core/game.js';
const dirs = ['up','down','left','right','wait'];
let floors = [];
for (let s = 0; s < 200; s++) {
  for (const cls of ['knight','pyro','ranger','geo','shadow','hexer']) {
    const g = newRun({ cls, seed: s, meta: { frozen: true, grimoire: {} } });
    let steps = 0;
    while (steps++ < 3000) {
      if (g.phase === 'play') act(g, dirs[Math.floor(Math.random()*5)]);
      else if (g.phase === 'draft') chooseDraft(g, 0, 0);
      else if (g.phase === 'relic') chooseRelic(g, 0);
      else if (g.phase === 'path') choosePath(g, 'frozen');
      else break;
    }
    floors.push(g.floor);
  }
}
console.log('random bot avg floor', floors.reduce((a,b)=>a+b)/floors.length, 'max', Math.max(...floors));
