import { ScrollTrigger } from './utils/gsap.js';
import { $, $$ } from './utils/dom.js';

/* Farbe der Navigation: weiß über dunklen Abschnitten (Klasse is-light), schwarz über hellen.
   Das Zeichen „gO“ hat eine eigene kleine Fläche (nav.css), damit es nie in Text darunter läuft. */
export function initNav() {
  const nav = $('.nav');
  if (!nav) return;
  let ranges = [], queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY + nav.offsetHeight / 2;
    nav.classList.toggle('is-light', ranges.some(([a, b]) => y >= a && y < b));
  };
  const measure = () => {
    ranges = $$('main .on-dark:not([data-nav="dark"]), footer.on-dark').map((el) => {
      const r = el.getBoundingClientRect();
      return [r.top + window.scrollY, r.bottom + window.scrollY];
    });
    update();
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  ScrollTrigger.addEventListener('refresh', measure);
  measure();
}
