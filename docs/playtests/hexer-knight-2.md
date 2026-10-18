# Playtest: Hexer and reworked Knight (text CLI), round 2

Tester: an AI agent (Claude), playing through `tools/cli.js`, almost always one move per call. I read DESIGN.md §1–5
first. I only opened `src/` after I noticed something odd in play, to confirm it. Nothing I read changed how I played,
except that after confirming the Hexer slime immunity (bug 4) I trusted the preview on slime tiles.

| Run | Class | Seed | Result | Picks |
|---|---|---|---|---|
| A | Hexer | 101 | **Died on F3** (Bone Tyrant at 12/17 HP), turn 16. F1 and F2 both Swift and Flawless | Bone Spear+, Corpse Explosion |
| B | Knight | 202 | **Died on F4** (Frozen Vault, first floor), turn 13. F1–F3 cleared, the boss without losing any HP | Rally, Shield Throw+, Lance; relic Vampire Fang |
| C (extra) | Hexer | 303 | **Died on F4** (Rot Swamp, first floor), turn 8. Bone Tyrant killed at **5/5 HP** | Soul Swap, Bone Spear+, Soul Swap+; relic Hourglass |

I played a second Hexer run because run A ended so fast. Its contrast with run A is the most useful result in this
report (see "Hexer").

---

## Run A: Hexer, seed 101

- **F1 (Crypt):** Swift and Flawless. The highlight was **friendly fire**. Imp D's diagonal swing killed imp E and hurt
  skeleton A. Later skeleton A was killed by D's strike while I just stepped aside. A zombie's swing killed the last
  skeleton. Raise Dead on the starting corpses gave 2 thralls that chipped enemies. It felt like Into the Breach, in a
  good way.
- **F2:** Empowered Bone Spear (2 damage, pierce) hit two Bone Casters standing in one column: **DOUBLE KILL** on turn 2.
  Three zombies and skeletons then killed each other with crossing swings. Swift and Flawless again. At this point the
  Hexer felt overpowered.
- **F3, Bone Tyrant (17 HP, 2 damage, 3-wide swing):** I hit it 3 times with Bone Spear+ and once with Curse. Then the
  **wall-pin** started:
  - The boss steps next to me and telegraphs. The only clean dodge is a straight step away.
  - Every dodge moves me one square toward a wall, and every directional spell I cast while dodging fires *away* from
    the boss.
  - About 4 dodges later I was on the bottom row. Every option said "DANGER: 2 dmg" (turns 11, 14 and 15). Two hits took
    me from 5 HP to 1, and the third killed me.
- I wasted Curse on turn 10: the boss was cursed, but I had no Bone Spear line to follow it up before the curse ran out.

## Run B: Knight (rework), seed 202

- **F1:**
  - Smite sniped an imp from 4 squares away.
  - The **boomerang return hit is excellent.** Stepping *away* from a chaser onto a Shield Throw tile hits it on the way
    back. This fixes the "adjacent chaser can't be hit" problem from knight-1 **when the chaser is behind you**.
  - Skeleton D's swing killed two imps that were standing next to me.
  - I ended at 5/7, because of a skeleton that was **beside** me (not behind) while I had my back to the right wall.
    Turns 14–15: every option took 1 damage.
- **F2:** Flawless. Shield Throw knocked a skeleton back into an imp (collision, **DOUBLE KILL**). Holy Nova finished off
  low-HP enemies. I drafted Shield Throw+.
- **F3, Bone Tyrant:** **0 HP lost to the boss.**
  - Smite stuns the boss, and the stun also **freezes its summon timer** (it stayed at 0 for 2 turns).
  - Retreating onto Shield Throw tiles hit the boss on the way back every time.
  - A Shield Throw knocked the boss into a skeleton for 3 damage.
  - Holy Nova finished it.
  - **Then a single leftover skeleton cost me 5 HP.** It sat beside me along the left wall for about 12 turns (turns
    23–37). Every option took 1 damage, and no Knight tile can hit an enemy that is *beside* you. Only Holy Nova at the
    end of the column killed it. The boss was trivial; its leftover add was the real boss.
- **F4 (Frozen Vault):** 7 enemies at turn 0 (frost zombies, an elite skeleton, an elite wraith), plus 5 vents, on a
  **7x7** board.
  - I opened well: a Lance pierce killed one enemy, then Smite and Holy Nova killed two more.
  - Then I got boxed in at (1,6): a zombie above, a zombie below and a skeleton to the right. "wait" was the only legal
    move (turns 8 and 10). I died at turn 13.
  - I never saw ice sliding happen.

## Run C: Hexer, seed 303 (extra)

- **F1–F2:** Thralls did most of the killing; in F2 I waited 3 turns while 3 thralls killed an elite zombie. It is
  effective but passive.
