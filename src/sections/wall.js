/*
  Arbeiten: Wand aus Bildschirmen (nach der Jitter-Vorlage „Animated Mobile Screens“). Drei Reihen hochformatiger
  Bildschirme gleiten langsam seitlich, die hinteren kleiner und dunkler, alles zoomt sanft. In der vorderen Reihe laufen
  die echten Seiten durch. Die Bewegung macht CSS (sections.css → „Wand aus Bildschirmen“).
  Antippen oder Klicken irgendwo auf die Wand: die Reihen bleiben stehen, die Seiten in den Bildschirmen laufen weiter.
  Nochmal antippen: es geht weiter. Außerhalb des Bildschirms ruht alles, damit das Handy nicht unnötig rechnet.
*/
import { $ } from '../utils/dom.js';

export function initWall() {
  const wall = $('[data-wall]');
  if (!wall) return;
  const btn = $('.wall__toggle', wall);
  const set = (paused) => {
    wall.classList.toggle('is-paused', paused);
    if (btn) {
      btn.setAttribute('aria-pressed', String(paused));
      btn.setAttribute('aria-label', paused ? 'Bewegung fortsetzen' : 'Bewegung anhalten');
    }
  };
  wall.addEventListener('click', () => set(!wall.classList.contains('is-paused')));
  new IntersectionObserver(([e]) => wall.classList.toggle('is-off', !e.isIntersecting), { rootMargin: '100px' }).observe(wall);
}
