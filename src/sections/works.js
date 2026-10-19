import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';

/* Arbeiten: nur noch OUNJI auf Perlweiß. Das Bild schiebt sich von unten frei, darin leichtes Parallax. */
const CLOSED = 'inset(100% 0% 0% 0%)';
const OPEN = 'inset(0% 0% 0% 0%)';

export function initWorks({ cursor } = {}) {
  const section = $('.works');
  if (!section) return;
  const reduce = reducedMotion();

  /* Fehlender Screenshot: Platzhalter einblenden */
  $$('.work__img', section).forEach((img) => {
    const card = img.closest('.work');
    const missing = () => card.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0) missing();
    img.addEventListener('error', missing);
  });

  if (!reduce) {
    $$('.work', section).forEach((card) => {
      const media = $('.work__media', card), img = $('.work__img', card);
      gsap.set(media, { clipPath: CLOSED });
      ScrollTrigger.create({
        trigger: card, start: 'top 88%', once: true,
        onEnter: () => gsap.to(media, { clipPath: OPEN, duration: 1, ease: 'power4.inOut' }),
      });
      if (img) {
        gsap.fromTo(img, { yPercent: -4.5 }, {
          yPercent: 4.5, ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1.5 },
        });
      }
    });
  }

  if (cursor) cursor.bind(section);
}
