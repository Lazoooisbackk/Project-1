import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './utils/gsap.js';
import { reducedMotion } from './utils/dom.js';

let lenis = null, tick = null;

function startSmooth() {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  if (document.documentElement.classList.contains('is-locked')) lenis.stop();
}

/* zurück zum Scrollen des Browsers: das bleibt auch dann flüssig, wenn Skripte nur 30 Bilder pro Sekunde bekommen */
function stopSmooth() {
  if (!lenis) return;
  gsap.ticker.remove(tick);
  lenis.destroy();
  lenis = null; tick = null;
  document.documentElement.classList.add('is-native-scroll');
  ScrollTrigger.refresh();
}

/* Misst laufend die Bildrate. Liegt sie zweimal hintereinander unter ca. 42 Bildern pro Sekunde
   (Energiesparmodus in Safari und auf dem iPhone, schwache Geräte), wird das weiche Scrollen abgeschaltet.
   Der Median zählt, damit einzelne Hänger beim Laden nichts auslösen. */
function watchFrameRate() {
  let last = 0, slow = 0;
  const win = [];
  const frame = (t) => {
    if (!lenis) return;
    if (last) { const d = t - last; if (d < 250) win.push(d); }
    last = t;
    if (win.length >= 30) {
      win.sort((a, b) => a - b);
      const median = win[15];
      win.length = 0;
      slow = median > 24 ? slow + 1 : 0;
      if (slow >= 2) { stopSmooth(); return; }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function initScroll() {
  if (reducedMotion()) {
    ScrollTrigger.defaults({ toggleActions: 'play none none none' });
    return null;
  }
  gsap.ticker.lagSmoothing(0);
  startSmooth();
  watchFrameRate();
  return lenis;
}

export const getLenis = () => lenis;
export const lockScroll = () => { if (lenis) lenis.stop(); document.documentElement.classList.add('is-locked'); };
export const unlockScroll = () => { if (lenis) lenis.start(); document.documentElement.classList.remove('is-locked'); };
export const scrollTo = (target, opts = {}) => {
  if (lenis) { lenis.scrollTo(target, { duration: 1.4, ...opts }); return; }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const top = typeof target === 'number' ? target : (el ? el.getBoundingClientRect().top + window.scrollY + (opts.offset || 0) : null);
  if (top !== null) window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
};
