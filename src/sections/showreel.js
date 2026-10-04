import { gsap } from '../utils/gsap.js';
import { $, reducedMotion } from '../utils/dom.js';

/* Showreel über die ganze Breite. Der Schalter „Sound“ gehört zu src/sound.js. */
export function initShowreel() {
  const section = $('.showreel');
  if (!section || reducedMotion()) return;
  const frame = $('.showreel__frame', section), video = $('video', section), pill = $('.sound', section);

  /* Der Rahmen wächst beim Hereinscrollen auf die volle Breite, das Video gleitet leicht mit */
  gsap.fromTo(frame, { scale: 0.86, transformOrigin: '50% 50%' }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: section, start: 'top 90%', end: 'top 15%', scrub: 1 },
  });
  if (video) {
    gsap.fromTo(video, { yPercent: -5 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
    });
  }
  if (pill) {
    gsap.fromTo(pill, { opacity: 0 }, {
      opacity: 1, duration: 0.6, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top 45%', toggleActions: 'play none none reverse' },
    });
  }
}
