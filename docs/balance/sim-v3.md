# Simulation v3: telegraphed (Into-the-Breach) enemy AI

Rules version: every tile is a spell, there is no melee, and enemies resolve a telegraph, then move, then telegraph a new one.
Reproduce with `node tools/sim.js --bot planner|greedy|random --runs 200 --cls all`.
Settings: depth 0, no grimoire spells, Frozen path unlocked. The planner searches 5 plies with a beam of 16, and the hero's danger is `dangerMap` at his square.

## 1. Baseline: far too easy
| bot | win% | mean floor | close% | dmg/floor | turns/floor | forced% | dense% |
|---|---|---|---|---|---|---|---|
| planner | **96.3** | 11.68 | 1.2 | 0.31 | 8.2 | 0.5 | 79.4 |
| greedy | **47.1** | 7.72 | 2.3 | 0.77 | 17.7 | 2.1 | 69.6 |
| random | 0 | 1.40 | 14.9 | 4.69 | 19.4 | 2.1 | 61.5 |

Planner win% by class: Knight 88.5, Pyromancer 100, Ranger 99.5, Geomancer 90.5, Shadowblade 100, Hexer 99.5. Bosses die 100% of the time.
Its only real "deaths" are 39 stalls: an Imp (diagonal mover) or a shade (moves in any direction) stays diagonal to a Knight or Geomancer whose spells all fire straight ahead, so they can never hit it.

**Why it is easy:** a telegraph covers exactly one square, the hero's current one, and it resolves next phase, so a single step dodges everything.
Danger only appears when the hero is boxed in (0.5% of turns). Enemies, not the dodge, set the difficulty, so the levers have to
(a) cover more of the board with telegraphs, (b) add bodies and time pressure, or (c) add attrition.

Full baseline tables are at the end of this file.

## 2. Lever sweep (planner unless noted; 30–40 runs/class; win% per class)
Prototype toggles live in a scratch copy of src (the `MCV` environment variable; exact diff in the appendix):
- **swing:** a melee telegraph covers the target square plus the two squares beside it (relative to the attacker). The only safe step is directly away from the attacker.
- **area:** melee enemies strike their whole reach pattern.
- **reinfN:K:** every N turns, an "emerging" spawn square is telegraphed and an enemy from the biome roster appears there a turn later.
  - K + floor/3 spawns per floor, boss floors excluded.
  - If the hero is standing on the square when it emerges, he takes 1 damage instead.
- **budX:** enemy budget × X. **bsA:B:** enemy budget × (A + B·floor).
- **burnwalk:** enemies no longer avoid burning ground (a Pyromancer nerf).
- **arrow2:** Arrow deals 2.

Class changes shared by every row from P1_cls onward:
- **Ranger:** Hawk replaces Vault as a starter.
- **Hexer:** Corpse Explosion does 1 damage (was 2), and Wither moves to the grimoire.
- **Pyromancer:** Meteor does 2 damage (was 3).

The "CT2" frequency settings: Life Drain, Flame Wave and Soul Swap get freq 1, and Ranger and Geomancer get 7 HP.

| config | kni | pyr | ran | geo | sha | hex | ALL | close% | dmg/fl | forced% | deaths by biome |
|---|---|---|---|---|---|---|---|---|---|---|---|
| area + reinf2:4 | 83 | 100 | 97 | 80 | 100 | 100 | 93 | 1.6 | 0.46 | 1.4 | mostly stalls |
| area + depth 5 | 77 | 100 | 87 | 77 | 97 | 100 | 89 | 3.7 | 0.54 | 1.8 | crypt/swamp |
| swing | 90 | 100 | 100 | 87 | 100 | 100 | 96 | 1.7 | 0.52 | 2.5 | – |
| swing + bud2 + reinf2:3 + enemy HP+1 | 57 | 87 | 3 | 50 | 67 | 97 | 60 | 14.7 | 1.71 | 5.1 | spread |
| P1 = swing + bud2.5 + reinf2:3 + HP+1 | 20 | 80 | 3 | 30 | 37 | 83 | 42 | 15.9 | 2.02 | 6.2 | spread (W 36, S 25, C 23, I 14) |
| P4 = swing + bud3 + reinf2:3 (+class) | 72.5 | 90 | 32.5 | 40 | 72.5 | 92.5 | 67 | 11.2 | 1.73 | 5.0 | S 35, W 33 |
| P6 = swing + bud3.5 + reinf2:4 (+class, CT2) | 52.5 | 87.5 | 15 | 40 | 60 | 80 | 56 | 13.8 | 1.97 | 5.7 | S 48, W 44 |
| PKG = P6, 100 runs/class | 48 | 86 | 17 | 29 | 63 | 79 | 54 | 13.7 | 1.98 | 5.9 | S 121, W 116, I 26, C 13 |
| PKG greedy (200/class) | 0 | 0.5 | 0 | 0 | 0 | 0 | 0.1 | | 3.53 | 15 | crypt 909 |
| PKG random (200/class) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | | 6.24 | 22.7 | crypt 1200 |
| Q1 = swing + bs1.5:0.35 + reinf2:4 + burnwalk + arrow2 (+CT2) | 45 | 72.5 | 20 | 15 | 65 | 67.5 | 47.5 | 10.3 | 1.75 | 5.7 | W 86, S 25 |
| Q1 greedy | 0 | 1 | 0 | 0 | 1 | 0 | 0.3 | | 2.82 | 14 | crypt 346 |
| Q3 = Q1 but bs1.6:0.2 | 72.5 | 95 | 50 | 70 | 90 | 87.5 | 77.5 | 7.9 | 1.55 | 4.8 | W 30 |
| Q3 greedy | 0 | 4 | 1 | 0 | 0 | 1 | 1.0 | | 2.73 | 13.8 | crypt 340 |
| Q3 + depth 2 | 40 | 75 | 25 | 37.5 | 55 | 75 | 51 | 13.0 | 1.89 | 5.9 | W 70 |
| Q3 + depth 4 | 35 | 67.5 | 15 | 22.5 | 60 | 70 | 45 | 17.5 | 1.73 | 5.7 | W 74 |
| **Q4** = swing + bs1.6:0.3 + reinf2:4 + burnwalk + arrow2 + CT2 + Warrens softening + depth 4 | 30 | 60 | 12.5 | 12.5 | 17.5 | 52.5 | **30.8** | 16.5 | 1.82 | 6.0 | W 102, S 43, I 16 |

