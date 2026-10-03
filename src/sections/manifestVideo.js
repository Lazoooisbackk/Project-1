import { gsap } from '../utils/gsap.js';
import { $, $$, reducedMotion } from '../utils/dom.js';
import { content } from '../content.js';

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz§!?.,;:_';

/* Vollbild-Video mit der Figur im Folien-Kostüm. Darüber kleine Textblöcke, deren letzte Zeile
   ständig ihre Zeichen würfelt, und zwei Bildkarten, die unterschiedlich schnell mitgleiten. */
export function initManifestVideo() {
  const section = $('.mvideo');
  if (!section) return;
  const reduce = reducedMotion();
  const line = content.manifestVideo.line;

  /* Textblöcke aufbauen: drei gleiche Zeilen, eine gewürfelte */
  const scramblers = $$('.mvideo__note', section).map((note) => {
    note.innerHTML = `<span>${line}</span><span>${line}</span><span>${line}</span><span class="mvideo__scramble" aria-hidden="true">${line}</span>`;
    return $('.mvideo__scramble', note);
  });

  if (reduce) return;

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(section);
  const chars = Array.from(line);
  setInterval(() => {
    if (!visible || document.hidden) return;
    scramblers.forEach((el) => {
      el.textContent = chars.map((c) => (c === ' ' || Math.random() > 0.55 ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    });
  }, 110);

  /* Video gleitet langsam, die Karten laufen unterschiedlich schnell darüber */
  const video = $('.mvideo__bg video', section);
  if (video) gsap.fromTo(video, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
  $$('.mvideo__card', section).forEach((card, i) => {
    const d = i % 2 ? 190 : 110;
    gsap.fromTo(card, { y: d, rotation: i % 2 ? 3 : -4 }, {
      y: -d, rotation: i % 2 ? -2 : 3, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1 + i * 0.5 },
    });
  });
  const say = $('.mvideo__say', section);
  if (say) gsap.fromTo(say, { y: 60 }, { y: -60, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.4 } });
}
