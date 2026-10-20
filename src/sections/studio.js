import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';

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

  /* Laufende Leiste: der Inhalt steht zweimal drin. Der Abstand nach jedem Satz wird so gesetzt, dass ein Satz
     mindestens die Leistenbreite überbrückt, also nie zwei Kopien derselben Vorlage gleichzeitig sichtbar sind.
     Die Geschwindigkeit bleibt gleich (Pixel pro Sekunde), egal wie breit die Runde ist. */
  const strip = $('.strip', section);
  const track = strip && $('.strip__track', strip);
  if (track) {
    const items = $$('.strip__item', track), n = items.length / 2;
    const fit = () => {
      const gap = parseFloat(getComputedStyle(strip).getPropertyValue('--gap')) || 16;
      const seen = strip.clientWidth;                                   /* sichtbare Breite der Leiste (samt Rand) */
      const set = items.slice(0, n).reduce((w, el) => w + el.offsetWidth, 0) + gap * (n - 1);
      const narrowest = Math.min(...items.slice(0, n).map((el) => el.offsetWidth));
      const sep = Math.max(gap, seen - gap - narrowest + 2);             /* erst wenn eine Kopie ganz draußen ist, kommt die nächste herein */
      [items[n - 1], items[2 * n - 1]].forEach((el) => el && el.classList.add('is-last'));
      strip.style.setProperty('--sep', `${sep}px`);
      track.style.animationDuration = `${Math.round((set + sep) / 55)}s`;   /* ~55 px pro Sekunde */
    };
    fit();
    window.addEventListener('resize', debounce(fit, 200));
    document.fonts?.ready.then(fit);
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
