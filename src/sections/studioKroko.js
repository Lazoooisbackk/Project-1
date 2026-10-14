/*
  Krokodil im Studio-Bereich: das Bild erscheint durch eine Maske aus Pixel-Blöcken, die sich ständig verändert.
  Eigener Code statt Video: scharf in jeder Größe, klein beim Laden, läuft nur, solange die Kachel sichtbar ist.
  Im HTML: <div class="studio__blob"><p class="studio__kroko-name">…</p><canvas data-kroko></canvas></div>
*/
import { $, reducedMotion, asset, clamp, lerp } from '../utils/dom.js';

const LOOP = 6;                 // Sekunden, dann beginnt es nahtlos von vorn
const GRID = 48;                // feine Zellen pro Seite; grobe Blöcke sind 2 × 2 Zellen
const CROC_H = 0.82;            // Höhe des Krokodils im Verhältnis zur Kachel
const CROC_RIGHT = 0.742;       // sein rechter Rand bleibt stehen, es wächst nach links

/* Bildlage: [Zeit, Größe, oberer Rand] */
const PHOTO = [[0, 1, 0.02], [1.5, 1, 0.09], [3.4, 1.09, 0.01], [5, 1, 0.015], [6, 1, 0.02]];
/* Maske: [Zeit, Mitte x, Mitte y, Radius x, Radius y] – eine Ellipse mit ausgefranstem Blockrand */
const MASK = [
  [0, 0.52, 0.22, 0.30, 0.27],
  [1.5, 0.50, 0.50, 0.37, 0.46],
  [2.5, 0.50, 0.48, 0.43, 0.49],
  [3, 0.36, 0.30, 0.44, 0.42],
  [3.4, 0.33, 0.25, 0.43, 0.39],
  [4, 0.34, 0.25, 0.42, 0.38],
  [4.5, 0.45, 0.15, 0.36, 0.26],
  [5, 0.47, 0.14, 0.27, 0.18],
  [5.5, 0.52, 0.22, 0.26, 0.24],
  [6, 0.52, 0.22, 0.30, 0.27],
];

const ease = (t) => t * t * (3 - 2 * t);
function track(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const k = ease(clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
  return a.map((v, n) => lerp(v, b[n], k));
}
/* fester Zufallswert 0…1 für eine Zelle */
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* Zufall, der sich langsam ändert: so wandern einzelne Blöcke am Rand */
function drift(x, y, t, speed, seed) {
  const k = Math.floor(t * speed), f = ease(t * speed - k);
  const n = Math.round(LOOP * speed);                  // nach einer Runde wieder derselbe Zufall
  return lerp(hash(x, y, seed + (k % n)), hash(x, y, seed + ((k + 1) % n)), f);
}

export function initStudioKroko(root = document) {
  const canvas = $('canvas[data-kroko]', root);
  if (!canvas) return;
  const box = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = mask.height = GRID;
  const mctx = mask.getContext('2d');
  const cells = mctx.createImageData(GRID, GRID);
  const img = new Image();
  img.decoding = 'async';
  let ready = false, visible = false, raf = 0, last = 0, t0 = 0;
  const reduce = reducedMotion();

  function size() {
    const w = box.clientWidth;
    if (!w) return;
    box.style.setProperty('--u', `${w / 100}px`);        // Einheit für die Schrift: 1 % der Kachelbreite
    const px = Math.round(w * Math.min(window.devicePixelRatio || 1, 2));
    if (canvas.width !== px) { canvas.width = canvas.height = px; if (ready) draw(reduce ? 1.5 : time()); }
  }
  const time = () => ((performance.now() - t0) / 1000) % LOOP;

  function paintMask(t) {
    const [, cx, cy, rx, ry] = track(MASK, t);
    const d = cells.data;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x = (i + 0.5) / GRID, y = (j + 0.5) / GRID;
        const bi = i >> 1, bj = j >> 1;                                  // grober Block, zu dem die Zelle gehört
        const bx = (bi + 0.5) / (GRID / 2), by = (bj + 0.5) / (GRID / 2);
        const fBlock = ((bx - cx) / rx) ** 2 + ((by - cy) / ry) ** 2;
        const fCell = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        const f = fBlock
          + (drift(bi >> 1, bj >> 1, t, 0.5, 7) - 0.5) * 0.5       // große Ausbuchtungen
          + (drift(bi, bj, t, 1, 11) - 0.5) * 0.5;               // ausgefranster Rand aus groben Blöcken
        let on = f < 1;
        if (Math.abs(fCell - 1) < 0.16 && drift(i, j, t, 1.5, 97) < 0.07) on = !on;   // am Rand wenige feine Zellen
        if (!on && f < 1.8 && drift(bi, bj, t, 0.5, 53) < 0.03) on = true;           // verstreute Blöcke draußen
        d[(j * GRID + i) * 4 + 3] = on ? 255 : 0;
      }
    }
    mctx.putImageData(cells, 0, 0);
  }

  function draw(t) {
    const W = canvas.width;
    const [, s, top] = track(PHOTO, t);
    const h = CROC_H * W * s, w = h * img.naturalWidth / img.naturalHeight;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, CROC_RIGHT * W - w, top * W, w, h);
    paintMask(t);
    ctx.globalCompositeOperation = 'destination-in';     // nur dort stehen lassen, wo die Maske Blöcke hat
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mask, 0, 0, W, W);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 30) return;                         // etwa 30 Bilder pro Sekunde reichen für Blöcke
    last = now;
    draw(time());
  }
  function sync() {
    const run = ready && visible && !document.hidden && !reduce;
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  img.onload = () => { ready = true; t0 = performance.now(); size(); draw(reduce ? 1.5 : 0); sync(); };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !img.src) img.src = asset('studio/kroko.webp');   // erst laden, wenn die Kachel in die Nähe kommt
    sync();
  }, { rootMargin: '300px 0px' }).observe(box);
  new ResizeObserver(size).observe(box);
  document.addEventListener('visibilitychange', sync);
  size();
}
