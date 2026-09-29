import { gsap, ScrollTrigger, Flip } from '../utils/gsap.js';
import { $, $$, debounce, reducedMotion } from '../utils/dom.js';
import { createMiniO } from '../miniO.js';

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

  /* Überschrift: Buchstaben wandern per Flip von der Zeile in den Stapel am linken Rand und zurück */
  let master = null, trigger = null;
  function buildFlip() {
    if (master) { master.kill(); master = null; }
    if (trigger) { trigger.kill(); trigger = null; }
    gsap.set(letters, { clearProps: 'all' });
    if (reduce || window.innerWidth < 900) return;

    title.classList.add('works__title--row');
    const rowState = Flip.getState(letters);
    title.classList.remove('works__title--row');

    /* Reihenfolge wichtig: Flip.to zuerst aufnehmen (natürlicher Stapel), dann Flip.from (rendert die Zeile sofort) */
    const back = Flip.to(rowState, { duration: 1, ease: 'none', stagger: { each: 0.06, from: 'end' } });
    const forth = Flip.from(rowState, { duration: 1, ease: 'none', stagger: { each: 0.06, from: 'end' } });
    const squash = (at) => gsap.to(letters, { keyframes: [{ scale: 0.2, ease: 'power2.in' }, { scale: 1, ease: 'power2.out' }], duration: 1, stagger: { each: 0.06, from: 'end' } });

    master = gsap.timeline({ paused: true });
    master.add(forth, 0).add(squash(), 0);
    master.add(back, 2.2).add(squash(), 2.2);

    trigger = ScrollTrigger.create({
      trigger: section, start: 'top 60%', end: 'bottom 40%', scrub: 3, animation: master,
    });
  }
  buildFlip();
  window.addEventListener('resize', debounce(buildFlip, 250));

  /* Projekte: Clip-Reveal von unten, Parallax im Bild */
  $$('.work', section).forEach((card, i) => {
    const media = $('.work__media', card), img = $('.work__img', card);
    if (card.classList.contains('work--cta')) {
      gsap.set(media, { clipPath: 'inset(100% 0 0 0)' });
      ScrollTrigger.create({ trigger: card, start: 'top 88%', once: true, onEnter: () => gsap.to(media, { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'power4.inOut' }) });
      return;
    }
    if (reduce) { gsap.set(media, { clipPath: 'inset(0% 0 0 0)' }); return; }
    ScrollTrigger.create({
      trigger: card, start: 'top 88%', once: true,
      onEnter: () => gsap.to(media, { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'power4.inOut' }),
    });
    if (img) {
      gsap.fromTo(img, { yPercent: -4.5 }, {
        yPercent: 4.5, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1.5 + (i % 3) * 0.6 },
      });
    }
  });

  /* Pulsierendes Chrom-O in der CTA-Karte; ohne WebGL steht das Newsreader-O */
  const pulse = $('.work__pulse canvas', section);
  if (pulse && !createMiniO(pulse, { fill: 0.8, observe: true, spin: 0.4 })) pulse.remove();

  if (cursor) cursor.bind(section);
}
