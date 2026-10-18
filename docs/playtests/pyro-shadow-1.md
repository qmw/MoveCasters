# Playtest: Pyromancer + Shadowblade, 1 run each (text CLI)

Tester: AI agent (Claude), playing through `tools/cli.js`, almost always one move per call. I read DESIGN.md §1–5 first.
I opened `src/` only after spotting a suspected bug in play, to confirm it. Nothing I read there changed a move I made.

| Run | Class | Seed | Result | Picks |
|---|---|---|---|---|
| 1 | Pyromancer | 7331 | **Died on floor 8** (Orc Warrens, turn 8), killed by an Orc Warrior charge the CLI did not warn about | Empower Firebolt, Meteor, Combustion (later swapped for Inferno Line, then Blink Flare), relics Hourglass + Iron Heart, path Frozen |
| 2 | Shadowblade | 4242 | **Died on floor 4** (Rot Swamp, turn 16): pinned against the east wall by a slug's 3-wide swing at 1 HP | Fan of Knives, Decoy, relic Iron Heart, path Swamp |

---

## Run 1: Pyromancer (seed 7331)

- **F1–F2 (Crypt):** trivial. Flame Wave, Fire Ring and Kindling fire set up burning zones. **Zombies, skeletons and imps
  walk straight into burning tiles and die.** About half my kills were enemies suiciding into fire. Both floors were Swift
  and took no damage. Empowered Firebolt (2 damage, 29 tiles on the floor) erases most Crypt enemies from range.
- **F3 Bone Tyrant (11 HP):** Meteor (auto-targets the toughest enemy for 2) plus Heat Shield stun-lock (stun cancels the
  telegraph, then it burns). Killed on turn 10 at full HP. It raised only 1 skeleton, and that skeleton spawned stunned.
- **F4 Frozen (11 enemies on 7x8, 4 wraiths):** the first real floor. Heat Shield block stacks with no cap (I reached
  block 5). Two moments stood out:
  - **Ice-slide chains:** I stepped on an ice Meteor tile and slid across Heat Shield, Firebolt, Firebolt. That was four
    casts from one move.
  - **Friendly fire:** a Frost Zombie swing killed its neighbour.

  Wraiths were the only enemies that avoid fire. Chasing the last 2 wraiths around the room took about 8 turns and was the
  low point of the run.
- **F5 (12 enemies):** fun and busy. Ice chains, Flame Wave double kills, and a Meteor that re-targeted after its first
  victim dropped to 1 HP and killed two Bone Casters. Still at 5/5 HP.
- **F6 Frost Colossus (20 HP; DESIGN says 13):** it never reached me. Its 3x3 slam is telegraphed 2 phases ahead and is
  easy to step out of. I killed it with Meteors and one ice chain (Fire Ring, Firebolt, Meteor, Flame Wave), taking 0
  damage. **Six floors in, I had taken 0 damage.**
- **F7 Warrens (11 enemies, 5 Orc Warriors dealing 2 damage, goblins that move 2):** a big difficulty cliff, and the most
  intense and fun stretch of either run.
  - **Bug:** the CLI said a square was safe, but an orc's charge carried past its telegraphed target into me: 2 damage.
    Later I was boxed in with one legal move, which the CLI showed as "1 dmg". It cost 3. I was at 2/7 HP.
  - Then came the best play of the session. Blink Flare onto a square between 4 enemies: the explosion at my old square
    killed 2 goblins, 1 orc and 1 goblin (**MASSACRE**), and I teleported out. Next turn a Blink Flare into the wall
    exploded beside the last orc.
- **F8 (13 enemies, 6 orcs, 4 shamans):** I skipped the draft to heal to 3.
  - Turn 6: I worked out that orc B's charge would stop at goblin J and kill it, and that orc E's charge would then hit B
    instead of me. I moved into the only square that was safe *because of* that friendly fire, and it worked exactly.
    That is the Into the Breach payoff, and it felt great.
  - Two turns later I had one legal move. The CLI marked it "DANGER: 1", but an orc charge behind a goblin continued
    through the square and killed me.

## Run 2: Shadowblade (seed 4242)

