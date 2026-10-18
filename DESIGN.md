# MoveCasters — Game Design

> A tactical roguelite where **your deck is the dungeon floor**. You move one hero in 4 directions,
> chess-style. Every spell in your deck lies on a tile. **Step on it and you cast it — in the direction you moved.**

## 1. Pillars

1. **Every step is a decision.** Enemies show their threat squares (like chess pieces). Spell tiles show where your power is. Routing between them is the game.
2. **Approach angle matters.** A spell fires in the direction you entered its tile. The same Firebolt is useless or lethal depending on whether you walked in from the left or from below.
3. **Short, deep, fair.** Floors take 1–3 minutes. All enemy behaviour is deterministic and telegraphed. Deaths should feel like *your* mistake.
4. **Builds, not grinding.** Meta-unlocks widen your options (more spells, classes, relics, challenge tiers), not raw power. Small power perks are capped.

## 2. Core loop

```
Run start → pick class → Floor 1..12 (4 biomes x 3 floors, 3rd floor = boss)
  each floor: clear all enemies → draft 1 of 3 new spells (replace a deck slot or skip) → small heal
  each boss: relic choice (1 of 3) + heal
Death or victory → Embers awarded → Sanctum (meta-unlocks) → new run
```

## 3. Turn structure

1. **Hero phase** – move 1 tile up/down/left/right, or **wait** (Space).
   - Moving into an enemy = **bump attack** (hero stays in place; damage = class bump damage).
   - Moving onto a spell tile = **cast** that spell, direction = movement direction.
   - Tiles: floor, wall, pit (hero can't enter; enemies pushed in die), spikes (toggle each turn, 1 dmg when up),
     ice (you slide until something stops you — sliding over spell tiles casts them!), lava (2 dmg),
     slime (entering it roots you for 1 turn), bones/corpse (decoration; Hexer uses them).
2. **Enemy phase** – each enemy, in order: **if the hero is inside its attack pattern → attack. Otherwise move.**
   Never both (except bosses with explicit 2-step patterns). This makes danger 100% readable:
   the board shades every square that is currently threatened, with a number when multiply threatened.
3. **Upkeep** – spell cooldowns tick, burning/poison tick, spikes toggle, doom clock ticks.

### Spell tiles (the deck on the board)

- Deck = 4 spells at start, max 5 slots (relics can add a 6th).
- Floor start: each spell is placed on a random free tile (not adjacent to hero, not under enemies).
- When cast, the spell leaves the board and **recharges** for its cooldown (2–8 turns). Its return tile is chosen
  immediately and shown as a ghost tile with a countdown, so you can plan your route to it.
- Enemies walking over spell tiles don't trigger them. **Goblins eat them** (sending them back to recharge +3).

### Doom clock

Each floor has a **par** (`14 + 2 x enemies` turns). Clear before par → **Swift** bonus (+1 Ember, +1 draft option).
After par, **the Dark rises**: every 4 turns a shade spawns on a telegraphed tile. Stalling is never optimal.

## 4. Hero classes (each has a completely different spell list)

| Class | Sprite | HP | Bump | Passive | Unlock |
|---|---|---|---|---|---|
| **Knight** | knight_m | 8 | 2 | *Steel*: first hit each floor is blocked | Start |
| **Pyromancer** | wizzard_m | 5 | 1 | *Kindling*: enemies killed by spells leave a burning tile | Reach floor 4 |
| **Ranger** | elf_f | 6 | 1 | *Steady Aim*: after waiting, your next spell deals +1 | Kill 60 enemies (total) |
| **Geomancer** | dwarf_m | 7 | 1 | *Stoneblood*: pushing an enemy into a wall/enemy deals +1 collision dmg | Defeat the Crypt boss |
| **Shadowblade** | lizard_m | 5 | 1 | *Backstab*: bumps vs stunned/rooted enemies deal 3 | Clear a floor without taking damage |
| **Hexer** | wizzard_f | 6 | 1 | *Harvest*: kills leave corpses; walking onto a corpse heals 1 (max once per floor) | Defeat the Orc Warlord |

Each class has 12 spells: 4 starters, 4 base draftable, 4 locked behind **Grimoire** meta-unlocks.
Spell list with exact numbers lives in `src/core/spells.js` (the single source of truth); summary:

- **Knight** – Cleave, Charge, Shield Bash, Bulwark | Whirlwind, Lance, Rally, Taunt | Riposte, Earthshaker, Execute, Valor
- **Pyromancer** – Firebolt, Flame Wave, Fire Ring, Heat Shield | Meteor, Inferno Line, Blink Flare, Combustion | Cinder Storm, Magma Wall, Phoenix Feather, Pyroclasm
- **Ranger** – Arrow, Vault, Bear Trap, Piercing Shot | Volley, Hawk, Snare Net, Windstep | Ricochet, Rain of Arrows, Smoke Bomb, Mark Prey
- **Geomancer** – Boulder, Stone Fist, Raise Wall, Stone Skin | Quake, Tremor, Earth Spike, Sinkhole | Landslide, Geode, Fissure, Tectonic Shift
- **Shadowblade** – Shuriken, Shadowstep, Swap, Smoke | Fan of Knives, Poison Edge, Caltrops, Decoy | Assassinate, Garrote, Mirror Step, Death Mark
- **Hexer** – Bone Spear, Life Drain, Raise Dead, Curse | Corpse Explosion, Bone Wall, Soul Swap, Wither | Grave Grasp, Dark Pact, Plague, Lich Form

## 5. Enemies — chess pieces with teeth

Attack patterns are shown as threat squares. Movement uses pathfinding with the listed step style.

| Enemy | Biome | HP | Attack pattern (threat) | Move | Special |
|---|---|---|---|---|---|
| Skeleton | Crypt | 2 | 4 orthogonal neighbours (Rook-1) | 1 orth | — |
| Zombie | Crypt | 3 | orth neighbours | 1 orth every other turn | slow, tanky |
| Imp | Crypt/Inferno | 1 | 4 diagonal neighbours (Bishop-1) | 1 diag | — |
| Bone Caster (necromancer) | Crypt | 2 | orth line, range 4, blocked by walls | keeps distance | ranged |
| Slug | Swamp | 3 | orth neighbours | 1 orth | leaves slime |
| Spitter (swampy) | Swamp | 2 | lobs at tiles exactly 2 away orth (jumps over things) | 1 orth | mortar |
| Mudling (muddy) | Swamp | 3 | orth neighbours | 1 orth | splits into 2 Slimelings (1hp) on death |
| Frost Zombie (ice_zombie) | Frozen | 3 | orth neighbours | 1 orth | freezes the tile it leaves (ice) |
| Wraith (angel, tinted) | Frozen | 2 | Knight-move (L shapes) | jumps like a chess knight | ignores walls |
| Goblin | Warrens | 1 | orth neighbours | 2 orth | eats spell tiles |
| Orc Warrior | Warrens | 3 | orth line up to 3 (charge, stops adjacent) | 1 orth | charging = moves to you then hits |
| Masked Orc | Warrens | 3 | orth neighbours | 1 orth | shield: immune to damage from the side it faces |
| Orc Shaman | Warrens | 2 | none | keeps distance | heals the most wounded ally 1 each turn |
| Chort | Inferno | 2 | 8 neighbours (King) | 1 orth/diag | — |
| Wogol | Inferno | 2 | orth neighbours | 1 orth | explodes on death: 1 dmg to 8 neighbours |
| Shade | any (doom) | 1 | 8 neighbours | 1 any, phases through walls | spawned by doom clock |

Bosses (32x36 sprites, occupy 1 tile but have patterns):
- **Bone Tyrant** (big_zombie, Crypt): 10 HP, orth neighbours for 2; every 4th turn raises 2 skeletons.
- **Mother Slug** (slug scaled, Swamp): 10 HP, spits slime lines; splits into Mudlings at half HP.
- **Frost Colossus** (ice_zombie scaled, Frozen): 12 HP, slams a 3x3 telegraphed area every 3rd turn, otherwise moves.
- **Orc Warlord** (ogre, Warrens): 14 HP, Rook charge range 5 for 3 dmg; summons goblins.
- **Pit Lord** (big_demon, Inferno): 18 HP, King pattern, alternates fire lines (telegraphed rows/columns) and imp summons.

## 6. Biomes

| # | Biome | Floors | Hazards | Palette |
|---|---|---|---|---|
| 1 | Forgotten Crypt | 1–3 | spikes, pits | grey stone |
| 2a | Rot Swamp | 4–6 | slime, pits | green |
| 2b | Frozen Vault (alt. path) | 4–6 | ice (sliding) | blue |
| 3 | Orc Warrens | 7–9 | spikes, crates (walls) | brown |
| 4 | Infernal Pit | 10–12 | lava | red |

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