"Warrens softening" = `--set ENEMIES.masked.hp=2 --set ENEMIES.orc.range=2 --set ENEMIES.masked.cost=1.6`.
Turning off the Masked Orc shield and giving Orc Warriors 1 damage changed nothing (Q2: 49.6%), so the shield is not the Warrens problem. Enemy count and the Warriors' telegraphed 2-damage charges are.
The 40-run rows are noisy: about ±7 points per class, about ±3 overall.

## 3. Findings
1. **Telegraph coverage is the core lever.**
   - A one-square telegraph is free to dodge. **Swing** (three squares) makes adjacency to melee enemies costly and keeps a dodge (step straight away).
   - Swing barely moves the planner on its own, but it multiplies the effect of more enemies. Forced-damage turns rise from 0.5% to 5–6%, which sits in "low but nonzero".
   - **Area** (whole reach pattern) is weaker in practice, because the hero is rarely adjacent anyway.
2. **More enemies plus reinforcements give the difficulty dial.**
   - Overall win rate is very sensitive to the budget slope: bs1.6:0.2 gives 77%, bs1.6:0.3 with depth 4 gives 31%, bs1.5:0.35 gives 47%.
   - A budget **slope per floor** is needed. A flat multiplier makes the Crypt either trivial for the planner or a wall for greedy.
   - Greedy dies in the Crypt under every swing package (0–4% wins), so **greedy's 2–8% target needs a gentler Crypt**. Leave the Crypt at about 1.6× budget and grow from there.
3. **The Warrens are the new single wall** (60–75% of planner deaths in the Q packages).
   - The roster is Goblin (fast) + Orc Warrior (2-damage charge, range 3) + Masked Orc + Orc Shaman (heals 1 per turn, out-sustaining 1-damage kits).
   - Suggested: Shaman heals every other turn; Warrens budget ×0.8; Orc Warrior charge range 3→2 (tested, helps a little).
4. **Swamp is far deadlier than Frozen** (floor death 20–32% against 0–2% in P6). The slugs' slime and Mudlings splitting into Slimelings punish single-target kits.
   - Suggested: Swamp starts with 3 slime patches (was 6), and Mudling cost 1.9→2.3. Alternatively, give Frozen +20% budget.
