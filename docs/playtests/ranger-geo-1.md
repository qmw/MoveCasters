# Playtest: Ranger + Geomancer, 1 run each (text CLI)

Tester: AI agent (Claude). I played through `tools/cli.js` one move per call and read DESIGN.md §1–5 first. I only
opened `src/` after the runs, to confirm suspected bugs (`src/core/game.js` draft code, `tools/cli.js` labels). No code
knowledge was used during play.

| Run | Class | Seed | Result | Turns | Picks |
|---|---|---|---|---|---|
| 1 | Ranger | 7 | **Died on floor 5** (Frozen Vault, turn 12 of the floor). 43 kills, 13 embers | 75 | Windstep, Snare Net, Hawk+ (empower), relic Vampire Fang, Vault (replaced Snare Net) |
| 2 | Geomancer | 11 | **Died on floor 5** (Rot Swamp, turn 14 of the floor). 49 kills, 13 embers | 83 | Stone Skin, Quake, skip (heal), relic Iron Heart, skip (heal) |

Both runs died on floor 5, in different biomes. Both deaths came from the same pattern: I was pinned against a wall or
corner by 2+ melee enemies, and every legal move took damage.

---

## Run 1: Ranger (seed 7)

- **F1 (Crypt): Swift + Flawless, 11 turns.** Volley one-shot an imp and chunked a zombie. Zombies and imps killed each
  other by friendly fire twice. I noticed the "chess colour" rule for imps: an imp on an even square can never threaten
  you on an odd square. That was a nice discovery. Hawk sniped everything else.
- **F2 (Crypt): Swift + Flawless, 13 turns.** Best moments of the run:
  - An Arrow knockback pushed an elite zombie onto a vent. The vent blocked it and it died.
  - I dodged a Bone Caster's line shot, so the shot hit an imp behind me.
  - Windstep → Hawk chains (dash 3, cast the landing tile at +1) killed a zombie and the caster from across the board.
- **F3 (Bone Tyrant): Swift, 23 turns, took 2 damage.** The boss was not threatening.
  - Hawk stuns it, which cancels its swing *and* pauses its summon timer.
  - Arrow knockback is pointless against it: it just walks back.
  - It was finally killed by its own skeleton's swing.
  - The only damage I took came after the boss died. A lone skeleton pinned me against the bottom wall, and every option
    cost 1 HP for 2 turns.
- **F4 (Frozen Vault, the "breather" floor): Swift, 16 turns, HP 9→7.** It had 7 enemies plus 5 reinforcements, about
  the same as F2.
  - Four skeletons surrounded me on turn 4. Every move took damage for 4 turns in a row.
  - The Ranger can't hit anything orthogonally adjacent. Every spell fires from the destination square, and moving into
    an enemy is illegal. So when surrounded, my only tools were Hawk and stepping away.
- **F5 (Frozen Vault): died on turn 12.** The floor had **11 enemies (4 Bone Casters, 5 Frost Zombies, Wraith, Skeleton)
  plus 6 reinforcements** on a 7×7 board, starting at HP 7/9.
  - Opening Piercing Shots and Hawks were great: 4 kills in the first 5 turns.
  - Then three melee enemies and two wraiths converged on the left wall. From turn 9 on, every option did 3–4 damage.
  - The Vault "escape" leapt me back onto the square I started from (see bugs). Dead.

## Run 2: Geomancer (seed 11)

- **F1 (Crypt): Swift + Flawless, 14 turns.** Boulder is a great spell: 1 damage + shove to the wall + 2 Stoneblood
  collision = 3 damage at any range. Earth Spike (auto-targets nearest within 4) cleaned up.
- **F2 (Crypt): Swift, HP 7→2.** This was the floor where the Geomancer felt both best and worst.
  - Tremor made a skeleton swing and an imp swing land on their own allies (2 friendly-fire kills).
  - But an elite skeleton chased me across the board. Its 3-wide swing means the only clean dodge is straight away, so it
    pushed me toward walls again and again.
  - About 6 turns had no damage-free option.
- **F3 (Bone Tyrant) at 2 HP: Swift + Flawless, 17 turns.** This was the most tense and satisfying fight of the session.
  - A Boulder shoved a zombie into the boss: 5 damage in total.
  - A Stone Fist knocked the boss into its freshly raised skeleton: 5 damage and a kill.
  - Quake stunned the boss to cancel its 2-damage swing when I had 2 HP.
  - A Boulder finished it against the top wall.
  - **Every turn was a real puzzle, and the danger preview made it fair.** More fights like this, please.
- **F4 (Rot Swamp): Swift, HP 7→4.** Boulders up empty columns killed 3 enemies against the top wall. Tremor near walls is
  the star: it pushes enemies into walls and each other for collision damage. Spitters punished me once. I pushed a
  spitter with Tremor, and its lob (relative to the attacker) landed exactly on the square I moved to. The preview did
  warn me.
