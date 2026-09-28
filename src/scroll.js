import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './utils/gsap.js';
import { reducedMotion } from './utils/dom.js';

let lenis = null;

export function initScroll() {
  if (reducedMotion()) {
    ScrollTrigger.defaults({ toggleActions: 'play none none none' });
    return null;
  }
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export const getLenis = () => lenis;
export const lockScroll = () => { if (lenis) lenis.stop(); document.documentElement.classList.add('is-locked'); };
export const unlockScroll = () => { if (lenis) lenis.start(); document.documentElement.classList.remove('is-locked'); };
export const scrollTo = (target, opts = {}) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.4, ...opts });
  else {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'auto' });
    else if (typeof target === 'number') window.scrollTo(0, target);
  }
};
