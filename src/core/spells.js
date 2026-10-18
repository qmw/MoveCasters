// All spells. Single source of truth for numbers.
// tier: s = starter, b = base draftable, l = locked behind a Grimoire page (meta unlock).
// cast(g, c): c = { dx, dy, P (bonus damage), lv, moveHero(x, y, dx, dy) }
import { KING, ORTH, T } from './data.js';
import {
  key, inb, tile, setTile, isWall, unitAt, heroAt, occupied, enemies, ray, firstEnemyInRay, enemiesInRay,
  nearestEnemy, damageUnit, killUnit, pushUnit, healHero, hurtHero, emit, makeUnit, standable, manhattan, cheb, spellAt,
} from './engine.js';

const hit = (g, u, n) => u && damageUnit(g, u, n, g.hero, 'spell');
const perp = (dx, dy) => [[-dy, dx], [dy, -dx]];
const bolt = (g, from, to, c) => emit(g, { t: 'bolt', from, to, c });
const aoe = (g, tiles, c) => emit(g, { t: 'aoe', tiles, c });
const H = (g) => g.hero;
const around8 = (x, y) => KING.map(([dx, dy]) => [x + dx, y + dy]);
const enemyAt = (g, x, y) => { const u = unitAt(g, x, y); return u && u.team === 'enemy' ? u : null; };
const ignite = (g, x, y, n = 3) => { if (inb(g, x, y) && !isWall(g, x, y)) g.fx.burn[key(x, y)] = Math.max(g.fx.burn[key(x, y)] || 0, n); };
function shootFirst(g, c, range, dmg, color) {
  const h = H(g);
  const tiles = ray(g, h.x, h.y, c.dx, c.dy, range, true);
  const end = tiles[tiles.length - 1] || [h.x + c.dx, h.y + c.dy];
  bolt(g, [h.x, h.y], end, color);
  const u = firstEnemyInRay(g, h.x, h.y, c.dx, c.dy, range);
  hit(g, u, dmg);
  return u;
}
function pierce(g, c, range, dmg, color) {
  const h = H(g);
  const tiles = ray(g, h.x, h.y, c.dx, c.dy, range);
  if (tiles.length) bolt(g, [h.x, h.y], tiles[tiles.length - 1], color);
  aoe(g, tiles, color);
  const us = enemiesInRay(g, h.x, h.y, c.dx, c.dy, range);
  us.forEach((u) => hit(g, u, dmg));
  return { tiles, us };
}
function placeTempWall(g, x, y, turns) {
  if (!inb(g, x, y) || !standable(g, x, y) || occupied(g, x, y) || spellAt(g, x, y)) return false;
  g.fx.wall[key(x, y)] = turns;
  return true;
}

