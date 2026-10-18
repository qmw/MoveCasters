// UI controller: screens, input, modals, persistence.
import { CLASSES, CLASS_ORDER, ENEMIES, ALLIES, RELICS, BLESSINGS, BIOMES, DEPTH_MODS, T, TOTAL_FLOORS } from '../core/data.js';
import { SPELLS, spellsOf, spellCd, spellFreq } from '../core/spells.js';
import { newRun, act, chooseDraft, rerollDraft, chooseRelic, choosePath, healBetween } from '../core/game.js';
import { newMeta, applyRun, buy, grimoireFor, nextGoals, GRIMOIRE_COSTS, RELIC_COST } from '../core/meta.js';
import { key, tile, spikesUp } from '../core/engine.js';
import { dangerTiles, dangerMap } from '../core/ai.js';
import { Renderer, SLOT_COLORS } from './render.js';
import { preloadAll, sprite, spellIcon, iconCanvas, genImage } from './sprites.js';
import { sfx, isMuted, setMuted } from './audio.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---- persistence -------------------------------------------------------------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
let meta = Object.assign(newMeta(), store.get('mc_meta') || {});
const saveMeta = () => store.set('mc_meta', meta);
let g = null;
const saveRun = () => { if (g && (g.phase !== 'dead' && g.phase !== 'won')) store.set('mc_run', g); else store.del('mc_run'); };

const metaForRun = () => ({ blessings: meta.blessings, grimoire: meta.grimoire, relics: meta.relics, frozen: meta.frozen });
const PATTERN_TEXT = {
  orth1: 'the 4 orthogonal squares', diag1: 'the 4 diagonal squares', king: 'all 8 surrounding squares',
  knight: 'L-shaped knight jumps', line: 'rows & columns (range 4, blocked)', charge: 'charges along rows & columns (range 3)',
  lob2: 'squares exactly 2 away (orthogonal)', none: 'nothing (support)',
};
const todayKey = () => new Date().toISOString().slice(0, 10);

// ---- screens -----------------------------------------------------------------
const screens = ['title', 'class', 'game', 'sanctum', 'codex'];
let current = 'title';
function show(name) {
  current = name;
  for (const s of screens) $('#scr-' + s).classList.toggle('hidden', s !== name);
  if (name === 'title') renderTitle();
  if (name === 'class') renderClassSelect();
  if (name === 'sanctum') renderSanctum();
  if (name === 'codex') renderCodex();
  if (name === 'game') requestAnimationFrame(layout);
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { sfx('pick'); show(b.dataset.go); }));

function renderTitle() {
  $('#btn-continue').classList.toggle('hidden', !store.get('mc_run'));
  $('#ember-count').textContent = meta.embers;
  const goals = nextGoals(meta).slice(0, 2);
  const box = $('#title-goals');
  box.innerHTML = '';
  if (meta.runs) box.append(el('div', '', `Runs ${meta.runs} · Wins ${meta.wins} · Best floor ${meta.bestFloor}/${TOTAL_FLOORS}`));
  for (const gl of goals) {
    const d = el('div', 'goal', `🔒 ${CLASSES[gl.cls].name}: ${gl.text}`);
    if (gl.progress > 0) { const b = el('span', 'pbar'); b.append(el('i')); b.firstChild.style.width = gl.progress * 100 + '%'; d.append(b); }
    box.append(d);
  }
  const img = genImage('title');
  const tImg = $('#title-img');
  if (img) { tImg.src = img.src; tImg.classList.remove('hidden'); $('#title-canvas')?.remove(); }
  else if (!$('#title-canvas')) { tImg.classList.add('hidden'); titleScene(); }
}

