/*
  Baut die Wortmarke „guskic studiO“ als Vektor-Pfade (ein Pfad pro Buchstabe) aus Geist Bold.
  Aufruf: node scripts/wordmark.mjs  → schreibt src/wordmark.js
  Nur nötig, wenn Schrift, Laufweite oder Text der Wortmarke geändert werden.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import opentype from 'opentype.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = resolve(root, 'node_modules/@fontsource/geist/files/geist-latin-700-normal.woff');
const TEXT = 'guskic studi';
const LAST = 'O';
const SIZE = 1000;            // Einheiten pro em im SVG
const TRACKING = -0.05;       // Laufweite in em

const buf = readFileSync(FONT);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const scale = SIZE / font.unitsPerEm;
const r = (n) => Math.round(n * 100) / 100;

const chars = Array.from(TEXT + LAST);
const glyphs = chars.map((c) => font.charToGlyph(c));

/* Laufweite und Kerning von Hand, damit jede Position bekannt ist */
let x = 0;
const placed = glyphs.map((g, i) => {
  const item = { ch: chars[i], glyph: g, x };
  let adv = g.advanceWidth * scale + TRACKING * SIZE;
  if (glyphs[i + 1]) adv += font.getKerningValue(g, glyphs[i + 1]) * scale;
  x += adv;
  return item;
});

/* Grenzen der gezeichneten Formen */
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
placed.forEach((p) => {
  if (p.ch === ' ') return;
  const b = p.glyph.getPath(p.x, 0, SIZE).getBoundingBox();
  p.box = b;
  minX = Math.min(minX, b.x1); maxX = Math.max(maxX, b.x2);
  minY = Math.min(minY, b.y1); maxY = Math.max(maxY, b.y2);
});

const ox = -minX, oy = -minY;
const letters = [];
let o = null;
placed.forEach((p) => {
  if (p.ch === ' ') return;
  const path = p.glyph.getPath(p.x + ox, oy, SIZE);
  const b = path.getBoundingBox();
  const entry = { ch: p.ch, d: path.toPathData(2), box: { x: r(b.x1), y: r(b.y1), w: r(b.x2 - b.x1), h: r(b.y2 - b.y1) } };
  if (p.ch === LAST && p === placed[placed.length - 1]) o = entry; else letters.push(entry);
});

const out = `/* Erzeugt von scripts/wordmark.mjs aus Geist Bold. Nicht von Hand ändern. */
export const WORDMARK = ${JSON.stringify({ width: r(maxX - minX), height: r(maxY - minY), baseline: r(oy), letters, o }, null, 0)};
export default WORDMARK;
`;
writeFileSync(resolve(root, 'src/wordmark.js'), out);
console.log('wordmark', r(maxX - minX), 'x', r(maxY - minY), 'baseline', r(oy), 'letters', letters.length, 'O box', o.box);