- **F1 (Crypt, 4 imps, then vent skeletons and a zombie):** the opening was great. Swap pulled an imp into a stun for 3
  damage, Shuriken bounced, and imps killed each other. Then **one 1-HP skeleton took me from 5 HP to 1.**
  - It stood orthogonally adjacent and followed me into a corner. Its 3-wide swing covers both side squares, and "step
    straight away" was the wall.
  - None of the 4 Shadowblade starter spells can hit an orthogonally adjacent enemy. Every spell fires from the tile you
    step onto, in the direction you moved, and you cannot step into the enemy.
  - I lost 4 HP to "every option = 1 dmg" turns. I escaped only with Smoke, then kited until it was 2 squares away in a
    line. The Knight tester reported the same chaser trap.
- **F2 at 1 HP:** drafted Fan of Knives, which is the fix: it hits the first enemy in all 4 directions, so it hits
  adjacent enemies. Highlights:
  - A Fan double kill.
  - Imps are bishops, so an imp on the other square colour can never hit you. I found that out in play and enjoyed it.
  - Cleared the floor still at 1 HP.
- **F3 Bone Tyrant (17 HP):**
  - **Swap silently does nothing on bosses.** The spell text doesn't say so; the code has `if (u.boss) return`.
  - The boss mostly paced along the top row instead of chasing me.
  - The kill was the best combo of the session: Shadowstep up stunned it (3 damage) and teleported me behind it onto a
    Fan of Knives tile. The chained Fan hit the now-stunned boss for 1+2 Backstab and killed it.
  - Iron Heart plus the boss heal brought me to 6/7.
- **F4 Swamp (5 slugs, spitter, vent imps):**
  - Same pattern as F1: slugs chase, swing 3 wide and pin you to a wall. Each Swap kill landed me in the middle of the
    pack.
  - Friendly fire killed 4 enemies for me, which was fun.
  - I lost 1 HP per turn on 5 different turns because every option was "DANGER: 1". I died pinned against the east wall.

---

## 1. Results
- **Pyromancer:** died on floor 8/12 (Warrens) to an Orc Warrior charge the danger preview didn't show (see bug B1).
  Floors 1–6 were near-flawless; floors 7–8 took me from 7 HP to 0.
- **Shadowblade:** died on floor 4/12 (Swamp) to a Slug swing while pinned against a wall. It spent 3 floors at 1–2 HP
  because of the adjacent-chaser trap.

## 2. Stickiness (1–10)
- **Tension: 7.**
  - Pyro floors 1–6: 3. Zero damage taken; enemies walk into fire.
  - Pyro floors 7–8: 10.
  - Shadowblade: 8 throughout, but partly the bad kind: being at 1 HP because of unavoidable chip damage, not because of
    mistakes.
- **Depth of decisions: 7.**
  - At its best (ice chains, Blink Flare repositioning, predicting friendly fire, imp colour parity, chaining onto a Fan
    tile after a teleport) it is truly deep.
  - Depth drops when a chaser pins you and every option costs 1 HP. That is a forced loop, not a decision.
- **Clarity: 5.** The rules are mostly learnable from the CLI. But the danger preview is wrong in exactly the
  high-stakes cases (charges), the log names the wrong attacker, and the grid's 6-character columns are easy to misread
  (I cast the wrong spell twice by miscounting columns). See §5.
- **Desire to replay: 7.** The "one more floor" pull was real after the Massacre turn and the boss combo. I'd replay to
  try Combustion and Poison Edge builds. The Shadowblade wall-pin deaths dampened it.

## 3. Meaningful decisions? Do the classes feel different?
- Spell placement and approach direction clearly matter. Examples:
  - Firebolt down a column to snipe a caster.
  - Swap/Shadowstep only work along a line with a gap.
  - Ice tiles turn one move into 3–4 casts.
  - "Facing" a Blink Flare into a wall makes it a point-blank bomb.
