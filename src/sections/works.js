import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, debounce, reducedMotion } from '../utils/dom.js';

/* Drei Arten, wie sich ein Bild freischiebt: von unten, von unten links, von unten rechts */
const CLIPS = ['inset(100% 0% 0% 0%)', 'inset(100% 100% 0% 0%)', 'inset(100% 0% 0% 100%)'];
const OPEN = 'inset(0% 0% 0% 0%)';

export function initWorks({ cursor } = {}) {
  const section = $('.works');
  if (!section) return;
  const reduce = reducedMotion();
  const title = $('.works__title', section);
  const letters = $$('.works__letter', section);

  /* Fehlende Screenshots: Platzhalter einblenden */
  $$('.work__img', section).forEach((img) => {
    const card = img.closest('.work');
    const missing = () => card.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0) missing();
    img.addEventListener('error', missing);
  });

  /* Überschrift: bleibt oben stehen und wandert beim Scrollen Buchstabe für Buchstabe
     an den rechten Rand und wieder zurück */
  let master = null;
  function buildTravel() {
    if (master) { master.scrollTrigger.kill(); master.kill(); master = null; }
    gsap.set(letters, { clearProps: 'transform' });
    if (reduce || window.innerWidth < 800) return;
    const pad = parseFloat(getComputedStyle(section).paddingLeft) || 0;
    const travel = section.clientWidth - pad * 2 - title.offsetWidth;
    if (travel < 40) return;
    master = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 20%', end: 'bottom 80%', scrub: 2.5 },
    });
    master
      .to(letters, { x: travel, duration: 1, ease: 'power2.inOut', stagger: { each: 0.07, from: 'end' } }, 0.25)
      .to(letters, { x: 0, duration: 1, ease: 'power2.inOut', stagger: { each: 0.07, from: 'start' } }, 2.1)
      .to({}, { duration: 0.2 });
  }
  buildTravel();
  window.addEventListener('resize', debounce(buildTravel, 250));

  /* Aussage rechts oben */
  const statement = $('.works__statement', section);
  if (statement && !reduce) {
    gsap.fromTo(statement, { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power4.out',
      scrollTrigger: { trigger: statement, start: 'top 88%', once: true },
    });
  }

  /* Projekte: Bild schiebt sich frei, leichtes Parallax im Bild und zwischen den Karten */
  $$('.work', section).forEach((card, i) => {
    const media = $('.work__media', card), img = $('.work__img', card);
    if (reduce) return;
    gsap.set(media, { clipPath: CLIPS[i % CLIPS.length] });
    ScrollTrigger.create({
      trigger: card, start: 'top 88%', once: true,
      onEnter: () => gsap.to(media, { clipPath: OPEN, duration: 1, ease: 'power4.inOut' }),
    });
    if (img) {
      gsap.fromTo(img, { yPercent: -4.5 }, {
        yPercent: 4.5, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1.5 + (i % 3) * 0.6 },
      });
    }
    if (window.innerWidth >= 800 && i % 2 === 1) {
      gsap.fromTo(card, { y: 60 }, {
        y: -60, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
      });
    }
  });

  if (cursor) cursor.bind(section);
}
