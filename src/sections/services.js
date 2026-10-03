import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, reducedMotion } from '../utils/dom.js';
import { content } from '../content.js';
import { balloonPicture } from '../objects.js';

/* Leistungen: Text oben, darunter die Folien-Ballons und die Buchstaben g u s k i c. Alle weichen dem Zeiger aus. */
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

  const add = (el, spec) => {
    el.style.setProperty('--x', `${spec.x}%`);
    el.style.setProperty('--y', `${spec.y}%`);
    el.style.setProperty('--mx', `${spec.mx ?? spec.x}%`);
    el.style.setProperty('--my', `${spec.my ?? spec.y}%`);
    layer.appendChild(el);
    gsap.set(el, { rotation: spec.rot });
    const inner = el.firstElementChild;
    if (!reduce && inner) {
      gsap.to(inner, { y: rand(-16, 16), rotation: rand(-6, 6), duration: rand(3, 5), yoyo: true, repeat: -1, ease: 'sine.inOut', delay: rand(0, 2) });
    }
    const obj = { el, base: spec.rot, inside: false };
    objs.push(obj);
    return obj;
  };

  content.objects.cluster.forEach((spec) => {
    const el = document.createElement('div');
    el.className = 'float-obj';
    el.style.setProperty('--size', `min(${spec.size}vw, 600px)`);
    el.style.setProperty('--msize', `min(${Math.round(spec.size * 2.1)}vw, 300px)`);
    const inner = document.createElement('div');
    inner.className = 'float-obj__inner';
    const pic = balloonPicture(spec.id, { lazy: true });
    inner.appendChild(pic);
    el.appendChild(inner);
    const obj = add(el, spec);
    pic.querySelector('img').addEventListener('error', () => {
      el.remove();
      const i = objs.indexOf(obj);
      if (i > -1) objs.splice(i, 1);
    });
  });

  content.objects.letters.forEach((spec) => {
    const el = document.createElement('div');
    el.className = 'float-obj float-obj--letter';
    const inner = document.createElement('span');
    inner.className = 'float-obj__inner';
    inner.textContent = spec.ch;
    el.appendChild(inner);
    add(el, { ...spec, mx: spec.x, my: spec.y });
  });

  if (reduce) return;

  /* Zeiger-Abstoßung: innerhalb des Radius werden die Dinge weggeschoben, danach federn sie zurück */
  const params = () => (window.matchMedia('(max-width: 767px)').matches
    ? { R: 260, MAX: 110, ROT: 12, SC: 0.1 }
    : { R: 460, MAX: 380, ROT: 30, SC: 0.2 });
  let active = false;
  new IntersectionObserver(([e]) => { active = e.isIntersecting; }, { threshold: 0 }).observe(section);

  const release = (o) => {
    o.inside = false;
    gsap.to(o.el, { x: 0, y: 0, rotation: o.base, scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
  };
  const onMove = (x, y) => {
    if (!active) return;
    const { R, MAX, ROT, SC } = params();
    objs.forEach((o) => {
      const r = o.el.getBoundingClientRect();
      const tx = gsap.getProperty(o.el, 'x'), ty = gsap.getProperty(o.el, 'y');
      /* Abstand zur Ruhe-Position, damit ein weggeschobenes Ding nicht zittert */
      const cx = r.left + r.width / 2 - tx, cy = r.top + r.height / 2 - ty;
      const dx = cx - x, dy = cy - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        o.inside = true;
        const k = Math.pow((R - d) / R, 1.6);
        gsap.to(o.el, {
          x: (dx / d) * MAX * k, y: (dy / d) * MAX * k,
          rotation: o.base + (dx > 0 ? 1 : -1) * ROT * k, scale: 1 + SC * k,
          duration: 0.45, ease: 'power4.out', overwrite: 'auto',
        });
      } else if (o.inside) {
        release(o);
      }
    });
  };
  section.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
  section.addEventListener('pointerleave', () => objs.forEach((o) => { if (o.inside) release(o); }));
  section.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  section.addEventListener('touchend', () => objs.forEach((o) => { if (o.inside) release(o); }), { passive: true });
}
