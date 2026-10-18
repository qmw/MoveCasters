# Simulation v2: interim results (cell floor, no melee, old enemy AI)

> SUPERSEDED by sim-v3.md. INTERIM. These runs used commit cdb41be (every tile is a spell, no bump) with the OLD enemy AI
> (attack if the hero is in the pattern, otherwise move). The enemy AI is being replaced by telegraphed
> Into-the-Breach-style intents, so treat these numbers as historical. Settings: depth 0, Frozen path unlocked,
> 200 runs per class. The planner searches 5 plies with a beam of 16.

## Headline
- **Far too easy:** the planner wins 80% (target 20–35%). Damage taken is 0.8 per floor, close calls are 3.8% of floors (target 20–40%), 98% of floors are Swift, and floors average 9 turns.
- **Classes are far apart:** win rates run from 52.5% (Knight) to 100% (Pyromancer); the target is within about 10 points of each other.
- Nearly all deaths that do happen are in the Crypt (floors 1–3).
- Spells with almost no measured kills:
  - **Rarely drafted** (the policy prefers damage spells): Rally, Snare Net, Decoy, Windstep.
  - **Utility spells** (kills don't capture their value): Swap, Shadowstep, Smoke, Bulwark, Stone Skin, Heat Shield, Bone Wall.
  - **Kills credited elsewhere:** Raise Dead and Poison Edge (their kills land in the ally and poison buckets).

## Lever probes (planner, 50 runs/class; win% per class)
| probe | knight | pyro | ranger | geo | shadow | hexer | ALL | close% | dmg/fl |
|---|---|---|---|---|---|---|---|---|---|
| baseline (200/class) | 52.5 | 100 | 72.5 | 63.5 | 98 | 96 | 80.4 | 3.8 | 0.79 |
| depth 2 (+1 enemy budget, elites) | 40 | 100 | 46 | 52 | 98 | 92 | 71.3 | 5.7 | 1.01 |
| depth 5 | 16 | 100 | 20 | 34 | 80 | 90 | 56.7 | 11.1 | 1.17 |
| all regular enemies +1 HP | 24 | 100 | 50 | 56 | 98 | 76 | 67.3 | 6.5 | 1.02 |
| +1 HP and depth 1 | 18 | 100 | 38 | 42 | 94 | 72 | 60.7 | 8.5 | 1.26 |

Pyromancer, Shadowblade and Hexer stay above 70–100% under every generic difficulty lever. Their kits (long-range
line spells, AoE, Meteor, Shuriken bounce, Soul Swap, Wither) out-range the melee enemy roster, so class-specific
nerfs are needed, not just harder enemies. Meanwhile the Knight's short-range kit (Slash and Cleave hit only the
squares in front) forces it into enemy threat range.

## v2_planner

