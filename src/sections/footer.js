import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';
import { splitChars } from '../utils/split.js';

export function initFooter() {
  const footer = $('.footer');
  if (!footer) return;
  const reduce = reducedMotion();
  const mark = $('.footer__mark', footer);
  const { chars, masks } = splitChars($('.footer__mark-text', mark));

  /* Wortmarke auf Viewport-Breite */
  const fit = () => {
    mark.style.fontSize = '100px';
    const w = $('.footer__mark-text', mark).offsetWidth;
    mark.style.fontSize = `${Math.min((mark.clientWidth / w) * 100 * 0.995, window.innerHeight * 0.4).toFixed(2)}px`;
  };
  fit();
  window.addEventListener('resize', fit, { passive: true });
  document.fonts.ready.then(fit);

  const oChar = chars[chars.length - 1];
  const others = chars.slice(0, -1);
  gsap.set(others, { yPercent: reduce ? 0 : 120 });
  gsap.set(oChar, { yPercent: 0, scale: reduce ? 1 : 0, transformOrigin: '50% 60%' });
  if (!reduce) {
    ScrollTrigger.create({
      trigger: mark, start: 'top 90%', once: true,
      onEnter: () => {
        gsap.to(others, { yPercent: 0, duration: 1.2, ease: 'power4.inOut', stagger: { each: 0.03, from: 'random' } });
        gsap.to(oChar, { scale: 1, duration: 1.1, ease: 'back.out(0.9)', delay: 0.9 });
      },
    });

    /* Hover: Buchstabe quetscht sich zusammen und federt zurück */
    masks.forEach((m, i) => {
      const ch = chars[i];
      if (!ch) return;
      m.addEventListener('pointerenter', () => {
        gsap.timeline({ overwrite: true })
          .to(ch, { scale: 0.05, duration: 0.6, ease: 'power2.inOut', transformOrigin: '50% 100%' })
          .to(ch, { scale: 1, duration: 1.8, ease: 'elastic.out(1, 0.8)' });
      });
    });
  }

  const year = $('[data-year]', footer);
  if (year) year.textContent = String(new Date().getFullYear());
}
