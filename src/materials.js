/*
  Die vier Material-Os (Wolke, Moos, Pixel, Puffy) aus public/intro.
  Nur auf #0B0B0C oder dunkler verwenden: die weichen Kanten sind gegen Schwarz vormultipliziert.
*/
import { asset } from './utils/dom.js';
import { content } from './content.js';

export const MATERIALS = content.intro.materials.map((m) => ({
  ...m,
  webp: asset(`intro/${m.id}.webp`),
  png: asset(`intro/${m.id}.png`),
}));

/* Die Stern-Bilder aus public/stars für „Leistungen“, ebenfalls für Schwarz freigestellt */
export const STARS = content.services.stars.map((m) => ({
  ...m,
  webp: asset(`stars/${m.id}.webp`),
  png: asset(`stars/${m.id}.png`),
}));

/* Laden + dekodieren. Schlägt WebP fehl, wird PNG versucht; schlägt beides fehl: null. */
function preload(src, timeout) {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), timeout);
    img.src = src;
    img.decode().then(() => { clearTimeout(t); resolve(img); }, () => { clearTimeout(t); resolve(null); });
  });
}

let cache = null;
export function preloadMaterials({ timeout = 8000 } = {}) {
  if (cache) return cache;
  cache = Promise.all(MATERIALS.map(async (m) => {
    let img = await preload(m.webp, timeout);
    let format = 'webp';
    if (!img) { img = await preload(m.png, timeout); format = 'png'; }
    return img ? { ...m, format } : null;
  })).then((list) => list.filter(Boolean));
  return cache;
}

/* <picture> mit WebP und PNG-Fallback. format 'png' = WebP ist nicht verfügbar. */
export function materialPicture(m, { className = '', lazy = false, format = 'webp' } = {}) {
  const pic = document.createElement('picture');
  if (className) pic.className = className;
  if (format === 'webp') {
    const s = document.createElement('source');
    s.type = 'image/webp';
    s.srcset = m.webp;
    pic.appendChild(s);
  }
  const img = document.createElement('img');
  img.src = m.png;
  img.alt = '';
  img.width = m.w;
  img.height = m.h;
  img.draggable = false;
  img.decoding = lazy ? 'async' : 'sync';
  if (lazy) img.loading = 'lazy';
  img.setAttribute('aria-hidden', 'true');
  pic.appendChild(img);
  return pic;
}
