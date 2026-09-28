import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, reducedMotion, isMobile } from '../utils/dom.js';
import { OBJECT_NAMES } from '../objects.js';

export function initServices({ objects } = {}) {
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

  /* Schwebende Chrom- und Folienobjekte mit Cursor-Abstoßung */
  const layer = $('.services__objects', section);
  Promise.resolve(objects).then((loaded) => {
    const urls = (loaded && loaded.urls) || [];
    if (!urls.length || !layer) return;
    const spots = [
      { x: 8, y: 14, s: 150 }, { x: 78, y: 10, s: 120 }, { x: 92, y: 42, s: 190 }, { x: 14, y: 68, s: 110 },
      { x: 46, y: 88, s: 160 }, { x: 84, y: 82, s: 130 }, { x: 60, y: 6, s: 90 },
    ];
    const mob = isMobile();
    const objs = spots.map((sp, i) => {
      const el = document.createElement('div');
      el.className = 'float-obj';
      const size = mob ? sp.s * 0.55 : sp.s;
      el.style.setProperty('--size', `${size}px`);
      el.style.setProperty('--x', `${sp.x}%`);
      el.style.setProperty('--y', `${sp.y}%`);
      const inner = document.createElement('div');
      inner.className = 'float-obj__inner';
      const img = document.createElement('img');
      img.src = urls[i % urls.length]; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.setAttribute('aria-hidden', 'true');
      inner.appendChild(img); el.appendChild(inner); layer.appendChild(el);
      const base = rand(-20, 20);
      gsap.set(el, { rotation: base });
      if (!reduce) {
        gsap.to(inner, { y: rand(-16, 16), rotation: rand(-6, 6), duration: rand(3, 5), yoyo: true, repeat: -1, ease: 'sine.inOut', delay: rand(0, 2) });
      }
      return { el, base, inside: false };
    });

    if (reduce || window.matchMedia('(hover: none)').matches && !mob) return;
    const R = mob ? 260 : 460, MAX = mob ? 110 : 380, ROT = mob ? 12 : 30;
    let active = false;
    new IntersectionObserver(([e]) => { active = e.isIntersecting; }, { threshold: 0 }).observe(section);
    const onMove = (e) => {
      if (!active) return;
      objs.forEach((o) => {
        const r = o.el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = cx - e.clientX, dy = cy - e.clientY;
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
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onMove({ clientX: t.clientX, clientY: t.clientY }); }, { passive: true });
  });
}
