import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, reducedMotion, isMobile } from '../utils/dom.js';
import { content } from '../content.js';
import { MATERIALS, materialPicture } from '../materials.js';
import { createMiniO } from '../miniO.js';

/* Leistungen auf Schwarz, umgeben von den eigenen Os. Nichts anderes: die Marke hat nur ihre Os. */
export function initServices() {
  const section = $('.services');
  if (!section) return;
  const reduce = reducedMotion();

  const items = $$('.services__item .line', section);
  gsap.set(items, { yPercent: reduce ? 0 : 110 });
  if (!reduce) {
    ScrollTrigger.create({
      trigger: section, start: 'top 70%', once: true,
      onEnter: () => gsap.to(items, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }),
    });
  }

  const layer = $('.services__objects', section);
  if (!layer) return;
  const objs = [];

  content.services.objects.forEach((spec) => {
    const el = document.createElement('div');
    el.className = 'float-obj';
    el.style.setProperty('--x', `${spec.x}%`);
    el.style.setProperty('--y', `${spec.y}%`);
    el.style.setProperty('--mx', `${spec.mx ?? spec.x}%`);
    el.style.setProperty('--my', `${spec.my ?? spec.y}%`);
    const inner = document.createElement('div');
    inner.className = 'float-obj__inner';
    el.appendChild(inner);
    const obj = { el, base: spec.rot, inside: false };

    if (spec.type === 'material') {
      const m = MATERIALS.find((x) => x.id === spec.id);
      if (!m) return;
      /* Nie über 100 % der Pixelgröße bei DPR 2 skalieren */
      const cap = Math.floor(Math.max(m.w, m.h) / 2);
      el.style.setProperty('--size', `min(${spec.size}vw, ${cap}px)`);
      const pic = materialPicture(m, { lazy: true });
      pic.querySelector('img').addEventListener('error', () => {
        el.remove();
        const i = objs.indexOf(obj);
        if (i > -1) objs.splice(i, 1);
      });
      inner.appendChild(pic);
    } else {
      el.style.setProperty('--size', `clamp(56px, ${spec.size}vw, 220px)`);
      el.classList.add('float-obj--chrome');
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      inner.appendChild(canvas);
      layer.appendChild(el);
      if (!createMiniO(canvas, { fill: 0.86, observe: true, spin: 0.45 })) { el.remove(); return; }
    }

    layer.appendChild(el);
    gsap.set(el, { rotation: spec.rot });
    if (!reduce) {
      gsap.to(inner, { y: rand(-16, 16), rotation: rand(-6, 6), duration: rand(3, 5), yoyo: true, repeat: -1, ease: 'sine.inOut', delay: rand(0, 2) });
    }
    objs.push(obj);
  });

  if (reduce) return;

  /* Cursor-Abstoßung */
  const mob = isMobile();
  const R = mob ? 260 : 460, MAX = mob ? 110 : 380, ROT = mob ? 12 : 30;
  let active = false;
  new IntersectionObserver(([e]) => { active = e.isIntersecting; }, { threshold: 0 }).observe(section);

  const onMove = (x, y) => {
    if (!active) return;
    objs.forEach((o) => {
      const r = o.el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        o.inside = true;
        const k = Math.pow((R - d) / R, 1.6);
        gsap.to(o.el, {
          x: (dx / d) * MAX * k, y: (dy / d) * MAX * k,
          rotation: o.base + (dx > 0 ? 1 : -1) * ROT * k, scale: 1 + 0.2 * k,
          duration: 0.45, ease: 'power4.out', overwrite: 'auto',
        });
      } else if (o.inside) {
        o.inside = false;
        gsap.to(o.el, { x: 0, y: 0, rotation: o.base, scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
      }
    });
  };
  window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
}
