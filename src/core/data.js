// Static game data: tiles, classes, enemies, biomes, relics, blessings, depth modifiers.

export const T = { FLOOR: 0, WALL: 1, PIT: 2, SPIKES: 3, ICE: 4, LAVA: 5 };

export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
export const DIR_NAMES = Object.keys(DIRS);
export const ORTH = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIAG = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
export const KING = [...ORTH, ...DIAG];
export const KNIGHT = [[1, -2], [2, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2]];

export const CLASSES = {
  knight: {
    name: 'Knight', sprite: 'knight_m', hp: 7,
    role: 'Ranged guardian: thrown shields, lances and holy light.', color: '#c9d4e8',
    passive: 'Steel — the first hit you take each floor is blocked.',
    unlock: null,
    starters: ['shield_throw', 'smite', 'holy_nova', 'bulwark'],
  },
  pyro: {
    name: 'Pyromancer', sprite: 'wizzard_m', hp: 4, color: '#ff8a3d',
    passive: 'Kindling — spell kills set the ground ablaze. You are immune to fire.',
    unlock: { kind: 'reachFloor', n: 4, text: 'Reach floor 4' },
    starters: ['firebolt', 'flame_wave', 'fire_ring', 'heat_shield'],
  },
  ranger: {
    name: 'Ranger', sprite: 'elf_f', hp: 9, color: '#8fd16a',
    passive: 'Steady Aim — after waiting or a quiet step (over a recharging tile), your next spell deals +1.',
    unlock: { kind: 'kills', n: 60, text: 'Slay 60 enemies (all runs)' },
    starters: ['arrow', 'hawk', 'volley', 'piercing_shot'],
  },
  geo: {
    name: 'Geomancer', sprite: 'dwarf_m', hp: 7, color: '#c8a26b',
    passive: 'Stoneblood — enemies you knock into walls or foes take +1.',
    unlock: { kind: 'boss', id: 'bone_tyrant', text: 'Defeat the Bone Tyrant' },
    starters: ['boulder', 'stone_fist', 'earth_spike', 'tremor'],
  },
  shadow: {
    name: 'Shadowblade', sprite: 'lizard_m', hp: 5, color: '#b18cff',
    passive: 'Backstab — your spells deal +2 to stunned or rooted enemies.',
    unlock: { kind: 'perfectFloor', text: 'Clear a floor without taking damage' },
    starters: ['shuriken', 'shadowstep', 'swap', 'fan_of_knives'],
  },
  hexer: {
    name: 'Hexer', sprite: 'wizzard_f', hp: 5, color: '#7de0c8',
    passive: 'Harvest — foes leave corpses. Step on a corpse to heal 1 (once per floor).',
    unlock: { kind: 'boss', id: 'orc_warlord', text: 'Defeat the Orc Warlord' },
    starters: ['bone_spear', 'life_drain', 'raise_dead', 'curse'],
  },
};
export const CLASS_ORDER = ['knight', 'pyro', 'ranger', 'geo', 'shadow', 'hexer'];