- **F5 (Rot Swamp): died on turn 14.** The floor had **9 enemies, 4 of them Mudlings that split into 2 Slimelings each, plus
  6 reinforcements**, starting at HP 5/9.
  - The highlight was a **Tremor triple kill** in a corner (pushed G, B and J into walls).
  - Then I was boxed into the bottom-right corner. For **5 consecutive turns my only legal move was `wait`**: up, left,
    down and right were all blocked by enemies or walls, and each turn did 2 damage. Stone Skin bought one turn. Dead.

---

## Ratings (1–10)

| | Ranger | Geomancer | Notes |
|---|---|---|---|
| **Tension** | 5 | 7 | Ranger F1–F3 were nearly risk-free (Flawless ×2, boss dealt 0). The Geo boss fight at 2 HP was a 9. Floor 5 tension turns into helplessness, not suspense. |
| **Depth of decisions** | 5 | 7 | Push/collision/friendly-fire geometry is genuinely deep, especially Tremor near walls, luring swings onto allies, and the vent block. But auto-target spells (Hawk, Earth Spike) and the "deals X, kills 1" preview often reduce a turn to "step on the tile that says kills 1". |
| **Clarity** | 7 | 7 | The CLI preview (end-square damage, chain casts, ice slides, pushes) is excellent. It loses points for ignoring stun cancels and Block, stale empowered descriptions, the `#51` unit, and the board columns being hard to scan. |
| **Desire to replay** | 6 | 7 | I want to try Geomancer again, building around Tremor/Boulder/Raise Wall. The Ranger felt solved by "Hawk + run away". Drafts dry up by floor 4, so a run stops changing after the first boss. |

## Turns with no good option or only one obvious option

- **Ranger (75 turns):**
  - About **11 turns where every option took damage**: F3 ×2, F4 ×4, F5 ×5.
  - About **10 turns with exactly one safe move**, almost always "step straight away from a melee swing".
  - About 25 more turns where the preview's "kills 1" made the choice obvious. Most of those were Hawk tiles.
- **Geomancer (83 turns):**
  - About **13 turns where every option took damage**: F2 ×5, F4 ×2, F5 ×6, including **5 turns with `wait` as the only
    legal move**.
  - About **9 turns with one safe move**.
  - About 20 turns where the choice was obvious.
- **In total, roughly 30% of turns had zero or one real option.** They cluster at walls and corners.

## Difficulty curve, unfair and trivial enemies

- **Curve: flat, then a cliff.** F1–F2 are easy (3 of 4 floors Flawless). The F3 boss is easy to moderate. F4 is
  moderate. **F5 is a wall in both biomes.**
  - F5 fields 9–11 enemies plus 6 reinforcements on 49–63 tiles.
  - Mudling splits push the effective count to about 17.
  - There is no healing between floors.
  - Both runs reached F5 at 5–7 HP and died within 14 turns.
- **The "breather" floor is not a breather.** F4 had 7 enemies plus 5 reinforcements, the same as F2, so the "25% fewer"
  rule barely shows. F5 then nearly doubles it.
- **Unfair:** a 3-wide melee swing plus a wall means a guaranteed hit. Two melee enemies on adjacent sides means no
  escape. One more in a corner means no legal move at all. Enemies pathfind straight into this, and the hero has no
  answer to orthogonally adjacent enemies except auto-target spells or Tremor.
- **Unfair-ish:** Wraiths add a hit nobody can dodge when you are already pinned.
- **Trivial:**
  - **Bone Tyrant.** Hawk stuns it, and the stun also freezes its summon timer. It raises only 1 skeleton per cycle
    (DESIGN says 2). Its own skeletons hit it. Knockback is undone by its next move. Both runs killed it without
    pressure.
  - **Imps** are pure friendly-fire fodder.
  - **Bone Casters** shoot their own allies when you sidestep.

## Did the classes feel distinct and fun?