```
bot=planner runs=200/class depth=0 grimoire=none frozen=true plies=5 beam=16 (364.994s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | otherKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|------------|
| knight | 52.5 |   7.87 |        3 |    2.5 |     13.6 |   91.8 |    14.69 |   1.08 |   71.1 |       4 |       87.9 |       12.1 |
|   pyro |  100 |     12 |        0 |    4.3 |      6.7 |    100 |     6.24 |   0.61 |   83.9 |     0.6 |       83.2 |       16.8 |
| ranger | 72.5 |   9.91 |        3 |    3.2 |      8.4 |   98.9 |     8.39 |   0.79 |   74.8 |     2.1 |       93.8 |        6.2 |
|    geo | 63.5 |   8.79 |        3 |    2.3 |     10.3 |     96 |    10.08 |    0.7 |   73.4 |     3.4 |       89.3 |       10.7 |
| shadow |   98 |  11.82 |        3 |    8.4 |      9.7 |   98.4 |     9.11 |   0.79 |   79.3 |     0.7 |       82.4 |       17.6 |
|  hexer |   96 |  11.66 |        3 |      1 |        7 |   99.7 |      7.4 |   0.87 |     81 |     0.8 |       87.4 |       12.6 |
|    ALL | 80.4 |  10.34 |        3 |    3.8 |      8.9 |   97.9 |     8.96 |   0.79 |   76.7 |     2.1 |         87 |         13 |

[knight] deaths by floor: F1:13 F2:8 F3:50 F4:6 F5:2 F6:13 F7:2 F8:1
[knight] bosses: bone_tyrant 143/179 (79.9%), frost_colossus 58/58 (100%), orc_warlord 105/105 (100%), pit_lord 105/105 (100%), mother_slug 57/63 (90.5%)
[knight] death causes: skeleton:38 shade:29 imp:5 mudling:5 bone_tyrant:3 goblin:3
[knight] spells (casts/kills): Slash 6031c/1455k, Cleave 4466c/2172k, Shield Bash 3702c/632k, Charge 2818c/320k, Bulwark 2155c/40k, Lance 2075c/840k, Whirlwind 1827c/1902k, Rally 27c/1k
[pyro] deaths by floor: -
[pyro] bosses: bone_tyrant 200/200 (100%), frost_colossus 110/110 (100%), orc_warlord 200/200 (100%), pit_lord 200/200 (100%), mother_slug 90/90 (100%)
[pyro] death causes: -
[pyro] spells (casts/kills): Firebolt 3491c/1056k, Flame Wave 3194c/1819k, Meteor 3074c/3560k, Fire Ring 2122c/1217k, Heat Shield 1149c/53k, Inferno Line 915c/385k, Combustion 892c/248k, Blink Flare 135c/80k
[ranger] deaths by floor: F1:2 F2:2 F3:26 F4:2 F5:4 F6:13 F7:3 F10:2 F11:1
[ranger] bosses: bone_tyrant 186/196 (94.9%), mother_slug 68/74 (91.9%), frost_colossus 90/90 (100%), orc_warlord 148/148 (100%), pit_lord 145/145 (100%)
[ranger] death causes: skeleton:15 shade:14 mudling:7 mother_slug_area:6 imp:4 bone_tyrant:3
[ranger] spells (casts/kills): Arrow 3958c/1133k, Hawk 3566c/2543k, Piercing Shot 2727c/1381k, Vault 2627c/315k, Bear Trap 2569c/1478k, Volley 1017c/999k, Windstep 139c/4k, Snare Net 26c/0k
[geo] deaths by floor: F1:16 F2:12 F3:22 F4:8 F5:6 F6:4 F7:3 F10:2
[geo] bosses: bone_tyrant 162/172 (94.2%), mother_slug 45/48 (93.8%), frost_colossus 88/88 (100%), orc_warlord 129/129 (100%), pit_lord 127/127 (100%)
[geo] death causes: shade:37 skeleton:17 imp:6 mudling:5 goblin:3 chort:2
[geo] spells (casts/kills): Stone Fist 4619c/1166k, Earth Spike 4322c/3054k, Boulder 4180c/2067k, Stone Skin 2378c/7k, Raise Wall 1211c/678k, Sinkhole 717c/165k, Tremor 156c/112k, Quake 134c/148k
[shadow] deaths by floor: F3:4
[shadow] bosses: bone_tyrant 199/200 (99.5%), frost_colossus 102/102 (100%), orc_warlord 196/196 (100%), pit_lord 196/196 (100%), mother_slug 94/94 (100%)
[shadow] death causes: skeleton:3 shade:1
[shadow] spells (casts/kills): Shuriken 7078c/4426k, Fan of Knives 3562c/2127k, Caltrops 2651c/2556k, Poison Edge 2645c/102k, Swap 2365c/20k, Smoke 1664c/35k, Shadowstep 1557c/16k, Decoy 22c/0k
[hexer] deaths by floor: F3:7 F6:1
[hexer] bosses: bone_tyrant 197/200 (98.5%), frost_colossus 103/103 (100%), orc_warlord 192/192 (100%), pit_lord 192/192 (100%), mother_slug 90/90 (100%)
[hexer] death causes: skeleton:7 mudling:1
[hexer] spells (casts/kills): Life Drain 4237c/1734k, Bone Spear 3620c/790k, Curse 2581c/509k, Soul Swap 2344c/1829k, Wither 1752c/2854k, Corpse Explosion 1146c/1410k, Raise Dead 932c/2k, Bone Wall 630c/12k
[ALL] deaths by floor: F1:31 F2:22 F3:109 F4:16 F5:12 F6:31 F7:8 F8:1 F10:4 F11:1
[ALL] bosses: bone_tyrant 1087/1147 (94.8%), frost_colossus 551/551 (100%), orc_warlord 970/970 (100%), pit_lord 965/965 (100%), mother_slug 444/459 (96.7%)
[ALL] death causes: shade:81 skeleton:80 mudling:18 imp:15 mother_slug_area:10 goblin:9
[ALL] spells (casts/kills): Shuriken 7078c/4426k, Slash 6031c/1455k, Stone Fist 4619c/1166k, Cleave 4466c/2172k, Earth Spike 4322c/3054k, Life Drain 4237c/1734k, Boulder 4180c/2067k, Arrow 3958c/1133k, Shield Bash 3702c/632k, Bone Spear 3620c/790k, Hawk 3566c/2543k, Fan of Knives 3562c/2127k, Firebolt 3491c/1056k, Flame Wave 3194c/1819k, Meteor 3074c/3560k, Charge 2818c/320k, Piercing Shot 2727c/1381k, Caltrops 2651c/2556k, Poison Edge 2645c/102k, Vault 2627c/315k, Curse 2581c/509k, Bear Trap 2569c/1478k, Stone Skin 2378c/7k, Swap 2365c/20k, Soul Swap 2344c/1829k, Bulwark 2155c/40k, Fire Ring 2122c/1217k, Lance 2075c/840k, Whirlwind 1827c/1902k, Wither 1752c/2854k, Smoke 1664c/35k, Shadowstep 1557c/16k, Raise Wall 1211c/678k, Heat Shield 1149c/53k, Corpse Explosion 1146c/1410k, Volley 1017c/999k, Raise Dead 932c/2k, Inferno Line 915c/385k, Combustion 892c/248k, Sinkhole 717c/165k, Bone Wall 630c/12k, Tremor 156c/112k, Windstep 139c/4k, Blink Flare 135c/80k, Quake 134c/148k, Rally 27c/1k, Snare Net 26c/0k, Decoy 22c/0k
```

