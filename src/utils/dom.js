export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
export const isMobile = () => window.innerWidth <= 991;

export const rand = (min, max) => min + Math.random() * (max - min);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad3 = (n) => String(Math.max(0, Math.round(n))).padStart(3, '0');

/* Pfad zu einer Datei in /public, unabhängig vom base-Pfad des Builds. */
export const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, v) { try { sessionStorage.setItem(key, v); } catch { /* privat / blockiert */ } },
};

export const debounce = (fn, ms = 200) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail }));

/* Prüft, ob eine optionale Datei in /public existiert (Bild/Video). */
export const imageExists = (src, timeout = 6000) => new Promise((resolve) => {
  const img = new Image();
  const t = setTimeout(() => resolve(false), timeout);
  img.onload = () => { clearTimeout(t); resolve(true); };
  img.onerror = () => { clearTimeout(t); resolve(false); };
  img.src = src;
});