// pattern: threat shape. move: step set. speed: steps per turn.
export const ENEMIES = {
  skeleton: { name: 'Skeleton', sprite: 'skelet_idle', hp: 2, dmg: 1, pattern: 'orth1', move: 'orth', cost: 1,
    desc: 'Hits the 4 orthogonal squares.' },
  zombie: { name: 'Zombie', sprite: 'tiny_zombie_idle', hp: 3, dmg: 1, pattern: 'orth1', move: 'orth', slow: true, cost: 1.3,
    desc: 'Slow: acts every other turn. Tough.' },
  imp: { name: 'Imp', sprite: 'imp_idle', hp: 1, dmg: 1, pattern: 'diag1', move: 'diag', cost: 0.9,
    desc: 'Moves and strikes diagonally, like a bishop.' },
  caster: { name: 'Bone Caster', sprite: 'necromancer', hp: 2, dmg: 1, pattern: 'line', range: 4, move: 'orth', ranged: true, cost: 1.8,
    desc: 'Fires bolts along rows and columns (range 4). Walls and bodies block.' },
  slug: { name: 'Slug', sprite: 'slug', hp: 3, dmg: 1, pattern: 'orth1', move: 'orth', slime: true, cost: 1.4,
    desc: 'Leaves slime. Spells on slimed tiles fizzle when you step on them.' },
  spitter: { name: 'Spitter', sprite: 'swampy', hp: 2, dmg: 1, pattern: 'lob2', move: 'orth', ranged: true, cost: 1.8,
    desc: 'Lobs acid at squares exactly 2 away (orthogonal), over obstacles.' },
  mudling: { name: 'Mudling', sprite: 'muddy', hp: 3, dmg: 1, pattern: 'orth1', move: 'orth', split: true, cost: 2.3,
    desc: 'Splits into two Slimelings when slain.' },
  slimeling: { name: 'Slimeling', sprite: 'tiny_slug', hp: 1, dmg: 1, pattern: 'orth1', move: 'orth', cost: 0.5,
    desc: 'Small, but it still bites.' },
  frost: { name: 'Frost Zombie', sprite: 'ice_zombie', hp: 3, dmg: 1, pattern: 'orth1', move: 'orth', icy: true, cost: 1.4,
    desc: 'Freezes the ground it leaves. Ice makes you slide.' },
  wraith: { name: 'Wraith', sprite: 'angel_idle', hp: 2, dmg: 1, pattern: 'knight', move: 'knight', cost: 1.9, tint: '#9fd8ff',
    desc: 'Leaps and strikes in L-shapes, like a chess knight.' },
  goblin: { name: 'Goblin', sprite: 'goblin_idle', hp: 1, dmg: 1, pattern: 'orth1', move: 'orth', speed: 2, eater: true, cost: 1.1,
    desc: 'Fast (2 steps). Spoils every spell tile it walks over.' },
  orc: { name: 'Orc Warrior', sprite: 'orc_warrior_idle', hp: 3, dmg: 2, pattern: 'charge', range: 2, move: 'orth', cost: 2.1,
    desc: 'Charges along a clear line (range 2) and hits for 2.' },
  masked: { name: 'Masked Orc', sprite: 'masked_orc_idle', hp: 2, dmg: 1, pattern: 'orth1', move: 'orth', shield: true, cost: 1.6,
    desc: 'Shield: immune to damage coming from the side it faces.' },
  shaman: { name: 'Orc Shaman', sprite: 'orc_shaman_idle', hp: 2, dmg: 0, pattern: 'none', move: 'orth', healer: true, cost: 1.8,
    desc: 'Heals the most wounded ally by 1 every other turn. Keeps away.' },
  chort: { name: 'Chort', sprite: 'chort_idle', hp: 2, dmg: 1, pattern: 'king', move: 'king', cost: 1.6,
    desc: 'Threatens all 8 neighbours, like a king.' },
  wogol: { name: 'Wogol', sprite: 'wogol_idle', hp: 2, dmg: 1, pattern: 'orth1', move: 'orth', explode: true, cost: 1.5,
    desc: 'Explodes when slain, hitting all 8 neighbours.' },
  shade: { name: 'Shade', sprite: 'chort_idle', hp: 1, dmg: 1, pattern: 'king', move: 'phase', cost: 1, tint: '#333',
    desc: 'Born of the Dark when you linger. Drifts through walls.' },
  // Bosses
  bone_tyrant: { name: 'Bone Tyrant', sprite: 'big_zombie_idle', hp: 11, dmg: 2, pattern: 'orth1', move: 'orth', boss: true, big: true,
    desc: 'Raises skeletons every 4th turn.' },
  mother_slug: { name: 'Mother Slug', sprite: 'slug', hp: 12, dmg: 2, pattern: 'orth1', move: 'orth', boss: true, big: true, slime: true,
    desc: 'Lobs slime bombs (3x3). Splits at half health.' },
  frost_colossus: { name: 'Frost Colossus', sprite: 'ice_zombie', hp: 13, dmg: 2, pattern: 'king', move: 'orth', boss: true, big: true, icy: true,
    desc: 'Slams a 3x3 area every 3rd turn.' },
  orc_warlord: { name: 'Orc Warlord', sprite: 'ogre_idle', hp: 15, dmg: 3, pattern: 'orth1', move: 'orth', boss: true, big: true,
    desc: 'Telegraphs long charges. Calls goblins.' },
  pit_lord: { name: 'Pit Lord', sprite: 'big_demon_idle', hp: 18, dmg: 2, pattern: 'king', move: 'orth', boss: true, big: true,
    desc: 'Rains fire on whole rows and columns. Summons imps.' },
};

export const ALLIES = {
  thrall: { name: 'Thrall', sprite: 'skelet_idle', tint: '#7de0c8', desc: 'Raised skeleton. Attacks adjacent enemies for 1.' },
  geode: { name: 'Geode', sprite: 'flask_big_blue', desc: 'Crystal turret. Shoots in 4 directions.' },
  decoy: { name: 'Decoy', sprite: 'lizard_m_idle', tint: '#555', desc: 'Enemies prefer to attack it.' },
};

