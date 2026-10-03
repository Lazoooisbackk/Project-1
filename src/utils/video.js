/*
  Stumme Videos, die nur spielen, solange sie sichtbar sind.
  Im HTML: <video data-auto muted playsinline loop preload="none" poster="…"><source data-src="…" type="video/mp4"></video>
  Die Quelle wird erst geladen, wenn das Video in die Nähe des Bildschirms kommt.
*/
import { $$, reducedMotion } from './dom.js';

export function initAutoVideos(root = document) {
  const reduce = reducedMotion();
  $$('video[data-auto]', root).forEach((v) => {
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    let loaded = false, visible = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      $$('source[data-src]', v).forEach((s) => { s.src = s.dataset.src; });
      if (v.dataset.src) v.src = v.dataset.src;
      v.load();
    };
    const sync = () => {
      if (reduce) return;                       // weniger Bewegung: es bleibt beim Standbild
      if (visible && !document.hidden) { load(); v.play().catch(() => {}); }
      else v.pause();
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '200px 0px' }).observe(v);
    document.addEventListener('visibilitychange', sync);
  });
}