- The classes feel **very** different:
  - The Pyromancer is a zone controller. It has AoE (Ring, Wave, Heat Shield), Kindling fire, and sustain from stacking
    block. It handles crowds and adjacency well.
  - The Shadowblade is a precision assassin: 3-damage burst along lines and teleport repositioning. It has **no answer to
    an adjacent enemy** until it drafts Fan of Knives (or Poison Edge), which makes melee chasers its nemesis.

  The difference is good, but the Shadowblade starter kit has a hole in it.

## 4. Difficulty curve
- **Too easy:**
  - Pyromancer floors 1–6. Enemy AI walks into burning ground (Kindling plus Ring/Wave are free kills).
  - Heat Shield block stacks without a cap.
  - Meteor auto-targets from anywhere.
  - Both bosses I faced as Pyro (Bone Tyrant, Frost Colossus) were trivial. The Colossus never got adjacent, and its slam
    is easy to dodge.
- **Too hard / spiky:**
  - Floor 7 (Warrens) has 5–6 Orc Warriors dealing 2-damage charges plus goblins that move 2 and wreck tiles, on a 7x9
    board. Combined with no healing between floors, a perfect run can drop from 7 HP to 2 in 4 turns.
  - Floor 4 has 11–12 enemies on 7x8 boards.
- **Unfair:**
  - Melee chasers (skeleton/slug) against a wall versus a class with no adjacent attack: guaranteed damage every turn.
  - The charge preview bug made 2 of my 3 hits on floors 7–8 feel unfair.
- **Trivial:**
  - Wraiths' only threat is time: they always hop away, so the last 1–2 wraiths become a tedious chase.
  - Orc Shamans never mattered in my few turns.
- **Doc mismatches:**
  - Boss HP is 1.5x the DESIGN.md values (17/20 instead of 11/13). My Pyro run's Bone Tyrant still had 11 HP, so this
    seems to have changed mid-session.
  - The Bone Tyrant raises 1 skeleton, not 2.

## 5. Clarity problems (CLI and rules)
1. **The danger preview is wrong for charges and lines** (bugs B1 and B2 below). This is the biggest problem, because
   it lies exactly when you are low on HP.
2. **The log names the wrong attacker:**
   - Projectile events from *my* spells print as "<last-killed enemy> shoots toward …". For example, Fan of Knives
     printed "B Skeleton shoots toward …" four times after B died.
   - An Orc Shaman heal prints as "D Orc Shaman shoots toward (4,6). [+1]".
3. **Damage sources aren't named.** "A Zombie takes 1 damage" might be spikes, burning or a vent block. Bare "Area effect
   on 6 squares" lines (a boss slam, Smoke, a Flame Wave into a wall with "0 squares") are noise.
4. **Vents aren't labelled.** A lone "1" danger mark on an empty square appears with no explanation, unlike the clear
   "DOOM: a shade will spawn at …" line.
5. **"x" means two things:** in the hazard column it is a corpse; in the danger column it is a delayed strike. Use
   different symbols.
6. **The boss timer is opaque:** "boss timer 4 — raises skeletons every 4th turn" is fine, but the Colossus line only
   says "boss timer 3". It should say "slams a 3x3 on you in N turns".
7. **Smoke** says "enemies cannot attack": already-telegraphed attacks still land. "Cannot track" is vague; enemies still
   moved toward me sometimes.
8. **The Swap danger hint** shows the danger of the tile you step on, but you end the turn on the swapped enemy's square.
9. **Swap doesn't affect bosses**, and the text doesn't say so.
10. **Empower text:**
    - "Firebolt+" still says "takes 1" (it deals 2).
    - "Cooldown -1" did nothing on a 1-cooldown spell (minimum 1).
    - "Swift: +1 draft option" sometimes showed only 2 options once the class pool was exhausted.
11. **Missing feedback:** a Flawless clear isn't reported (just "+3 embers"), and the boss heal (+2) isn't printed.
12. **Grid readability:** with 6-character cells and no column labels per row, I misread which tile was under a column
    twice. I worked around it by trusting the "YOUR OPTIONS" list. Possible fixes: a coordinate list of ready tiles per
    spell, or showing the 4 neighbours' spells directly (as the options already do).