// Animated diorama of heroes facing monsters (fallback when there is no generated key art).
function titleScene() {
  const c = el('canvas');
  c.id = 'title-canvas';
  c.width = 224; c.height = 98;
  $('.title-art').append(c);
  const ctx = c.getContext('2d');
  const heroes = CLASS_ORDER.map((k) => CLASSES[k].sprite);
  const foes = ['skelet_idle', 'imp_idle', 'goblin_idle', 'orc_warrior_idle', 'chort_idle', 'necromancer'];
  const tick = (t) => {
    if (!c.isConnected) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, 224, 98);
    for (let x = 0; x < 14; x++) { const w = sprite('wall_mid'); if (w.complete) ctx.drawImage(w, x * 16, 18); }
    for (let y = 0; y < 4; y++) for (let x = 0; x < 14; x++) { const f = sprite((x * 7 + y * 3) % 9 ? 'floor_1' : 'floor_' + (2 + ((x + y) % 6))); if (f.complete) ctx.drawImage(f, x * 16, 34 + y * 16); }
    const banner = sprite('wall_banner_red'); if (banner.complete) { ctx.drawImage(banner, 48, 18); ctx.drawImage(banner, 160, 18); }
    const fnt = sprite('wall_fountain_mid_blue', t, 5); if (fnt?.complete) ctx.drawImage(fnt, 104, 18);
    const spells = ['weapon_red_magic_staff', 'weapon_axe', 'weapon_bow', 'flask_big_blue'];
    spells.forEach((s, i) => {
      const x = 40 + i * 44, y = 66 + (i % 2) * 14;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t / 300 + i);
      ctx.fillStyle = ['#ff8a3d', '#c9d4e8', '#8fd16a', '#7de0c8'][i];
      ctx.beginPath(); ctx.arc(x + 8, y + 8, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      const im = sprite(s); if (im.complete) ctx.drawImage(im, x + 8 - im.naturalWidth / 2 * 0.6, y + 8 - im.naturalHeight / 2 * 0.6, im.naturalWidth * 0.6, im.naturalHeight * 0.6);
    });
    heroes.forEach((h, i) => { const im = sprite(h + '_idle', t + i * 200); if (im.complete) ctx.drawImage(im, 6 + i * 15 + (i % 2) * 4, 50 + (i % 2) * 12 - 6); });
    foes.forEach((f, i) => {
      const im = sprite(f, t + i * 170);
      if (!im.complete) return;
      ctx.save(); ctx.translate(218 - i * 13, 0); ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 74 - im.naturalHeight + (i % 2) * 14 - 4);
      ctx.restore();
    });
    const boss = sprite('big_demon_idle', t); if (boss.complete) { ctx.save(); ctx.translate(150, 0); ctx.scale(-1, 1); ctx.drawImage(boss, -30, 30); ctx.restore(); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

$('#btn-new').addEventListener('click', () => { sfx('pick'); show('class'); });
$('#btn-continue').addEventListener('click', () => { const r = store.get('mc_run'); if (r) startGame(r); });
$('#btn-sanctum').addEventListener('click', () => { sfx('pick'); show('sanctum'); });
$('#btn-codex').addEventListener('click', () => { sfx('pick'); show('codex'); });
$('#btn-help').addEventListener('click', () => helpModal());
$('#btn-daily').addEventListener('click', () => {
  const day = todayKey();
  const cls = CLASS_ORDER[Math.floor(Date.parse(day) / 86400000) % CLASS_ORDER.length];
  const done = meta.daily[day];
  modal(`<h2>Daily Descent</h2><p>${day}</p>
    <p>Everyone gets the same dungeon today. Hero of the day: <b style="color:${CLASSES[cls].color}">${CLASSES[cls].name}</b> (even if locked!).<br>No blessings — pure skill.</p>
    ${done ? `<p class="unlock">Today's result: floor ${done.floor}${done.won ? ' — VICTORY' : ''}, ${done.kills} kills. Replays don't count.</p>` : ''}
    <div class="row-btns"><button class="btn primary" id="m-go">Descend</button><button class="btn ghost" id="m-x">Back</button></div>`);
  $('#m-go').onclick = () => { closeModal(); startGame(newRun({ cls, seed: 'daily-' + day, depth: 0, meta: { frozen: true }, daily: done ? false : day })); };
  $('#m-x').onclick = closeModal;
});

// ---- class select ----------------------------------------------------------------
let selCls = 'knight', selDepth = 0;
function renderClassSelect() {
  const list = $('#class-list');
  list.innerHTML = '';
  for (const c of CLASS_ORDER) {
    const C = CLASSES[c], locked = !meta.classes[c];
    const card = el('div', 'ccard' + (c === selCls ? ' on' : '') + (locked ? ' locked' : ''));
    card.append(iconCanvas(sprite(C.sprite + '_idle'), 64));
    card.append(el('div', 'nm', C.name));
    card.append(el('div', 'lk', locked ? '🔒 ' + C.unlock.text : `HP ${C.hp}`));
    if (!locked) card.onclick = () => { selCls = c; selDepth = Math.min(selDepth, meta.depthUnlocked[c] || 0); sfx('pick'); renderClassSelect(); };
    list.append(card);
  }
  const C = CLASSES[selCls];
  const det = $('#class-detail');
  det.innerHTML = '';
  det.append(el('h3', '', C.name));
  det.append(el('p', '', `<span class="k">Passive:</span> ${C.passive}`));
  const st = el('div', '', '<span class="k">Starting deck:</span> ');
  C.starters.forEach((id) => st.append(spellMini(id)));
  det.append(st);
  const pool = el('div', '', '<span class="k">Can be drafted:</span> ');
  spellsOf(selCls).filter((id) => !C.starters.includes(id)).forEach((id) => {
    const m = spellMini(id);
    if (SPELLS[id].tier === 'l' && !meta.grimoire[id]) { m.style.opacity = 0.35; m.title = 'Locked — buy this Grimoire page in the Sanctum'; }
    pool.append(m);
  });
  det.append(pool);
  const maxD = meta.depthUnlocked[selCls] || 0;
  const ds = el('div', 'depthsel', '<span class="k">Depth:&nbsp;</span>');
  for (let d = 0; d <= maxD; d++) {
    const b = el('button', 'btn' + (d === selDepth ? ' on' : ''), d === 0 ? 'Base' : 'D' + d);
    b.title = d === 0 ? 'Standard descent' : DEPTH_MODS.slice(1, d + 1).map((m) => m.text).join('\n');
    b.onclick = () => { selDepth = d; renderClassSelect(); };
    ds.append(b);
  }
  if (maxD === 0) ds.append(el('span', 'k', '&nbsp;Win a run to unlock Depth 1 (harder, more Embers).'));
  det.append(ds);
  if (selDepth > 0) det.append(el('p', 'k', 'Depth modifiers: ' + DEPTH_MODS.slice(1, selDepth + 1).map((m) => m.text).join(' · ')));
  const go = el('button', 'btn big primary', 'Begin descent ▶');
  go.style.marginTop = '12px';
  go.onclick = () => {
    if (store.get('mc_run') && !confirm('Abandon your current run?')) return;
    if (store.get('mc_run')) abandonRun(store.get('mc_run'));
    startGame(newRun({ cls: selCls, seed: (Math.random() * 2 ** 32) >>> 0, depth: selDepth, meta: metaForRun() }));
  };
  det.append(go);
}

function spellMini(id) {
  const S = SPELLS[id];
  const m = el('span', 'spell-mini');
  m.append(iconCanvas(spellIcon(id, S.icon), 24));
  m.append(document.createTextNode(S.name));
  m.title = `${S.name} (cooldown ${S.cd})\n${S.desc}`;
  return m;
}

// ---- game ------------------------------------------------------------------------
const canvas = $('#board');
const R = new Renderer(canvas);
let pending = null;
let lastFloorShown = 0;

function startGame(run) {
  g = run;
  g.events = [];
  R.setGame(g);
  lastFloorShown = 0;
  show('game');
  updateHud();
  if (!meta.runs && !store.get('mc_seen_help')) { store.set('mc_seen_help', 1); helpModal(); }
  afterTurn();
  saveRun();
}

function layout() {
  if (!g || current !== 'game') return;
  const wrap = $('#board-wrap');
  R.resize(wrap.clientWidth, wrap.clientHeight);
}
window.addEventListener('resize', layout);

async function doAction(a) {
  if (!g || g.phase !== 'play' || !$('#modal').classList.contains('hidden')) return;
  if (R.busy) { pending = a; return; }
  const ok = act(g, a);
  if (!ok) { sfx('bad'); return; }
  const evs = g.events;
  g.events = [];
  updateHud();
  saveRun();
  R.preview = null;
  await R.play(evs);
  updateHud();
  afterTurn();
  if (pending && g.phase === 'play') { const p = pending; pending = null; doAction(p); } else pending = null;
}

function afterTurn() {
  if (!g) return;
  if (g.floor !== lastFloorShown && g.phase === 'play') {
    lastFloorShown = g.floor;
    R.setGame(g);
    layout();
    const inB = ((g.floor - 1) % 3) + 1;
    banner(`FLOOR ${g.floor}<br><small>${BIOMES[g.biome].name}${inB === 3 ? ' — BOSS' : ''}</small>`);
  }
  if (g.phase === 'draft') draftModal();
  else if (g.phase === 'relic') relicModal();
  else if (g.phase === 'path') pathModal();
  else if (g.phase === 'dead' || g.phase === 'won') endModal();
  describe(R.hover);
  R.preview = previewMove(R.hover);
  checkHints();
}

// ---- contextual first-run hints ----
const seenHints = store.get('mc_hints') || {};
function hint(id, html) {
  if (seenHints[id]) return false;
  seenHints[id] = 1;
  store.set('mc_hints', seenHints);
  const t = $('#toast');
  t.innerHTML = html + ' <span class="k">(tap to dismiss)</span>';
  t.classList.remove('hidden');
  t.onclick = () => t.classList.add('hidden');
  clearTimeout(hint.t);
  hint.t = setTimeout(() => t.classList.add('hidden'), 9000);
  return true;
}
function checkHints() {
  if (!g || g.phase !== 'play') return;
  const h = g.hero;
  const adj = (x, y) => Math.abs(x - h.x) + Math.abs(y - h.y) === 1;
  if (g.stats.spellsCast === 0)
    return hint('spell_adj', 'Every tile is a spell from your deck. <b>Each step casts the tile you step onto</b>, in the direction of the arrow. No melee — position is everything.');
  if (g.stats.spellsCast >= 1 && hint('recharge', 'A used tile <b>recharges in place</b> (faded, with a countdown). Walking over spent tiles casts nothing — use them to reposition.')) return;
  const dm = dangerMap(g);
  if (Object.keys(dm).some((k) => { const [x, y] = k.split(',').map(Number); return adj(x, y); }))
    return hint('danger', '<b>Red crosshairs</b> are telegraphed attacks: they land on the enemy turn, hitting whoever stands there — even other enemies. Dodge, kill, push or stun the attacker.');
  if (g.floorTurns >= g.par - 3 && g.floorTurns < g.par) return hint('par', 'The <b>Dark</b> rises at turn ' + g.par + ': shades will start spawning. Finish the floor fast!');
  if (g.units.some((u) => u.intent && u.intent.delay > 1)) return hint('intent', '<b>Orange squares</b> land in more than one turn (see the countdown).');
  if (g.emerge && hint('emerge', '<b>Rumbling ground</b> (orange ring): reinforcements emerge there at the end of the turn. Block it by standing on it (1 damage) or pushing an enemy onto it.')) return;
  if (g.floor >= 2) hint('inspect', 'Tip: hover or tap any enemy to see exactly which squares it threatens.');
}

function banner(html) {
  const b = $('#banner');
  b.innerHTML = html;
  b.classList.add('show');
  clearTimeout(banner.t);
  banner.t = setTimeout(() => b.classList.remove('show'), 1300);
}

function updateHud() {
  if (!g) return;
  const h = g.hero;
  const hearts = $('#hearts');
  hearts.innerHTML = '';
  for (let i = 0; i < h.maxHp; i++) {
    const im = el('img');
    im.src = `assets/0x72/frames/ui_heart_${i < h.hp ? 'full' : 'empty'}.png`;
    hearts.append(im);
  }
  $('#block').textContent = h.block ? '◆' + h.block : '';
  const inB = ((g.floor - 1) % 3) + 1;
  $('#floor-name').textContent = `F${g.floor} · ${BIOMES[g.biome].name}${inB === 3 ? ' · BOSS' : ''}`;
  const tEl = $('#turns');
  tEl.textContent = g.floorTurns <= g.par ? `Turn ${g.floorTurns}/${g.par} swift` : `THE DARK RISES (${g.floorTurns})`;
  tEl.className = g.floorTurns <= g.par ? 'swift' : 'over';
  const rel = $('#relics');
  rel.innerHTML = '';
  for (const id of h.relics) { const c = iconCanvas(genImage('relic_' + id) || sprite(RELICS[id].icon), 22); c.title = `${RELICS[id].name}: ${RELICS[id].desc}`; rel.append(c); }
  const boss = g.units.find((u) => u.boss);
  $('#bossbar').classList.toggle('hidden', !boss);
  if (boss) { $('#boss-name').textContent = ENEMIES[boss.type].name + ' ' + boss.hp + '/' + boss.maxHp; $('#boss-fill').style.width = (100 * boss.hp) / boss.maxHp + '%'; }
  renderDeck();
}

function renderDeck() {
  const d = $('#deck');
  d.innerHTML = '';
  g.hero.deck.forEach((s, i) => {
    const S = SPELLS[s.id];
    const mine = g.cells.filter((cl) => cl && cl.slot === i);
    const ready = mine.filter((cl) => cl.cd <= 0).length;
    const c = el('div', 'dcard' + (ready ? '' : ' charging') + (s.lv ? ' lv1' : ''));
    c.style.borderColor = SLOT_COLORS[i % SLOT_COLORS.length];
    c.append(iconCanvas(spellIcon(s.id, S.icon), 32));
    c.append(el('div', 'nm', S.name + (s.lv ? '+' : '')));
    c.append(el('div', 'st' + (ready ? '' : ' cd'), `${ready}/${mine.length} ready`));
    c.onclick = () => showInfo(spellInfo(s.id, s.lv));
    d.append(c);
  });
  for (let i = g.hero.deck.length; i < g.hero.slots; i++) d.append(el('div', 'dcard', '<div class="nm k">empty</div><div class="st cd">slot</div>'));
}

function spellInfo(id, lv = 0) {
  const S = SPELLS[id];
  const cd = g ? spellCd(g, id, lv) : S.cd;
  return `<b style="color:${CLASSES[S.cls].color}">${S.name}${lv ? '+' : ''}</b>${S.desc}<br><span class="k">Tile recharge ${cd} · ${['', 'rare', 'common', 'very common'][spellFreq(id)]} on the floor. Fires in the direction you step onto it.${lv ? ' Empowered: +1 power, -1 recharge.' : ''}</span>`;
}

function showInfo(html) { $('#info').innerHTML = html; }

function describe(t) {
  if (!g) return;
  if (!t) {
    const hints = [
      'Every step casts the tile you step onto, <em>in the direction you moved</em>. Spent tiles are silent steps.',
      'Red crosshairs = telegraphed attacks landing next enemy turn (number = damage). Stun cancels them.',
      'Hover/tap an enemy to see its reach. Orange tiles = telegraphed boss attacks.',
      `Clear the floor within ${g.par} turns for a Swift bonus (+1 Ember, +1 draft choice). After that, the Dark spawns shades.`,
    ];
    showInfo(`<b>${CLASSES[g.cls].name}</b><span class="k">${CLASSES[g.cls].passive}</span><br>${hints[g.floorTurns % hints.length]}`);
    return;
  }
  const [x, y] = t;
  const parts = [];
  const u = g.units.find((v) => v.x === x && v.y === y);
  if (g.hero.x === x && g.hero.y === y) {
    const h = g.hero;
    parts.push(`<b>${CLASSES[g.cls].name} — you</b>HP ${h.hp}/${h.maxHp}${h.block ? ` · Block ${h.block}` : ''}<br><span class="k">${CLASSES[g.cls].passive}</span>`);
  }
  if (u) {
    const D = ENEMIES[u.type] || ALLIES[u.type];
    const st = [u.stun > 0 && `stunned ${u.stun}`, u.root > 0 && `rooted ${u.root}`, u.poison > 0 && `poison ${u.poison}`, u.curse > 0 && `cursed ${u.curse}`, u.mark && 'marked', u.elite && 'elite'].filter(Boolean);
    if (u.team === 'enemy') parts.push(`<b>${D.name} ${u.hp}/${u.maxHp}</b>${D.desc}<br><span class="k">Reach: ${PATTERN_TEXT[D.pattern] || 'special'} (yellow outline), ${D.dmg} dmg.${st.length ? ' Status: ' + st.join(', ') + '.' : ''}</span>${u.intent ? `<br><span class="warn">Telegraphing an attack (${u.intent.dmg} dmg) — it lands on its next turn. Move away, kill it, push it, or stun it to cancel.</span>` : ''}`);
    else parts.push(`<b>${D.name} (ally)</b>${D.desc}<br><span class="k">HP ${u.hp}${u.life ? `, ${u.life} turns left` : ''}</span>`);
  }
  const cl = g.cells[y * g.map.w + x];
  if (cl && g.hero.deck[cl.slot]) {
    const d = g.hero.deck[cl.slot];
    if (cl.cd > 0) parts.push(`<b>${SPELLS[d.id].name} (recharging)</b>Ready again in ${cl.cd} turn${cl.cd > 1 ? 's' : ''}. Walking here casts nothing.`);
    else parts.push(spellInfo(d.id, d.lv));
  }
  const tt = tile(g, x, y), k = key(x, y);
  if (tt === T.PIT) parts.push('<b>Pit</b>Impassable. Knock enemies in to kill them instantly.');
  if (tt === T.SPIKES) parts.push(`<b>Spikes</b>Alternate every turn. ${spikesUp(g, x, y, g.turn + 1) ? '<span class="warn">Up at the end of this turn: 1 damage.</span>' : 'Down at the end of this turn: safe.'}`);
  if (tt === T.ICE) parts.push('<b>Ice</b>You slide until something stops you — casting every spell you slide over.');
  if (tt === T.LAVA) parts.push('<b>Lava</b>2 damage when entered. Enemies avoid it — push them in.');
  if (g.fx.slime[k]) parts.push('<b>Slime</b>The spell here fizzles if you step on it.');
  if (g.fx.burn[k]) parts.push(`<b>Burning</b>1 damage at end of turn to anyone standing here (${g.fx.burn[k]} turns).`);
  if (g.fx.wall[k]) parts.push(`<b>Temporary wall</b>Crumbles in ${g.fx.wall[k]} turns.`);
  if (g.fx.corpse[k]) parts.push('<b>Remains</b>Fuel for the Hexer.');
  if (g.fx.trap[k]) parts.push('<b>Your trap</b>Enemies stepping here are hurt and rooted.');
  if (g.doomMark && g.doomMark[0] === x && g.doomMark[1] === y) parts.push('<b>The Dark</b><span class="warn">A shade will emerge here.</span>');
  if (g.emerge && g.emerge[0] === x && g.emerge[1] === y) parts.push('<b>Emerging enemy</b><span class="warn">An enemy crawls out here at the end of this turn. Stand on it (taking 1 damage) or shove an enemy onto it to block it.</span>');
  const threats = g.units.filter((v) => v.team === 'enemy' && v.intent && dangerTiles(g, v).some(([a, c]) => a === x && c === y));
  if (threats.length) parts.push(`<span class="warn">Targeted by: ${threats.map((v) => `${ENEMIES[v.type].name} (${v.intent.dmg} dmg${v.intent.delay > 1 ? `, in ${v.intent.delay} turns` : ''})`).join(', ')}</span>`);
  showInfo(parts.join('<br>') || '<span class="k">Floor.</span>');
}

// ---- input ------------------------------------------------------------------------
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right', k: 'up', j: 'down', h: 'left', l: 'right', ' ': 'wait', '.': 'wait' };
window.addEventListener('keydown', (e) => {
  if (current !== 'game') return;
  if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden') && g.phase === 'play') closeModal(); else if (g.phase === 'play') menuModal(); return; }
  if (e.key === 't' || e.key === 'T') { R.showDanger = !R.showDanger; return; }
  const a = KEYS[e.key];
  if (a) { e.preventDefault(); doAction(a); }
});
$('#btn-wait').addEventListener('click', () => doAction('wait'));
$('#btn-danger').addEventListener('click', () => { R.showDanger = !R.showDanger; });
$('#btn-menu').addEventListener('click', () => menuModal());

let touch = null;
canvas.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    const r = canvas.getBoundingClientRect();
    const t = R.tileAtPx(e.clientX - r.left, e.clientY - r.top);
    if (String(t) !== String(R.hover)) { R.hover = t; describe(t); R.preview = previewMove(t); }
  }
});
canvas.addEventListener('pointerleave', () => { R.hover = null; R.preview = null; });

