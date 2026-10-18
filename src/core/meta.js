// Roguelite meta-progression: pure functions over a plain JSON save object.
import { CLASSES, CLASS_ORDER, RELICS, BLESSINGS } from './data.js';
import { SPELLS } from './spells.js';

export const GRIMOIRE_COSTS = [8, 12, 16, 20];
export const RELIC_COST = 10;

export function newMeta() {
  return {
    v: 1, embers: 0, totalEmbers: 0, runs: 0, wins: 0, kills: 0, bestFloor: 0,
    classes: { knight: true }, blessings: {}, grimoire: {}, relics: {}, frozen: false,
    bossKills: {}, perfect: false, depthUnlocked: {}, depthWon: {}, codex: { enemies: {}, spells: {}, relics: {} },
    daily: {}, history: [], newUnlocks: [],
  };
}

export function grimoireFor(meta, cls) {
  const locked = Object.keys(SPELLS).filter((id) => SPELLS[id].cls === cls && SPELLS[id].tier === 'l');
  const owned = locked.filter((id) => meta.grimoire[id]).length;
  return locked.map((id) => ({ id, owned: !!meta.grimoire[id], cost: GRIMOIRE_COSTS[Math.min(owned, 3)] }));
}

export function buy(meta, kind, id) {
  let cost = 0;
  if (kind === 'grimoire') {
    if (meta.grimoire[id]) return false;
    const owned = Object.keys(meta.grimoire).filter((s) => SPELLS[s].cls === SPELLS[id].cls).length;
    cost = GRIMOIRE_COSTS[Math.min(owned, 3)];
  } else if (kind === 'relic') {
    if (meta.relics[id] || RELICS[id].base) return false;
    cost = RELIC_COST;
  } else if (kind === 'blessing') {
    const b = BLESSINGS[id];
    if (meta.blessings[id] || (b.req && !meta.blessings[b.req])) return false;
    cost = b.cost;
  } else return false;
  if (meta.embers < cost) return false;
  meta.embers -= cost;
  (kind === 'grimoire' ? meta.grimoire : kind === 'relic' ? meta.relics : meta.blessings)[id] = true;
  return true;
}

export function classUnlocked(meta, cls) {
  return !!meta.classes[cls];
}

// Apply a finished run; returns list of human-readable unlock messages.
export function applyRun(meta, s, deckIds = [], relicIds = []) {
  const msgs = [];
  meta.runs++;
  meta.embers += s.embers;
  meta.totalEmbers += s.embers;
  meta.kills += s.kills;
  meta.bestFloor = Math.max(meta.bestFloor, s.floor);
  if (s.won) meta.wins++;
  for (const b of s.bossKills) meta.bossKills[b] = (meta.bossKills[b] || 0) + 1;
  if (s.perfectFloors > 0) meta.perfect = true;
  for (const [t, n] of Object.entries(s.seen)) meta.codex.enemies[t] = (meta.codex.enemies[t] || 0) + n;
  for (const id of deckIds) meta.codex.spells[id] = (meta.codex.spells[id] || 0) + 1;
  for (const id of relicIds) meta.codex.relics[id] = (meta.codex.relics[id] || 0) + 1;
  if (!meta.frozen && meta.bossKills.bone_tyrant) { meta.frozen = true; msgs.push('New path: the Frozen Vault (choose after the Crypt)'); }
  for (const cls of CLASS_ORDER) {
    if (meta.classes[cls]) continue;
    const u = CLASSES[cls].unlock;
    let ok = false;
    if (u.kind === 'reachFloor') ok = meta.bestFloor >= u.n;
    if (u.kind === 'kills') ok = meta.kills >= u.n;
    if (u.kind === 'boss') ok = !!meta.bossKills[u.id];
    if (u.kind === 'perfectFloor') ok = meta.perfect;
    if (ok) { meta.classes[cls] = true; msgs.push(`New hero: ${CLASSES[cls].name}!`); }
  }
  if (s.won) {
    const cur = meta.depthWon[s.cls] ?? -1;
    if (s.depth > cur) meta.depthWon[s.cls] = s.depth;
    const next = Math.min(10, s.depth + 1);
    if ((meta.depthUnlocked[s.cls] || 0) < next) { meta.depthUnlocked[s.cls] = next; msgs.push(`${CLASSES[s.cls].name}: Depth ${next} unlocked`); }
  }
  if (s.daily) meta.daily[s.daily] = { floor: s.floor, won: s.won, kills: s.kills };
  meta.history.unshift({ cls: s.cls, floor: s.floor, won: s.won, depth: s.depth, embers: s.embers, t: Date.now() });
  meta.history = meta.history.slice(0, 30);
  meta.newUnlocks = msgs;
  return msgs;
}

// Progress toward the next locked class (for UI goals).
export function nextGoals(meta) {
  return CLASS_ORDER.filter((c) => !meta.classes[c]).map((c) => {
    const u = CLASSES[c].unlock;
    let p = 0;
    if (u.kind === 'reachFloor') p = Math.min(1, meta.bestFloor / u.n);
    if (u.kind === 'kills') p = Math.min(1, meta.kills / u.n);
    return { cls: c, text: u.text, progress: p };
  });
}