## 6. Bugs (with repro)
- **B1. The danger preview ignores charge/line continuation past the hero's current square.**
  - Repro: Pyro seed 7331, floor 7 turn 5. The orc at (3,6) telegraphed "charges down … (now (3,8))". The option to move
    to (3,9) showed no danger; I took 2. Same again on floor 8 turns 7–8: the only move, to (4,8), showed "DANGER: 1"
    but cost 2 and killed me.
  - Cause: `dangerMap`/`intentMap` in `src/core/ai.js` use `lineTiles` from the enemy, which stops at the hero's
    *current* square. Squares beyond it along the line that the hero might move into are never marked.
  - Fix: re-simulate intents per candidate move, or mark the whole line up to range as "path".
- **B2. When a square has both swing damage and a charge path, only "DANGER: n" (the swing) is printed** (`cli.js`
  ~l.251, if/else). Example: Pyro F8 turn 6, option (6,7). Show both, summed.
- **B3. Log misattribution** of player projectiles to a dead enemy. Repro: Shadow seed 4242, F3 turn 6 (Fan after a
  Swap kill); Pyro F5 turn 10 ("A Skeleton shoots toward (4,1)" during my Inferno Line).
- **B4. Swap silently fizzles on bosses** (`spells.js` swap: `if (!u || u.boss) return;`). There is no log line and no
  mention in the description. Repro: Shadow F3 turn 2.
- **B5. Empower "cooldown -1" is a no-op on 1-cooldown spells**, and the empowered description isn't updated.
- **B6 (possibly intended).** Boss AI: the Bone Tyrant paced (5,1)↔(6,1)↔(7,1) for about 8 turns instead of chasing
  (Shadow F3 turns 2–9). The Pyro run's Bone Tyrant did chase.
- **B7. Doc and data mismatch:** boss HP, Bone Tyrant raise count, and the floor 4+ enemy counts are far above what
  DESIGN.md implies.

## 7. Top 5 design suggestions (ranked)
1. **Fix the adjacent-chaser / wall-pin trap.** It is the main source of both "unfair" damage and boredom. Options:
   - Give every class one starter tile that hits adjacent enemies (the Shadowblade could start with Fan of Knives instead
     of Smoke).
   - Or make "wait" cast the tile you stand on (or a weak class-specific jab) when it is ready.
   - Or have basic melee enemies hit only the target square, keeping the 3-wide swing for elites.

   Right now a 1-HP skeleton can strip 4 HP from a Shadowblade.
2. **Make the danger preview simulate the move:** charges and lines that continue, and the post-Swap or post-Blink
   landing square. Also add an explicit "safe moves" line. Preview correctness matters more than anything else in a game
   whose pillar is "deterministic and telegraphed".
3. **Smooth the curve and add a little sustain:**
   - Fewer orcs on floor 7, or orc charges deal 1 at depth 0.
   - Floor 4–5 enemy counts nearer 8.
   - +1 HP on a Flawless clear, so playing well is rewarded with buffer, not just Embers.
   - Pyro floors 1–6 need more pressure. Fix suggestion 4 below, cap block at 3, and make bosses threaten more (e.g. the
     Colossus also advances 2 on non-slam turns).
4. **Fire-aware AI:** enemies should avoid burning tiles unless there is no other path, as wraiths already do. Fire then
   becomes area denial you plan around, instead of an enemy self-destruct button.
5. **Improve readability and juice in the CLI/log:**
   - Correct attacker names, and name damage sources ("burns", "spikes", "vent").
   - Label vents.
   - Spell out boss timers in plain words.
   - Report Flawless and the boss heal.
   - Use distinct corpse vs delayed-strike symbols.
   - Keep the great "[DOUBLE KILL]/[MASSACRE]" callouts, which were genuinely motivating.

**Best moments, worth protecting:** ice-slide multi-casts; Blink Flare as a point-blank bomb or escape; predicting enemy
friendly fire to find the one safe square; Shadowstep → teleport onto a Fan tile → Backstab finisher; imp colour parity.
**Worst moments:** chasing hop-away wraiths; being pinned to a wall where every option deals damage; the preview saying
"safe" before a lethal charge.
