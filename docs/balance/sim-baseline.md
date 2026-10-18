# Simulation baseline (pre rules-rewrite)

> Snapshot of the **old** core rules (bump attacks, interior walls/pits/lava, spell tiles on `g.board`/`g.recharge`).
> The core is being rewritten, so these numbers are a historical reference, not a current target.

How to reproduce: `node tools/sim.js --bot planner|greedy|random --runs 200 --cls all [--no-frozen] [--grimoire all]`.
Settings: depth 0. The planner searches 5 plies with a beam of 16. "frozen" means the Frozen path is unlocked and the bot picks a path at random; `--no-frozen` means every run goes to the Swamp.

What the columns mean:
- **close%**: share of cleared floors that ended at 2 HP or less.
- **dense%**: share of turns where at least 2 actions take no damage and their 1-ply scores differ by 20 or more.
- **forced%**: share of turns where every action leads to damage.
- **spellKill% / bumpKill%**: who gets credit for kills. The rest goes to burn, poison, allies or other sources.

## planner_frozen

```
bot=planner runs=200/class depth=0 grimoire=none frozen=true plies=5 beam=16 (110.059s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight | 53.5 |   9.02 |        6 |     15 |       18 |     87 |     1.64 |   2.19 |   59.7 |       3 |       15.4 |      72.5 |
|   pyro |    2 |   3.25 |        3 |      9 |       17 |   84.4 |     2.17 |   2.01 |   57.8 |     4.2 |         21 |      51.7 |
| ranger |    0 |   2.93 |        3 |    1.6 |     15.7 |   88.1 |     1.52 |   2.46 |   55.6 |     5.4 |       24.3 |        62 |
|    geo |    0 |   2.97 |        3 |    0.8 |     16.9 |   85.8 |     1.93 |   2.68 |   54.1 |     6.7 |       17.7 |      71.3 |
| shadow |    0 |   2.78 |        3 |    9.8 |       20 |   78.1 |     1.49 |   2.29 |   57.3 |       4 |        5.6 |      77.7 |
|  hexer |    4 |   3.48 |        3 |    2.4 |     16.2 |   87.9 |     1.93 |   2.77 |   56.8 |     5.4 |       21.5 |        56 |
|    ALL |  9.9 |   4.07 |        3 |    9.3 |     17.5 |   85.9 |     1.76 |   2.35 |   57.6 |     4.4 |       17.1 |      67.2 |

[knight] deaths by floor: F2:1 F3:25 F4:1 F5:5 F6:46 F8:5 F9:6 F10:2 F12:2
[knight] bosses: bone_tyrant 188/199 (94.5%), mother_slug 52/74 (70.3%), frost_colossus 94/94 (100%), orc_warlord 114/117 (97.4%), pit_lord 109/109 (100%)
[knight] death causes: shade:23 mudling:23 mother_slug_area:14 skeleton:12 bone_tyrant:9 masked:2
[knight] spells (casts/kills): Whirlwind 578c/579k, Charge 568c/241k, Cleave 532c/346k, Bulwark 506c/2k, Shield Bash 383c/121k, Lance 345c/229k, Taunt 25c/0k, Rally 18c/1k
[pyro] deaths by floor: F1:3 F2:3 F3:186 F6:1 F8:1 F10:1 F11:1
[pyro] bosses: bone_tyrant 26/194 (13.4%), mother_slug 0/1 (0%), frost_colossus 7/7 (100%), orc_warlord 6/6 (100%), pit_lord 4/4 (100%)
[pyro] death causes: skeleton:128 bone_tyrant:50 shade:7 caster:6 spikes:1 mother_slug_area:1
[pyro] spells (casts/kills): Fire Ring 354c/169k, Heat Shield 342c/5k, Flame Wave 279c/125k, Firebolt 246c/127k, Meteor 127c/109k, Inferno Line 44c/8k, Combustion 20c/1k
[ranger] deaths by floor: F1:3 F2:8 F3:189
[ranger] bosses: bone_tyrant 10/189 (5.3%)
[ranger] death causes: skeleton:115 bone_tyrant:72 shade:6 caster:4 stall:3
[ranger] spells (casts/kills): Arrow 213c/124k, Bear Trap 209c/146k, Piercing Shot 207c/130k, Vault 148c/69k, Hawk 81c/45k, Volley 33c/18k
[geo] deaths by floor: F1:3 F2:4 F3:192 F6:1
[geo] bosses: bone_tyrant 7/193 (3.6%), mother_slug 1/1 (100%)
[geo] death causes: skeleton:110 bone_tyrant:77 caster:5 shade:4 stall:2 spikes:1
[geo] spells (casts/kills): Stone Skin 413c/0k, Boulder 239c/162k, Earth Spike 184c/98k, Stone Fist 154c/82k, Raise Wall 151c/79k, Tremor 5c/10k, Quake 1c/0k
[shadow] deaths by floor: F1:10 F2:24 F3:166
[shadow] bosses: bone_tyrant 0/166 (0%)
[shadow] death causes: skeleton:107 bone_tyrant:62 caster:16 shade:14 spikes:1
[shadow] spells (casts/kills): Smoke 238c/3k, Shuriken 214c/82k, Swap 127c/0k, Shadowstep 101c/0k, Fan of Knives 51c/8k, Poison Edge 49c/0k, Caltrops 46c/26k
[hexer] deaths by floor: F1:1 F2:4 F3:179 F4:1 F5:3 F6:2 F11:2
[hexer] bosses: bone_tyrant 29/195 (14.9%), frost_colossus 8/8 (100%), orc_warlord 10/10 (100%), pit_lord 8/8 (100%), mother_slug 2/4 (50%)
[hexer] death causes: skeleton:109 bone_tyrant:66 shade:7 caster:4 mudling:2 mother_slug_area:1
[hexer] spells (casts/kills): Life Drain 359c/119k, Raise Dead 252c/0k, Bone Spear 232c/117k, Curse 194c/42k, Corpse Explosion 125c/200k, Wither 95c/118k, Soul Swap 61c/57k, Bone Wall 24c/0k
[ALL] deaths by floor: F1:20 F2:44 F3:937 F4:2 F5:8 F6:50 F8:6 F9:6 F10:3 F11:3 F12:2
[ALL] bosses: bone_tyrant 260/1136 (22.9%), mother_slug 55/80 (68.8%), frost_colossus 109/109 (100%), orc_warlord 130/133 (97.7%), pit_lord 121/121 (100%)
[ALL] death causes: skeleton:581 bone_tyrant:336 shade:61 caster:36 mudling:26 mother_slug_area:16
[ALL] spells (casts/kills): Whirlwind 578c/579k, Charge 568c/241k, Cleave 532c/346k, Bulwark 506c/2k, Stone Skin 413c/0k, Shield Bash 383c/121k, Life Drain 359c/119k, Fire Ring 354c/169k, Lance 345c/229k, Heat Shield 342c/5k, Flame Wave 279c/125k, Raise Dead 252c/0k, Firebolt 246c/127k, Boulder 239c/162k, Smoke 238c/3k, Bone Spear 232c/117k, Shuriken 214c/82k, Arrow 213c/124k, Bear Trap 209c/146k, Piercing Shot 207c/130k, Curse 194c/42k, Earth Spike 184c/98k, Stone Fist 154c/82k, Raise Wall 151c/79k, Vault 148c/69k, Meteor 127c/109k, Swap 127c/0k, Corpse Explosion 125c/200k, Shadowstep 101c/0k, Wither 95c/118k, Hawk 81c/45k, Soul Swap 61c/57k, Fan of Knives 51c/8k, Poison Edge 49c/0k, Caltrops 46c/26k, Inferno Line 44c/8k, Volley 33c/18k, Taunt 25c/0k, Bone Wall 24c/0k, Combustion 20c/1k, Rally 18c/1k, Tremor 5c/10k, Quake 1c/0k
```

