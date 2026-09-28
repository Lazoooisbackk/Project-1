/* Magnetische Buttons (max. 8 px Zug) und Link-Unterstreichungen (CSS). */
import { gsap } from './utils/gsap.js';
import { $$, reducedMotion } from './utils/dom.js';

export function initMagnetic(root = document) {
  if (reducedMotion() || window.matchMedia('(hover: none)').matches) return;
  const items = $$('.magnetic', root).map((el) => ({
    el,
    inside: false,
    x: gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' }),
    y: gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' }),
  }));
  if (!items.length) return;
  const R = 90, MAX = 8;
  window.addEventListener('pointermove', (e) => {
    items.forEach((it) => {
      const r = it.el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const reach = Math.max(r.width, r.height) / 2 + R;
      if (d < reach) {
        it.inside = true;
        const k = MAX * (1 - d / reach);
        it.x((dx / d) * k * 1.4); it.y((dy / d) * k * 1.4);
      } else if (it.inside) {
        it.inside = false;
        gsap.to(it.el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true });
      }
    });
  }, { passive: true });
}