- **F3, Bone Tyrant: won at 5/5 HP.** **Soul Swap** is the answer to the wall-pin. When the boss pins me, swapping with
  a far-away add teleports me out, and the boss's relative swing then hits empty squares or its own minions. Two
  standouts:
  - On turn 11, the swap put skeleton D into the boss's telegraphed swing. The boss killed its own minion for 2.
  - On turn 35, Soul Swap chained into a second Soul Swap and then Curse: 2 kills in one move. This was the most
    satisfying move I saw in either run.
- **F4 (Rot Swamp):** 7 enemies, 5 of them elite: 3 elite Spitters (lob 2), elite slugs and imps. 5 more came from vents.
  - Slugs chased me into a column. I was sandwiched between slugs J and H with a spitter lob on top.
  - Turns 3, 4 and 7 had no safe option. I died at turn 8 from 5 HP.

---

## Ratings (1–10)

| | Score | Why |
|---|---|---|
| Tension | **7** | Boss fights and every F4 were tense. Telegraphs and danger numbers make each step matter. F1–F2 are low tension (5 of 6 early floors were Swift and Flawless). Some tension turns into frustration when damage can't be avoided. |
| Depth of decisions | **7** | Friendly fire, the boomerang return, knock-back collisions, stun timing and Soul Swap chains are real depth. It is undercut by many forced turns (below) and by "wait while thralls work". |
| Clarity | **7** | The previews are the best part of the CLI ("deals 4, kills 2", "you END at (4,6)", danger counts). Minuses: I misread the dense grid columns several times, some log lines are ambiguous, and several rules are hidden (bugs 3–6). |
| Desire to replay | **7** | The Soul Swap boss win and the Knight's boss fight made me want "one more run". All 3 runs then died within 13 turns of entering biome 2, which feels like a wall rather than a curve. |

## Turns with no good option, or only one

About 190 turns played in total.

| Run | No safe option (all moves take damage, or "wait" is the only legal move) | Exactly one safe move, usually a forced retreat that wastes the tile |
|---|---|---|
| A | ~3 (boss wall-pin) | ~8 |
| B | ~20 (F1 wall-side skeleton ×3, F3 leftover skeleton ×12, F4 box-in ×5) | ~15 |
| C | ~5 | ~10 |
| **Total** | **~28 (~15% of turns)** | **~33 (~17%)** |

Nearly all no-option turns have the same cause: a **melee enemy beside you while your back is to a wall**. Its 3-wide
swing covers both sideways escapes, the straight-away step is the wall, and no directional tile can hit sideways. The
boomerang fixed the case where the chaser is *behind* you, but not the case where it is *beside* you.

## Difficulty curve, and unfair or trivial enemies

- **The curve is flat, then a cliff.** F1–F2 were trivial. All 3 runs died on F3 or F4.
- **F4 is the "breather" floor, but it is harder than the biome-1 boss.**
  - It had 7 enemies at start (5 of them elite) plus 5 vents, against 5 + 3 on F1.
  - HP doesn't come back between floors: I entered F4 at 7/7, 5/5 and 5/5 HP.
  - Confirmed in code: `eliteChance: 0.5` already applies at depth 0, plus 0.3 from depth 2 on. Elite spitters and
    slugs (4 HP) on F4 feel overtuned for the first floor of a new biome.
- **Trivial: imps.** Imps attack diagonally and move diagonally, so they can only threaten squares of their own colour.
  - If you stand on the other colour they freeze in place. On Knight F1, turns 10–12, two imps sat orthogonally next to
    me doing nothing while I waited.
  - Their most common effect is hitting their allies by friendly fire.
- **Trivial: Bone Tyrant vs Knight.** Smite stuns cancel its attack and freeze its summon timer, so stun-locking it is
  easy. Against the Hexer without Soul Swap it is a hard wall. Its threat depends almost entirely on your kit.
- **Unfair-feeling: leftover adds after a boss dies.** Shades vanish when the last real enemy dies, but raised skeletons
  stay. Killing them is pure attrition with no reward.

## Did each class feel distinct and fun?

- **Knight (rework): yes, a big improvement over knight-1.**
  - The boomerang return, knock-back collisions, Smite stun (which also cancels telegraphs) and Holy Nova as the
    "adjacent problem solver" make a clear identity: a ranged bruiser.
  - Its weak spot is enemies beside you. Holy Nova (freq 1, cd 5) is the only answer, and it is too rare to rely on.