// Simulate the hero's half of a move on a clone, to preview spell/bump results.
function previewMove(t) {
  if (!g || !t || g.phase !== 'play' || R.busy) return null;
  const dx = t[0] - g.hero.x, dy = t[1] - g.hero.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  const c = JSON.parse(JSON.stringify(g));
  c.quiet = true;
  if (!act(c, dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up', { heroOnly: true })) return null;
  const marks = [];
  for (const u of g.units) {
    if (u.team !== 'enemy') continue;
    const v = c.units.find((q) => q.id === u.id);
    if (!v) marks.push({ x: u.x, y: u.y, s: 'KO', c: '#ffcf5a' });
    else {
      if (v.hp < u.hp) marks.push({ x: v.x, y: v.y, s: '-' + (u.hp - v.hp), c: '#ffcf5a' });
      if (v.x !== u.x || v.y !== u.y) marks.push({ x: v.x, y: v.y, s: '●', c: '#ffffff88', from: [u.x, u.y] });
      if (v.stun > u.stun) marks.push({ x: v.x, y: v.y, s: 'Z', c: '#ffe66b', dy: 0.35 });
    }
  }
  return { marks, hero: [c.hero.x, c.hero.y], heroDmg: g.hero.hp - c.hero.hp };
}
canvas.addEventListener('pointerup', (e) => {
  if (!touch || !g) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  touch = null;
  if (Math.hypot(dx, dy) > 28) {
    doAction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    return;
  }
  const r = canvas.getBoundingClientRect();
  const t = R.tileAtPx(e.clientX - r.left, e.clientY - r.top);
  if (!t) return;
  const ddx = t[0] - g.hero.x, ddy = t[1] - g.hero.y;
  if (Math.abs(ddx) + Math.abs(ddy) === 1) {
    doAction(ddx === 1 ? 'right' : ddx === -1 ? 'left' : ddy === 1 ? 'down' : 'up');
  } else {
    R.hover = t;
    describe(t);
  }
});

// ---- modals ------------------------------------------------------------------------
function modal(html) { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }

function spellCard(id, extra = '') {
  const S = SPELLS[id];
  const c = el('div', 'card');
  c.append(iconCanvas(spellIcon(id, S.icon), 48));
  c.append(el('div', 'nm', S.name));
  c.append(el('div', 'cd', `cooldown ${S.cd}`));
  c.append(el('div', 'ds', S.desc));
  if (extra) c.append(el('div', 'tier', extra));
  return c;
}

function draftModal() {
  const d = g.draft;
  const h = g.hero;
  modal(`<h2>Floor ${g.floor} cleared</h2>
    <p>${['+1 ✦ cleared', d.swift && '+1 ✦ SWIFT (extra draft option)', g.lastFlawless && '+1 ✦ FLAWLESS', g.isBoss && '+3 ✦ BOSS'].filter(Boolean).map((t) => `<span class="ember" style="margin:0 6px">${t.replace('✦ ', '')}</span>`).join('')}</p>
    <p>Add a spell to your deck${h.deck.length >= h.slots ? ' (replacing one)' : ''}, or empower one you have. More spells = more variety on the floor, but your best ones get rarer. Then heal ${healBetween(g)}.</p>
    <div class="cards" id="m-cards"></div><div id="m-replace"></div>
    <div class="row-btns"><button class="btn ghost" id="m-skip">Skip (+1 HP)</button>${h.rerolls ? `<button class="btn" id="m-reroll">Reroll (${h.rerolls})</button>` : ''}</div>`);
  const cards = $('#m-cards');
  d.opts.forEach((o, i) => {
    let c;
    if (o.kind === 'empower') {
      const s = h.deck[o.slot];
      c = spellCard(s.id, '★ EMPOWER: +1 power, -1 cooldown');
      c.classList.add('empower');
      c.querySelector('.nm').textContent = 'Empower ' + SPELLS[s.id].name;
    } else c = spellCard(o.id, SPELLS[o.id].tier === 'l' ? 'Grimoire spell' : '');
    c.onclick = () => {
      sfx('pick');
      if (o.kind === 'spell' && h.deck.length >= h.slots) {
        cards.querySelectorAll('.card').forEach((q) => q.classList.remove('sel'));
        c.classList.add('sel');
        const rep = $('#m-replace');
        rep.innerHTML = '<p>Replace which spell?</p>';
        const row = el('div', 'cards');
        h.deck.forEach((s, slot) => {
          const rc = spellCard(s.id, s.lv ? 'empowered' : '');
          rc.style.width = '130px';
          rc.onclick = () => { chooseDraft(g, i, slot); finishDraft(); };
          row.append(rc);
        });
        rep.append(row);
      } else { chooseDraft(g, i); finishDraft(); }
    };
    cards.append(c);
  });
  $('#m-skip').onclick = () => { chooseDraft(g, -1); finishDraft(); };
  if ($('#m-reroll')) $('#m-reroll').onclick = () => { rerollDraft(g); draftModal(); };
}
function finishDraft() { closeModal(); saveRun(); updateHud(); afterTurn(); }

function relicModal() {
  modal(`<h2>Boss defeated!</h2><p>Choose a relic. You also heal 2.</p><div class="cards" id="m-cards"></div>`);
  g.relicOpts.forEach((id, i) => {
    const R0 = RELICS[id];
    const c = el('div', 'card');
    c.append(iconCanvas(genImage('relic_' + id) || sprite(R0.icon), 48));
    c.append(el('div', 'nm', R0.name));
    c.append(el('div', 'ds', R0.desc));
    c.onclick = () => { sfx('pick'); chooseRelic(g, i); finishDraft(); };
    $('#m-cards').append(c);
  });
}

function pathModal() {
  modal(`<h2>The path forks</h2><p>Where will you descend?</p><div class="cards">
    <div class="card" id="p-swamp"><div class="nm" style="color:#7dff6b">Rot Swamp</div><div class="ds">Slugs, spitters and mudlings. Slime roots you. Boss: Mother Slug.</div></div>
    <div class="card" id="p-frozen"><div class="nm" style="color:#8ecbff">Frozen Vault</div><div class="ds">Ice makes you slide (casting everything you pass). Knight-leaping wraiths. Boss: Frost Colossus.</div></div></div>`);
  $('#p-swamp').onclick = () => { choosePath(g, 'swamp'); finishDraft(); };
  $('#p-frozen').onclick = () => { choosePath(g, 'frozen'); finishDraft(); };
}

function endModal() {
  const s = g.summary;
  if (!g.applied) {
    g.applied = true;
    const msgs = applyRun(meta, s, g.hero.deck.map((d) => d.id), g.hero.relics);
    saveMeta();
    store.del('mc_run');
    g.unlockMsgs = msgs;
  }
  const won = s.won;
  modal(`<h2 style="color:${won ? '#ffcf5a' : '#ff6b6b'}">${won ? 'VICTORY' : 'YOU FELL'}</h2>
    <p>${won ? 'The Pit Lord is no more. The dungeon remembers your name.' : `Slain on floor ${s.floor} — ${BIOMES[s.biome].name}.`}</p>
    <div class="stats">
      <span>Hero</span><span>${CLASSES[s.cls].name}${s.depth ? ' · D' + s.depth : ''}</span>
      <span>Floor reached</span><span>${s.floor} / ${TOTAL_FLOORS}</span>
      <span>Enemies slain</span><span>${s.kills}</span>
      <span>Spells cast</span><span>${s.spellsCast}</span>
      <span>Bosses</span><span>${s.bossKills.length}</span>
      <span>Embers earned</span><span class="ember">${s.embers}</span>
    </div>
    ${(g.unlockMsgs || []).map((m) => `<div class="unlock">★ ${m}</div>`).join('')}
    <p class="k">${nextGoals(meta).slice(0, 1).map((gl) => `Next unlock — ${CLASSES[gl.cls].name}: ${gl.text}`).join('')}</p>
    <div class="row-btns"><button class="btn primary" id="m-again">Descend again ▶</button><button class="btn" id="m-hero">Change hero</button><button class="btn" id="m-sanc">Sanctum (${meta.embers} ✦)</button><button class="btn ghost" id="m-title">Title</button></div>`);
  $('#m-again').onclick = () => { closeModal(); if (!meta.classes[s.cls]) return show('class'); startGame(newRun({ cls: s.cls, seed: (Math.random() * 2 ** 32) >>> 0, depth: Math.min(s.depth, meta.depthUnlocked[s.cls] || 0), meta: metaForRun() })); };
  $('#m-hero').onclick = () => { closeModal(); show('class'); };
  $('#m-sanc').onclick = () => { closeModal(); show('sanctum'); };
  $('#m-title').onclick = () => { closeModal(); show('title'); };
}

function abandonRun(run) {
  run.phase = 'dead';
  run.summary = { cls: run.cls, depth: run.depth, won: false, floor: run.floor, biome: run.biome, kills: run.stats.kills, killsByType: {}, bossKills: run.stats.bossKills, perfectFloors: run.stats.perfectFloors, embers: run.stats.embers, seen: run.stats.seen, spellsCast: run.stats.spellsCast, turns: run.stats.turns, daily: false };
  applyRun(meta, run.summary, run.hero.deck.map((d) => d.id), run.hero.relics);
  saveMeta();
  store.del('mc_run');
}

function menuModal() {
  modal(`<h2>Paused</h2><div class="menu" style="margin:12px auto">
    <button class="btn" id="m-resume">Resume</button>
    <button class="btn" id="m-help">How to play</button>
    <button class="btn" id="m-sound">Sound: ${isMuted() ? 'OFF' : 'ON'}</button>
    <button class="btn" id="m-speed">Animation: ${R.speed > 1 ? 'FAST' : 'NORMAL'}</button>
    <button class="btn" id="m-title">Save & quit to title</button>
    <button class="btn ghost" id="m-abandon">Abandon run</button></div>`);
  $('#m-resume').onclick = closeModal;
  $('#m-help').onclick = helpModal;
  $('#m-sound').onclick = () => { setMuted(!isMuted()); menuModal(); };
  $('#m-speed').onclick = () => { R.speed = R.speed > 1 ? 1 : 2.2; store.set('mc_speed', R.speed); menuModal(); };
  $('#m-title').onclick = () => { closeModal(); saveRun(); show('title'); };
  $('#m-abandon').onclick = () => { if (confirm('Abandon this run? You keep the Embers earned so far.')) { abandonRun(g); g = null; closeModal(); show('title'); } };
}
R.speed = store.get('mc_speed') || 1;

function helpModal() {
  modal(`<h2>How to play</h2><ul class="help">
    <li><b>Move</b> one square with <kbd>Arrows</kbd>/<kbd>WASD</kbd>, swipe, or tap a neighbouring square. <kbd>Space</kbd> waits.</li>
    <li><b>The whole floor is your deck.</b> Every tile holds one of your spells (coloured frame = which deck slot). <b>Each step casts the tile you step onto, in the direction you stepped.</b></li>
    <li>A used tile <b>recharges in place</b> (faded icon + countdown). Spent tiles are safe, silent steps.</li>
    <li>There is <b>no melee</b> — you cannot walk into enemies. Every kill is a spell, so plan your path and your approach angle.</li>
    <li><b>Waiting</b> re-casts the tile you stand on (once it has recharged), in the direction you last moved.</li>
    <li>Enemies <b>emerge</b> from rumbling orange rings; the <b>Dark</b> sends shades if you dawdle past par. Shades fade once the real enemies are gone.</li>
    <li><b>Enemies telegraph.</b> Each enemy marks the square(s) it will strike (red crosshair + damage) and attacks on its next turn — hitting <b>whoever</b> stands there, even other enemies. Dodge, kill it, push it so the attack lands elsewhere, or <b>stun it to cancel</b>. Hover an enemy to see its reach (yellow).</li>
    <li>Clear every enemy to finish the floor, then draft new spells. Be quick: after the <b>par</b> turn count, the Dark spawns shades.</li>
    <li>Earn <span class="ember">Embers</span> to unlock spells, relics and blessings in the Sanctum. Achievements unlock new heroes.</li></ul>
    <div class="row-btns"><button class="btn primary" id="m-ok">Got it</button></div>`);
  $('#m-ok').onclick = () => { if (current === 'game' && g && g.phase === 'play') closeModal(); else if (current === 'game') afterTurn(); else closeModal(); };
}

// ---- sanctum ------------------------------------------------------------------------
let sanctumTab = 'blessings', grimCls = 'knight';
function renderSanctum() {
  $('#sanctum-embers').textContent = meta.embers;
  const tabs = $('#sanctum-tabs');
  tabs.innerHTML = '';
  for (const [k, n] of [['blessings', 'Blessings'], ['grimoire', 'Grimoire'], ['relics', 'Relic Vault'], ['heroes', 'Heroes']]) {
    const b = el('button', 'btn' + (sanctumTab === k ? ' on' : ''), n);
    b.onclick = () => { sanctumTab = k; renderSanctum(); };
    tabs.append(b);
  }
  const body = $('#sanctum-body');
  body.innerHTML = '';
  const shop = (name, desc, cost, owned, onBuy, img, note = '') => {
    const s = el('div', 'shop' + (owned ? ' owned' : ''));
    const nm = el('div', 'nm');
    if (img) nm.append(iconCanvas(img, 28));
    nm.append(document.createTextNode(name));
    s.append(nm, el('div', 'ds', desc + (note ? `<br><span class="k">${note}</span>` : '')));
    const b = el('button', 'btn', owned ? 'OWNED' : `Unlock ✦ ${cost}`);
    b.disabled = owned || meta.embers < cost || cost == null;
    b.onclick = () => { if (onBuy()) { sfx('clear'); saveMeta(); renderSanctum(); } };
    s.append(b);
    body.append(s);
  };
  if (sanctumTab === 'blessings') {
    for (const [id, B] of Object.entries(BLESSINGS)) {
      const locked = B.req && !meta.blessings[B.req];
      shop(B.name, B.desc, locked ? null : B.cost, !!meta.blessings[id], () => buy(meta, 'blessing', id), null, locked ? `Requires ${BLESSINGS[B.req].name}` : '');
    }
  } else if (sanctumTab === 'grimoire') {
    const row = el('div', 'tabs');
    row.style.gridColumn = '1 / -1';
    for (const c of CLASS_ORDER) {
      const b = el('button', 'btn' + (grimCls === c ? ' on' : ''), CLASSES[c].name);
      b.onclick = () => { grimCls = c; renderSanctum(); };
      row.append(b);
    }
    body.append(row);
    for (const gr of grimoireFor(meta, grimCls)) {
      const S = SPELLS[gr.id];
      shop(S.name, S.desc, gr.cost, gr.owned, () => buy(meta, 'grimoire', gr.id), spellIcon(gr.id, S.icon), `cooldown ${S.cd}${meta.classes[grimCls] ? '' : ' · hero still locked'}`);
    }
  } else if (sanctumTab === 'relics') {
    for (const [id, R0] of Object.entries(RELICS)) {
      if (R0.base) shop(R0.name, R0.desc, 0, true, () => false, genImage('relic_' + id) || sprite(R0.icon), 'Always in the pool');
      else shop(R0.name, R0.desc, RELIC_COST, !!meta.relics[id], () => buy(meta, 'relic', id), genImage('relic_' + id) || sprite(R0.icon), 'Adds it to the boss relic pool');
    }
  } else {
    for (const c of CLASS_ORDER) {
      const C = CLASSES[c];
      const s = el('div', 'shop' + (meta.classes[c] ? ' owned' : ''));
      const nm = el('div', 'nm'); nm.append(iconCanvas(sprite(C.sprite + '_idle'), 28)); nm.append(document.createTextNode(C.name));
      const gl = nextGoals(meta).find((q) => q.cls === c);
      s.append(nm, el('div', 'ds', meta.classes[c]
        ? `Unlocked. Best depth won: ${meta.depthWon[c] ?? '—'}. Depth available: ${meta.depthUnlocked[c] || 0}.`
        : `🔒 ${C.unlock.text}${gl && gl.progress ? ` (${Math.round(gl.progress * 100)}%)` : ''}`));
      body.append(s);
    }
    body.append(el('div', 'shop', `<div class="nm">Frozen Vault</div><div class="ds">${meta.frozen ? 'Unlocked — choose it after the Crypt boss.' : '🔒 Defeat the Bone Tyrant to open an alternative path.'}</div>`));
  }
}

// ---- codex ---------------------------------------------------------------------------
let codexTab = 'enemies';
function renderCodex() {
  const tabs = $('#codex-tabs');
  tabs.innerHTML = '';
  for (const [k, n] of [['enemies', 'Bestiary'], ['spells', 'Spells'], ['relics', 'Relics']]) {
    const b = el('button', 'btn' + (codexTab === k ? ' on' : ''), n);
    b.onclick = () => { codexTab = k; renderCodex(); };
    tabs.append(b);
  }
  const body = $('#codex-body');
  body.innerHTML = '';
  let known = 0, total = 0;
  const entry = (img, name, desc, count, isKnown) => {
    total++; if (isKnown) known++;
    const c = el('div', 'cx' + (isKnown ? '' : ' unknown'));
    c.append(iconCanvas(isKnown ? img : sprite('skull'), 40));
    c.append(el('div', '', `<div class="nm">${isKnown ? name : '???'}</div>${isKnown ? desc : 'Not yet discovered.'}${isKnown && count ? `<br><span class="k">× ${count}</span>` : ''}`));
    body.append(c);
  };
  if (codexTab === 'enemies') {
    for (const [id, E] of Object.entries(ENEMIES)) {
      const n = meta.codex.enemies[id] || 0;
      entry(sprite(E.sprite), E.name, `${E.desc}<br><span class="k">HP ${E.hp} · attacks ${PATTERN_TEXT[E.pattern]}</span>`, n ? `${n} met` : 0, n > 0);
    }
  } else if (codexTab === 'spells') {
    for (const [id, S] of Object.entries(SPELLS)) {
      const n = meta.codex.spells[id] || 0;
      entry(spellIcon(id, S.icon), `${S.name} · ${CLASSES[S.cls].name}`, S.desc, n ? `${n} runs` : 0, n > 0);
    }
  } else {
    for (const [id, R0] of Object.entries(RELICS)) {
      const n = meta.codex.relics[id] || 0;
      entry(genImage('relic_' + id) || sprite(R0.icon), R0.name, R0.desc, n ? `${n} runs` : 0, n > 0);
    }
  }
  $('#codex-pct').textContent = `${known}/${total}`;
}

// ---- boot ------------------------------------------------------------------------------
preloadAll().then(() => { renderTitle(); });
show('title');