export const SPELLS = {
  // ======================= KNIGHT =======================
  cleave: { cls: 'knight', tier: 's', name: 'Cleave', cd: 3, icon: 'weapon_axe',
    desc: 'Hit the 3 squares in front of you for 2.',
    cast(g, c) {
      const h = H(g), ax = h.x + c.dx, ay = h.y + c.dy;
      const tiles = [[ax, ay], ...perp(c.dx, c.dy).map(([px, py]) => [ax + px, ay + py])];
      aoe(g, tiles, '#e8e8e8');
      tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 2 + c.P));
    } },
  charge: { cls: 'knight', tier: 's', name: 'Charge', cd: 4, icon: 'weapon_spear',
    desc: 'Dash forward up to 4 squares. If you slam into an enemy: 2 damage and stun it.',
    cast(g, c) {
      const h = H(g);
      let tx = h.x, ty = h.y, target = null;
      for (let i = 0; i < 4; i++) {
        const nx = tx + c.dx, ny = ty + c.dy;
        if (!standable(g, nx, ny) || tile(g, nx, ny) === T.LAVA) break;
        const u = unitAt(g, nx, ny);
        if (u) { if (u.team === 'enemy') target = u; break; }
        tx = nx; ty = ny;
      }
      if (!target) { const n = unitAt(g, tx + c.dx, ty + c.dy); if (n && n.team === 'enemy') target = n; }
      if (tx !== h.x || ty !== h.y) c.moveHero(tx, ty, c.dx, c.dy, true);
      if (target && target.hp > 0) { hit(g, target, 2 + c.P); if (target.hp > 0) target.stun = Math.max(target.stun, 1); }
    } },
  shield_bash: { cls: 'knight', tier: 's', name: 'Shield Bash', cd: 3, icon: 'weapon_mace',
    desc: 'Enemy in front takes 1, is knocked back 2 and stunned.',
    cast(g, c) {
      const h = H(g), u = enemyAt(g, h.x + c.dx, h.y + c.dy);
      aoe(g, [[h.x + c.dx, h.y + c.dy]], '#8ecbff');
      if (!u) return;
      hit(g, u, 1 + c.P);
      if (u.hp > 0) { u.stun = Math.max(u.stun, 1); pushUnit(g, u, c.dx, c.dy, 2); }
    } },
  bulwark: { cls: 'knight', tier: 's', name: 'Bulwark', cd: 5, icon: 'weapon_knight_sword',
    desc: 'Gain 2 Block (absorbs damage this floor).',
    cast(g, c) { H(g).block += 2 + c.lv; emit(g, { t: 'text', x: H(g).x, y: H(g).y, s: '+BLOCK', c: '#8ecbff' }); } },
  whirlwind: { cls: 'knight', tier: 'b', name: 'Whirlwind', cd: 5, icon: 'weapon_double_axe',
    desc: 'Deal 2 to all 8 surrounding squares.',
    cast(g, c) {
      const h = H(g), tiles = around8(h.x, h.y);
      aoe(g, tiles, '#e8e8e8');
      tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 2 + c.P));
    } },
  lance: { cls: 'knight', tier: 'b', name: 'Lance', cd: 4, icon: 'weapon_spear',
    desc: 'Pierce: every enemy in a line (range 3) takes 2.',
    cast(g, c) { pierce(g, c, 3, 2 + c.P, '#e8e8e8'); } },
  rally: { cls: 'knight', tier: 'b', name: 'Rally', cd: 8, icon: 'flask_big_red',
    desc: 'Heal 2.',
    cast(g, c) { healHero(g, 2 + c.lv); } },
  taunt: { cls: 'knight', tier: 'b', name: 'Taunt', cd: 5, icon: 'wall_banner_red',
    desc: 'Enemies within 3 are dragged 1 toward you. Gain 1 Block per enemy dragged (max 3).',
    cast(g, c) {
      const h = H(g);
      const us = enemies(g).filter((u) => manhattan(u.x, u.y, h.x, h.y) <= 3 && manhattan(u.x, u.y, h.x, h.y) > 1)
        .sort((a, b) => manhattan(a.x, a.y, h.x, h.y) - manhattan(b.x, b.y, h.x, h.y));
      let n = 0;
      for (const u of us) {
        const dx = Math.sign(h.x - u.x), dy = Math.sign(h.y - u.y);
        const step = Math.abs(h.x - u.x) >= Math.abs(h.y - u.y) ? [dx, 0] : [0, dy];
        const nx = u.x + step[0], ny = u.y + step[1];
        if (standable(g, nx, ny) && !occupied(g, nx, ny)) {
          emit(g, { t: 'move', id: u.id, from: [u.x, u.y], to: [nx, ny], push: true });
          u.x = nx; u.y = ny; n++;
        }
      }
      h.block += Math.min(3, n + c.lv);
    } },
  riposte: { cls: 'knight', tier: 'l', name: 'Riposte', cd: 4, icon: 'weapon_duel_sword',
    desc: 'The next enemy attack against you is parried and the attacker takes 3.',
    cast(g, c) { H(g).riposte = 1; emit(g, { t: 'text', x: H(g).x, y: H(g).y, s: 'EN GARDE', c: '#fff36b' }); } },
  earthshaker: { cls: 'knight', tier: 'l', name: 'Earthshaker', cd: 6, icon: 'weapon_big_hammer',
    desc: 'All enemies within 2 squares take 1 and are stunned.',
    cast(g, c) {
      const h = H(g), tiles = [];
      for (let y = h.y - 2; y <= h.y + 2; y++) for (let x = h.x - 2; x <= h.x + 2; x++) if (manhattan(x, y, h.x, h.y) <= 2 && (x !== h.x || y !== h.y)) tiles.push([x, y]);
      aoe(g, tiles, '#c8a26b');
      tiles.forEach(([x, y]) => { const u = enemyAt(g, x, y); if (u) { hit(g, u, 1 + c.P); if (u.hp > 0) u.stun = Math.max(u.stun, 1); } });
    } },
  execute: { cls: 'knight', tier: 'l', name: 'Execute', cd: 4, icon: 'weapon_lavish_sword',
    desc: 'Enemy in front: slain outright if it has 4 HP or less (bosses take 4).',
    cast(g, c) {
      const h = H(g), u = enemyAt(g, h.x + c.dx, h.y + c.dy);
      aoe(g, [[h.x + c.dx, h.y + c.dy]], '#ff4d4d');
      if (!u) return;
      if (!u.boss && u.hp <= 4 + c.lv) { emit(g, { t: 'hit', id: u.id, x: u.x, y: u.y, n: u.hp }); killUnit(g, u, 'spell'); }
      else hit(g, u, 4 + c.P);
    } },
  valor: { cls: 'knight', tier: 'l', name: 'Valor', cd: 6, icon: 'weapon_golden_sword',
    desc: 'For 4 turns your bump attacks deal +2.',
    cast(g, c) { H(g).valor = 4 + c.lv; emit(g, { t: 'text', x: H(g).x, y: H(g).y, s: 'VALOR', c: '#ffd700' }); } },

  // ======================= PYROMANCER =======================
  firebolt: { cls: 'pyro', tier: 's', name: 'Firebolt', cd: 2, icon: 'weapon_red_magic_staff',
    desc: 'The first enemy in a line takes 2.',
    cast(g, c) { shootFirst(g, c, 99, 2 + c.P, '#ff8a3d'); } },
  flame_wave: { cls: 'pyro', tier: 's', name: 'Flame Wave', cd: 4, icon: 'wall_fountain_basin_red_anim',
    desc: 'A 3-wide, 2-deep wave ahead: 1 damage and sets the ground ablaze.',
    cast(g, c) {
      const h = H(g), tiles = [];
      for (let d = 1; d <= 2; d++) {
        const ax = h.x + c.dx * d, ay = h.y + c.dy * d;
        tiles.push([ax, ay], ...perp(c.dx, c.dy).map(([px, py]) => [ax + px, ay + py]));
      }
      const ok = tiles.filter(([x, y]) => inb(g, x, y) && !isWall(g, x, y));
      aoe(g, ok, '#ff8a3d');
      ok.forEach(([x, y]) => { ignite(g, x, y); hit(g, enemyAt(g, x, y), 1 + c.P); });
    } },
  fire_ring: { cls: 'pyro', tier: 's', name: 'Fire Ring', cd: 5, icon: 'floor_spikes_anim',
    desc: 'All 8 surrounding squares: 1 damage and set ablaze.',
    cast(g, c) {
      const h = H(g), tiles = around8(h.x, h.y).filter(([x, y]) => inb(g, x, y) && !isWall(g, x, y));
      aoe(g, tiles, '#ff8a3d');
      tiles.forEach(([x, y]) => { ignite(g, x, y); hit(g, enemyAt(g, x, y), 1 + c.P); });
    } },
  heat_shield: { cls: 'pyro', tier: 's', name: 'Heat Shield', cd: 5, icon: 'flask_big_yellow',
    desc: 'Gain 1 Block. Adjacent enemies catch fire (their squares burn).',
    cast(g, c) {
      const h = H(g); h.block += 1 + c.lv;
      ORTH.forEach(([dx, dy]) => { const u = enemyAt(g, h.x + dx, h.y + dy); if (u) ignite(g, u.x, u.y); });
      aoe(g, around8(h.x, h.y), '#ffd36b');
    } },
  meteor: { cls: 'pyro', tier: 'b', name: 'Meteor', cd: 6, icon: 'bomb_f0',
    desc: 'The toughest enemy takes 3; its neighbours take 1.',
    cast(g, c) {
      const es = enemies(g); if (!es.length) return;
      const u = es.reduce((a, b) => (b.hp > a.hp ? b : a));
      const tiles = around8(u.x, u.y);
      bolt(g, [u.x, u.y - 6], [u.x, u.y], '#ff5a1f');
      aoe(g, [[u.x, u.y], ...tiles], '#ff5a1f');
      const ns = tiles.map(([x, y]) => enemyAt(g, x, y)).filter(Boolean);
      hit(g, u, 3 + c.P);
      ns.forEach((v) => hit(g, v, 1 + c.P));
      ignite(g, u.x, u.y);
    } },
  inferno_line: { cls: 'pyro', tier: 'b', name: 'Inferno Line', cd: 5, icon: 'weapon_red_gem_sword',
    desc: 'Every enemy in the whole line takes 1. The line burns.',
    cast(g, c) {
      const { tiles } = pierce(g, c, 99, 1 + c.P, '#ff5a1f');
      tiles.forEach(([x, y]) => ignite(g, x, y, 3));
    } },
  blink_flare: { cls: 'pyro', tier: 'b', name: 'Blink Flare', cd: 4, icon: 'flask_big_blue',
    desc: 'Teleport up to 3 squares ahead. Your old square explodes: 2 to its neighbours.',
    cast(g, c) {
      const h = H(g), ox = h.x, oy = h.y;
      let tx = h.x, ty = h.y;
      for (let i = 1; i <= 3; i++) {
        const nx = h.x + c.dx * i, ny = h.y + c.dy * i;
        if (!inb(g, nx, ny) || isWall(g, nx, ny)) break;
        if (standable(g, nx, ny) && !occupied(g, nx, ny) && tile(g, nx, ny) !== T.LAVA) { tx = nx; ty = ny; }
      }
      const tiles = around8(ox, oy);
      aoe(g, tiles, '#ff8a3d');
      tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 2 + c.P));
      if (tx !== ox || ty !== oy) c.moveHero(tx, ty, c.dx, c.dy, true);
    } },
  combustion: { cls: 'pyro', tier: 'b', name: 'Combustion', cd: 5, icon: 'wall_fountain_mid_red_anim',
    desc: 'Every enemy standing on burning ground takes 3.',
    cast(g, c) {
      const us = enemies(g).filter((u) => g.fx.burn[key(u.x, u.y)]);
      aoe(g, us.map((u) => [u.x, u.y]), '#ff3b1f');
      us.forEach((u) => hit(g, u, 3 + c.P));
    } },
  cinder_storm: { cls: 'pyro', tier: 'l', name: 'Cinder Storm', cd: 7, icon: 'coin_anim',
    desc: 'Every enemy on the floor takes 1.',
    cast(g, c) {
      const us = enemies(g);
      aoe(g, us.map((u) => [u.x, u.y]), '#ff8a3d');
      us.forEach((u) => hit(g, u, 1 + c.P));
    } },
  magma_wall: { cls: 'pyro', tier: 'l', name: 'Magma Wall', cd: 6, icon: 'wall_goo',
    desc: 'A 5-wide line of fire 2 squares ahead burns for 5 turns; enemies on it take 1.',
    cast(g, c) {
      const h = H(g), ax = h.x + c.dx * 2, ay = h.y + c.dy * 2;
      const [p] = perp(c.dx, c.dy);
      const tiles = [-2, -1, 0, 1, 2].map((i) => [ax + p[0] * i, ay + p[1] * i]).filter(([x, y]) => inb(g, x, y) && !isWall(g, x, y));
      aoe(g, tiles, '#ff3b1f');
      tiles.forEach(([x, y]) => { ignite(g, x, y, 5); hit(g, enemyAt(g, x, y), 1 + c.P); });
    } },
  phoenix_feather: { cls: 'pyro', tier: 'l', name: 'Phoenix Feather', cd: 9, icon: 'flask_big_red',
    desc: 'Heal 2 and set all 8 surrounding squares ablaze.',
    cast(g, c) { const h = H(g); healHero(g, 2 + c.lv); around8(h.x, h.y).forEach(([x, y]) => ignite(g, x, y)); aoe(g, around8(h.x, h.y), '#ffd36b'); } },
  pyroclasm: { cls: 'pyro', tier: 'l', name: 'Pyroclasm', cd: 8, icon: 'big_demon_idle_anim',
    desc: 'Every enemy within 2 squares (incl. diagonals) takes 3. You take 1.',
    cast(g, c) {
      const h = H(g), tiles = [];
      for (let y = h.y - 2; y <= h.y + 2; y++) for (let x = h.x - 2; x <= h.x + 2; x++) if (x !== h.x || y !== h.y) tiles.push([x, y]);
      aoe(g, tiles, '#ff3b1f');
      tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 3 + c.P));
      hurtHero(g, 1, null, 'self');
    } },

  // ======================= RANGER =======================
  arrow: { cls: 'ranger', tier: 's', name: 'Arrow', cd: 2, icon: 'weapon_arrow',
    desc: 'The first enemy in a line takes 2.',
    cast(g, c) { shootFirst(g, c, 99, 2 + c.P, '#d9f0a3'); } },
  vault: { cls: 'ranger', tier: 's', name: 'Vault', cd: 3, icon: 'weapon_bow',
    desc: 'Leap 2 squares backward, then loose an arrow forward for 1.',
    cast(g, c) {
      const h = H(g);
      let tx = h.x, ty = h.y;
      for (let i = 1; i <= 2; i++) {
        const nx = h.x - c.dx * i, ny = h.y - c.dy * i;
        if (!inb(g, nx, ny) || isWall(g, nx, ny)) break;
        if (standable(g, nx, ny) && !occupied(g, nx, ny) && tile(g, nx, ny) !== T.LAVA) { tx = nx; ty = ny; }
      }
      if (tx !== h.x || ty !== h.y) c.moveHero(tx, ty, -c.dx, -c.dy, false);
      shootFirst(g, c, 99, 1 + c.P, '#d9f0a3');
    } },
  bear_trap: { cls: 'ranger', tier: 's', name: 'Bear Trap', cd: 4, icon: 'weapon_saw_sword',
    desc: 'Set a trap on the square ahead (or under the enemy there): 2 damage and rooted 2 turns.',
    cast(g, c) {
      const h = H(g), x = h.x + c.dx, y = h.y + c.dy;
      const u = enemyAt(g, x, y);
      if (u) { hit(g, u, 2 + c.P); if (u.hp > 0) u.root = Math.max(u.root, 2); return; }
      if (standable(g, x, y)) g.fx.trap[key(x, y)] = { type: 'bear', bonus: c.P };
      aoe(g, [[x, y]], '#ffd36b');
    } },
  piercing_shot: { cls: 'ranger', tier: 's', name: 'Piercing Shot', cd: 4, icon: 'weapon_bow_2',
    desc: 'Every enemy in a line takes 1; the first takes 1 more.',
    cast(g, c) {
      const { us } = pierce(g, c, 99, 1 + c.P, '#d9f0a3');
      if (us[0] && us[0].hp > 0) hit(g, us[0], 1);
    } },
  volley: { cls: 'ranger', tier: 'b', name: 'Volley', cd: 5, icon: 'weapon_throwing_axe',
    desc: 'Three parallel arrows (ahead and to each side): first enemy in each takes 2.',
    cast(g, c) {
      const h = H(g);
      for (const [ox, oy] of [[0, 0], ...perp(c.dx, c.dy)]) {
        const sx = h.x + ox, sy = h.y + oy;
        if (isWall(g, sx, sy) && (ox || oy)) continue;
        const tiles = ray(g, sx, sy, c.dx, c.dy, 99, true);
        if (tiles.length) bolt(g, [sx, sy], tiles[tiles.length - 1], '#d9f0a3');
        hit(g, firstEnemyInRay(g, sx, sy, c.dx, c.dy), 2 + c.P);
      }
    } },
  hawk: { cls: 'ranger', tier: 'b', name: 'Hawk', cd: 4, icon: 'angel_idle_anim',
    desc: 'Your hawk strikes the nearest enemy for 2 and stuns it.',
    cast(g, c) { const h = H(g), u = nearestEnemy(g, h.x, h.y); if (!u) return; bolt(g, [h.x, h.y], [u.x, u.y], '#fff'); hit(g, u, 2 + c.P); if (u.hp > 0) u.stun = Math.max(u.stun, 1); } },
  snare_net: { cls: 'ranger', tier: 'b', name: 'Snare Net', cd: 5, icon: 'wall_hole_1',
    desc: 'Every enemy in a line is stunned 1 turn and rooted 3.',
    cast(g, c) { const { us } = pierce(g, c, 99, 0, '#ffd36b'); us.forEach((u) => { u.stun = Math.max(u.stun, 1 + c.lv); u.root = Math.max(u.root, 3); }); } },
  windstep: { cls: 'ranger', tier: 'b', name: 'Windstep', cd: 3, icon: 'flask_green',
    desc: 'Dash up to 3 more squares forward. Your next spell deals +1.',
    cast(g, c) {
      const h = H(g);
      let tx = h.x, ty = h.y;
      for (let i = 0; i < 3; i++) {
        const nx = tx + c.dx, ny = ty + c.dy;
        if (!standable(g, nx, ny) || occupied(g, nx, ny) || tile(g, nx, ny) === T.LAVA) break;
        tx = nx; ty = ny;
      }
      h.aim = 1;
      if (tx !== h.x || ty !== h.y) c.moveHero(tx, ty, c.dx, c.dy, true);
    } },
  ricochet: { cls: 'ranger', tier: 'l', name: 'Ricochet', cd: 5, icon: 'coin_anim',
    desc: 'Hit the nearest enemy for 2, bouncing to 2 more nearby enemies for 1.',
    cast(g, c) {
      const h = H(g);
      let from = [h.x, h.y], u = nearestEnemy(g, h.x, h.y), hitSet = new Set(), d = 2 + c.P;
      for (let i = 0; i < 3 && u; i++) {
        bolt(g, from, [u.x, u.y], '#d9f0a3');
        hitSet.add(u.id); from = [u.x, u.y];
        hit(g, u, d); d = 1 + c.P;
        u = enemies(g).filter((v) => !hitSet.has(v.id) && manhattan(v.x, v.y, from[0], from[1]) <= 4)
          .sort((a, b) => manhattan(a.x, a.y, from[0], from[1]) - manhattan(b.x, b.y, from[0], from[1]))[0];
      }
    } },
  rain_of_arrows: { cls: 'ranger', tier: 'l', name: 'Rain of Arrows', cd: 7, icon: 'weapon_arrow',
    desc: 'Every enemy within 3 squares takes 2.',
    cast(g, c) {
      const h = H(g), us = enemies(g).filter((u) => manhattan(u.x, u.y, h.x, h.y) <= 3);
      aoe(g, us.map((u) => [u.x, u.y]), '#d9f0a3');
      us.forEach((u) => hit(g, u, 2 + c.P));
    } },
  smoke_bomb: { cls: 'ranger', tier: 'l', name: 'Smoke Bomb', cd: 6, icon: 'bomb_f0',
    desc: 'Adjacent enemies (incl. diagonal) are stunned 2 turns. You vanish for 1 turn.',
    cast(g, c) {
      const h = H(g); aoe(g, around8(h.x, h.y), '#9a9a9a');
      around8(h.x, h.y).forEach(([x, y]) => { const u = enemyAt(g, x, y); if (u) u.stun = Math.max(u.stun, 2); });
      h.invis = Math.max(h.invis, 1 + c.lv);
    } },
  mark_prey: { cls: 'ranger', tier: 'l', name: 'Mark Prey', cd: 4, icon: 'skull',
    desc: 'First enemy in a line takes 1 and is Marked: +1 damage from everything, forever.',
    cast(g, c) { const u = shootFirst(g, c, 99, 1 + c.P, '#ff4d4d'); if (u && u.hp > 0) u.mark = 1; } },

  // ======================= GEOMANCER =======================
  boulder: { cls: 'geo', tier: 's', name: 'Boulder', cd: 3, icon: 'crate',
    desc: 'Roll a boulder: the first enemy hit takes 1 and is shoved until it hits something.',
    cast(g, c) {
      const h = H(g), u = firstEnemyInRay(g, h.x, h.y, c.dx, c.dy);
      const tiles = ray(g, h.x, h.y, c.dx, c.dy, 99, true);
      if (tiles.length) bolt(g, [h.x, h.y], tiles[tiles.length - 1], '#c8a26b');
      if (!u) return;
      hit(g, u, 1 + c.P);
      if (u.hp > 0) pushUnit(g, u, c.dx, c.dy, 9);
    } },
  stone_fist: { cls: 'geo', tier: 's', name: 'Stone Fist', cd: 2, icon: 'weapon_hammer',
    desc: 'Enemy in front takes 1 and is knocked back 2.',
    cast(g, c) {
      const h = H(g), u = enemyAt(g, h.x + c.dx, h.y + c.dy);
      aoe(g, [[h.x + c.dx, h.y + c.dy]], '#c8a26b');
      if (!u) return;
      hit(g, u, 1 + c.P);
      if (u.hp > 0) pushUnit(g, u, c.dx, c.dy, 2);
    } },
  raise_wall: { cls: 'geo', tier: 's', name: 'Raise Wall', cd: 5, icon: 'wall_mid',
    desc: 'Raise a 3-wide stone wall 1 square ahead for 6 turns. Enemies there are pushed away and take 1.',
    cast(g, c) {
      const h = H(g), ax = h.x + c.dx, ay = h.y + c.dy;
      const tiles = [[ax, ay], ...perp(c.dx, c.dy).map(([px, py]) => [ax + px, ay + py])];
      for (const [x, y] of tiles) {
        const u = enemyAt(g, x, y);
        if (u) { hit(g, u, 1 + c.P); if (u.hp > 0) pushUnit(g, u, c.dx, c.dy, 1); }
        placeTempWall(g, x, y, 6 + c.lv);
      }
      aoe(g, tiles, '#c8a26b');
    } },
  stone_skin: { cls: 'geo', tier: 's', name: 'Stone Skin', cd: 5, icon: 'column',
    desc: 'Gain 2 Block.',
    cast(g, c) { H(g).block += 2 + c.lv; emit(g, { t: 'text', x: H(g).x, y: H(g).y, s: '+BLOCK', c: '#c8a26b' }); } },
  quake: { cls: 'geo', tier: 'b', name: 'Quake', cd: 6, icon: 'weapon_big_hammer',
    desc: 'All enemies within 2 squares take 1 and are stunned.',
    cast(g, c) { SPELLS.earthshaker.cast(g, c); } },
  tremor: { cls: 'geo', tier: 'b', name: 'Tremor', cd: 3, icon: 'floor_ladder',
    desc: 'Push every adjacent enemy (incl. diagonal) 2 squares away.',
    cast(g, c) {
      const h = H(g); aoe(g, around8(h.x, h.y), '#c8a26b');
      KING.forEach(([dx, dy]) => { const u = enemyAt(g, h.x + dx, h.y + dy); if (u) pushUnit(g, u, dx, dy, 2 + c.lv); });
    } },
  earth_spike: { cls: 'geo', tier: 'b', name: 'Earth Spike', cd: 3, icon: 'floor_spikes_anim',
    desc: 'The nearest enemy within 4 takes 2.',
    cast(g, c) { const h = H(g), u = nearestEnemy(g, h.x, h.y, 4); if (!u) return; aoe(g, [[u.x, u.y]], '#c8a26b'); hit(g, u, 2 + c.P); } },
  sinkhole: { cls: 'geo', tier: 'b', name: 'Sinkhole', cd: 6, icon: 'hole',
    desc: 'The square 2 ahead collapses into a pit. An enemy there falls (bosses take 3).',
    cast(g, c) {
      const h = H(g), x = h.x + c.dx * 2, y = h.y + c.dy * 2;
      if (!inb(g, x, y) || tile(g, x, y) === T.WALL || spellAt(g, x, y)) return;
      const u = enemyAt(g, x, y);
      if (u && u.boss) { hit(g, u, 3 + c.P); return; }
      setTile(g, x, y, T.PIT); delete g.fx.wall[key(x, y)];
      aoe(g, [[x, y]], '#5a3a1a');
      if (u) { emit(g, { t: 'fall', x, y }); damageUnit(g, u, 999, null, 'collide'); }
    } },
  landslide: { cls: 'geo', tier: 'l', name: 'Landslide', cd: 6, icon: 'wall_hole_2',
    desc: 'Every enemy in your row and column is shoved 3 squares away from you.',
    cast(g, c) {
      const h = H(g);
      for (const [dx, dy] of ORTH) enemiesInRay(g, h.x, h.y, dx, dy).reverse().forEach((u) => pushUnit(g, u, dx, dy, 3 + c.lv));
      aoe(g, ORTH.flatMap(([dx, dy]) => ray(g, h.x, h.y, dx, dy)), '#c8a26b');
    } },
  geode: { cls: 'geo', tier: 'l', name: 'Geode', cd: 6, icon: 'flask_big_blue',
    desc: 'Grow a crystal turret ahead (3 HP, 6 turns). Each turn it shoots the first enemy in each direction for 1.',
    cast(g, c) {
      const h = H(g), x = h.x + c.dx, y = h.y + c.dy;
      if (!standable(g, x, y) || occupied(g, x, y)) return;
      makeUnit(g, 'geode', x, y, 'ally', { hp: 3, life: 6 + c.lv });
    } },
  fissure: { cls: 'geo', tier: 'l', name: 'Fissure', cd: 6, icon: 'edge_down',
    desc: 'Every enemy in a line (range 5) takes 2 and is stunned.',
    cast(g, c) { const { us } = pierce(g, c, 5, 2 + c.P, '#c8a26b'); us.forEach((u) => { if (u.hp > 0) u.stun = Math.max(u.stun, 1); }); } },
  tectonic_shift: { cls: 'geo', tier: 'l', name: 'Tectonic Shift', cd: 7, icon: 'doors_leaf_closed',
    desc: 'Every enemy on the floor slides 2 squares in the direction you moved.',
    cast(g, c) {
      const us = enemies(g).sort((a, b) => (b.x - a.x) * c.dx + (b.y - a.y) * c.dy);
      us.forEach((u) => pushUnit(g, u, c.dx, c.dy, 2 + c.lv));
    } },

  // ======================= SHADOWBLADE =======================
  shuriken: { cls: 'shadow', tier: 's', name: 'Shuriken', cd: 2, icon: 'weapon_throwing_axe',
    desc: 'First enemy in a line takes 1, then it bounces to the nearest other enemy for 1.',
    cast(g, c) {
      const u = shootFirst(g, c, 99, 1 + c.P, '#b18cff');
      if (!u) return;
      const v = nearestEnemy(g, u.x, u.y, 4, u);
      if (v) { bolt(g, [u.x, u.y], [v.x, v.y], '#b18cff'); hit(g, v, 1 + c.P); }
    } },
  shadowstep: { cls: 'shadow', tier: 's', name: 'Shadowstep', cd: 3, icon: 'lizard_m_idle_anim',
    desc: 'Teleport behind the first enemy in a line (range 5) and stun it.',
    cast(g, c) {
      const h = H(g), u = firstEnemyInRay(g, h.x, h.y, c.dx, c.dy, 5);
      if (!u) return;
      u.stun = Math.max(u.stun, 1 + c.lv);
      const bx = u.x + c.dx, by = u.y + c.dy;
      if (standable(g, bx, by) && !occupied(g, bx, by) && tile(g, bx, by) !== T.LAVA) c.moveHero(bx, by, c.dx, c.dy, true);
    } },
  swap: { cls: 'shadow', tier: 's', name: 'Swap', cd: 3, icon: 'doors_leaf_open',
    desc: 'Swap places with the first enemy in a line. It is stunned.',
    cast(g, c) {
      const h = H(g), u = firstEnemyInRay(g, h.x, h.y, c.dx, c.dy);
      if (!u || u.boss) return;
      const ox = h.x, oy = h.y, ux = u.x, uy = u.y;
      emit(g, { t: 'move', id: u.id, from: [ux, uy], to: [ox, oy], push: true });
      u.x = ox; u.y = oy; u.stun = Math.max(u.stun, 1 + c.lv);
      c.moveHero(ux, uy, c.dx, c.dy, false);
    } },
  smoke: { cls: 'shadow', tier: 's', name: 'Smoke', cd: 5, icon: 'wall_fountain_top_1',
    desc: 'Vanish for 2 turns: enemies cannot attack or track you.',
    cast(g, c) { H(g).invis = Math.max(H(g).invis, 2 + c.lv); aoe(g, around8(H(g).x, H(g).y), '#666'); } },
  fan_of_knives: { cls: 'shadow', tier: 'b', name: 'Fan of Knives', cd: 4, icon: 'weapon_knife',
    desc: 'The first enemy in each of the 4 directions takes 1.',
    cast(g, c) { ORTH.forEach(([dx, dy]) => shootFirst(g, { ...c, dx, dy }, 99, 1 + c.P, '#b18cff')); } },
  poison_edge: { cls: 'shadow', tier: 'b', name: 'Poison Edge', cd: 4, icon: 'flask_green',
    desc: 'All 8 surrounding enemies are poisoned for 3 (1 damage per turn).',
    cast(g, c) {
      const h = H(g); aoe(g, around8(h.x, h.y), '#7dff6b');
      around8(h.x, h.y).forEach(([x, y]) => { const u = enemyAt(g, x, y); if (u) u.poison += 3 + c.P; });
    } },
  caltrops: { cls: 'shadow', tier: 'b', name: 'Caltrops', cd: 4, icon: 'floor_spikes_anim',
    desc: 'Scatter caltrops on 3 squares ahead in a line: 1 damage and root when stepped on.',
    cast(g, c) {
      const h = H(g);
      for (const [x, y] of ray(g, h.x, h.y, c.dx, c.dy, 3)) {
        const u = enemyAt(g, x, y);
        if (u) { hit(g, u, 1 + c.P); if (u.hp > 0) u.root = Math.max(u.root, 1); }
        else if (standable(g, x, y)) g.fx.trap[key(x, y)] = { type: 'caltrop' };
      }
    } },
  decoy: { cls: 'shadow', tier: 'b', name: 'Decoy', cd: 6, icon: 'lizard_f_idle_anim',
    desc: 'Leave a decoy (3 HP, 5 turns) on the square ahead. Enemies prefer to chase and hit it.',
    cast(g, c) {
      const h = H(g), x = h.x + c.dx, y = h.y + c.dy;
      const spot = standable(g, x, y) && !occupied(g, x, y) ? [x, y] : null;
      if (spot) makeUnit(g, 'decoy', spot[0], spot[1], 'ally', { hp: 3 + c.lv, life: 5 });
    } },
  assassinate: { cls: 'shadow', tier: 'l', name: 'Assassinate', cd: 5, icon: 'weapon_katana',
    desc: 'First enemy in a line within 2: 5 damage if it is stunned or rooted, otherwise 2.',
    cast(g, c) {
      const h = H(g), u = firstEnemyInRay(g, h.x, h.y, c.dx, c.dy, 2);
      aoe(g, ray(g, h.x, h.y, c.dx, c.dy, 2), '#b18cff');
      if (u) hit(g, u, (u.stun > 0 || u.root > 0 ? 5 : 2) + c.P);
    } },
  garrote: { cls: 'shadow', tier: 'l', name: 'Garrote', cd: 4, icon: 'weapon_machete',
    desc: 'Enemy in front takes 1 and is stunned 2 turns.',
    cast(g, c) {
      const h = H(g), u = enemyAt(g, h.x + c.dx, h.y + c.dy);
      aoe(g, [[h.x + c.dx, h.y + c.dy]], '#b18cff');
      if (u) { hit(g, u, 1 + c.P); if (u.hp > 0) u.stun = Math.max(u.stun, 2); }
    } },
  mirror_step: { cls: 'shadow', tier: 'l', name: 'Mirror Step', cd: 4, icon: 'flask_big_blue',
    desc: 'Teleport onto the farthest spell on the board and cast it (same direction).',
    cast(g, c) {
      const h = H(g);
      const far = g.board.slice().sort((a, b) => manhattan(b.x, b.y, h.x, h.y) - manhattan(a.x, a.y, h.x, h.y))
        .find((b) => !unitAt(g, b.x, b.y));
      if (far) c.moveHero(far.x, far.y, c.dx, c.dy, true);
    } },
  death_mark: { cls: 'shadow', tier: 'l', name: 'Death Mark', cd: 6, icon: 'skull',
    desc: 'Every enemy in a line is Marked (+1 damage taken) and poisoned 2.',
    cast(g, c) { const { us } = pierce(g, c, 99, 0, '#b18cff'); us.forEach((u) => { u.mark = 1; u.poison += 2 + c.P; }); } },

  // ======================= HEXER =======================
  bone_spear: { cls: 'hexer', tier: 's', name: 'Bone Spear', cd: 3, icon: 'weapon_spear',
    desc: 'Every enemy in a line (range 4) takes 1; the first takes 1 more.',
    cast(g, c) { const { us } = pierce(g, c, 4, 1 + c.P, '#e8e0c8'); if (us[0] && us[0].hp > 0) hit(g, us[0], 1); } },
  life_drain: { cls: 'hexer', tier: 's', name: 'Life Drain', cd: 4, icon: 'flask_red',
    desc: 'The nearest enemy within 3 takes 1. You heal 1.',
    cast(g, c) {
      const h = H(g), u = nearestEnemy(g, h.x, h.y, 3);
      if (!u) return;
      bolt(g, [u.x, u.y], [h.x, h.y], '#ff4d6d');
      hit(g, u, 1 + c.P); healHero(g, 1);
    } },
  raise_dead: { cls: 'hexer', tier: 's', name: 'Raise Dead', cd: 5, icon: 'skelet_idle_anim',
    desc: 'Up to 2 corpses within 4 rise as skeleton allies (2 HP). They fight for you.',
    cast(g, c) {
      const h = H(g);
      const cs = Object.keys(g.fx.corpse).map((k) => k.split(',').map(Number))
        .filter(([x, y]) => manhattan(x, y, h.x, h.y) <= 4 && !occupied(g, x, y))
        .sort((a, b) => manhattan(a[0], a[1], h.x, h.y) - manhattan(b[0], b[1], h.x, h.y));
      cs.slice(0, 2 + c.lv).forEach(([x, y]) => {
        delete g.fx.corpse[key(x, y)];
        makeUnit(g, 'thrall', x, y, 'ally', { hp: 2 });
        aoe(g, [[x, y]], '#7de0c8');
      });
    } },
  curse: { cls: 'hexer', tier: 's', name: 'Curse', cd: 4, icon: 'skull',
    desc: 'First enemy in a line takes 1 and is Cursed 3 turns (takes double damage).',
    cast(g, c) { const u = shootFirst(g, c, 99, 1 + c.P, '#7de0c8'); if (u && u.hp > 0) u.curse = Math.max(u.curse, 3 + c.lv); } },
  corpse_explosion: { cls: 'hexer', tier: 'b', name: 'Corpse Explosion', cd: 5, icon: 'bomb_f1',
    desc: 'Every corpse on the floor explodes: 2 damage to its 8 neighbours.',
    cast(g, c) {
      const cs = Object.keys(g.fx.corpse).map((k) => k.split(',').map(Number));
      g.fx.corpse = {};
      for (const [cx, cy] of cs) {
        const tiles = around8(cx, cy);
        aoe(g, tiles, '#7de0c8');
        tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 2 + c.P));
      }
    } },
  bone_wall: { cls: 'hexer', tier: 'b', name: 'Bone Wall', cd: 4, icon: 'skull',
    desc: 'A 3-wide wall of bone 1 square ahead for 4 turns.',
    cast(g, c) {
      const h = H(g), ax = h.x + c.dx, ay = h.y + c.dy;
      const tiles = [[ax, ay], ...perp(c.dx, c.dy).map(([px, py]) => [ax + px, ay + py])];
      tiles.forEach(([x, y]) => placeTempWall(g, x, y, 4 + c.lv));
      aoe(g, tiles, '#e8e0c8');
    } },
  soul_swap: { cls: 'hexer', tier: 'b', name: 'Soul Swap', cd: 4, icon: 'doors_leaf_open',
    desc: 'Swap places with the farthest enemy; it takes 2.',
    cast(g, c) {
      const h = H(g);
      const u = enemies(g).filter((v) => !v.boss).sort((a, b) => manhattan(b.x, b.y, h.x, h.y) - manhattan(a.x, a.y, h.x, h.y))[0];
      if (!u) return;
      const ox = h.x, oy = h.y, ux = u.x, uy = u.y;
      emit(g, { t: 'move', id: u.id, from: [ux, uy], to: [ox, oy], push: true });
      u.x = ox; u.y = oy;
      hit(g, u, 2 + c.P);
      c.moveHero(ux, uy, c.dx, c.dy, false);
    } },
  wither: { cls: 'hexer', tier: 'b', name: 'Wither', cd: 6, icon: 'flask_big_green',
    desc: 'Every enemy takes 1 (cursed enemies take double, as usual).',
    cast(g, c) { const us = enemies(g); aoe(g, us.map((u) => [u.x, u.y]), '#7de0c8'); us.forEach((u) => hit(g, u, 1 + c.P)); } },
  grave_grasp: { cls: 'hexer', tier: 'l', name: 'Grave Grasp', cd: 5, icon: 'wall_hole_1',
    desc: 'Enemies within 2 of a corpse (or of you) are rooted 3 and stunned 1.',
    cast(g, c) {
      const h = H(g);
      const srcs = [[h.x, h.y], ...Object.keys(g.fx.corpse).map((k) => k.split(',').map(Number))];
      const us = enemies(g).filter((u) => srcs.some(([x, y]) => manhattan(x, y, u.x, u.y) <= 2));
      aoe(g, us.map((u) => [u.x, u.y]), '#7de0c8');
      us.forEach((u) => { u.root = Math.max(u.root, 3); u.stun = Math.max(u.stun, 1 + c.lv); });
    } },
  dark_pact: { cls: 'hexer', tier: 'l', name: 'Dark Pact', cd: 6, icon: 'flask_big_red',
    desc: 'Lose 1 HP. All your other spells finish recharging instantly.',
    cast(g, c) { hurtHero(g, 1, null, 'self'); g.recharge.forEach((r) => (r.t = 0)); g.pactNow = true; } },
  plague: { cls: 'hexer', tier: 'l', name: 'Plague', cd: 6, icon: 'flask_green',
    desc: 'Every enemy is poisoned 2.',
    cast(g, c) { const us = enemies(g); aoe(g, us.map((u) => [u.x, u.y]), '#7dff6b'); us.forEach((u) => (u.poison += 2 + c.P)); } },
  lich_form: { cls: 'hexer', tier: 'l', name: 'Lich Form', cd: 9, icon: 'necromancer_anim',
    desc: 'For 4 turns your bump attacks deal 3 and heal you 1.',
    cast(g, c) { H(g).lich = 4 + c.lv; emit(g, { t: 'text', x: H(g).x, y: H(g).y, s: 'LICH FORM', c: '#7de0c8' }); } },
};

export const spellsOf = (cls) => Object.keys(SPELLS).filter((id) => SPELLS[id].cls === cls);
export const spellCd = (g, id, lv) => Math.max(1, SPELLS[id].cd - (lv ? 1 : 0) - (g.hero.relics.includes('hourglass') ? 1 : 0));