## planner_base

```
bot=planner runs=200/class depth=0 grimoire=none frozen=false plies=5 beam=16 (106.207s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |   22 |    7.1 |        6 |   14.6 |     18.4 |     86 |     1.69 |   2.23 |   58.4 |     3.8 |       13.3 |      77.9 |
|   pyro |    0 |   3.09 |        3 |    6.9 |     16.6 |   84.7 |     2.12 |   2.03 |   57.5 |     4.4 |       19.1 |      53.9 |
| ranger |    0 |   2.93 |        3 |    1.6 |     15.7 |   88.1 |     1.52 |   2.46 |   55.6 |     5.4 |       24.3 |        62 |
|    geo |    0 |   2.97 |        3 |    0.8 |       17 |   85.8 |     1.93 |   2.68 |   54.1 |     6.6 |       17.7 |      71.4 |
| shadow |    0 |   2.78 |        3 |    9.8 |       20 |   78.1 |     1.49 |   2.29 |   57.3 |       4 |        5.6 |      77.7 |
|  hexer |  1.5 |   3.29 |        3 |      2 |     15.9 |     87 |     1.92 |   2.83 |   55.5 |     5.7 |       20.1 |      57.4 |
|    ALL |  3.9 |   3.69 |        3 |    8.1 |     17.5 |   85.3 |     1.77 |   2.39 |   56.8 |     4.8 |       15.9 |      69.5 |

[knight] deaths by floor: F2:1 F3:25 F4:1 F5:8 F6:111 F9:4 F10:1 F11:2 F12:3
[knight] bosses: bone_tyrant 188/199 (94.5%), mother_slug 122/165 (73.9%), orc_warlord 52/54 (96.3%), pit_lord 46/47 (97.9%)
[knight] death causes: mudling:51 shade:40 mother_slug_area:29 skeleton:12 bone_tyrant:9 slug:4
[knight] spells (casts/kills): Bulwark 491c/3k, Charge 467c/164k, Cleave 432c/272k, Whirlwind 401c/368k, Shield Bash 322c/82k, Lance 269c/157k, Taunt 6c/1k, Rally 4c/0k
[pyro] deaths by floor: F1:3 F2:3 F3:186 F4:1 F6:6 F11:1
[pyro] bosses: bone_tyrant 26/194 (13.4%), mother_slug 3/7 (42.9%), orc_warlord 1/1 (100%)
[pyro] death causes: skeleton:128 bone_tyrant:50 shade:7 caster:6 mudling:3 mother_slug_area:3
[pyro] spells (casts/kills): Heat Shield 337c/5k, Fire Ring 326c/147k, Flame Wave 260c/112k, Firebolt 218c/108k, Meteor 112c/78k, Inferno Line 39c/9k, Combustion 19c/0k
[ranger] deaths by floor: F1:3 F2:8 F3:189
[ranger] bosses: bone_tyrant 10/189 (5.3%)
[ranger] death causes: skeleton:115 bone_tyrant:72 shade:6 caster:4 stall:3
[ranger] spells (casts/kills): Arrow 213c/124k, Bear Trap 209c/146k, Piercing Shot 207c/130k, Vault 148c/69k, Hawk 81c/45k, Volley 33c/18k
[geo] deaths by floor: F1:3 F2:4 F3:192 F6:1
[geo] bosses: bone_tyrant 7/193 (3.6%), mother_slug 0/1 (0%)
[geo] death causes: skeleton:110 bone_tyrant:77 shade:5 caster:5 stall:2 spikes:1
[geo] spells (casts/kills): Stone Skin 412c/0k, Boulder 238c/161k, Earth Spike 186c/99k, Stone Fist 153c/81k, Raise Wall 151c/79k, Tremor 5c/10k, Quake 1c/0k
[shadow] deaths by floor: F1:10 F2:24 F3:166
[shadow] bosses: bone_tyrant 0/166 (0%)
[shadow] death causes: skeleton:107 bone_tyrant:62 caster:16 shade:14 spikes:1
[shadow] spells (casts/kills): Smoke 238c/3k, Shuriken 214c/82k, Swap 127c/0k, Shadowstep 101c/0k, Fan of Knives 51c/8k, Poison Edge 49c/0k, Caltrops 46c/26k
[hexer] deaths by floor: F1:1 F2:4 F3:179 F5:3 F6:9 F7:1
[hexer] bosses: bone_tyrant 29/195 (14.9%), mother_slug 6/13 (46.2%), orc_warlord 3/3 (100%), pit_lord 3/3 (100%)
[hexer] death causes: skeleton:109 bone_tyrant:66 shade:10 caster:4 mother_slug_area:4 mudling:1
[hexer] spells (casts/kills): Life Drain 348c/115k, Raise Dead 253c/0k, Bone Spear 221c/108k, Curse 192c/39k, Corpse Explosion 99c/166k, Wither 83c/90k, Soul Swap 50c/49k, Bone Wall 16c/0k
[ALL] deaths by floor: F1:20 F2:44 F3:937 F4:2 F5:11 F6:127 F7:1 F9:4 F10:1 F11:3 F12:3
[ALL] bosses: bone_tyrant 260/1136 (22.9%), mother_slug 131/186 (70.4%), orc_warlord 56/58 (96.6%), pit_lord 49/50 (98%)
[ALL] death causes: skeleton:581 bone_tyrant:336 shade:82 mudling:55 mother_slug_area:36 caster:36
[ALL] spells (casts/kills): Bulwark 491c/3k, Charge 467c/164k, Cleave 432c/272k, Stone Skin 412c/0k, Whirlwind 401c/368k, Life Drain 348c/115k, Heat Shield 337c/5k, Fire Ring 326c/147k, Shield Bash 322c/82k, Lance 269c/157k, Flame Wave 260c/112k, Raise Dead 253c/0k, Boulder 238c/161k, Smoke 238c/3k, Bone Spear 221c/108k, Firebolt 218c/108k, Shuriken 214c/82k, Arrow 213c/124k, Bear Trap 209c/146k, Piercing Shot 207c/130k, Curse 192c/39k, Earth Spike 186c/99k, Stone Fist 153c/81k, Raise Wall 151c/79k, Vault 148c/69k, Swap 127c/0k, Meteor 112c/78k, Shadowstep 101c/0k, Corpse Explosion 99c/166k, Wither 83c/90k, Hawk 81c/45k, Fan of Knives 51c/8k, Soul Swap 50c/49k, Poison Edge 49c/0k, Caltrops 46c/26k, Inferno Line 39c/9k, Volley 33c/18k, Combustion 19c/0k, Bone Wall 16c/0k, Taunt 6c/1k, Tremor 5c/10k, Rally 4c/0k, Quake 1c/0k
```