- **Hexer: distinct and fun, but bimodal.**
  - Friendly-fire setups plus thralls plus Life Drain (which doesn't need a direction) feel like a necromancer
    puppet-master.
  - **Without Soul Swap the boss is a wall. With it the boss is trivial.** That makes the draft offer decide the run.
  - Thralls make some floors play themselves (several "wait ×3" stretches). They also act before enemies move, so they
    often end up one step behind their target.

## Bugs and issues (seed + moves)

1. **Empowering a cooldown-1 spell promises "cooldown −1" but does nothing**, and the legend still shows the base text.
   - Repro: Hexer seed 101, F1, `draft 0` (EMPOWER Bone Spear).
   - The legend shows `Bone Spear+ [cooldown 1] … takes 1`, but the spear deals 2. `spellCd` clamps the cooldown to a
     minimum of 1 (`spells.js:594`).
   - The same happens with Knight seed 202, F2, `draft 0` (Shield Throw+).
   - Suggestion: say "+1 damage" only for cd-1 spells, and show the empowered numbers in the description.
2. **The danger preview ignores your own stun cancelling the attack.**
   - Repro: Knight seed 202, F3 turn 2 (after `u`, `u`). The option `left` showed "CASTS Smite left (deals 2) — DANGER:
     1 dmg". The log then showed `[CANCELLED]` and I took 0 damage.
   - Because of this, the best move looks dangerous.
3. **Soul Swap silently ignores bosses.** The code filters `!v.boss` (`spells.js:570`).
   - Repro: Hexer seed 303, F3 turn 16 (the boss was the only enemy). The preview said "CASTS Soul Swap right ok" with
     no "END at". The tile was spent and nothing happened.
   - The description says "farthest enemy" and doesn't mention bosses.
4. **The Hexer is immune to slime, but this is shown nowhere** (`game.js:65`, `g.cls !== 'hexer'`).
   - Repro: Hexer seed 303, F4 turn 4. The preview says "[floor, slime] — CASTS Bone Spear", which contradicts the board
     key ("the spell on this tile FIZZLES").
   - Add it to the Harvest passive text, or to a Hexer line in the board key.
5. **Steel is used up by 1 damage from spikes while you still have 2 Block.**
   - Repro: Knight seed 202, F2 turn 5 (`l`, `u`, `r`, `r`, `r`): "[STEEL] at (7,8)" from the spike, with block 2
     unused.
   - Spend Block first, or let Steel ignore hazards.
6. **The log is ambiguous.**
   - "X strikes (a,b)" names the target square, but the damage lines below it are for units on *other* swing squares. It
     reads as if a strike on (6,9) hit me at (7,9).
   - "[BLOCK 1] at" means "1 damage blocked", not "1 block left".
   - Spike damage to enemies has no cause shown: Hexer seed 101, F2 turn 9 shows "F Zombie takes 1 damage" right after a
     move line.
7. **DESIGN.md is out of date.**
   - The Knight starters are listed as Shield Throw/Smite/Lance/Bulwark, but the game starts with Holy Nova, and Lance is
     a draft.
   - Bone Tyrant is listed at 11 HP "raises 2 skeletons"; in play it has 17 HP (`bossHpMul` 1.5) and raises 1 skeleton
     below depth 5.
8. **Minor: vents scheduled for a floor don't arrive** if you clear it fast ("Reinforcements still to come: 1" on
   clear, Hexer seed 101 F2). This seems intentional; just noting it.
9. **Minor: Vampire Fang heals are wasted at full HP** (Knight F4). Expected, but it makes the relic feel weak.

## Top 5 design suggestions, ranked

1. **Fix the wall-pin / beside-enemy deadlock** (the cause of ~28 forced-damage turns).
   - Option 1: melee swings hit only the target square plus *one* side square (the side the attacker came from), so a
     diagonal step out is possible.
   - Option 2: give every class a common **basic sidestep tile** that casts sideways, like Shield Throw's return but
     perpendicular.
   - Option 3: make "wait" next to a wall a **brace** (+1 Block).
   - Any of these turns "I lose 1 HP per turn for 12 turns" into a puzzle.
2. **Smooth the biome-2 cliff.**
   - Make the biome-entry floor a real breather: cap elites at about 30% and make vents start from the 2nd vent turn.
   - Or give a guaranteed **campfire / heal 2** event between biomes.
   - Right now every run dies within 13 turns of entering biome 2, which hurts the "one more run" feeling more than
     anything else.
3. **Boss adds should die with the boss**, like shades with the Dark. Or the boss kill should give a "victory lap" heal.
   Losing 5 HP to a leftover skeleton after a perfect boss fight is the worst moment of the session.
4. **Make the key build-defining tools reliable.**
   - The Hexer needs Soul Swap (or Bone Wall) to beat the boss; the Knight relies on Holy Nova for adjacent enemies.
   - Guarantee one "mobility or adjacency answer" option in the first two drafts, or make Bone Wall and Soul Swap
     starters that you can swap out.
   - Also: thralls should act *after* enemies move, or get 1 free step, so they stop lagging behind and the Hexer has
     less "wait ×3" downtime.
5. **Reward mastery, which makes the next run feel worth starting.**
   - Swift and Flawless already pay embers. Add a visible **combo meter**: chain casts, double kills and friendly-fire
     kills give a small bonus (an ember, +1 draft option, or a reroll).
   - The best moments (the Soul Swap chain, the collision double kill, imps killing each other) are currently only log
     lines.
   - Also fix the imp parity exploit: let imps also step orthogonally when they can't reach you, so they stop freezing
     in place.
