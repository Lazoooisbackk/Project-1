import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, clamp, reducedMotion } from '../utils/dom.js';
import { splitChars } from '../utils/split.js';

export function initManifest() {
  const section = $('.manifest');
  if (!section) return;
  const reduce = reducedMotion();
  const lines = $$('.manifest__word .line', section);
  const side = $('.manifest__side', section);

  if (reduce) {
    gsap.set(lines, { yPercent: 0 });
    return;
  }

  gsap.set(lines, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: section, start: 'top 75%', once: true,
    onEnter: () => gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.05 }),
  });

  /* Seitentext: fällt beim Rausscrollen buchstabenweise */
  const { chars } = splitChars(side);
  gsap.set(chars, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: side, start: 'top 85%', once: true,
    onEnter: () => gsap.to(chars, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: { each: 0.006, from: 'start' } }),
  });

  const fall = gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top top', end: 'center 30%', scrub: 2,
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