## greedy_frozen

```
bot=greedy runs=200/class depth=0 grimoire=none frozen=true (7.439s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |    0 |   2.65 |        3 |    5.5 |     22.8 |   67.5 |     1.99 |   3.32 |   54.4 |     9.6 |        5.2 |      81.8 |
|   pyro |    0 |   1.59 |        1 |   20.3 |       27 |   55.1 |     2.52 |   3.35 |   50.1 |     9.3 |        6.9 |      61.8 |
| ranger |    0 |   1.36 |        1 |   26.8 |     26.6 |   54.9 |     1.68 |   4.63 |   45.1 |    11.1 |       10.6 |      68.9 |
|    geo |    0 |   1.58 |        1 |   16.5 |     37.5 |   29.6 |     2.49 |   4.67 |   45.7 |      12 |          5 |      72.4 |
| shadow |    0 |   1.21 |        1 |   33.3 |     36.5 |   28.6 |      1.8 |   4.28 |     50 |     9.4 |        1.7 |      72.9 |
|  hexer |    0 |   1.81 |        2 |    6.8 |     26.7 |   49.7 |     1.96 |   4.23 |   47.6 |    10.5 |        7.3 |      65.4 |
|    ALL |    0 |    1.7 |        1 |   12.6 |     27.2 |   54.1 |     2.08 |   3.98 |   49.1 |    10.3 |          6 |      72.1 |

[knight] deaths by floor: F1:25 F2:40 F3:123 F4:6 F5:5 F6:1
[knight] bosses: bone_tyrant 34/135 (25.2%), frost_colossus 1/1 (100%)
[knight] death causes: shade:76 bone_tyrant:73 skeleton:37 caster:8 frost:2 stall:2
[knight] spells (casts/kills): Bulwark 420c/1k, Cleave 194c/62k, Charge 176c/47k, Shield Bash 144c/18k, Lance 61c/15k, Whirlwind 59c/36k
[pyro] deaths by floor: F1:114 F2:54 F3:32
[pyro] bosses: bone_tyrant 1/32 (3.1%)
[pyro] death causes: shade:112 skeleton:59 bone_tyrant:15 caster:12 spikes:1 stall:1
[pyro] spells (casts/kills): Heat Shield 271c/1k, Fire Ring 196c/51k, Flame Wave 150c/20k, Firebolt 140c/30k, Meteor 29c/19k, Inferno Line 9c/0k, Combustion 7c/0k
[ranger] deaths by floor: F1:147 F2:35 F3:18
[ranger] bosses: bone_tyrant 0/18 (0%)
[ranger] death causes: shade:137 skeleton:45 caster:10 bone_tyrant:5 spikes:3
[ranger] spells (casts/kills): Piercing Shot 155c/32k, Arrow 109c/24k, Bear Trap 103c/60k, Vault 55c/19k, Hawk 22c/16k, Volley 11c/6k
[geo] deaths by floor: F1:114 F2:57 F3:29
[geo] bosses: bone_tyrant 0/29 (0%)
[geo] death causes: shade:127 skeleton:55 caster:11 bone_tyrant:5 stall:1 spikes:1
[geo] spells (casts/kills): Stone Skin 325c/0k, Boulder 156c/48k, Stone Fist 131c/9k, Raise Wall 122c/28k, Earth Spike 51c/30k
[shadow] deaths by floor: F1:165 F2:28 F3:7
[shadow] bosses: bone_tyrant 0/7 (0%)
[shadow] death causes: shade:127 skeleton:64 caster:7 spikes:2
[shadow] spells (casts/kills): Smoke 136c/0k, Shuriken 121c/22k, Swap 91c/0k, Shadowstep 73c/0k, Fan of Knives 8c/0k, Poison Edge 4c/0k, Caltrops 2c/0k
[hexer] deaths by floor: F1:85 F2:69 F3:46
[hexer] bosses: bone_tyrant 0/46 (0%)
[hexer] death causes: shade:101 skeleton:61 caster:19 bone_tyrant:16 spikes:2 stall:1
[hexer] spells (casts/kills): Life Drain 241c/72k, Raise Dead 148c/0k, Bone Spear 143c/27k, Curse 136c/4k, Soul Swap 15c/12k, Wither 13c/14k, Corpse Explosion 10c/10k, Bone Wall 3c/0k
[ALL] deaths by floor: F1:650 F2:283 F3:255 F4:6 F5:5 F6:1
[ALL] bosses: bone_tyrant 35/267 (13.1%), frost_colossus 1/1 (100%)
[ALL] death causes: shade:680 skeleton:321 bone_tyrant:114 caster:67 spikes:9 stall:5
[ALL] spells (casts/kills): Bulwark 420c/1k, Stone Skin 325c/0k, Heat Shield 271c/1k, Life Drain 241c/72k, Fire Ring 196c/51k, Cleave 194c/62k, Charge 176c/47k, Boulder 156c/48k, Piercing Shot 155c/32k, Flame Wave 150c/20k, Raise Dead 148c/0k, Shield Bash 144c/18k, Bone Spear 143c/27k, Firebolt 140c/30k, Smoke 136c/0k, Curse 136c/4k, Stone Fist 131c/9k, Raise Wall 122c/28k, Shuriken 121c/22k, Arrow 109c/24k, Bear Trap 103c/60k, Swap 91c/0k, Shadowstep 73c/0k, Lance 61c/15k, Whirlwind 59c/36k, Vault 55c/19k, Earth Spike 51c/30k, Meteor 29c/19k, Hawk 22c/16k, Soul Swap 15c/12k, Wither 13c/14k, Volley 11c/6k, Corpse Explosion 10c/10k, Inferno Line 9c/0k, Fan of Knives 8c/0k, Combustion 7c/0k, Poison Edge 4c/0k, Bone Wall 3c/0k, Caltrops 2c/0k
```

