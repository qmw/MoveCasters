# Playtest — Knight, 2 runs (text CLI)

Tester: AI agent (Claude), playing through `tools/cli.js` one move per call (sometimes 2–3 when obviously safe).
I read DESIGN.md §1–5 first. I only read `src/` after spotting suspected problems in play, to confirm them. The places
where that knowledge then affected my play are marked **[used code knowledge]**.

| Run | Seed | Result | Turns | Draft / relic picks |
|---|---|---|---|---|
| 1 | 1234 | **Died on floor 1** (turn 70) to Shades. Soft-locked: the last enemies couldn't be killed | 70 | — |
| 2 | 777 | **Died on floor 4** (Rot Swamp, turn 7) after being surrounded by slugs and imps and rooted by slime | 4 floors | Charge, Holy Nova, Rally (replaced Bulwark), relic Iron Heart |

---

## Run 1 (seed 1234): floor 1 soft-lock

- Floor 1 (Crypt): 3 zombies, 1 skeleton, 1 imp, plus vent reinforcements. The early game was fun. I sniped the skeleton with
  Smite from 3 squares away, and zombies killed both imps by **friendly fire** (that felt great and very ITB).
- Zombies (3 HP, slow) took a long time to kill. One zombie (D) kept re-telegraphing a 3-square swing around me while I
  was pinned in the bottom-right corner. Six turns went by with only "dodge" moves.
- I missed par (22). The Dark rose and shades started spawning every 4 turns.
- **The core problem:** shades (speed 1, any direction) always end their move adjacent to you, orthogonally or
  diagonally. Every Knight spell fires *forward from the square you step onto*, so an enemy adjacent to your previous
  square can never be in front of you. **An adjacent chaser can't be hit by any starting Knight spell.** I proved this to
  myself on the board, then confirmed the movement code. The only ways to kill such a shade are:
  - friendly fire from another shade, but the attacker always survives, so one shade always remains;
  - spikes (shades walk on spikes), but you can only lure them there through very fiddly AI manipulation **[used code knowledge]**;
  - sniping *newly spawned* shades before they reach you (I did this 4 times).
- I tried for ~30 turns. Block from stacking Bulwark reached **14**. Then I waited to see what happens and died on turn 70.
- Result: a starting-deck Knight who misses par on floor 1 **cannot win that floor**. It is a slow death.

## Run 2 (seed 777): floors 1–3 cleared, died on floor 4

- **F1 (Crypt):** 2 elite zombies (4 HP), skeletons, vents. The same chaser problem appeared with a skeleton (E). A
  skeleton that is orthogonally adjacent follows you forever and you can't hit it. I killed it by standing still next to
  it while it stood on a spike tile, and **took 3 hits to do it** (HP 7→4). Zombies are slow, which gives you openings,
  and two zombies killed each other's HP by friendly fire. Cleared on turn 21, 1 turn over par. Drafted **Charge**.
- **F2 (Crypt):** 4 Bone Casters + skeleton. This was the best floor of the session:
  - Ranged enemies keep their distance, so they line up for you.
  - Shield Throw knocked a caster into a skeleton (collision damage killed the caster).
  - Charge slid me onto a Smite tile and chain-cast it into a caster, and later slammed another one.
  - The last imp became another chase puzzle. Bishop-moving imps are locked to one square colour and stall next to you.
    I solved it by Charging far away and then Charging back into it as it approached. Clever, but only because I'd
    worked out the AI. Cleared SWIFT. Drafted **Holy Nova**.
- **F3 (Bone Tyrant, 17 HP):** a good boss fight. Opening Charge→Lance chain, Charge escapes to regain distance,
  Smite and Lance down its column as it approached, Holy Nova when it was close, and its own swings killed its raised
  skeletons. Stunning it also *delayed its skeleton raise*. Won with HP 4/9 after the boss heal. Drafted Rally
  (replaced Bulwark). Relic Iron Heart → HP 8/9.
- **F4 (Swamp):** **8 enemies at turn 0** (5 imps, 3 slugs), plus vents (another slug, a spitter). On turn 3 a Holy Nova
  hit 4 enemies, but on turn 4 I was **boxed in on the bottom wall by 3 slugs. Every move was illegal (no melee), and
  "wait" was the only option.** I took 3 damage, then moved onto slime and got rooted, then took 3 more and died. From
  HP 8 to 0 in 3 turns, and I had no real choice in 2 of them.

---

## Ratings