export const BIOMES = {
  crypt: { name: 'Forgotten Crypt', boss: 'bone_tyrant', tint: null, floorTint: '#000000',
    roster: [['skeleton', 1], ['zombie', 1], ['imp', 1], ['caster', 2]], hazards: { spikes: 0.06 } },
  swamp: { name: 'Rot Swamp', boss: 'mother_slug', floorTint: '#2f6b2a',
    roster: [['slug', 1], ['spitter', 1], ['mudling', 2], ['imp', 1]], hazards: {}, slimeStart: 3 },
  frozen: { name: 'Frozen Vault', boss: 'frost_colossus', floorTint: '#3d6fa8',
    roster: [['frost', 1], ['wraith', 1], ['skeleton', 1], ['caster', 2]], hazards: { ice: 0.14 } },
  warrens: { name: 'Orc Warrens', boss: 'orc_warlord', floorTint: '#7a5228',
    roster: [['goblin', 1], ['orc', 1], ['masked', 2], ['shaman', 2]], hazards: { spikes: 0.08 } },
  inferno: { name: 'Infernal Pit', boss: 'pit_lord', floorTint: '#8a1f12',
    roster: [['chort', 1], ['wogol', 1], ['imp', 1], ['wraith', 2], ['orc', 2]], hazards: { burn: 4 } },
};

export const RELICS = {
  iron_heart: { name: 'Iron Heart', desc: '+2 max HP (and heal 2).', base: true, icon: 'flask_big_red' },
  echo_stone: { name: 'Echo Stone', desc: 'The first spell you cast each floor casts twice.', base: true, icon: 'flask_big_blue' },
  hourglass: { name: 'Hourglass', desc: 'All spell cooldowns -1 (min 1).', base: true, icon: 'flask_yellow' },
  vampire_fang: { name: 'Vampire Fang', desc: 'Every 4th kill heals 1.', base: true, icon: 'flask_red' },
  thorn_mail: { name: 'Thorn Mail', desc: 'Enemies that hit you in melee take 1.', base: true, icon: 'weapon_baton_with_spikes' },
  extra_pocket: { name: 'Extra Pocket', desc: '+1 deck slot.', base: true, icon: 'chest_full_open_anim' },
  glass_lens: { name: 'Glass Lens', desc: 'Spells deal +1 damage. Max HP -2.', base: false, icon: 'flask_big_yellow' },
  swift_boots: { name: 'Swift Boots', desc: 'Swift bonus threshold +6 turns; the Dark arrives later.', base: false, icon: 'flask_green' },
  lucky_coin: { name: 'Lucky Coin', desc: '+1 option in every spell draft.', base: false, icon: 'coin_anim' },
  ember_heart: { name: 'Ember Heart', desc: '+1 Ember per floor cleared.', base: false, icon: 'flask_big_green' },
  spiked_boots: { name: 'Spiked Boots', desc: 'Spikes and burning ground no longer hurt you; spikes hurt enemies +1.', base: false, icon: 'floor_spikes_anim' },
  phylactery: { name: 'Phylactery', desc: 'Once per run, survive a lethal blow at 1 HP.', base: false, icon: 'skull' },
};

export const BLESSINGS = {
  vigor1: { name: 'Vigor I', desc: '+1 max HP for every hero.', cost: 15 },
  vigor2: { name: 'Vigor II', desc: '+1 more max HP.', cost: 30, req: 'vigor1' },
  insight: { name: 'Insight', desc: '+1 option in every spell draft.', cost: 25 },
  reroll: { name: 'Reroll', desc: 'Reroll one spell draft per run.', cost: 20 },
  second_wind: { name: 'Second Wind', desc: 'Heal +1 more between floors.', cost: 30 },
};

export const DEPTH_MODS = [
  null,
  { text: '+1 enemy budget per floor' },
  { text: 'Elites: some enemies have +1 HP' },
  { text: 'Par is 4 turns shorter' },
  { text: 'Heal 1 less between floors' },
  { text: 'Bosses have +25% HP' },
  { text: 'Goblins lurk on every floor' },
  { text: 'Spell drafts offer 1 fewer option' },
  { text: 'The Dark spawns every 3 turns' },
  { text: 'Start with only 3 spells' },
  { text: 'Hero has -1 max HP' },
];

// Tuning knobs (overridable in tools/sim.js with --set BALANCE.x=y)
export const BALANCE = {
  capBase: 4, capSlope: 1.3, // max starting enemies = capBase + capSlope * floor
  budMul: 1.6, budSlope: 0.3, // budget multiplier = budMul + budSlope * floor
  reinfBase: 3, reinfEvery: 2, reinfSlope: 0.6, // reinforcements per floor = reinfBase + reinfSlope * floor
  waitCast: 1, // 1 = waiting re-casts your recharged tile
  bossHpMul: 1.5, eliteChance: 0.4, // HP multiplier for bosses; chance an enemy is elite (+1 HP) at depth 0
};

export const FLOORS_PER_BIOME = 3;
export const TOTAL_FLOORS = 12;
