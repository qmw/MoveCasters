// Rebuild the class spell sheets in tools/art/sheets.json from the current SPELLS (relics/title kept as-is).
// Usage: node tools/art/sheets.mjs
import fs from 'fs';
import { SPELLS } from '../../src/core/spells.js';
import { CLASSES } from '../../src/core/data.js';

const file = new URL('./sheets.json', import.meta.url);
const sheets = JSON.parse(fs.readFileSync(file, 'utf8'));
const STYLE = 'Style: crisp 32x32-pixel-art game icons upscaled with hard pixel edges (no anti-aliasing, no blur), limited 16-colour palette, dark fantasy dungeon roguelite, bold readable silhouettes, strong rim light, each icon centered inside a rounded dark-violet (#241b30) square tile with a 1-pixel lighter border. Pure black (#000000) background and wide pure-black gutters between tiles. NO text, NO letters, NO numbers, NO watermark.';

for (const [cls, C] of Object.entries(CLASSES)) {
  const ids = Object.keys(SPELLS).filter((id) => SPELLS[id].cls === cls);
  const list = ids.map((id, i) => `${i + 1}. ${SPELLS[id].name} — ${SPELLS[id].desc}`).join(' ');
  const sheet = {
    key: 'spells_' + cls,
    grid: [4, 3],
    ids: ids.map((id) => 'spell_' + id),
    prompt: `Create ONE landscape image (1536x1024): a sprite sheet of ${ids.length} spell icons arranged in an exact 4 columns x 3 rows grid, for the ${C.name} class (theme colour ${C.color}). In reading order (left to right, top to bottom): ${list} ${STYLE}`,
  };
  const i = sheets.findIndex((s) => s.key === sheet.key);
  if (i >= 0) sheets[i] = sheet; else sheets.unshift(sheet);
}
fs.writeFileSync(file, JSON.stringify(sheets, null, 1) + '\n');
console.log('wrote', sheets.map((s) => s.key).join(' '));