| Axis | Score | Why |
|---|---|---|
| Tension | **7/10** | Telegraphs plus friendly fire make every enemy phase readable and exciting. The Dark clock adds pressure. Lost points because tension often turned into helplessness (soft-lock, forced waits) rather than hard choices. |
| Depth of decisions | **6/10** | Ranged enemies and lining up approach angles are deep and satisfying, and Charge chains are excellent. But against melee chasers the deep decision collapses into "dodge straight away and wait for an opening". The best tricks (spike luring, imp colour parity) depend on hidden AI tie-break order. |
| Clarity | **7/10** | The CLI is excellent: per-option previews (casts X / quiet / danger N / "in shot path"), telegraph lines, recharge countdowns. Problems are listed below. |
| Desire to replay | **6/10** | Run 2 floors 2–3 were genuinely "one more turn". Run 1's soft-lock and floor 4's ambush would make a human player quit in frustration rather than retry. |

## Were decisions meaningful?

- **Yes, when enemies are 2+ squares away.**
  - Approach direction really mattered: "step into (6,7) from the left to Smite B down the row".
  - So did spell placement, e.g. which Lance tile lines up with the boss's column.
  - Recharging tiles create real routing puzzles. More than once I miscounted a cooldown by 1 and arrived on a spent tile.
- **No, once an enemy is adjacent.**
  - Every move is either "step straight away" (the only clean dodge, and it casts in the wrong direction) or
    "take a hit".
  - **Obvious-only turns:** dodging a slow zombie's swing in a corner (run 1, turns 6–13); imp stalemates.
  - **No-option turns:** run 1 shades (no possible win), and run 2 floor 4, turns 4–6 (surrounded; "wait" was the only
    legal move twice).
- Bulwark is an auto-pick tile: stacking block with no cap (block 14 in run 1) makes routing over BU tiles trivially right.

## Difficulty curve

- **Floor 1 is too hard for the wrong reason.** The difficulty is not the enemies but the Knight's blind spot. Missing
  par on floor 1 is easy, because 3-HP zombies plus vents take ~25 turns against a par of 20–22. After that the Knight
  is effectively dead.
- **Floor 2 (casters) is about right and the most fun.** Ranged enemies suit a line-caster.
- **Floor 3 boss is fair and well designed.** It is beatable with Charge plus Holy Nova. Without Holy Nova (pure starting
  deck) I suspect the Tyrant would be as unkillable as the shades once adjacent, since it is a speed-1 orthogonal chaser.
- **Floor 4 is a cliff.** It went from 5 enemies to 8 at turn 0, plus 4+ vents, swarm enemies (imps) and root slime.
  I went from 8/9 to dead in 4 turns.
- **Unfair:** the Shade (unkillable when adjacent for line-casters) and walls plus slugs body-blocking you (no-option
  turns). **Trivial:** Bone Casters, which die to anything aligned. Imps are both: trivial to dodge (colour-bound), and
  tedious to kill.

## Clarity problems (CLI; likely the same in the UI)

1. **Strike log names only the target square.** `A Bone Tyrant strikes (5,4)` is followed by `C Skeleton takes 2 damage`
   where C stands at (6,4) (the side square of the swing). It reads like a bug. Print all hit squares or the victim's square.
2. **The danger map sums damage naively.** It ignores that an attacker will die earlier in the same enemy phase from
   friendly fire. For example, it showed "DANGER 1/2/3" for squares where the attacker was going to be killed first by
   another enemy's swing. Either resolve in order, or mark it "(may be cancelled)".
3. **Spike damage to enemies isn't labelled.** It shows `B Zombie takes 1 damage` right under *my* cast line, which reads as
   if my spell did it. Same for the vent block damage (`[BLOCKED] ... takes 1 damage`).
4. **"Area effect on 0/1/3 squares"** after Lance or Holy Nova is noise. It counts squares, not enemies, and appears even
   when facing a wall.
5. **Slow zombies:** "moves every other turn" plus "telegraphs land 1 phase later" is hard to track. A "next action: turn N"
   counter per slow enemy would help. I misjudged their timing several times.
6. **Steel is consumed by spike damage.** It's technically "a hit", but it felt bad to lose Steel to my own path choice
   while holding 4 block. Order of absorption (Steel before Block) isn't stated anywhere.
7. **Stun doesn't stop movement.** A stunned zombie still walked away. DESIGN.md only says stun cancels the telegraph.
   Spell text "stunned (its attack is cancelled)" is accurate but players will assume a full skip.
8. **No hint about the Knight's adjacency blind spot.** The tooltip should warn that line spells start on the next square
   and can never hit an enemy you just walked away from.
