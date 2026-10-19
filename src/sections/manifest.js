import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';

export function initManifest() {
  const section = $('.manifest');
  if (!section) return;
  const reduce = reducedMotion();
  const lines = $$('.manifest__statement .line', section);
  const reel = $('.manifest__reel', section);

  if (reduce) {
    gsap.set(lines, { yPercent: 0 });
    return;
  }

  /* Aussage: Zeile für Zeile aus der Maske */
  gsap.set(lines, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: section, start: 'top 80%', once: true,
    onEnter: () => gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }),
  });

  /* Showreel: der Rahmen wächst beim Hereinscrollen auf die volle Breite */
  if (reel) {
    gsap.fromTo(reel, { scale: 0.92, transformOrigin: '50% 100%' }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: reel, start: 'top 95%', end: 'top 35%', scrub: 1 },
    });
  }

  /* Der Link www.ounji.at bleibt ruhig stehen: keine Buchstaben-Animation, damit er am Handy lesbar und klickbar ist */
}
