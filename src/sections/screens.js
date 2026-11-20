/*
  Arbeiten als Stapel (seit 20.11.2026, Lazars Idee). CSS: sections.css → „Arbeiten als Stapel“.
  Zwei Browserfenster im Breitformat liegen aufeinander.
    aufeinander  → Tippen: sie fächern auf
    aufgefächert → Tippen auf eines: nur diese Seite groß, die andere klein daneben
    groß         → Tippen auf die große: zurück zum Auffächern; Tippen auf die kleine: die wird groß
  Escape führt zurück zum Stapel. Die Seiten scrollen in jedem Zustand von selbst.
  Außerhalb des Bildschirms ruht alles (.is-on), beim ersten Sichtbarwerden schweben die Fenster herein (.is-seen).
*/
import { $, $$ } from '../utils/dom.js';

const HINWEIS = {
  stack: 'Tippen zum Auffächern',
  open: 'Tippen, um eine Seite groß zu sehen',
  focus: 'Nochmal tippen: zurück',
};

export function initScreens() {
  const works = $('[data-works]');
  if (!works) return;
  const cards = $$('[data-screen]', works);
  const hint = $('[data-deck-hint]', works);
  if (!cards.length) return;
  const name = (c) => c.dataset.name || c.getAttribute('aria-label');
  cards.forEach((c) => { c.dataset.name = c.getAttribute('aria-label'); });

  const set = (state, focus = '') => {
    works.dataset.state = state;
    if (focus) works.dataset.focus = focus; else delete works.dataset.focus;
    if (hint) hint.textContent = HINWEIS[state];
    cards.forEach((c) => {
      const n = c.dataset.screen, big = state === 'focus' && focus === n;
      c.setAttribute('aria-pressed', String(big));
      c.setAttribute('aria-label', state === 'stack' ? `${name(c)}: Arbeiten auffächern` : big ? `${name(c)}: zurück` : `${name(c)}: groß ansehen`);
    });
  };

  cards.forEach((c) => c.addEventListener('click', () => {
    const n = c.dataset.screen, st = works.dataset.state;
    if (st === 'stack') set('open');
    else if (st === 'open') set('focus', n);
    else if (works.dataset.focus === n) set('open');
    else set('focus', n);
  }));
  works.addEventListener('keydown', (e) => { if (e.key === 'Escape' && works.dataset.state !== 'stack') set('stack'); });

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    e.target.classList.toggle('is-on', e.isIntersecting);
    if (e.isIntersecting) e.target.classList.add('is-seen');
  }), { threshold: 0.15 });
  cards.forEach((c) => io.observe(c));
  set('stack');
}
