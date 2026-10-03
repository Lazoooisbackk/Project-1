import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, clamp, reducedMotion } from '../utils/dom.js';
import { splitChars } from '../utils/split.js';

export function initManifest() {
  const section = $('.manifest');
  if (!section) return;
  const reduce = reducedMotion();
  const lines = $$('.manifest__statement .line', section);
  const side = $('.manifest__side', section);
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

  /* Showreel: der Rahmen öffnet sich beim Hereinscrollen */
  if (reel) {
    gsap.fromTo(reel, { clipPath: 'inset(8% 4% 0% 4%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: reel, start: 'top 95%', end: 'top 35%', scrub: 1 },
    });
  }

  /* Kleiner Absatz: erscheint buchstabenweise und fällt beim Weiterscrollen auseinander */
  if (!side) return;
  const { chars } = splitChars(side);
  gsap.set(chars, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: side, start: 'top 88%', once: true,
    onEnter: () => gsap.to(chars, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: { each: 0.006, from: 'start' } }),
  });

  const fall = gsap.timeline({
    scrollTrigger: {
      trigger: side, start: 'top 30%', end: 'bottom top', scrub: 2,
      onUpdate: (self) => {
        const v = clamp(self.getVelocity() / 1400, -1, 1);
        gsap.to(side, { x: v * 14, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
      },
    },
  });
  chars.forEach((c) => {
    fall.to(c, {
      y: rand(40, 160), x: rand(-10, 10), rotation: rand(-20, 20), opacity: 0,
      duration: 1, ease: 'power2.in',
    }, rand(0, 0.6));
  });
}