- **Ranger: distinct, but shallow.**
  - The kit is "line shooter that kites". Windstep → Hawk chains and Volley double kills feel good.
  - **Hawk is dominant.** It targets the nearest enemy at any range, regardless of direction, deals 2 (3 empowered) and
    stuns. It has cooldown 4 and frequency 2, so it is almost always 1–2 steps away. It works against pillar 2 ("approach
    angle matters").
  - The Ranger has no way to hit or push an adjacent enemy, which makes swarms lethal.
  - **Vault** looks like the answer to adjacency, but it leaps away from your movement direction, and you can't move
    toward an adjacent enemy. When the leap is blocked you end where you started.
  - Steady Aim mostly fired by accident; I never planned around it.
- **Geomancer: distinct and fun. This was the better class.**
  - Boulder, Tremor and Stoneblood turn walls and crowds into weapons, so the board geometry *is* the damage.
  - The Tremor triple kill and the boss knocked into its own skeleton were the two best moments of the session.
  - Weak spots:
    - Stone Fist needs exactly one empty square between you and the enemy. In practice it rarely hits, and a common
      tile that does nothing feels bad.
    - Earth Spike is a second "auto-aim" button, like Hawk.

## Bugs (seed + moves)

1. **Unlabelled unit `#51` in the combat log.**
   - Repro: geo seed 11, floor 5 turn 6 (`left` onto Quake). The log shows `#51 takes 1 damage. #51 dies at (6,8)`.
   - Cause: `tools/cli.js:342` falls back to `#id` for units with no letter. Here it was a Slimeling spawned from a
     Mudling split in the same enemy phase.
2. **The danger preview ignores stun cancels and Block.**
   - Ranger seed 7, floor 3 turn 19, `down` (Hawk the boss): preview says "DANGER 2", real damage 0 (`[CANCELLED]`).
   - Geo seed 11, floor 3 turn 10, `down` (Quake): same.
   - Geo, any turn with Block: the preview shows the full telegraphed damage.
   - Effect: the safest move often looks like the most dangerous one.
3. **Empowered spell text is stale.** After drafting "EMPOWER Hawk" the legend reads `Hawk+ … strikes the nearest enemy
   for 2 … (empowered)`, but it deals 3. Repro: ranger seed 7 after floor 3. The previews show the correct numbers.
4. **Swift's "+1 draft option" can be empty.** `makeDraft` (`src/core/game.js:240`) only fills from the remaining base
   pool (4 spells per class without Grimoire) plus at most one empower, offered at a 60% chance.
   - Ranger seed 7: F2 Swift gave only 3 options.
   - F4 Swift gave **2 options** (Bear Trap, Vault) and no empower.
   - After floor 3 a run has almost nothing left to draft.
5. **Vault with a blocked leap leaves you on your starting square.** Repro: ranger seed 7, floor 5 turn 10, at (1,5) with
   an enemy at (1,4).
   - `down` onto the Vault at (1,6) reports "you END at (1,5)": you never leave the danger square, and the arrow fires
     into empty space.
   - If this is intended, the hero should at least stay on (1,6).
6. **Bone Tyrant summon count doesn't match DESIGN.md.** DESIGN §5 says "raises 2 skeletons"; it raised exactly 1 every
   cycle (ranger seed 7 F3: C, D, E, F; geo seed 11 F3: C, D, E). Either update the doc or the boss.
7. (Minor) The Bone Tyrant does not move during the phase in which it raises skeletons. That is fine, but it isn't shown
   in the BOSS SCHEDULE line.

## Top 5 design suggestions (ranked) to boost engagement and the "one more run" feeling

1. **Break the wall/corner coffin.** This is the single biggest source of "no choice" turns and the cause of both deaths.
   Options, from least to most invasive:
   - (a) Bumping an adjacent enemy shoves it 1 square, with no damage except Stoneblood collisions. This makes it a real
     choice, not free melee.
   - (b) Weak enemies (1 dmg, non-elite) telegraph only the target square. Keep the 3-wide swing for elites and bosses.
   - (c) Waiting on a spent tile gives 1 Block (max 1).
   - (d) Enemies avoid ending their move in a square that boxes you in completely.
2. **Smooth the floor 4→5 cliff.**
   - Cap enemies plus reinforcements by board area, for example at 25% of tiles counting splits.
   - Scale later floors through elites and affixes instead of raw count.
   - Make the biome's first floor a real breather.
   - Add a small sustain hook, such as +1 HP on Swift or an optional "rest instead of draft".
   - Both runs arrived at F5 already bleeding with no way to recover.
3. **Keep drafts interesting all run.**
   - Always offer at least one empower when the pool is short, and allow empowering the same spell more than once.
   - Add deck-shaping options: remove a spell, raise or lower its frequency.
   - Add tile "runes", for example "Arrow tiles also push", "Boulder leaves rubble", "+1 frequency".
   - Swift should always give something; a free reroll is the fallback.
   - Today the build is locked by floor 3, which kills the variety a roguelite needs.
4. **Make auto-target spells respect approach angle.** Hawk and Earth Spike should pick the nearest enemy in the 90° cone
   ahead of your move, or in the forward half-board. This puts pillar 2 back into the two most-cast spells. It also turns
   "step on the kills-1 tile" into "step on it from the right side", and nerfs Hawk's dominance without a number change.
5. **Give each run a hook and each death a "next time".**
   - At death, show progress toward the next unlock (e.g. "Geomancer: 12/60 kills to unlock Fissure"), plus the best
     floor and best combo.
   - Add a short **floor contract** at the start of each floor, e.g. "kill 3 by collision" or "no damage from casters",
     for a bonus Ember.
   - Show a **preview of the next floor** (biome, enemy count, elite) on the path choice.
   - Geomancer's collision kills and Ranger's Windstep chains are fun; reward and surface them.

Smaller notes:
- Show the effect of stuns and Block in the danger preview.
- Rework Stone Fist so it hits the adjacent enemy in front of your *previous* square, i.e. a push-away punch.
- Turn Vault into "leap away from the nearest adjacent enemy".
- Let Steady Aim show on the board as a highlight.
