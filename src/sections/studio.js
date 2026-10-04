import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';

export function initStudio() {
  const section = $('.studio');
  if (!section) return;
  const reduce = reducedMotion();

  const text = $('.studio__text', section);
  let { lines } = splitLines(text);
  let shown = reduce;
  gsap.set(lines, { yPercent: reduce ? 0 : 110 });
  if (!reduce) ScrollTrigger.create({ trigger: text, start: 'top 85%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }); } });
  window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(text)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));

  if (reduce) return;

  /* Die weiße Form schiebt sich von unten frei und gleitet beim Scrollen leicht mit */
  const shape = $('.studio__shape', section);
  if (shape) {
    gsap.fromTo(shape, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut',
      scrollTrigger: { trigger: shape, start: 'top 90%', once: true },
    });
    if (window.innerWidth >= 800) {
      gsap.fromTo(shape, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: shape, start: 'top bottom', end: 'bottom top', scrub: 1.5 } });
    }
  }
}