## greedy_base

```
bot=greedy runs=200/class depth=0 grimoire=none frozen=false (8.194s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |    0 |   2.67 |        3 |    6.3 |       23 |   67.1 |     1.92 |   3.31 |   54.3 |     9.6 |        5.2 |      81.7 |
|   pyro |    0 |   1.59 |        1 |   20.3 |       27 |   55.1 |     2.52 |   3.35 |   50.1 |     9.3 |        6.9 |      61.8 |
| ranger |    0 |   1.36 |        1 |   26.8 |     26.6 |   54.9 |     1.68 |   4.63 |   45.1 |    11.1 |       10.6 |      68.9 |
|    geo |    0 |   1.58 |        1 |   16.5 |     37.5 |   29.6 |     2.49 |   4.67 |   45.7 |      12 |          5 |      72.4 |
| shadow |    0 |   1.21 |        1 |   33.3 |     36.5 |   28.6 |      1.8 |   4.28 |     50 |     9.4 |        1.7 |      72.9 |
|  hexer |    0 |   1.81 |        2 |    6.8 |     26.7 |   49.7 |     1.96 |   4.23 |   47.6 |    10.5 |        7.3 |      65.4 |
|    ALL |    0 |    1.7 |        1 |   12.8 |     27.2 |     54 |     2.06 |   3.98 |   49.1 |    10.3 |          6 |        72 |

[knight] deaths by floor: F1:25 F2:40 F3:123 F4:3 F5:6 F6:3
[knight] bosses: bone_tyrant 34/135 (25.2%), mother_slug 0/3 (0%)
[knight] death causes: shade:75 bone_tyrant:73 skeleton:37 caster:7 mother_slug_area:2 stall:2
[knight] spells (casts/kills): Bulwark 415c/1k, Cleave 190c/63k, Charge 175c/48k, Shield Bash 139c/19k, Whirlwind 57c/36k, Lance 48c/12k
[pyro] deaths by floor: F1:114 F2:54 F3:32
[pyro] bosses: bone_tyrant 1/32 (3.1%)
[pyro] death causes: shade:112 skeleton:59 bone_tyrant:15 caster:12 spikes:1 stall:1
[pyro] spells (casts/kills): Heat Shield 271c/1k, Fire Ring 196c/51k, Flame Wave 150c/20k, Firebolt 140c/30k, Meteor 29c/19k, Inferno Line 9c/0k, Combustion 7c/0k
[ranger] deaths by floor: F1:147 F2:35 F3:18
[ranger] bosses: bone_tyrant 0/18 (0%)
[ranger] death causes: shade:137 skeleton:45 caster:10 bone_tyrant:5 spikes:3
[ranger] spells (casts/kills): Piercing Shot 155c/32k, Arrow 109c/24k, Bear Trap 103c/60k, Vault 55c/19k, Hawk 22c/16k, Volley 11c/6k
[geo] deaths by floor: F1:114 F2:57 F3:29
[geo] bosses: bone_tyrant 0/29 (0%)
[geo] death causes: shade:127 skeleton:55 caster:11 bone_tyrant:5 stall:1 spikes:1
[geo] spells (casts/kills): Stone Skin 325c/0k, Boulder 156c/48k, Stone Fist 131c/9k, Raise Wall 122c/28k, Earth Spike 51c/30k
[shadow] deaths by floor: F1:165 F2:28 F3:7
[shadow] bosses: bone_tyrant 0/7 (0%)
[shadow] death causes: shade:127 skeleton:64 caster:7 spikes:2
[shadow] spells (casts/kills): Smoke 136c/0k, Shuriken 121c/22k, Swap 91c/0k, Shadowstep 73c/0k, Fan of Knives 8c/0k, Poison Edge 4c/0k, Caltrops 2c/0k
[hexer] deaths by floor: F1:85 F2:69 F3:46
[hexer] bosses: bone_tyrant 0/46 (0%)
[hexer] death causes: shade:101 skeleton:61 caster:19 bone_tyrant:16 spikes:2 stall:1
[hexer] spells (casts/kills): Life Drain 241c/72k, Raise Dead 148c/0k, Bone Spear 143c/27k, Curse 136c/4k, Soul Swap 15c/12k, Wither 13c/14k, Corpse Explosion 10c/10k, Bone Wall 3c/0k
[ALL] deaths by floor: F1:650 F2:283 F3:255 F4:3 F5:6 F6:3
[ALL] bosses: bone_tyrant 35/267 (13.1%), mother_slug 0/3 (0%)
[ALL] death causes: shade:679 skeleton:321 bone_tyrant:114 caster:66 spikes:9 stall:5
[ALL] spells (casts/kills): Bulwark 415c/1k, Stone Skin 325c/0k, Heat Shield 271c/1k, Life Drain 241c/72k, Fire Ring 196c/51k, Cleave 190c/63k, Charge 175c/48k, Boulder 156c/48k, Piercing Shot 155c/32k, Flame Wave 150c/20k, Raise Dead 148c/0k, Bone Spear 143c/27k, Firebolt 140c/30k, Shield Bash 139c/19k, Smoke 136c/0k, Curse 136c/4k, Stone Fist 131c/9k, Raise Wall 122c/28k, Shuriken 121c/22k, Arrow 109c/24k, Bear Trap 103c/60k, Swap 91c/0k, Shadowstep 73c/0k, Whirlwind 57c/36k, Vault 55c/19k, Earth Spike 51c/30k, Lance 48c/12k, Meteor 29c/19k, Hawk 22c/16k, Soul Swap 15c/12k, Wither 13c/14k, Volley 11c/6k, Corpse Explosion 10c/10k, Inferno Line 9c/0k, Fan of Knives 8c/0k, Combustion 7c/0k, Poison Edge 4c/0k, Bone Wall 3c/0k, Caltrops 2c/0k
```