## v2_greedy

```
bot=greedy runs=200/class depth=0 grimoire=none frozen=true (70.139s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |    0 |   1.34 |        1 |    1.5 |     29.2 |     50 |    20.19 |   5.26 |   41.2 |    18.6 |       58.2 |         0 |
|   pyro |   36 |   7.73 |        5 |    8.5 |     12.9 |     89 |    11.26 |   1.08 |     74 |     3.7 |       70.9 |         0 |
| ranger |    2 |   2.19 |        1 |    4.1 |     14.5 |   81.3 |    15.16 |   2.96 |   55.3 |    11.2 |         87 |         0 |
|    geo |  1.5 |   1.81 |        1 |      3 |     16.2 |   82.3 |    15.14 |   3.43 |   46.9 |    16.3 |       71.2 |         0 |
| shadow |    2 |   2.49 |        2 |   15.6 |     24.6 |   56.6 |    21.36 |    2.4 |   67.9 |     6.2 |       75.3 |         0 |
|  hexer |   25 |   5.69 |        3 |    1.3 |     11.6 |   90.6 |    11.45 |   1.53 |   69.2 |     5.9 |       83.3 |         0 |
|    ALL | 11.1 |   3.54 |        2 |    6.2 |     14.3 |   84.7 |    13.79 |   2.01 |   62.6 |     8.7 |       75.5 |         0 |

[knight] deaths by floor: F1:150 F2:32 F3:18
[knight] bosses: bone_tyrant 3/18 (16.7%)
[knight] death causes: shade:126 skeleton:35 imp:32 bone_tyrant:4 spikes:2 stall:1
[knight] spells (casts/kills): Slash 1953c/217k, Cleave 1346c/297k, Shield Bash 1063c/74k, Bulwark 870c/2k, Charge 79c/10k, Lance 66c/11k, Whirlwind 35c/21k
[pyro] deaths by floor: F1:14 F2:12 F3:26 F4:9 F5:6 F6:19 F7:10 F8:4 F9:10 F10:8 F11:6 F12:4
[pyro] bosses: bone_tyrant 153/174 (87.9%), mother_slug 45/60 (75%), orc_warlord 92/100 (92%), frost_colossus 72/73 (98.6%), pit_lord 72/76 (94.7%)
[pyro] death causes: skeleton:36 imp:16 mother_slug_area:13 orc:12 goblin:8 chort:7
[pyro] spells (casts/kills): Firebolt 5000c/999k, Flame Wave 3900c/1196k, Fire Ring 2502c/964k, Heat Shield 2153c/38k, Meteor 1875c/1798k, Inferno Line 973c/155k, Combustion 944c/115k, Blink Flare 57c/26k
[ranger] deaths by floor: F1:105 F2:33 F3:45 F4:3 F5:2 F6:3 F7:2 F9:1 F10:2
[ranger] bosses: bone_tyrant 25/62 (40.3%), frost_colossus 9/9 (100%), orc_warlord 6/7 (85.7%), mother_slug 1/3 (33.3%), pit_lord 4/4 (100%)
[ranger] death causes: shade:102 skeleton:45 imp:28 bone_tyrant:7 spikes:3 mother_slug_area:2
[ranger] spells (casts/kills): Arrow 2302c/299k, Piercing Shot 1301c/215k, Bear Trap 1275c/529k, Vault 1166c/62k, Hawk 414c/257k, Volley 155c/59k, Snare Net 12c/0k
[geo] deaths by floor: F1:133 F2:39 F3:14 F4:3 F6:5 F9:1 F10:1 F11:1
[geo] bosses: bone_tyrant 16/28 (57.1%), mother_slug 2/6 (33.3%), frost_colossus 5/5 (100%), orc_warlord 5/6 (83.3%), pit_lord 3/3 (100%)
[geo] death causes: shade:108 skeleton:41 imp:34 spikes:3 mother_slug_area:3 bone_tyrant:2
[geo] spells (casts/kills): Stone Fist 1993c/178k, Boulder 1330c/318k, Stone Skin 978c/1k, Raise Wall 583c/115k, Earth Spike 464c/318k, Sinkhole 107c/14k, Quake 5c/3k, Tremor 4c/1k
[shadow] deaths by floor: F1:87 F2:29 F3:62 F4:6 F5:1 F6:4 F7:2 F9:1 F10:2 F11:1 F12:1
[shadow] bosses: bone_tyrant 33/84 (39.3%), frost_colossus 10/10 (100%), mother_slug 1/5 (20%), orc_warlord 8/9 (88.9%), pit_lord 4/5 (80%)
[shadow] death causes: shade:81 skeleton:68 imp:19 bone_tyrant:10 spikes:5 mother_slug_area:4
[shadow] spells (casts/kills): Shuriken 3861c/1244k, Swap 1919c/5k, Shadowstep 1787c/3k, Smoke 1493c/14k, Fan of Knives 606c/264k, Poison Edge 492c/10k, Caltrops 475c/407k, Decoy 4c/0k
[hexer] deaths by floor: F1:6 F2:14 F3:93 F4:6 F5:7 F6:12 F7:7 F8:2 F9:2 F11:1
[hexer] bosses: bone_tyrant 93/180 (51.7%), mother_slug 21/32 (65.6%), frost_colossus 42/42 (100%), orc_warlord 51/53 (96.2%), pit_lord 50/50 (100%)
[hexer] death causes: skeleton:72 bone_tyrant:22 shade:16 mother_slug_area:8 mudling:7 imp:6
[hexer] spells (casts/kills): Life Drain 3396c/1339k, Bone Spear 3383c/396k, Curse 2159c/272k, Soul Swap 1159c/823k, Wither 885c/1090k, Raise Dead 875c/0k, Bone Wall 633c/5k, Corpse Explosion 545c/344k
[ALL] deaths by floor: F1:495 F2:159 F3:258 F4:27 F5:16 F6:43 F7:21 F8:6 F9:15 F10:13 F11:9 F12:5
[ALL] bosses: bone_tyrant 323/546 (59.2%), mother_slug 70/106 (66%), orc_warlord 162/175 (92.6%), frost_colossus 138/139 (99.3%), pit_lord 133/138 (96.4%)
[ALL] death causes: shade:439 skeleton:297 imp:135 bone_tyrant:49 mother_slug_area:30 orc:17
[ALL] spells (casts/kills): Firebolt 5000c/999k, Flame Wave 3900c/1196k, Shuriken 3861c/1244k, Life Drain 3396c/1339k, Bone Spear 3383c/396k, Fire Ring 2502c/964k, Arrow 2302c/299k, Curse 2159c/272k, Heat Shield 2153c/38k, Stone Fist 1993c/178k, Slash 1953c/217k, Swap 1919c/5k, Meteor 1875c/1798k, Shadowstep 1787c/3k, Smoke 1493c/14k, Cleave 1346c/297k, Boulder 1330c/318k, Piercing Shot 1301c/215k, Bear Trap 1275c/529k, Vault 1166c/62k, Soul Swap 1159c/823k, Shield Bash 1063c/74k, Stone Skin 978c/1k, Inferno Line 973c/155k, Combustion 944c/115k, Wither 885c/1090k, Raise Dead 875c/0k, Bulwark 870c/2k, Bone Wall 633c/5k, Fan of Knives 606c/264k, Raise Wall 583c/115k, Corpse Explosion 545c/344k, Poison Edge 492c/10k, Caltrops 475c/407k, Earth Spike 464c/318k, Hawk 414c/257k, Volley 155c/59k, Sinkhole 107c/14k, Charge 79c/10k, Lance 66c/11k, Blink Flare 57c/26k, Whirlwind 35c/21k, Snare Net 12c/0k, Quake 5c/3k, Tremor 4c/1k, Decoy 4c/0k
```

