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

  /* Die beiden Bilder schieben sich von unten frei; im Rahmen gleiten sie leicht, das kleine läuft etwas schneller mit */
  const big = $('.studio__big', section), small = $('.studio__small', section), frame = $('.studio__frame', section);
  [big, frame].forEach((el) => {
    if (!el) return;
    gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
    const img = $('img', el);
    if (img) gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.5 } });
  });
  if (small && window.innerWidth >= 800) {
    gsap.fromTo(small, { y: 70 }, { y: -70, ease: 'none', scrollTrigger: { trigger: small, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
  }
}
