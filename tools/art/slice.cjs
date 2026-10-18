// Slice generated sheets into icons + write src/ui/gen-manifest.js.
// Needs `sharp` (NODE_PATH pointing at a node_modules that has it).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const sheets = require('./sheets.json');
const out = path.join(root, 'assets/gen');
(async () => {
  const manifest = {};
  for (const s of sheets) {
    const raw = path.join(out, 'raw', s.key + '.png');
    if (!fs.existsSync(raw)) continue;
    if (s.key === 'title') {
      await sharp(raw).resize({ width: 1120 }).png().toFile(path.join(out, 'title.png'));
      manifest.title = 'assets/gen/title.png';
      continue;
    }
    const img = sharp(raw);
    const { width, height } = await img.metadata();
    const { data, info } = await sharp(raw).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const [cols, rows] = s.grid;
    const lum = (x, y) => { const i = (y * info.width + x) * 3; return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = s.ids[r * cols + c];
      if (!id) continue;
      const x0 = Math.floor((c * width) / cols), x1 = Math.floor(((c + 1) * width) / cols);
      const y0 = Math.floor((r * height) / rows), y1 = Math.floor(((r + 1) * height) / rows);
      let bx0 = x1, by0 = y1, bx1 = x0, by1 = y0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) if (lum(x, y) > 14) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      if (bx1 <= bx0) { console.log('empty cell', s.key, id); continue; }
      const side = Math.max(bx1 - bx0, by1 - by0) + 2;
      const cx = (bx0 + bx1) >> 1, cy = (by0 + by1) >> 1;
      const left = Math.max(0, Math.min(width - side, cx - (side >> 1))), top = Math.max(0, Math.min(height - side, cy - (side >> 1)));
      const file = path.join(out, id + '.png');
      await sharp(raw).extract({ left, top, width: Math.min(side, width), height: Math.min(side, height) }).resize(64, 64, { kernel: 'lanczos3' }).png().toFile(file);
      manifest[id] = 'assets/gen/' + id + '.png';
    }
    console.log('sliced', s.key);
  }
  fs.writeFileSync(path.join(root, 'src/ui/gen-manifest.js'), '// Generated art (Codex). key -> path. Filled by tools/art/slice.cjs\nexport const GEN = ' + JSON.stringify(manifest, null, 1) + ';\n');
  console.log(Object.keys(manifest).length, 'images');
})();
