import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';

/* Arbeiten: die Aussage fährt Zeile für Zeile aus der Maske, danach kommen die drei Handys nacheinander von unten */
export function initManifest() {
  const section = $('.manifest');
  if (!section || reducedMotion()) return;
  const lines = $$('.manifest__statement .line', section);
  const works = $$('.work', section);

  gsap.set(lines, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: section, start: 'top 80%', once: true,
    onEnter: () => gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }),
  });

  if (works.length) {
    gsap.set(works, { y: 40, opacity: 0 });
    ScrollTrigger.create({
      trigger: $('.works__list', section), start: 'top 88%', once: true,
      onEnter: () => gsap.to(works, { y: 0, opacity: 1, duration: 1.1, ease: 'power4.out', stagger: 0.12, clearProps: 'transform,opacity' }),
    });
  }
}
