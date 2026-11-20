import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';
import { createMiniO } from '../miniO.js';
import { createChromeLogo } from '../chromeMark.js';
import { WORDMARK } from '../wordmark.js';

/* Ganz unten: das Zeichen (vier Schleifen) in Chrom, in der Mitte ein X, rechts das zerknitterte Chrom-O.
   Beim Hinscrollen erscheinen sie nacheinander, danach dreht sich das Zeichen leicht. Bis 20.11.2026 stand hier die Wortmarke. */
const LOGO_FILL = 0.8, O_FILL = 0.6;      // Anteil der Leinwand, den Zeichen bzw. O füllen (Rest ist Luft für die Bewegung)

export function initFooter() {
  const footer = $('.footer');
  if (!footer) return;
  const reduce = reducedMotion();
  const mark = $('.lockup', footer);
  if (mark) {
    const aspect = WORDMARK.o.box.w / WORDMARK.o.box.h;
    mark.style.setProperty('--oa', String(aspect));          // Breite des O im Verhältnis zur Höhe (für das CSS)
    const logoCanvas = $('.lockup__logo', mark), oCanvas = $('.lockup__o', mark), x = $('.lockup__x', mark);
    const logo = createChromeLogo(logoCanvas, { fill: LOGO_FILL, hell: false });
    const chrome = createMiniO(oCanvas, { fill: O_FILL, crumple: 1, scale: reduce ? 1 : 0, spin: 0, observe: true, aspect });
    if (!logo || !chrome) footer.classList.add('is-flat');  // ohne 3D: flaches Zeichen und flaches O aus CSS
    if (logo && !reduce) logo.state.scale = 0;

    if (reduce) { if (logo) logo.begin(); }
    else {
      gsap.set(x, { yPercent: 40, opacity: 0 });
      ScrollTrigger.create({
        trigger: mark, start: 'top 92%', once: true,
        onEnter: () => {
          if (logo) gsap.to(logo.state, { scale: 1, duration: 1.1, ease: 'back.out(1.1)', onComplete: () => logo.begin() });
          gsap.to(x, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', delay: 0.35 });
          if (chrome) gsap.to(chrome.state, { scale: 1, duration: 1.1, ease: 'back.out(0.9)', delay: 0.6 });
        },
      });
    }
  }

  $$('[data-year]').forEach((y) => { y.textContent = String(new Date().getFullYear()); });
}