## random_frozen

```
bot=random runs=200/class depth=0 grimoire=none frozen=true (1.119s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |    0 |   1.41 |        1 |   14.6 |     17.3 |     78 |     0.71 |   5.91 |   50.5 |       5 |        0.7 |      89.5 |
|   pyro |    0 |   1.08 |        1 |   62.5 |     15.8 |   81.3 |     0.48 |   4.69 |     46 |     4.3 |          5 |      83.4 |
| ranger |    0 |   1.09 |        1 |   58.8 |     16.8 |   76.5 |     0.51 |   5.59 |     45 |     4.6 |          4 |      85.8 |
|    geo |    0 |   1.13 |        1 |     50 |     18.8 |   73.1 |     0.52 |   6.29 |   45.6 |     5.8 |        0.9 |      90.6 |
| shadow |    0 |   1.05 |        1 |   44.4 |     16.1 |   88.9 |     0.48 |   4.81 |   45.7 |     4.6 |          1 |      90.4 |
|  hexer |    0 |   1.16 |        1 |     50 |     19.9 |   62.5 |     0.58 |   5.86 |   48.7 |       5 |        1.7 |      81.9 |
|    ALL |    0 |   1.15 |        1 |   35.7 |     17.7 |   75.3 |     0.56 |   5.56 |   47.3 |     4.9 |        1.9 |      87.2 |

[knight] deaths by floor: F1:129 F2:60 F3:11
[knight] bosses: bone_tyrant 0/11 (0%)
[knight] death causes: shade:127 caster:25 imp:19 skeleton:14 spikes:8 bone_tyrant:6
[knight] spells (casts/kills): Shield Bash 55c/0k, Cleave 49c/2k, Bulwark 46c/0k, Charge 44c/2k, Lance 3c/1k, Whirlwind 3c/1k
[pyro] deaths by floor: F1:185 F2:14 F3:1
[pyro] bosses: bone_tyrant 0/1 (0%)
[pyro] death causes: shade:80 skeleton:79 imp:27 caster:7 spikes:6 lava:1
[pyro] spells (casts/kills): Fire Ring 30c/11k, Firebolt 28c/2k, Flame Wave 24c/2k, Heat Shield 22c/1k
[ranger] deaths by floor: F1:183 F2:17
[ranger] bosses: -
[ranger] death causes: shade:89 skeleton:66 imp:26 spikes:13 caster:6
[ranger] spells (casts/kills): Bear Trap 33c/9k, Arrow 30c/2k, Vault 27c/2k, Piercing Shot 21c/2k
[geo] deaths by floor: F1:174 F2:26
[geo] bosses: -
[geo] death causes: shade:103 skeleton:51 imp:26 caster:11 spikes:9
[geo] spells (casts/kills): Boulder 34c/3k, Raise Wall 32c/0k, Stone Fist 29c/1k, Stone Skin 23c/0k
[shadow] deaths by floor: F1:191 F2:9
[shadow] bosses: -
[shadow] death causes: skeleton:78 shade:76 imp:33 spikes:9 caster:3 lava:1
[shadow] spells (casts/kills): Swap 30c/0k, Shuriken 26c/3k, Shadowstep 23c/0k, Smoke 21c/0k
[hexer] deaths by floor: F1:169 F2:30 F3:1
[hexer] bosses: bone_tyrant 0/1 (0%)
[hexer] death causes: shade:94 skeleton:62 imp:19 caster:16 spikes:8 bone_tyrant:1
[hexer] spells (casts/kills): Raise Dead 39c/0k, Bone Spear 37c/1k, Life Drain 31c/7k, Curse 26c/0k, Soul Swap 1c/0k, Bone Wall 1c/0k
[ALL] deaths by floor: F1:1031 F2:156 F3:13
[ALL] bosses: bone_tyrant 0/13 (0%)
[ALL] death causes: shade:569 skeleton:350 imp:150 caster:68 spikes:53 bone_tyrant:7
[ALL] spells (casts/kills): Shield Bash 55c/0k, Cleave 49c/2k, Bulwark 46c/0k, Charge 44c/2k, Raise Dead 39c/0k, Bone Spear 37c/1k, Boulder 34c/3k, Bear Trap 33c/9k, Raise Wall 32c/0k, Life Drain 31c/7k, Fire Ring 30c/11k, Arrow 30c/2k, Swap 30c/0k, Stone Fist 29c/1k, Firebolt 28c/2k, Vault 27c/2k, Shuriken 26c/3k, Curse 26c/0k, Flame Wave 24c/2k, Stone Skin 23c/0k, Shadowstep 23c/0k, Heat Shield 22c/1k, Piercing Shot 21c/2k, Smoke 21c/0k, Lance 3c/1k, Whirlwind 3c/1k, Soul Swap 1c/0k, Bone Wall 1c/0k
```

