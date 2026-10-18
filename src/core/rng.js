// Seeded RNG (mulberry32). State lives on the game object so runs serialize to JSON.
export function rnd(g) {
  let t = (g.rs = (g.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (g, n) => Math.floor(rnd(g) * n);
export const pick = (g, arr) => arr[rint(g, arr.length)];
export function shuffle(g, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rint(g, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
