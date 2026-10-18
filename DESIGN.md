# MoveCasters — Game Design

> A tactical roguelite where **your deck is the dungeon floor**. You move one hero in 4 directions,
> chess-style. Every spell in your deck lies on a tile. **Step on it and you cast it — in the direction you moved.**

## 1. Pillars

1. **Every step is a spell.** The whole floor is tiled with your deck. There is no melee and no empty ground:
   every move casts the spell under your feet, in the direction you moved. Routing *is* fighting.
2. **Approach angle matters.** The same Firebolt is useless or lethal depending on whether you walked in from the left or from below.
3. **Short, deep, fair.** Floors take 1–3 minutes. All enemy behaviour is deterministic and telegraphed (chess-like threat squares).
4. **Builds, not grinding.** Meta-unlocks widen your options (spells, heroes, relics, challenge tiers), not raw power.

## 2. Core loop

```
Run start → pick hero → Floor 1..12 (4 biomes x 3 floors, 3rd floor = boss)
  each floor: clear all enemies → draft 1 of 3+ spells (add / replace a deck slot / empower; Vigor +1 max HP when the pool runs dry)
  each boss: relic choice (1 of 3) + heal
Death or victory → Embers awarded → Sanctum (meta-unlocks) → new run
```

## 3. Turn structure & the spell floor

- **Open arenas**: floors are open rectangles (7x7 to 8x9) with no interior walls or pits. Every tile carries a spell.
- **Floor layout**: at floor start every tile is assigned one of your deck's spells, weighted by the spell's
  *frequency* (basic spells are common, big spells rare; every deck spell appears at least twice). Each deck slot has
  its own colour so you can read the floor at a glance.