5. **Classes are far apart** (Q4: 12.5–60%). Pyromancer and Hexer are strong under every lever; Ranger and Geomancer are weak.
   - Pyromancer: burning ground used to be a wall enemies refused to cross (fixed by burnwalk). Fire Ring and Flame Wave hit areas without aiming.
     - Further suggestion: Fire Ring cooldown 5→6 and burn lasts 2 turns (was 3), and Heat Shield should also stun adjacent enemies (currently 0 kills).
   - Hexer: sustain from Life Drain plus Harvest, and Soul Swap repositioning.
     - Further suggestion: Life Drain heals only on a kill. Raise Dead and Bone Wall have about 0 kills (Raise Dead's kills go to allies; check their real impact).
   - Ranger: 1-damage single-target kit with no attack-cancel among starters.
     - Arrow 2 damage and Hawk as a starter help (+5–15 points); Ranger HP 6→7 had no measurable effect. Next try Bear Trap stunning (cancelling the telegraph) and Piercing Shot frequency 2→3.
   - Geomancer: every attack is aimed straight ahead, so it can't hit diagonal enemies (Imps, shades) and stalls.
     - Suggested: Earth Spike (non-aimed) as a starter instead of Raise Wall; Stone Fist pushes 1 and stuns.
   - Knight has the same diagonal problem; Holy Nova (radius 3) fixes it once drafted.
   - **General fix:** make `wait` cast a weak non-directional "pulse" of the tile underfoot, or let diagonal enemies be hit by line spells passing through an adjacent square.
6. **Spells with almost no impact:**
   - Rarely drafted: Rally (13 casts), Decoy (1), Blink Flare (9).
   - Utility spells with ~0 kills: Swap, Shadowstep, Smoke, Poison Edge (its kills land in the poison bucket), Stone Skin, Bulwark, Heat Shield, Raise Dead, Bone Wall.
   - Defensive or utility value isn't captured by kills; a "damage prevented" metric would be the next addition to sim.js.

## 4. Proposed package (gets the overall planner number into range; class spread still needs one more pass)
1. **Swing telegraphs** for all non-ranged attackers (diff: `ai.js planAttack`, appendix).
2. **Telegraphed reinforcements** on normal floors: every 2 turns, 4 + floor/3 per floor (diff: `game.js upkeep`).
   - This needs proper state in `buildFloor` (`g.reinfLeft`, `g.emerge`), the emerge marker added to `dangerMap`/rendering (show it like the doom mark), and a decision on the "emerge onto hero = 1 damage" rule.
3. **Budget** = (2.6 + 0.55·floor) × (1.6 + 0.3·floor) on normal floors; boss floors unchanged.
4. **Heal between floors 1→0** (the depth-4 modifier made baseline), or keep 1 and use bs1.6:0.35.
5. **Class:**
   - Pyromancer: enemies walk onto burning ground.
   - Ranger: Arrow 2 damage and Hawk as a starter.
   - Hexer: Corpse Explosion 1 damage and Wither to the grimoire.
   - Pyromancer: Meteor 2 damage.
   - Frequency 1 for Life Drain, Flame Wave and Soul Swap.
   - Ranger and Geomancer 7 HP.
6. **Warrens:** Masked Orc 2 HP and cost 1.6; Orc Warrior range 2. Further Shaman/budget nerf as in finding 3.

Measured Q4: planner **30.8%**, close calls **16.5%** (target 20–40), forced damage **6%**, decision density **68%**.
Deaths span four biomes but the Warrens dominate, and classes are not yet within 10 points (12.5–60).
Greedy under the similar Q1/Q3 packages: 0.3–1% (slightly below the 2–8% target); random: 0%, dying in the Crypt.

## Baseline: planner (200/class)

```
bot=planner runs=200/class depth=0 grimoire=none frozen=true plies=5 beam=16 (284.055s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | otherKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|------------|
| knight | 88.5 |     11 |        4 |    0.2 |      9.6 |   96.9 |    10.89 |   0.16 |   75.6 |     0.5 |         83 |         17 |
|   pyro |  100 |     12 |        0 |    1.8 |      6.4 |    100 |     6.01 |    0.3 |   85.6 |     0.4 |       75.5 |       24.5 |
| ranger | 99.5 |  11.97 |        6 |    1.1 |      8.3 |   98.6 |      7.8 |   0.35 |   81.5 |     0.5 |       88.3 |       11.7 |
|    geo | 90.5 |  11.14 |        4 |    0.8 |     10.1 |   96.4 |    10.19 |   0.26 |   75.3 |     0.6 |       80.2 |       19.8 |
| shadow |  100 |     12 |        0 |    2.9 |      8.5 |   99.7 |     7.91 |   0.39 |   79.8 |     0.5 |       74.1 |       25.9 |
|  hexer | 99.5 |  11.96 |        3 |    0.3 |      6.6 |    100 |     6.94 |    0.4 |   83.8 |     0.3 |         87 |         13 |
|    ALL | 96.3 |  11.68 |        4 |    1.2 |      8.2 |   98.7 |     8.23 |   0.31 |   79.4 |     0.5 |       81.3 |       18.7 |

[knight] deaths by floor: F1:6 F2:2 F4:11 F5:2 F6:2
[knight] bosses: bone_tyrant 192/192 (100%), frost_colossus 95/95 (100%), orc_warlord 177/177 (100%), pit_lord 177/177 (100%), mother_slug 84/84 (100%)
[knight] death causes: stall:20 shade:1 mudling:1 slimeling:1
[knight] spells (casts/kills): Shield Throw 6585c/1628k, Smite 4594c/1477k, Lance 4470c/1930k, Charge 2373c/296k, Holy Nova 2098c/2529k, Javelin Rain 2065c/897k, Bulwark 1755c/16k, Rally 23c/0k
[pyro] deaths by floor: -
[pyro] bosses: bone_tyrant 200/200 (100%), frost_colossus 93/93 (100%), orc_warlord 200/200 (100%), pit_lord 200/200 (100%), mother_slug 107/107 (100%)
[pyro] death causes: -
[pyro] spells (casts/kills): Firebolt 3423c/901k, Meteor 3014c/3438k, Flame Wave 2922c/1370k, Fire Ring 2020c/988k, Heat Shield 1100c/0k, Inferno Line 895c/388k, Combustion 891c/212k, Blink Flare 151c/93k
[ranger] deaths by floor: F6:1
[ranger] bosses: bone_tyrant 200/200 (100%), mother_slug 106/106 (100%), orc_warlord 199/199 (100%), pit_lord 199/199 (100%), frost_colossus 94/94 (100%)
[ranger] death causes: mudling:1
[ranger] spells (casts/kills): Arrow 4287c/1267k, Hawk 4261c/3103k, Piercing Shot 3018c/1539k, Vault 2848c/306k, Bear Trap 2819c/1459k, Volley 1208c/1209k, Windstep 183c/3k, Snare Net 43c/3k
[geo] deaths by floor: F1:6 F2:3 F4:7 F5:3
[geo] bosses: bone_tyrant 191/191 (100%), mother_slug 86/86 (100%), orc_warlord 181/181 (100%), pit_lord 181/181 (100%), frost_colossus 95/95 (100%)
[geo] death causes: stall:19
[geo] spells (casts/kills): Stone Fist 6448c/1323k, Boulder 5356c/2502k, Earth Spike 5334c/3683k, Stone Skin 2788c/0k, Raise Wall 1368c/735k, Sinkhole 1050c/246k, Tremor 199c/169k, Quake 161c/158k
[shadow] deaths by floor: -
[shadow] bosses: bone_tyrant 200/200 (100%), frost_colossus 98/98 (100%), orc_warlord 200/200 (100%), pit_lord 200/200 (100%), mother_slug 102/102 (100%)
[shadow] death causes: -
[shadow] spells (casts/kills): Shuriken 6293c/3738k, Fan of Knives 3078c/1732k, Poison Edge 2630c/0k, Caltrops 2441c/2201k, Swap 2070c/0k, Shadowstep 1413c/0k, Smoke 1034c/0k, Decoy 23c/0k
[hexer] deaths by floor: F3:1
[hexer] bosses: bone_tyrant 200/200 (100%), frost_colossus 108/108 (100%), orc_warlord 199/199 (100%), pit_lord 199/199 (100%), mother_slug 91/91 (100%)
[hexer] death causes: skeleton:1
[hexer] spells (casts/kills): Life Drain 4157c/1616k, Bone Spear 3502c/680k, Curse 2448c/454k, Soul Swap 2257c/1784k, Wither 1707c/2770k, Corpse Explosion 1139c/1420k, Raise Dead 810c/1k, Bone Wall 583c/7k
[ALL] deaths by floor: F1:12 F2:5 F3:1 F4:18 F5:5 F6:3
[ALL] bosses: bone_tyrant 1183/1183 (100%), frost_colossus 583/583 (100%), orc_warlord 1156/1156 (100%), pit_lord 1156/1156 (100%), mother_slug 576/576 (100%)
[ALL] death causes: stall:39 mudling:2 shade:1 slimeling:1 skeleton:1
[ALL] spells (casts/kills): Shield Throw 6585c/1628k, Stone Fist 6448c/1323k, Shuriken 6293c/3738k, Boulder 5356c/2502k, Earth Spike 5334c/3683k, Smite 4594c/1477k, Lance 4470c/1930k, Arrow 4287c/1267k, Hawk 4261c/3103k, Life Drain 4157c/1616k, Bone Spear 3502c/680k, Firebolt 3423c/901k, Fan of Knives 3078c/1732k, Piercing Shot 3018c/1539k, Meteor 3014c/3438k, Flame Wave 2922c/1370k, Vault 2848c/306k, Bear Trap 2819c/1459k, Stone Skin 2788c/0k, Poison Edge 2630c/0k, Curse 2448c/454k, Caltrops 2441c/2201k, Charge 2373c/296k, Soul Swap 2257c/1784k, Holy Nova 2098c/2529k, Swap 2070c/0k, Javelin Rain 2065c/897k, Fire Ring 2020c/988k, Bulwark 1755c/16k, Wither 1707c/2770k, Shadowstep 1413c/0k, Raise Wall 1368c/735k, Volley 1208c/1209k, Corpse Explosion 1139c/1420k, Heat Shield 1100c/0k, Sinkhole 1050c/246k, Smoke 1034c/0k, Inferno Line 895c/388k, Combustion 891c/212k, Raise Dead 810c/1k, Bone Wall 583c/7k, Tremor 199c/169k, Windstep 183c/3k, Quake 161c/158k, Blink Flare 151c/93k, Snare Net 43c/3k, Rally 23c/0k, Decoy 23c/0k
```

## Baseline: greedy (200/class)

```
bot=greedy runs=200/class depth=0 grimoire=none frozen=true (125.364s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | otherKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|------------|
| knight | 19.5 |   4.86 |        3 |    1.4 |     32.7 |   62.6 |    36.94 |   1.16 |   66.6 |     2.6 |       52.3 |       47.7 |
|   pyro | 80.5 |  10.91 |        6 |    2.4 |     11.8 |   92.1 |     9.97 |   0.43 |   80.8 |     1.2 |       73.2 |       26.8 |
| ranger | 29.5 |    6.2 |        3 |      4 |       18 |   83.7 |    16.96 |   1.16 |   62.9 |     2.6 |       78.1 |       21.9 |
|    geo |   18 |   4.83 |        2 |    1.9 |     22.8 |   75.1 |    21.95 |   1.24 |   62.8 |     3.7 |       56.4 |       43.6 |
| shadow |   59 |   9.26 |        6 |    3.8 |     22.4 |   70.6 |    19.93 |   0.68 |   71.6 |       1 |       67.2 |       32.8 |
|  hexer |   76 |  10.29 |        4 |    0.4 |     11.5 |   93.5 |    11.08 |   0.58 |   73.9 |     1.4 |       83.8 |       16.2 |
|    ALL | 47.1 |   7.72 |        3 |    2.3 |     17.7 |   82.6 |    17.22 |   0.77 |   69.6 |     2.1 |       68.6 |       31.4 |

[knight] deaths by floor: F1:40 F2:21 F3:55 F4:16 F5:7 F6:14 F7:1 F8:1 F9:3 F10:2 F11:1
[knight] bosses: bone_tyrant 92/139 (66.2%), mother_slug 15/23 (65.2%), orc_warlord 43/45 (95.6%), frost_colossus 36/38 (94.7%), pit_lord 39/39 (100%)
[knight] death causes: skeleton:45 shade:44 stall:34 mother_slug_area:8 bone_tyrant:8 slug:6
[knight] spells (casts/kills): Shield Throw 11692c/1301k, Smite 7183c/1061k, Lance 7106c/1029k, Bulwark 3543c/15k, Charge 2834c/192k, Javelin Rain 2220c/350k, Holy Nova 1265c/962k, Rally 21c/1k
[pyro] deaths by floor: F2:1 F3:2 F4:4 F6:21 F7:3 F8:1 F9:2 F10:4 F12:1
[pyro] bosses: bone_tyrant 197/199 (99%), mother_slug 87/104 (83.7%), orc_warlord 166/168 (98.8%), pit_lord 162/162 (100%), frost_colossus 89/89 (100%)
[pyro] death causes: mother_slug_area:14 mudling:6 imp:4 skeleton:3 goblin:3 orc:3
[pyro] spells (casts/kills): Firebolt 6273c/1215k, Flame Wave 4385c/1311k, Meteor 3101c/3100k, Fire Ring 2898c/1092k, Heat Shield 2466c/0k, Inferno Line 1290c/252k, Combustion 1224c/147k, Blink Flare 97c/35k
[ranger] deaths by floor: F1:28 F2:12 F3:44 F4:5 F5:15 F6:25 F7:5 F8:1 F9:2 F10:3 F11:1
[ranger] bosses: bone_tyrant 129/160 (80.6%), frost_colossus 55/58 (94.8%), orc_warlord 63/65 (96.9%), pit_lord 59/59 (100%), mother_slug 22/38 (57.9%)
[ranger] death causes: shade:52 skeleton:29 mother_slug_area:11 bone_tyrant:10 slug:7 orc:5
[ranger] spells (casts/kills): Arrow 7206c/872k, Piercing Shot 3825c/720k, Bear Trap 3525c/1566k, Vault 3173c/174k, Hawk 2278c/1517k, Volley 905c/340k, Windstep 65c/0k, Snare Net 38c/0k
[geo] deaths by floor: F1:54 F2:31 F3:31 F4:5 F5:10 F6:15 F7:2 F8:6 F9:2 F10:5 F11:1 F12:2
[geo] bosses: bone_tyrant 89/115 (77.4%), frost_colossus 43/43 (100%), orc_warlord 44/46 (95.7%), pit_lord 38/38 (100%), mother_slug 13/26 (50%)
[geo] death causes: shade:82 skeleton:27 mother_slug_area:10 stall:7 orc:6 imp:5
[geo] spells (casts/kills): Stone Fist 7639c/596k, Boulder 4937c/990k, Stone Skin 3028c/0k, Earth Spike 2554c/1665k, Raise Wall 2221c/474k, Sinkhole 696c/54k, Tremor 70c/27k, Quake 59c/32k
[shadow] deaths by floor: F1:5 F3:15 F4:3 F5:1 F6:54 F10:1 F11:1 F12:2
[shadow] bosses: bone_tyrant 183/195 (93.8%), mother_slug 27/78 (34.6%), frost_colossus 98/98 (100%), orc_warlord 122/122 (100%), pit_lord 118/120 (98.3%)
[shadow] death causes: mother_slug_area:37 shade:14 skeleton:9 mudling:6 other:5 mother_slug:4
[shadow] spells (casts/kills): Shuriken 11284c/3562k, Swap 5619c/0k, Shadowstep 4765c/0k, Fan of Knives 4498c/2055k, Smoke 4321c/0k, Poison Edge 3337c/0k, Caltrops 3041c/2065k, Decoy 49c/0k
[hexer] deaths by floor: F1:1 F3:22 F4:2 F5:8 F6:4 F7:3 F8:3 F9:1 F10:3 F11:1
[hexer] bosses: bone_tyrant 182/199 (91.5%), frost_colossus 89/89 (100%), orc_warlord 156/157 (99.4%), pit_lord 152/152 (100%), mother_slug 74/78 (94.9%)
[hexer] death causes: skeleton:19 mother_slug_area:4 orc:4 slug:4 bone_tyrant:4 mudling:3
[hexer] spells (casts/kills): Bone Spear 5656c/669k, Life Drain 5592c/2052k, Curse 3413c/408k, Soul Swap 2478c/1727k, Wither 1868c/2230k, Bone Wall 1473c/13k, Corpse Explosion 1255c/873k, Raise Dead 1067c/2k
[ALL] deaths by floor: F1:128 F2:65 F3:169 F4:35 F5:41 F6:133 F7:14 F8:12 F9:10 F10:18 F11:5 F12:5
[ALL] bosses: bone_tyrant 872/1007 (86.6%), mother_slug 238/347 (68.6%), orc_warlord 594/603 (98.5%), frost_colossus 410/415 (98.8%), pit_lord 568/570 (99.6%)
[ALL] death causes: shade:195 skeleton:132 mother_slug_area:84 stall:41 mudling:26 bone_tyrant:26
[ALL] spells (casts/kills): Shield Throw 11692c/1301k, Shuriken 11284c/3562k, Stone Fist 7639c/596k, Arrow 7206c/872k, Smite 7183c/1061k, Lance 7106c/1029k, Firebolt 6273c/1215k, Bone Spear 5656c/669k, Swap 5619c/0k, Life Drain 5592c/2052k, Boulder 4937c/990k, Shadowstep 4765c/0k, Fan of Knives 4498c/2055k, Flame Wave 4385c/1311k, Smoke 4321c/0k, Piercing Shot 3825c/720k, Bulwark 3543c/15k, Bear Trap 3525c/1566k, Curse 3413c/408k, Poison Edge 3337c/0k, Vault 3173c/174k, Meteor 3101c/3100k, Caltrops 3041c/2065k, Stone Skin 3028c/0k, Fire Ring 2898c/1092k, Charge 2834c/192k, Earth Spike 2554c/1665k, Soul Swap 2478c/1727k, Heat Shield 2466c/0k, Hawk 2278c/1517k, Raise Wall 2221c/474k, Javelin Rain 2220c/350k, Wither 1868c/2230k, Bone Wall 1473c/13k, Inferno Line 1290c/252k, Holy Nova 1265c/962k, Corpse Explosion 1255c/873k, Combustion 1224c/147k, Raise Dead 1067c/2k, Volley 905c/340k, Sinkhole 696c/54k, Blink Flare 97c/35k, Tremor 70c/27k, Windstep 65c/0k, Quake 59c/32k, Decoy 49c/0k, Snare Net 38c/0k, Rally 21c/1k
```

## Baseline: random (200/class)

```
bot=random runs=200/class depth=0 grimoire=none frozen=true (1.602s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | otherKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|------------|
| knight |    0 |   1.05 |        1 |   11.1 |     26.2 |   33.3 |    19.54 |   6.72 |   60.7 |     3.1 |         24 |         76 |
|   pyro |    0 |   1.75 |        1 |   18.7 |     23.2 |     48 |    14.22 |   3.14 |   71.1 |     0.8 |       35.5 |       64.5 |
| ranger |    0 |   1.14 |        1 |   35.7 |     17.5 |     75 |    14.39 |   5.37 |   52.9 |     2.7 |       67.8 |       32.2 |
|    geo |    0 |   1.05 |        1 |   11.1 |     22.7 |   55.6 |     16.6 |   5.76 |   57.8 |     3.7 |       22.8 |       77.2 |
| shadow |    0 |   1.03 |        1 |   28.6 |     18.9 |   57.1 |    15.32 |   4.85 |   55.3 |     1.4 |       33.4 |       66.6 |
|  hexer |    0 |    2.4 |        2 |   10.7 |     17.3 |     73 |    11.25 |   4.07 |   64.5 |     1.3 |       51.8 |       48.2 |
|    ALL |    0 |    1.4 |        1 |   14.9 |     19.4 |     64 |    14.49 |   4.69 |   61.5 |     2.1 |         40 |         60 |

[knight] deaths by floor: F1:191 F2:9
[knight] bosses: -
[knight] death causes: shade:126 skeleton:44 spikes:14 zombie:9 imp:7
[knight] spells (casts/kills): Shield Throw 1670c/66k, Lance 997c/59k, Smite 969c/63k, Bulwark 433c/0k, Javelin Rain 10c/1k, Charge 3c/0k, Holy Nova 1c/0k
[pyro] deaths by floor: F1:105 F2:54 F3:35 F4:1 F5:2 F6:3
[pyro] bosses: bone_tyrant 12/41 (29.3%), mother_slug 0/1 (0%), frost_colossus 0/2 (0%)
[pyro] death causes: skeleton:73 shade:52 caster:21 spikes:15 zombie:12 bone_tyrant:12
[pyro] spells (casts/kills): Firebolt 2146c/81k, Flame Wave 1264c/102k, Heat Shield 693c/0k, Fire Ring 683c/201k, Meteor 74c/50k, Combustion 73c/0k, Inferno Line 45c/2k
[ranger] deaths by floor: F1:178 F2:16 F3:6
[ranger] bosses: bone_tyrant 0/6 (0%)
[ranger] death causes: shade:71 skeleton:58 imp:25 zombie:21 spikes:15 caster:3
[ranger] spells (casts/kills): Arrow 1184c/58k, Vault 728c/10k, Piercing Shot 686c/54k, Bear Trap 663c/208k, Hawk 14c/9k, Volley 5c/0k
[geo] deaths by floor: F1:192 F2:7 F3:1
[geo] bosses: bone_tyrant 1/1 (100%)
[geo] death causes: shade:105 skeleton:51 imp:19 zombie:12 spikes:12 caster:1
[geo] spells (casts/kills): Stone Fist 1585c/18k, Boulder 961c/94k, Stone Skin 462c/0k, Raise Wall 453c/21k, Sinkhole 5c/1k, Earth Spike 3c/1k
[shadow] deaths by floor: F1:193 F2:7
[shadow] bosses: -
[shadow] death causes: shade:74 skeleton:56 spikes:25 imp:21 zombie:21 caster:2
[shadow] spells (casts/kills): Shuriken 1263c/125k, Shadowstep 784c/0k, Swap 739c/0k, Smoke 379c/0k, Poison Edge 4c/0k, Fan of Knives 3c/1k
[hexer] deaths by floor: F1:53 F2:53 F3:75 F4:8 F5:3 F6:7 F8:1
[hexer] bosses: bone_tyrant 21/94 (22.3%), mother_slug 0/5 (0%), frost_colossus 1/3 (33.3%)
[hexer] death causes: skeleton:83 shade:28 caster:26 bone_tyrant:25 zombie:9 spikes:7
[hexer] spells (casts/kills): Bone Spear 2039c/74k, Life Drain 1244c/443k, Curse 1140c/39k, Raise Dead 554c/0k, Soul Swap 157c/108k, Bone Wall 145c/0k, Corpse Explosion 69c/34k, Wither 63c/37k
[ALL] deaths by floor: F1:912 F2:146 F3:117 F4:9 F5:5 F6:10 F8:1
[ALL] bosses: bone_tyrant 34/142 (23.9%), mother_slug 0/6 (0%), frost_colossus 1/5 (20%)
[ALL] death causes: shade:456 skeleton:365 spikes:88 imp:87 zombie:84 caster:53
[ALL] spells (casts/kills): Firebolt 2146c/81k, Bone Spear 2039c/74k, Shield Throw 1670c/66k, Stone Fist 1585c/18k, Flame Wave 1264c/102k, Shuriken 1263c/125k, Life Drain 1244c/443k, Arrow 1184c/58k, Curse 1140c/39k, Lance 997c/59k, Smite 969c/63k, Boulder 961c/94k, Shadowstep 784c/0k, Swap 739c/0k, Vault 728c/10k, Heat Shield 693c/0k, Piercing Shot 686c/54k, Fire Ring 683c/201k, Bear Trap 663c/208k, Raise Dead 554c/0k, Stone Skin 462c/0k, Raise Wall 453c/21k, Bulwark 433c/0k, Smoke 379c/0k, Soul Swap 157c/108k, Bone Wall 145c/0k, Meteor 74c/50k, Combustion 73c/0k, Corpse Explosion 69c/34k, Wither 63c/37k, Inferno Line 45c/2k, Hawk 14c/9k, Javelin Rain 10c/1k, Volley 5c/0k, Sinkhole 5c/1k, Poison Edge 4c/0k, Charge 3c/0k, Earth Spike 3c/1k, Fan of Knives 3c/1k, Holy Nova 1c/0k
```

## Appendix: prototype diff (scratch copy of src; env toggles are for the sim and should become real constants)

```diff
diff -ru /home/piotr/MoveCasters/src/core/ai.js v/src/core/ai.js
--- /home/piotr/MoveCasters/src/core/ai.js	2026-10-18 18:23:11.509864445 +0200
+++ v/src/core/ai.js	2026-10-18 18:42:17.222491976 +0200
@@ -8,6 +8,7 @@
 } from './engine.js';
 import { rint } from './rng.js';
 
+export const VAR = (typeof process !== 'undefined' && process.env.MCV) || '';
 const STEPS = { orth: ORTH, diag: DIAG, king: KING, knight: KNIGHT, phase: KING };
 
 // Tiles threatened by a pattern centred at (x,y). Line patterns are blocked by walls and units (not the hero).
@@ -226,7 +227,17 @@
   const dmg = dmgOverride || def.dmg;
   const delay = def.slow ? 2 : 1;
   if (pat === 'line' || pat === 'charge') u.intent = { kind: pat, dir: [Math.sign(dx), Math.sign(dy)], range: def.range || 4, dmg, delay };
-  else u.intent = { kind: 'rel', offs: [[dx, dy]], dmg, delay };
+  else if (VAR.includes('swing') && !def.ranged) {
+    // ITB-style swing: the target square plus the squares beside it (relative to the attacker)
+    const offs = [[dx, dy]];
+    if (Math.abs(dx) + Math.abs(dy) === 1) offs.push([dx - dy, dy + dx], [dx + dy, dy - dx]);
+    else if (Math.abs(dx) === 1 && Math.abs(dy) === 1) offs.push([dx, 0], [0, dy]);
+    u.intent = { kind: 'rel', offs, dmg, delay };
+  } else if (VAR.includes('area') && !def.ranged) {
+    // ITB-style: melee enemies strike their whole reach pattern
+    const offs = patternTiles(g, pat, u.x, u.y).map(([x, y]) => [x - u.x, y - u.y]);
+    u.intent = { kind: 'rel', offs, dmg, delay };
+  } else u.intent = { kind: 'rel', offs: [[dx, dy]], dmg, delay };
   if (dx === 0 || dy === 0) u.facing = [Math.sign(dx), Math.sign(dy)];
   return true;
 }
diff -ru /home/piotr/MoveCasters/src/core/data.js v/src/core/data.js
--- /home/piotr/MoveCasters/src/core/data.js	2026-10-18 18:21:48.124365403 +0200
+++ v/src/core/data.js	2026-10-18 18:53:33.341837680 +0200
@@ -32,7 +32,7 @@
     name: 'Ranger', sprite: 'elf_f', hp: 6, color: '#8fd16a',
     passive: 'Steady Aim — after waiting, your next spell deals +1.',
     unlock: { kind: 'kills', n: 60, text: 'Slay 60 enemies (all runs)' },
-    starters: ['arrow', 'vault', 'bear_trap', 'piercing_shot'],
+    starters: ['arrow', 'hawk', 'bear_trap', 'piercing_shot'],
   },
   geo: {
     name: 'Geomancer', sprite: 'dwarf_m', hp: 6, color: '#c8a26b',
diff -ru /home/piotr/MoveCasters/src/core/engine.js v/src/core/engine.js
--- /home/piotr/MoveCasters/src/core/engine.js	2026-10-18 18:04:10.342459992 +0200
+++ v/src/core/engine.js	2026-10-18 19:04:42.850241826 +0200
@@ -38,7 +38,7 @@
   const t = tile(g, x, y);
   if (t === T.LAVA) return false;
   if (t === T.SPIKES && spikesUp(g, x, y, g.turn + 1)) return false;
-  if (g.fx.burn[key(x, y)]) return false;
+  if (g.fx.burn[key(x, y)] && !(process.env.MCV || '').includes('burnwalk')) return false;
   if (g.fx.trap[key(x, y)] && !g.fx.trap[key(x, y)].known) return true;
   return true;
 }
diff -ru /home/piotr/MoveCasters/src/core/game.js v/src/core/game.js
--- /home/piotr/MoveCasters/src/core/game.js	2026-10-18 18:23:11.510000617 +0200
+++ v/src/core/game.js	2026-10-18 18:32:54.965365093 +0200
@@ -1,5 +1,5 @@
 // Run state machine and turn loop. Pure & deterministic given the seed.
-import { T, DIRS, CLASSES, RELICS, TOTAL_FLOORS, FLOORS_PER_BIOME } from './data.js';
+import { T, DIRS, CLASSES, RELICS, TOTAL_FLOORS, FLOORS_PER_BIOME, BIOMES } from './data.js';
 import { rnd, rint, pick, shuffle, hashSeed } from './rng.js';
 import {
   key, tile, setTile, standable, unitAt, enemies, allies, emit, damageUnit, hurtHero, healHero, spikesUp, manhattan,
@@ -155,6 +155,23 @@
   if (h.lich > 0) h.lich--;
   // spell tiles recharge in place
   for (const c of g.cells) if (c && c.cd > 0) c.cd--;
+  // PROTOTYPE: telegraphed reinforcements (MCV=reinfN:K -> every N turns, K per floor + floor/4)
+  const rm = /reinf(\d+):(\d+)/.exec(process.env.MCV || '');
+  if (rm && !g.isBoss) {
+    const every = +rm[1];
+    if (g.floorTurns === 1) { g.reinfLeft = +rm[2] + Math.floor((g.floor - 1) / 3); g.emerge = null; }
+    if (g.emerge) {
+      const [x, y] = g.emerge; g.emerge = null;
+      if (h.x === x && h.y === y) hurtHero(g, 1, null, 'area');
+      else if (!occupied(g, x, y)) {
+        const B = BIOMES[g.biome]; const inB = ((g.floor - 1) % 3) + 1;
+        const roster = B.roster.filter(([, m]) => m <= inB).map(([t]) => t);
+        const u = makeUnit(g, roster[rint(g, roster.length)], x, y); u.stun = 0; g.reinfLeft--;
+        emit(g, { t: 'spawn', id: u.id, x, y });
+      }
+    }
+    if (g.reinfLeft > 0 && g.floorTurns % every === every - 1) { const p = randomFree(g, { avoidHero: 3 }); if (p) g.emerge = p; }
+  }
   // the Dark
   if (g.floorTurns >= g.par) {
     if (g.doomMark) {
diff -ru /home/piotr/MoveCasters/src/core/gen.js v/src/core/gen.js
--- /home/piotr/MoveCasters/src/core/gen.js	2026-10-18 18:02:07.970547535 +0200
+++ v/src/core/gen.js	2026-10-18 19:04:42.850197630 +0200
@@ -91,6 +91,8 @@
     u.timer = 0;
   }
   let budget = boss ? 1 + floor * 0.15 : 2.6 + floor * 0.55;
+  { const bm = /bud([\d.]+)/.exec(process.env.MCV || ''); if (bm) budget *= +bm[1];
+    const bs = /bs([\d.]+):([\d.]+)/.exec(process.env.MCV || ''); if (bs && !boss) budget *= +bs[1] + +bs[2] * floor; }
   if (d >= 1) budget += 1;
   const roster = B.roster.filter(([, min]) => min <= inBiome).map(([t]) => t);
   if (d >= 6 && !roster.includes('goblin')) { const s = spots(); if (s.length) { const p = pick(g, s); makeUnit(g, 'goblin', p[0], p[1]); } }
diff -ru /home/piotr/MoveCasters/src/core/spells.js v/src/core/spells.js
--- /home/piotr/MoveCasters/src/core/spells.js	2026-10-18 18:21:48.123710771 +0200
+++ v/src/core/spells.js	2026-10-18 19:04:42.850326718 +0200
@@ -165,7 +165,7 @@
       bolt(g, [u.x, u.y - 6], [u.x, u.y], '#ff5a1f');
       aoe(g, [[u.x, u.y], ...tiles], '#ff5a1f');
       const ns = tiles.map(([x, y]) => enemyAt(g, x, y)).filter(Boolean);
-      hit(g, u, 3 + c.P);
+      hit(g, u, 2 + c.P);
       ns.forEach((v) => hit(g, v, 1 + c.P));
       ignite(g, u.x, u.y);
     } },
@@ -229,8 +229,8 @@
   // ======================= RANGER =======================
   arrow: { cls: 'ranger', tier: 's', name: 'Arrow', cd: 1, freq: 3, icon: 'weapon_arrow',
     desc: 'The first enemy in a line takes 1.',
-    cast(g, c) { shootFirst(g, c, 99, 1 + c.P, '#d9f0a3'); } },
-  vault: { cls: 'ranger', tier: 's', name: 'Vault', cd: 3, icon: 'weapon_bow',
+    cast(g, c) { shootFirst(g, c, 99, ((process.env.MCV || '').includes('arrow2') ? 2 : 1) + c.P, '#d9f0a3'); } },
+  vault: { cls: 'ranger', tier: 'b', name: 'Vault', cd: 3, icon: 'weapon_bow',
     desc: 'Leap 2 squares backward, then loose an arrow forward for 1.',
     cast(g, c) {
       const h = H(g);
@@ -270,7 +270,7 @@
         hit(g, firstEnemyInRay(g, sx, sy, c.dx, c.dy), 2 + c.P);
       }
     } },
-  hawk: { cls: 'ranger', tier: 'b', name: 'Hawk', cd: 4, icon: 'angel_idle_anim',
+  hawk: { cls: 'ranger', tier: 's', name: 'Hawk', cd: 4, icon: 'angel_idle_anim',
     desc: 'Your hawk strikes the nearest enemy for 2 and stuns it.',
     cast(g, c) { const h = H(g), u = nearestEnemy(g, h.x, h.y); if (!u) return; bolt(g, [h.x, h.y], [u.x, u.y], '#fff'); hit(g, u, 2 + c.P); if (u.hp > 0) u.stun = Math.max(u.stun, 1); } },
   snare_net: { cls: 'ranger', tier: 'b', name: 'Snare Net', cd: 5, icon: 'wall_hole_1',
@@ -525,14 +525,14 @@
     desc: 'First enemy in a line takes 1 and is Cursed 3 turns (takes double damage).',
     cast(g, c) { const u = shootFirst(g, c, 99, 1 + c.P, '#7de0c8'); if (u && u.hp > 0) u.curse = Math.max(u.curse, 3 + c.lv); } },
   corpse_explosion: { cls: 'hexer', tier: 'b', name: 'Corpse Explosion', cd: 5, icon: 'bomb_f1',
-    desc: 'Every corpse on the floor explodes: 2 damage to its 8 neighbours.',
+    desc: 'Every corpse on the floor explodes: 1 damage to its 8 neighbours.',
     cast(g, c) {
       const cs = Object.keys(g.fx.corpse).map((k) => k.split(',').map(Number));
       g.fx.corpse = {};
       for (const [cx, cy] of cs) {
         const tiles = around8(cx, cy);
         aoe(g, tiles, '#7de0c8');
-        tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 2 + c.P));
+        tiles.forEach(([x, y]) => hit(g, enemyAt(g, x, y), 1 + c.P));
       }
     } },
   bone_wall: { cls: 'hexer', tier: 'b', name: 'Bone Wall', cd: 4, icon: 'skull',
@@ -555,7 +555,7 @@
       hit(g, u, 2 + c.P);
       c.moveHero(ux, uy, c.dx, c.dy, false);
     } },
-  wither: { cls: 'hexer', tier: 'b', name: 'Wither', cd: 6, icon: 'flask_big_green',
+  wither: { cls: 'hexer', tier: 'l', name: 'Wither', cd: 6, icon: 'flask_big_green',
     desc: 'Every enemy takes 1 (cursed enemies take double, as usual).',
     cast(g, c) { const us = enemies(g); aoe(g, us.map((u) => [u.x, u.y]), '#7de0c8'); us.forEach((u) => hit(g, u, 1 + c.P)); } },
   grave_grasp: { cls: 'hexer', tier: 'l', name: 'Grave Grasp', cd: 5, icon: 'wall_hole_1',
```
