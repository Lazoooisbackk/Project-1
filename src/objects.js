/*
  Folien-Ballons aus public/objects. Jede Datei ist 1200 × 1200 px auf reinem Schwarz.
  Nur auf schwarzen Flächen verwenden (CSS mischt sie mit „lighten“).
*/
import { asset } from './utils/dom.js';

export const balloon = (id) => ({ id, webp: asset(`objects/${id}.webp`), png: asset(`objects/${id}.png`) });

/* Laden + dekodieren. Schlägt WebP fehl, wird PNG versucht; schlägt beides fehl: null. */
function preload(src, timeout) {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), timeout);
    img.src = src;
    img.decode().then(() => { clearTimeout(t); resolve(img); }, () => { clearTimeout(t); resolve(null); });
  });
}

const cache = new Map();
export function preloadBalloons(ids, { timeout = 8000 } = {}) {
  const key = ids.join(',');
  if (cache.has(key)) return cache.get(key);
  const p = Promise.all(ids.map(async (id) => {
    const b = balloon(id);
    let img = await preload(b.webp, timeout);
    let format = 'webp';
    if (!img) { img = await preload(b.png, timeout); format = 'png'; }
    return img ? { ...b, format } : null;
  })).then((list) => list.filter(Boolean));
  cache.set(key, p);
  return p;
}

/* <picture> mit WebP und PNG-Fallback. format 'png' = WebP ist nicht verfügbar. */
export function balloonPicture(id, { className = '', lazy = false, format = 'webp' } = {}) {
  const b = balloon(id);
  const pic = document.createElement('picture');
  if (className) pic.className = className;
  if (format === 'webp') {
    const s = document.createElement('source');
    s.type = 'image/webp';
    s.srcset = b.webp;
    pic.appendChild(s);
  }
  const img = document.createElement('img');
  img.src = b.png;
  img.alt = '';
  img.width = 1200;
  img.height = 1200;
  img.draggable = false;
  img.decoding = lazy ? 'async' : 'sync';
  if (lazy) img.loading = 'lazy';
  img.setAttribute('aria-hidden', 'true');
  pic.appendChild(img);
  return pic;
}
