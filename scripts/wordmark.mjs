/*
  Baut die Wortmarke „guskic studiO“ als Vektor-Pfade (ein Pfad pro Buchstabe):
  „guskic studi“ aus Geist Bold, das O aus Newsreader (wght 500 / opsz 18, die Form des alten Logos).
  Die O-Kontur liegt in scripts/newsreader-o.json (siehe dort, woher sie stammt).
  Das O wird auf die Versalhöhe von Geist skaliert und auf dieselbe Grundlinie gesetzt.
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
const SIZE = 1000;            // Einheiten pro em im SVG
const TRACKING = -0.05;       // Laufweite in em
const O_GAP = 0.039;          // Abstand (em) zwischen der Tinte des i und der des O (wie zuvor beim Geist-O)
const O_JSON = JSON.parse(readFileSync(resolve(root, 'scripts/newsreader-o.json'), 'utf8'));

const buf = readFileSync(FONT);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const scale = SIZE / font.unitsPerEm;
const r = (n) => Math.round(n * 100) / 100;

const chars = Array.from(TEXT);
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

/* Das O: Newsreader-Kontur (Schrift-Einheiten, y nach oben) in SVG-Koordinaten (y nach unten) */
const capGeist = font.tables.os2.sCapHeight * scale;          // Versalhöhe von Geist in SVG-Einheiten
const sO = capGeist / O_JSON.capHeight;                        // Newsreader-Einheiten → SVG-Einheiten
const [bx0, by0, bx1, by1] = O_JSON.bounds;
const oLeft = maxX + O_GAP * SIZE;                             // Tinte des O beginnt O_GAP hinter der letzten Tinte
const oTop = -(by1 * sO), oBottom = -(by0 * sO);               // Grundlinie bei y = 0 (vor der Verschiebung)
minX = Math.min(minX, oLeft); maxX = Math.max(maxX, oLeft + (bx1 - bx0) * sO);
minY = Math.min(minY, oTop); maxY = Math.max(maxY, oBottom);

const ox = -minX, oy = -minY;
const letters = [];
placed.forEach((p) => {
  if (p.ch === ' ') return;
  const path = p.glyph.getPath(p.x + ox, oy, SIZE);
  const b = path.getBoundingBox();
  letters.push({ ch: p.ch, d: path.toPathData(2), box: { x: r(b.x1), y: r(b.y1), w: r(b.x2 - b.x1), h: r(b.y2 - b.y1) } });
});

/* Pfad des O umrechnen: absolute Befehle M L H V Q C Z → M L Q C Z */
function transformPath(d, fx, fy) {
  const tokens = d.match(/[MLHVQCZ]|-?\d*\.?\d+/g);
  let i = 0, cx = 0, cy = 0, out = '';
  const num = () => parseFloat(tokens[i++]);
  const pt = (x, y) => `${r(fx(x))} ${r(fy(y))}`;
  while (i < tokens.length) {
    const c = tokens[i++];
    if (c === 'M' || c === 'L') { cx = num(); cy = num(); out += `${c}${pt(cx, cy)}`; }
    else if (c === 'H') { cx = num(); out += `L${pt(cx, cy)}`; }
    else if (c === 'V') { cy = num(); out += `L${pt(cx, cy)}`; }
    else if (c === 'Q') { const x1 = num(), y1 = num(); cx = num(); cy = num(); out += `Q${pt(x1, y1)} ${pt(cx, cy)}`; }
    else if (c === 'C') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(); cx = num(); cy = num(); out += `C${pt(x1, y1)} ${pt(x2, y2)} ${pt(cx, cy)}`; }
    else if (c === 'Z') out += 'Z';
    else throw new Error(`Unbekannter Pfadbefehl ${c}`);
  }
  return out;
}
const oX = (x) => oLeft + ox + (x - bx0) * sO;
const oY = (y) => oy - y * sO;
const o = {
  ch: 'O',
  d: transformPath(O_JSON.d, oX, oY),
  box: { x: r(oX(bx0)), y: r(oY(by1)), w: r((bx1 - bx0) * sO), h: r((by1 - by0) * sO) },
};

const out = `/* Erzeugt von scripts/wordmark.mjs: „guskic studi“ aus Geist Bold, das O aus Newsreader. Nicht von Hand ändern. */
export const WORDMARK = ${JSON.stringify({ width: r(maxX - minX), height: r(maxY - minY), baseline: r(oy), letters, o }, null, 0)};
export default WORDMARK;
`;
writeFileSync(resolve(root, 'src/wordmark.js'), out);
console.log('wordmark', r(maxX - minX), 'x', r(maxY - minY), 'baseline', r(oy), 'letters', letters.length, 'O box', o.box);