## planner_grim

```
bot=planner runs=200/class depth=0 grimoire=all frozen=true plies=5 beam=16 (118.353s)
|  class | win% | meanFl | medDeath | close% | turns/fl | swift% | casts/fl | dmg/fl | dense% | forced% | spellKill% | bumpKill% |
|--------|------|--------|----------|--------|----------|--------|----------|--------|--------|---------|------------|-----------|
| knight |   52 |   9.26 |        6 |   15.7 |     18.5 |   85.8 |     1.71 |   2.12 |   58.5 |     2.8 |       11.5 |      73.5 |
|   pyro |    1 |   3.15 |        3 |    8.3 |     15.4 |   89.1 |     2.03 |   2.03 |   58.4 |     4.4 |         21 |        54 |
| ranger |  0.5 |   3.01 |        3 |      3 |     15.5 |   87.8 |     1.58 |   2.46 |   54.8 |     5.4 |       28.2 |      59.1 |
|    geo |    0 |   3.08 |        3 |    1.9 |     17.4 |   84.3 |     1.92 |   2.63 |   54.2 |     5.9 |       17.3 |      69.1 |
| shadow |    0 |   2.84 |        3 |   10.4 |     18.9 |   79.6 |     1.46 |   2.23 |   57.4 |     4.1 |        5.8 |      76.3 |
|  hexer |  2.5 |    3.4 |        3 |    2.7 |     14.8 |   88.2 |     1.85 |    2.9 |   55.5 |     5.9 |       23.4 |      56.6 |
|    ALL |  9.3 |   4.12 |        3 |    9.9 |     17.3 |   85.9 |     1.75 |   2.33 |   56.9 |     4.3 |       15.8 |      67.6 |

[knight] deaths by floor: F3:26 F5:1 F6:44 F7:1 F8:3 F9:5 F10:3 F11:5 F12:8
[knight] bosses: bone_tyrant 187/200 (93.5%), mother_slug 74/87 (85.1%), frost_colossus 85/86 (98.8%), orc_warlord 124/125 (99.2%), pit_lord 109/112 (97.3%)
[knight] death causes: shade:29 mudling:21 bone_tyrant:11 mother_slug_area:11 skeleton:10 orc:5
[knight] spells (casts/kills): Cleave 622c/343k, Charge 613c/257k, Bulwark 422c/2k, Riposte 408c/13k, Shield Bash 384c/125k, Whirlwind 248c/256k, Lance 204c/135k, Valor 160c/0k, Execute 114c/43k
[pyro] deaths by floor: F1:3 F2:5 F3:184 F6:5 F11:1
[pyro] bosses: bone_tyrant 19/192 (9.9%), mother_slug 0/5 (0%), frost_colossus 3/3 (100%), orc_warlord 3/3 (100%), pit_lord 2/2 (100%)
[pyro] death causes: skeleton:109 bone_tyrant:74 shade:6 mother_slug_area:4 spikes:2 mudling:1
[pyro] spells (casts/kills): Heat Shield 308c/2k, Fire Ring 299c/127k, Flame Wave 229c/68k, Firebolt 219c/96k, Meteor 88c/79k, Cinder Storm 61c/70k, Pyroclasm 25c/53k, Inferno Line 24c/7k, Magma Wall 18c/5k, Combustion 11c/0k
[ranger] deaths by floor: F1:3 F2:5 F3:190 F6:1
[ranger] bosses: bone_tyrant 3/192 (1.6%), frost_colossus 1/1 (100%), orc_warlord 1/1 (100%), pit_lord 1/1 (100%), mother_slug 0/1 (0%)
[ranger] death causes: skeleton:104 bone_tyrant:83 shade:6 caster:3 mother_slug_area:1 spikes:1
[ranger] spells (casts/kills): Arrow 230c/116k, Bear Trap 220c/138k, Piercing Shot 206c/136k, Vault 157c/70k, Rain of Arrows 46c/97k, Ricochet 36c/66k, Hawk 21c/13k, Smoke Bomb 17c/0k, Volley 12c/7k, Mark Prey 5c/1k
[geo] deaths by floor: F1:3 F2:2 F3:190 F6:2 F7:1 F8:1 F11:1
[geo] bosses: bone_tyrant 15/195 (7.7%), mother_slug 1/2 (50%), frost_colossus 2/3 (66.7%), orc_warlord 1/1 (100%)
[geo] death causes: skeleton:110 bone_tyrant:77 stall:4 shade:3 spikes:2 caster:2
[geo] spells (casts/kills): Stone Skin 409c/0k, Boulder 238c/162k, Stone Fist 173c/84k, Raise Wall 169c/108k, Earth Spike 71c/44k, Geode 58c/7k, Fissure 52c/38k, Tremor 4c/6k, Sinkhole 3c/2k, Landslide 3c/4k
[shadow] deaths by floor: F1:10 F2:14 F3:175 F4:1
[shadow] bosses: bone_tyrant 5/176 (2.8%)
[shadow] death causes: skeleton:114 bone_tyrant:59 shade:14 caster:11 spikes:2
[shadow] spells (casts/kills): Smoke 269c/3k, Shuriken 212c/89k, Swap 116c/0k, Shadowstep 104c/0k, Fan of Knives 36c/10k, Death Mark 29c/1k, Caltrops 19c/12k, Garrote 16c/0k, Poison Edge 15c/0k, Assassinate 12c/6k
[hexer] deaths by floor: F1:1 F2:3 F3:183 F5:1 F6:3 F7:1 F11:3
[hexer] bosses: bone_tyrant 24/196 (12.2%), frost_colossus 7/7 (100%), orc_warlord 8/8 (100%), pit_lord 5/5 (100%), mother_slug 3/5 (60%)
[hexer] death causes: skeleton:109 bone_tyrant:71 caster:5 orc:2 shade:2 mother_slug_area:2
[hexer] spells (casts/kills): Life Drain 329c/119k, Raise Dead 220c/0k, Bone Spear 213c/115k, Curse 172c/38k, Wither 125c/133k, Corpse Explosion 95c/182k, Soul Swap 60c/50k, Lich Form 35c/0k, Bone Wall 7c/0k
[ALL] deaths by floor: F1:20 F2:29 F3:948 F4:1 F5:2 F6:55 F7:3 F8:4 F9:5 F10:3 F11:10 F12:8
[ALL] bosses: bone_tyrant 253/1151 (22%), mother_slug 78/100 (78%), frost_colossus 98/100 (98%), orc_warlord 137/138 (99.3%), pit_lord 117/120 (97.5%)
[ALL] death causes: skeleton:556 bone_tyrant:375 shade:60 mudling:23 caster:22 mother_slug_area:19
[ALL] spells (casts/kills): Cleave 622c/343k, Charge 613c/257k, Bulwark 422c/2k, Stone Skin 409c/0k, Riposte 408c/13k, Shield Bash 384c/125k, Life Drain 329c/119k, Heat Shield 308c/2k, Fire Ring 299c/127k, Smoke 269c/3k, Whirlwind 248c/256k, Boulder 238c/162k, Arrow 230c/116k, Flame Wave 229c/68k, Bear Trap 220c/138k, Raise Dead 220c/0k, Firebolt 219c/96k, Bone Spear 213c/115k, Shuriken 212c/89k, Piercing Shot 206c/136k, Lance 204c/135k, Stone Fist 173c/84k, Curse 172c/38k, Raise Wall 169c/108k, Valor 160c/0k, Vault 157c/70k, Wither 125c/133k, Swap 116c/0k, Execute 114c/43k, Shadowstep 104c/0k, Corpse Explosion 95c/182k, Meteor 88c/79k, Earth Spike 71c/44k, Cinder Storm 61c/70k, Soul Swap 60c/50k, Geode 58c/7k, Fissure 52c/38k, Rain of Arrows 46c/97k, Ricochet 36c/66k, Fan of Knives 36c/10k, Lich Form 35c/0k, Death Mark 29c/1k, Pyroclasm 25c/53k, Inferno Line 24c/7k, Hawk 21c/13k, Caltrops 19c/12k, Magma Wall 18c/5k, Smoke Bomb 17c/0k, Garrote 16c/0k, Poison Edge 15c/0k, Volley 12c/7k, Assassinate 12c/6k, Combustion 11c/0k, Bone Wall 7c/0k, Mark Prey 5c/1k, Tremor 4c/6k, Sinkhole 3c/2k, Landslide 3c/4k
```

