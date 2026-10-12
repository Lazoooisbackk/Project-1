import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';
import { initStudioKroko } from './studioKroko.js';

export function initStudio() {
  const section = $('.studio');
  if (!section) return;
  const reduce = reducedMotion();
  initStudioKroko(section);

  /* Textzeilen gibt es in diesem Bereich derzeit nicht; falls wieder welche dazukommen, fahren sie von unten ein */
  const text = $('.studio__text', section);
  if (text) {
    let { lines } = splitLines(text);
    let shown = reduce;
    gsap.set(lines, { yPercent: reduce ? 0 : 110 });
    if (!reduce) ScrollTrigger.create({ trigger: text, start: 'top 85%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }); } });
    window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(text)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));
  }

  if (reduce) return;

  /* Die Kacheln schieben sich von unten frei und gleiten beim Scrollen leicht mit, jede ein wenig anders */
  const tiles = [['.studio__luma', 24], ['.studio__shape', 48]];
  tiles.forEach(([sel, drift]) => {
    const el = $(sel, section);
    if (!el) return;
    gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
    if (window.innerWidth >= 800) {
      gsap.fromTo(el, { y: drift }, { y: -drift, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.5 } });
    }
  });
}