9. **Doc drift:** DESIGN.md §5 lists Bone Tyrant 11 HP (it had 17 HP in game, presumably scaling), and imps aren't listed
   for the Swamp, but they are in its roster.

## Bugs / suspected bugs

1. **Soft-lock: an adjacent Shade can't be killed by a Knight with the starting deck (critical design bug).**
   - Repro: seed 1234; play floor 1 slowly so par (22) passes with enemies still alive; let the shades reach you.
   - Proof: after your move, any enemy that ends adjacent to your previous square can't be on your new square plus k
     steps in your move direction. Shades (speed 1, any direction, re-close every phase, phase movement ignores spikes)
     therefore never get hit.
   - Friendly-fire kills always leave the attacker alive.
   - Result: forced death (run 1 died turn 70). The same applies, less harshly, to skeletons and other speed-1 orthogonal
     chasers, which you can only escape with Charge or kill with Holy Nova.
2. **Events still resolve after `*** YOU DIED ***`.** Seed 1234 turn 70 shows `O Shade takes 1 damage / dies` printed
   *after* the death line (remaining enemy strikes kept resolving). Cosmetic, but the end-of-run log is misleading.
3. **Lance and Holy Nova report "Area effect on 0 squares"** when cast against a wall (seed 1234 turn 46, Lance up from
   (6,1)). Cosmetic.
4. **Charge slam damage looks inconsistent.**
   - Seed 777 F2 turn 20: Charge down from (3,2), slid 1 square to (3,3) and stopped against the imp at (3,4). The log
     shows only the chained Lance hitting the imp, with no "slam 2 dmg + stun" line.
   - F3 turn 6 slam: the log printed the slam's "takes 2 damage" *after* the chained Shield Throw push, at the new
     square (5,5). So the slam resolves after the chain, against the pushed target.
   - Worth checking the order: dash → slam → chain cast is what the text implies.
5. **Possible:** the danger preview for side squares of swings uses the *current* telegraph even when the attacker will
   be killed earlier in the phase (see Clarity #2). The same thing appears in the "you would be hit" warning on shot
   paths: it was shown when my move would kill the shooter. That warning is correct-but-misleading rather than wrong.

## Top 5 design suggestions (ranked)

1. **Give the Knight (and line-casters generally) an answer to adjacent enemies in the starter kit.** Options:
   - Make Shield Throw (the basic spell) hit the square *behind* you as well, or fire backward when the square ahead is
     empty.
   - Add a "bump" interaction: moving into an enemy casts your current tile's spell at it and keeps you in place.
   - Make Holy Nova a starter instead of Bulwark.

   This single change removes the soft-lock, the imp stalemates and most "dodge-only" turns.
2. **Shades must be killable and should end the floor.** Possible fixes:
   - Shades die after N turns, or when they strike.
   - Shades take double damage.
   - Once the Dark rises, every shade dies when the last *real* enemy dies, so the Dark is a pressure clock, not a death
     sentence.
3. **Prevent no-option turns.** Possible fixes:
   - Let the hero swap places with or shove a body-blocking enemy (taking 1 damage).
   - Make "wait" re-cast the tile you're standing on (if ready) in the last direction you moved.
   - Cap the number of enemies that can surround you.

   Also re-check swamp slime: being rooted while surrounded is a death sentence with no counterplay.
4. **Smooth the floor-4 spike.**
   - Floor 4 opened with 8 enemies and 4+ vents, versus floor 1's 5 and floor 2's 5.
   - Scale enemy count more gently, or have the first floor of a new biome spawn fewer enemies plus a new-mechanic
     tutorial-ish layout.
   - Consider a small heal on biome transition, since HP is the scarce resource and Rally/Bulwark are the only sustain.
5. **Make the AI's tie-breaks visible, or randomise them.** The best tricks I found depend on fixed ORTH/DIAG preference
   order, and a human can't see it:
   - luring a shade or skeleton onto a spike;
   - Charging away so an approaching imp enters your line;
   - imp colour parity.

   Either show each enemy's planned next square, like ITB move previews, which would make these into real tactics, or
   cap Bulwark stacking (max 4 block) so that "camp on Bulwark tiles" stops being the dominant answer.

Honourable mentions:
- Charge is the best-feeling spell in the Knight list (mobility + chain casts + escape). Consider making it a starter.
- Collision damage from Shield Throw knockback is a great hidden gem. Surface it in the spell text ("knocked into a unit:
  both take 1").