- **Hero phase** – move 1 tile up/down/left/right, or **wait**: waiting re-casts the tile you stand on (if it has
  recharged) in the direction you last moved. Block caps at 3.
  - Moving onto a *ready* tile **casts** its spell in the movement direction; that tile then **recharges in place**
    for the spell's cooldown (a faded icon with a countdown). Spent tiles can be walked over freely — they are your "quiet" moves.
  - There is no melee. Walking into an enemy **shoves** it 1 square (no damage, no cast; bosses can't be shoved). Its
    telegraphed swing moves with it — the escape hatch when pinned against a wall.
  - If a spell moves you (Charge, Vault, Swap…) and you land on a ready tile, that tile casts too (max chain 3).
- **Enemy phase (Into the Breach style)** – each enemy, in order:
  1. **Resolves** the attack it telegraphed last turn: it strikes the marked squares, hitting *whatever* is there —
     you, your allies, or **other enemies** (friendly fire). Melee/lob intents are relative to the attacker, so if you push
     or swap it, the attack lands somewhere else. Line/charge intents fire in the marked direction from wherever it stands.
  2. **Moves** toward a square from which you are inside its attack pattern.
  3. **Telegraphs** its next attack on your current square (or line). The marked squares are shown in red with the damage.
  - Melee attackers **swing**: the target square plus the two squares beside it (relative to the attacker) — the clean
    dodge is stepping straight away. Ranged attackers (bolts, lobs, charges) hit exactly the marked square/line.
  - **Stunning an enemy cancels its telegraphed attack.** Killing it obviously does too.
- **Reinforcements (ITB vents)** – on normal floors a rumbling square is marked every 2 turns (4 + floor/3 per floor);
  an enemy emerges there at the end of the turn (paused while the board holds more than ~1 enemy per 5 squares). Standing on it (1 damage) or shoving an enemy onto it blocks the emergence.
  - Bosses telegraph big area attacks 1–2 turns ahead (orange countdowns).
- **Upkeep** – tiles recharge, burning/poison tick, spikes toggle, doom clock ticks.

### Floor overlays (biome flavour, never obstacles)
Spikes (crypt/warrens: alternate each turn, 1 dmg), slime (swamp: roots you 1 turn), ice (frozen: you slide, casting
*every* ready tile you slide across), burning ground, temporary walls/pits created by spells, traps, corpses.

Goblins **spoil** every tile they walk over (it goes on a 4-turn recharge).

### Doom clock

Each floor has a **par** (`12 + 2 x enemies` turns). There is **no healing between floors** (Blessing *Second Wind* adds 1; skipping a draft heals 1; bosses heal 2). Clear before par → **Swift** (+1 Ember, +1 draft option).
Take no damage → **Flawless** (+1 Ember). Each normal floor also has a random **Bounty** (double kill, friendly-fire kill, collision kill, chain cast, or clearing 5 under par): +1 Ember and heal 1. After par, **the Dark rises**: every 4 turns a shade spawns on a telegraphed tile. Shades fade when the last real enemy dies.
The first floor of each new biome has 25% fewer enemies (breather).

## 4. Hero classes (each has a completely different spell list)

| Class | Sprite | HP | Passive | Unlock |
|---|---|---|---|---|
| **Knight** (ranged) | knight_m | 7 | *Steel*: first hit each floor is blocked | Start |
| **Pyromancer** | wizzard_m | 4 | *Kindling*: spell kills set the ground ablaze; immune to fire | Reach floor 4 |
| **Ranger** | elf_f | 9 | *Steady Aim*: after waiting, your next spell deals +1 | Kill 60 enemies (total) |
| **Geomancer** | dwarf_m | 7 | *Stoneblood*: knocking an enemy into a wall/enemy deals +1 | Defeat the Crypt boss |
| **Shadowblade** | lizard_m | 5 | *Backstab*: spells deal +2 to stunned or rooted enemies | Clear a floor without taking damage |
| **Hexer** | wizzard_f | 5 | *Harvest*: kills leave corpses; stepping on one heals 1 (once per floor) | Defeat the Orc Warlord |

Each class has 12 spells: 4 starters (including one common *basic* spell), 4 base draftable, 4 locked behind **Grimoire** meta-unlocks.
Every spell has a cooldown and a floor frequency (1 = rare, 3 = common).
Spell list with exact numbers lives in `src/core/spells.js` (the single source of truth); summary:

- **Knight** (ranged: thrown shields, lances, holy light) – Shield Throw, Smite, Lance, Bulwark | Charge, Holy Nova, Javelin Volley, Rally | Taunt, Riposte, Judgement, Execute
- **Pyromancer** – Firebolt, Flame Wave, Fire Ring, Heat Shield | Meteor, Inferno Line, Blink Flare, Combustion | Cinder Storm, Magma Wall, Phoenix Feather, Pyroclasm
- **Ranger** – Arrow, Hawk, Volley, Piercing Shot | Vault, Bear Trap, Snare Net, Windstep | Ricochet, Rain of Arrows, Smoke Bomb, Mark Prey
- **Geomancer** – Boulder, Stone Fist, Earth Spike, Tremor | Quake, Raise Wall, Stone Skin, Sinkhole | Landslide, Geode, Fissure, Tectonic Shift
- **Shadowblade** – Shuriken, Shadowstep, Swap, Fan of Knives | Smoke, Poison Edge, Caltrops, Decoy | Assassinate, Garrote, Mirror Step, Death Mark
- **Hexer** – Bone Spear, Life Drain, Raise Dead, Curse | Corpse Explosion, Bone Wall, Soul Swap, Wither | Grave Grasp, Dark Pact, Plague, Lich Form

## 5. Enemies — chess pieces with teeth

The attack pattern is the enemy's *reach*: from where it can telegraph an attack on you. Hover an enemy to see it.
Movement uses pathfinding with the listed step style.

| Enemy | Biome | HP | Attack pattern (threat) | Move | Special |
|---|---|---|---|---|---|
| Skeleton | Crypt | 2 | 4 orthogonal neighbours (Rook-1) | 1 orth | — |
| Zombie | Crypt | 3 | orth neighbours | 1 orth every other turn | slow, tanky |
| Imp | Crypt/Inferno | 1 | 4 diagonal neighbours (Bishop-1) | 1 any | — |
| Bone Caster (necromancer) | Crypt | 2 | orth line, range 4, blocked by walls | keeps distance | ranged |
| Slug | Swamp | 3 | orth neighbours | 1 orth | leaves slime |
| Spitter (swampy) | Swamp | 2 | lobs at tiles exactly 2 away orth (jumps over things) | 1 orth | mortar |
| Mudling (muddy) | Swamp | 3 | orth neighbours | 1 orth | splits into 2 Slimelings (1hp) on death |
| Frost Zombie (ice_zombie) | Frozen | 3 | orth neighbours | 1 orth | freezes the tile it leaves (ice) |
| Wraith (angel, tinted) | Frozen | 2 | Knight-move (L shapes) | jumps like a chess knight | ignores walls |
| Goblin | Warrens | 1 | orth neighbours | 2 orth | spoils the tiles it walks on |
| Orc Warrior | Warrens | 3 | orth line up to 3 (charge, stops adjacent) | 1 orth | charging = moves to you then hits |
| Masked Orc | Warrens | 3 | orth neighbours | 1 orth | shield: immune to damage from the side it faces |
| Orc Shaman | Warrens | 2 | none | keeps distance | heals the most wounded ally 1 each turn |
| Chort | Inferno | 2 | 8 neighbours (King) | 1 orth/diag | — |
| Wogol | Inferno | 2 | orth neighbours | 1 orth | explodes on death: 1 dmg to 8 neighbours |
| Shade | any (doom) | 1 | 8 neighbours | 1 any, phases through walls | spawned by doom clock |

Bosses (32x36 sprites, occupy 1 tile but have patterns):
- **Bone Tyrant** (big_zombie, Crypt): 11 HP (×1.5), orth neighbours for 2; every 4th turn raises 1 skeleton (2 at Depth 5+).
- **Mother Slug** (slug scaled, Swamp): 12 HP, spits slime lines; splits into Mudlings at half HP.
- **Frost Colossus** (ice_zombie scaled, Frozen): 13 HP, slams a 3x3 telegraphed area every 3rd turn, otherwise moves.
- **Orc Warlord** (ogre, Warrens): 15 HP, Rook charge range 5 for 3 dmg; summons goblins.
- **Pit Lord** (big_demon, Inferno): 18 HP, King pattern, alternates fire lines (telegraphed rows/columns) and imp summons.

## 6. Biomes

| # | Biome | Floors | Hazards | Palette |
|---|---|---|---|---|
| 1 | Forgotten Crypt | 1–3 | spikes | grey stone |
| 2a | Rot Swamp | 4–6 | slime puddles, slug trails | green |
| 2b | Frozen Vault (alt. path) | 4–6 | ice patches (sliding chain-casts) | blue |
| 3 | Orc Warrens | 7–9 | spikes, spell-spoiling goblins | brown |
| 4 | Infernal Pit | 10–12 | burning ground (fire lines, wogol blasts) | red |

After the Crypt boss the player **chooses** Swamp or Frozen Vault (Frozen unlocks after first Crypt boss kill).

## 7. Relics (in-run passives, from bosses)

Iron Heart (+2 max HP), Echo Stone (first spell each floor casts twice), Hourglass (all cooldowns −1, min 1),
Vampire Fang (every 4th kill heals 1), Thorn Mail (melee attackers take 1), Extra Pocket (+1 deck slot),
Glass Lens (spell damage +1, max HP −2), Swift Boots (Swift threshold +6 turns), Lucky Coin (+1 draft option),
Ember Heart (+1 Ember per floor), Spiked Boots (walking onto spikes is safe & spikes hurt enemies +1), Phylactery (once per run, survive lethal at 1 HP).

## 8. Roguelite meta-progression (Sanctum)

Currency: **Embers** — 1 per floor cleared, +1 Swift, +3 per boss, +10 on victory, +Depth bonus.

1. **Class unlocks** – achievement-based (table in §4). Gives long-term goals beyond currency.
2. **Grimoire pages** – per class, 4 locked spells; each costs Embers (8 / 12 / 16 / 20). New spells = new builds.
3. **Relic vault** – 6 of 12 relics start locked; unlock for 10 Embers each.
4. **Blessings** (capped small power): Vigor I/II (+1 max HP each, 15/30), Insight (+1 draft option, 25),
   Reroll (1 draft reroll per run, 20), Second Wind (+1 heal between floors, 30).
5. **Frozen Vault path** – unlocked by first Crypt boss kill.
6. **Depth (ascension) 1–10** – unlocked per class by winning. Each adds a cumulative modifier:
   +1 enemy per floor · elites (+1 HP) · par −4 · less healing · bosses +25% HP · goblins everywhere · draft 2 options · doom every 3 turns · start with 3 spells · Hero −1 HP.
7. **Codex** – bestiary / spells / relics discovered, with counts. Completionist hook.
8. **Daily Descent** – same seed for everyone per date, one attempt tracked.

## 9. Stickiness / balance targets (measured by `tools/sim.js`)

We simulate thousands of runs with bots of different skill:
- `random` – random legal moves. Target: dies on floor 1–2. (Game isn't trivially winnable.)
- `greedy` – 1-ply: avoids threatened squares, walks to spells/enemies. Target: dies mostly in biomes 1–2, ~0–5% win.
- `planner` – 2-ply search with heuristic. Target: 15–35% win with base deck, median death in biome 3.

Metrics: win rate, death floor distribution (should be spread, not spiky), *close calls* (floors ended at ≤2 HP — target 20–40%
of floors for planner), *decision density* (turns where ≥2 moves are safe but differ in value), average turns/floor (target 12–30),
spells cast per floor (target ≥3 — spells must matter), damage taken per floor.
Human-like playtests are run by agents through `tools/cli.js` (text mode) and reported in `docs/playtests/`.

## 10. Tech

- Vanilla ES modules, no build step, deployed on GitHub Pages.
- `src/core/` – pure deterministic game logic (seeded RNG), runs in Node and browser.
- `src/ui/` – canvas renderer (16px art scaled), input (keys, swipe, tap), screens, meta save in localStorage.
- `tools/` – simulation/balancing bots and a text CLI.
- Art: 0x72 DungeonTileset II (CC0, itch.io) + Codex-generated spell icons & title art (see `CREDITS.md`).

## 11. Balance log

- v1 (melee, walls): planner 9.9% — Knight-only, Bone Tyrant wall.
- v2 (spell floor, old AI): planner 80% — far too easy.
- v3 (ITB telegraphs, single-square): planner 96% — one step dodges everything.
- v4 (swing telegraphs, reinforcements, budget slope, no inter-floor heal, class fixes): planner 91% after capping enemies.
- v5 (enemy ramp cap 3+1.2·floor, reinforcements 2+0.5·floor, boss HP ×1.5 and no breather after strikes, 30% elites,
  enemies avoid fire again, Knight starts with Holy Nova, Ranger 8 HP + knockback Arrow, Hexer 5 HP + Corpse Explosion
  capped at 3 corpses, Pyromancer 4 HP, Shadowstep/Swap deal 1+Backstab): planner ≈60% (classes 33–85%), deaths spread
  over all floors; greedy dies floors 1–5. The planner is superhuman (5-ply, perfect info), so a strong human should sit
  between the two bots. Tunables live in `BALANCE` (data.js).
- v6 (after 2nd playtest round): **shove** (walk into an enemy to push it 1, no damage), crowd cap for reinforcements,
  drafts always full (Vigor fallback), Hawk/Earth Spike target ahead of your step, boss minions die with the boss,
  imps may step orthogonally, Block before Steel, boss heal 3, elites 25% (none on biome-entry floors), boss HP ramps
  ×1.2→×1.5. Planner ≈75% (superhuman), greedy dies floors 1–8 (mean 4.1). Agent playtesters reached floors 3–8:
  the base game is tuned for a good human to sometimes win; Depth 1–10 is the expert ladder.
