# MoveCasters

**Play:** https://qmw.github.io/MoveCasters/

A tactical roguelite where **your deck is the dungeon floor**. Move one hero in 4 directions like a chess piece.
Every spell in your deck lies on a tile; **step on it and you cast it in the direction you moved**.
Enemies are chess pieces with teeth: each one threatens a visible pattern of squares.

- 6 hero classes with completely different spell lists (72 spells)
- 5 biomes / 12 floors, 5 bosses with telegraphed attacks, branching path
- 16 enemy types (rook-, bishop-, king- and knight-style attackers, chargers, mortars, shield-bearers, healers, spell-eating goblins…)
- Spell drafting between floors (replace or empower), relics from bosses
- Roguelite meta: Embers → Blessings, Grimoire pages, Relic vault; achievement-based hero unlocks; Depth 1–10 ascension; Codex; Daily Descent

See [DESIGN.md](DESIGN.md) for the full design.

## Run locally

```sh
python3 -m http.server 8765   # then open http://localhost:8765
```

No build step — vanilla ES modules.

## Tools

```sh
node tools/sim.js --bot planner --runs 100 --cls knight   # balance simulation with bots
node tools/cli.js new --cls knight --seed 1 --save /tmp/s.json   # text-mode play (for agent playtests)
node tools/fuzz.js 300                                     # random-play fuzzing with invariant checks
node tools/manifest.js                                     # regenerate sprite manifest
tools/art/gen.sh && NODE_PATH=... node tools/art/slice.cjs # generate Codex art & slice icons
```

## Credits

See [CREDITS.md](CREDITS.md).
