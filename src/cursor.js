import { gsap } from './utils/gsap.js';
import { $$ } from './utils/dom.js';

/* Runde weiße Blase mit Text, folgt dem Zeiger mit lerp 0.09. */
export function initCursor() {
  if (window.matchMedia('(hover: none)').matches) return null;
  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);

  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, cur = { x: pos.x, y: pos.y };
  window.addEventListener('pointermove', (e) => { pos.x = e.clientX; pos.y = e.clientY; }, { passive: true });
  gsap.ticker.add(() => {
    cur.x += (pos.x - cur.x) * 0.09; cur.y += (pos.y - cur.y) * 0.09;
    el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) scale(var(--s, 0))`;
  });

  const scale = { v: 0 };
  const apply = () => el.style.setProperty('--s', scale.v.toFixed(3));
  const show = (text) => { el.textContent = text; gsap.to(scale, { v: 1, duration: 0.6, ease: 'back.out(1.8)', overwrite: true, onUpdate: apply }); };
  const hide = () => gsap.to(scale, { v: 0, duration: 0.38, ease: 'power3.in', overwrite: true, onUpdate: apply });

  const bind = (root = document) => {
    $$('[data-cursor]', root).forEach((t) => {
      t.addEventListener('pointerenter', () => show(t.dataset.cursor));
      t.addEventListener('pointerleave', hide);
    });
  };
  bind();
  return { show, hide, bind };
}
