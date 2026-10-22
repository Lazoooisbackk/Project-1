import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';
import { initAutoVideos } from '../utils/video.js';

export function initStudio() {
  const section = $('.studio');
  if (!section) return;
  const reduce = reducedMotion();

  /* Textzeilen gibt es in diesem Bereich derzeit nicht; falls wieder welche dazukommen, fahren sie von unten ein */
  const text = $('.studio__text', section);
  if (text) {
    let { lines } = splitLines(text);
    let shown = reduce;
    gsap.set(lines, { yPercent: reduce ? 0 : 110 });
    if (!reduce) ScrollTrigger.create({ trigger: text, start: 'top 85%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }); } });
    window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(text)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));
  }

  /* Die Person: kommt beim Hinscrollen weich von unten */
  const person = $('[data-person]', section);
  if (person && !reduce) {
    const parts = Array.from(person.children);
    gsap.set(parts, { y: 24, opacity: 0 });
    ScrollTrigger.create({ trigger: person, start: 'top 85%', once: true, onEnter: () => gsap.to(parts, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.08, clearProps: 'transform,opacity' }) });
  }

  /* Laufende Säule: ein Satz = die Vorlagen einmal. Es werden so viele Kopien angehängt, dass die Säule
     auch in der Startstellung (um eine Satzhöhe hochgeschoben) bis unten gefüllt ist; die Strecke ist genau eine Satzhöhe. */
  const strip = $('.strip', section);
  const track = strip && $('.strip__track', strip);
  if (track) {
    const first = [...track.children];
    const n = first.length / 2;                                    /* im HTML steht der Satz zweimal */
    const set = () => first[n].offsetTop - first[0].offsetTop;     /* Satzhöhe samt Abständen */
    const fill = () => {
      const h = set();
      if (!h) return;
      const need = Math.ceil(strip.clientHeight / h) + 1;          /* Kopien, die nötig sind */
      let have = track.children.length / n;
      while (have < need) {
        first.slice(0, n).forEach((el) => { const c = el.cloneNode(true); track.appendChild(c); initAutoVideos(c); });
        have++;
      }
      track.style.setProperty('--set', `${h}px`);
      track.style.animationDuration = `${Math.max(16, Math.round(h / 16))}s`;   /* ~16 px pro Sekunde */
    };
    fill();
    window.addEventListener('resize', debounce(fill, 200));
    document.fonts?.ready.then(fill);
  }

  if (reduce) return;

  /* Die Glas-Leiste schiebt sich einmal von unten frei; das Laufen selbst macht reines CSS */
  if (strip) {
    gsap.fromTo(strip, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut',
      scrollTrigger: { trigger: strip, start: 'top 90%', once: true },
    });
  }
}