## Bone Tyrant what-if experiments

These ran the planner at 100 runs/class on a scratch copy of `src/` (the real `src/` was not modified).
"brittle" means skeletons summoned by the Tyrant have 1 HP. ty = Bone Tyrant kill rate.

| variant | knight win/ty | pyro | ranger | geo | shadow | hexer | ALL win / ty | mean floor |
|---|---|---|---|---|---|---|---|---|
| baseline (11 HP, 2 skel / 4 turns) | 53.5 / 94.5 | 2 / 13 | 0 / 5 | 0 / 4 | 0 / 0 | 4 / 15 | 9.9 / 23 | 4.07 |
| summon 1 | 50 / 100 | 3 / 32 | 0 / 15 | 0 / 13 | 0 / 2 | 12 / 34 | 10.8 / 34 | 4.42 |
| summon 1, HP 10 | 61 / 100 | 7 / 43 | 2 / 21 | 2 / 21 | 0 / 4 | 11 / 38 | 13.8 / 39 | 4.76 |
| HP 9 | 53 / 98 | 4 / 31 | 0 / 18 | 0 / 8 | 0 / 0 | 5 / 22 | 10.3 / 31 | 4.29 |
| cap: no summon if 4+ enemies | 52 / 82 | 4 / 27 | 0 / 5 | 0 / 6 | 0 / 1 | 7 / 20 | 10.5 / 25 | 4.23 |
| brittle | 56 / 92 | 10 / 46 | 0 / 13 | 2 / 10 | 0 / 2 | 17 / 54 | 14.2 / 37 | 4.79 |
| brittle + summon 1 | 47 / 100 | 15 / 68 | 6 / 46 | 8 / 56 | 0 / 15 | 37 / 77 | 18.8 / 62 | 5.89 |
| **brittle + summon 1 + HP 9** | 59 / 100 | 16 / 82 | 12 / 69 | 20 / 71 | 0 / 34 | 35 / 87 | **23.7 / 75** | 6.67 |
| brittle + 2 skel / 5 turns + HP 9 | 63 / 100 | 14 / 67 | 7 / 38 | 3 / 36 | 0 / 12 | 23 / 69 | 18.3 / 55 | 5.72 |
| summon 1, HP 8 | 57 / 100 | 13 / 64 | 4 / 51 | 2 / 41 | 0 / 11 | 10 / 54 | 14.3 / 55 | 5.08 |
