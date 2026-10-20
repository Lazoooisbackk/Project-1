import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';

export function initStudio() {
  const section = $('.studio');
  if (!section) return;
  const reduce = reducedMotion();

  /* Textzeilen gibt es in diesem Bereich derzeit nicht; falls wieder welche dazukommen, fahren sie von unten ein */
  const text = $('.studio__text', section);
  if (text) {
    let { lines } = splitLines(text);
    let shown = reduce;
    gsap.set(lines, { yPercent: reduce ? 0 : 110 });
    if (!reduce) ScrollTrigger.create({ trigger: text, start: 'top 85%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }); } });
    window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(text)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));
  }

  const strip = $('.strip', section);

  if (reduce) return;

  /* Die Glas-Leiste schiebt sich einmal von unten frei; das Laufen selbst macht reines CSS */
  if (strip) {
    gsap.fromTo(strip, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut',
      scrollTrigger: { trigger: strip, start: 'top 90%', once: true },
    });
  }
}