## v2_random

```
bot=random runs=200/class depth=0 grimoire=none frozen=true (0.994s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |    0 |      1 |        1 |      0 |       18 |    100 |       13 |   6.97 |   40.1 |      12 |       48.7 |         0 |
|   pyro |    0 |   1.44 |        1 |   24.1 |     21.4 |   51.7 |    11.76 |   3.68 |   62.1 |     2.5 |       49.1 |         0 |
| ranger |    0 |   1.09 |        1 |   38.9 |     17.1 |   83.3 |    11.33 |   5.57 |   40.8 |     7.8 |       87.9 |         0 |
|    geo |    0 |   1.02 |        1 |      0 |      7.5 |    100 |    11.46 |   5.89 |   43.1 |    12.1 |       57.1 |         0 |
| shadow |    0 |   1.02 |        1 |     25 |     15.3 |    100 |    11.76 |   4.92 |   46.3 |     4.8 |       63.6 |         0 |
|  hexer |    0 |   1.84 |        2 |    9.6 |     15.5 |   73.1 |     9.83 |   4.64 |   56.8 |     3.8 |       57.7 |         0 |
|    ALL |    0 |   1.23 |        1 |     16 |     17.3 |     68 |    11.34 |   5.12 |   49.4 |     6.9 |       58.3 |         0 |

[knight] deaths by floor: F1:199 F2:1
[knight] bosses: -
[knight] death causes: skeleton:74 shade:67 imp:46 spikes:13
[knight] spells (casts/kills): Slash 1063c/41k, Cleave 655c/41k, Shield Bash 595c/11k, Bulwark 297c/0k, Lance 2c/0k
[pyro] deaths by floor: F1:129 F2:55 F3:16
[pyro] bosses: bone_tyrant 2/16 (12.5%)
[pyro] death causes: skeleton:84 imp:44 shade:41 caster:20 spikes:7 bolt?:2
[pyro] spells (casts/kills): Firebolt 1462c/62k, Flame Wave 873c/82k, Fire Ring 497c/161k, Heat Shield 469c/4k, Combustion 33c/0k, Meteor 25c/24k, Inferno Line 17c/1k
[ranger] deaths by floor: F1:184 F2:14 F3:2
[ranger] bosses: bone_tyrant 0/2 (0%)
[ranger] death causes: imp:75 skeleton:59 shade:52 spikes:9 caster:3 bone_tyrant:1
[ranger] spells (casts/kills): Arrow 898c/41k, Vault 541c/9k, Piercing Shot 519c/39k, Bear Trap 506c/149k, Hawk 4c/2k, Volley 1c/0k
[geo] deaths by floor: F1:197 F2:2 F3:1
[geo] bosses: bone_tyrant 0/1 (0%)
[geo] death causes: skeleton:77 shade:63 imp:48 spikes:11 bone_tyrant:1
[geo] spells (casts/kills): Stone Fist 1026c/17k, Boulder 670c/74k, Raise Wall 329c/13k, Stone Skin 312c/1k
[shadow] deaths by floor: F1:197 F2:2 F3:1
[shadow] bosses: bone_tyrant 0/1 (0%)
[shadow] death causes: skeleton:87 shade:57 imp:42 spikes:13 self:1
[shadow] spells (casts/kills): Shuriken 950c/82k, Shadowstep 572c/0k, Swap 569c/0k, Smoke 297c/0k, Fan of Knives 7c/2k, Poison Edge 4c/0k
[hexer] deaths by floor: F1:91 F2:53 F3:55 F5:1
[hexer] bosses: bone_tyrant 1/56 (1.8%)
[hexer] death causes: skeleton:83 shade:33 imp:29 caster:26 bone_tyrant:19 spikes:9
[hexer] spells (casts/kills): Bone Spear 1394c/56k, Life Drain 862c/319k, Curse 790c/24k, Raise Dead 415c/0k, Soul Swap 76c/61k, Bone Wall 37c/0k, Corpse Explosion 19c/8k, Wither 14c/10k
[ALL] deaths by floor: F1:997 F2:127 F3:75 F5:1
[ALL] bosses: bone_tyrant 3/76 (3.9%)
[ALL] death causes: skeleton:464 shade:313 imp:284 spikes:62 caster:49 bone_tyrant:22
[ALL] spells (casts/kills): Firebolt 1462c/62k, Bone Spear 1394c/56k, Slash 1063c/41k, Stone Fist 1026c/17k, Shuriken 950c/82k, Arrow 898c/41k, Flame Wave 873c/82k, Life Drain 862c/319k, Curse 790c/24k, Boulder 670c/74k, Cleave 655c/41k, Shield Bash 595c/11k, Shadowstep 572c/0k, Swap 569c/0k, Vault 541c/9k, Piercing Shot 519c/39k, Bear Trap 506c/149k, Fire Ring 497c/161k, Heat Shield 469c/4k, Raise Dead 415c/0k, Raise Wall 329c/13k, Stone Skin 312c/1k, Bulwark 297c/0k, Smoke 297c/0k, Soul Swap 76c/61k, Bone Wall 37c/0k, Combustion 33c/0k, Meteor 25c/24k, Corpse Explosion 19c/8k, Inferno Line 17c/1k, Wither 14c/10k, Fan of Knives 7c/2k, Hawk 4c/2k, Poison Edge 4c/0k, Lance 2c/0k, Volley 1c/0k
```

