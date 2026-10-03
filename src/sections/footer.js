import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';
import { buildWordmark } from '../utils/wordmarkSvg.js';
import { createMiniO } from '../miniO.js';
import { WORDMARK } from '../wordmark.js';

export function initFooter() {
  const footer = $('.footer');
  if (!footer) return;
  const reduce = reducedMotion();
  const mark = $('.footer__mark', footer);

  /* Wortmarke: dieselben SVG-Buchstaben wie oben, am Ende ein zweites Chrom-O */
  const { svg, letters, o } = buildWordmark();
  mark.appendChild(svg);
  const canvas = document.createElement('canvas');
  canvas.className = 'footer__o';
  canvas.setAttribute('aria-hidden', 'true');
  mark.appendChild(canvas);

  const FILL = 0.6;                       // Anteil der Leinwand-Höhe, den das O füllt (Rest ist Platz für den Knitter)
  const place = () => {
    const m = mark.getBoundingClientRect(), g = o.getBoundingClientRect();
    if (!g.width) return;
    const size = g.height / FILL;
    Object.assign(canvas.style, {
      width: `${size}px`, height: `${size}px`,
      left: `${g.left - m.left + g.width / 2 - size / 2}px`,
      top: `${g.top - m.top + g.height / 2 - size / 2}px`,
    });
  };
  place();
  const chrome = createMiniO(canvas, { fill: FILL, crumple: 1, scale: reduce ? 1 : 0, spin: 0, observe: true, aspect: WORDMARK.o.box.w / WORDMARK.o.box.h });
  if (!chrome) { canvas.remove(); footer.classList.add('is-flat'); }
  window.addEventListener('resize', place, { passive: true });
  document.fonts.ready.then(place);

  gsap.set(letters, { yPercent: reduce ? 0 : 125 });
  if (!reduce) {
    ScrollTrigger.create({
      trigger: mark, start: 'top 92%', once: true,
      onEnter: () => {
        place();
        gsap.to(letters, { yPercent: 0, duration: 1.2, ease: 'power4.inOut', stagger: 0.04 });
        if (chrome) gsap.to(chrome.state, { scale: 1, duration: 1.1, ease: 'back.out(0.9)', delay: 0.9 });
      },
    });

    /* Hover: der Buchstabe quetscht sich zusammen und federt zurück */
    letters.forEach((l) => {
      l.addEventListener('pointerenter', () => {
        gsap.killTweensOf(l, 'scale');
        gsap.timeline()
          .to(l, { scale: 0.05, duration: 0.6, ease: 'power2.inOut', transformOrigin: '50% 100%' })
          .to(l, { scale: 1, duration: 1.8, ease: 'elastic.out(1, 0.8)' });
      });
    });
  }

  $$('[data-year]').forEach((y) => { y.textContent = String(new Date().getFullYear()); });
}
