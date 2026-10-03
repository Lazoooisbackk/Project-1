import { gsap } from '../utils/gsap.js';
import { $, rand, reducedMotion, debounce } from '../utils/dom.js';
import { content } from '../content.js';

/*
  Physik-Buchstaben: das Wort fällt in den Bereich, dreht sich, stapelt sich
  und lässt sich ziehen und werfen. matter-js wird erst kurz vor dem Bereich geladen.
*/
const STEP = 1000 / 60;

export function initPlay({ cursor } = {}) {
  const section = $('.play');
  if (!section) return;
  const field = $('.play__field', section);
  const word = field.dataset.word || content.play.word;
  const letters = Array.from(word);

  if (reducedMotion()) {
    section.classList.add('is-static');
    field.innerHTML = letters.map((c) => `<span class="play__ch">${c}</span>`).join('');
    return;
  }

  let started = false;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || started) return;
    started = true; io.disconnect();
    Promise.all([import('matter-js'), document.fonts.ready]).then(([m]) => build(m.default || m));
  }, { rootMargin: '50% 0px' });
  io.observe(section);

  function build(M) {
    const { Engine, Bodies, Body, Composite, Constraint, Sleeping, Query } = M;
    const engine = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 6 });
    engine.gravity.y = 1.1;

    const els = letters.map((c) => {
      const el = document.createElement('span');
      el.className = 'play__ch';
      el.textContent = c;
      el.dataset.cursor = content.play.cursor;
      field.appendChild(el);
      return el;
    });
    if (cursor) cursor.bind(section);

    const ctx = document.createElement('canvas').getContext('2d');
    let W = 0, H = 0, walls = [], items = [];

    /* Tintenbox jedes Buchstaben, damit der Körper genau die Form umschließt */
    const measure = (el) => {
      const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
      ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      const m = ctx.measureText(el.textContent);
      const base = (fs - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      return { w, h, cx: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, cy: base + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 };
    };

    const makeWalls = () => {
      Composite.remove(engine.world, walls);
      const t = 400;
      walls = [
        Bodies.rectangle(W / 2, H + t / 2, W * 3, t, { isStatic: true }),
        Bodies.rectangle(-t / 2, -H, t, H * 4, { isStatic: true }),
        Bodies.rectangle(W + t / 2, -H, t, H * 4, { isStatic: true }),
        Bodies.rectangle(W / 2, -H * 3 - t / 2, W * 3, t, { isStatic: true }),
      ];
      Composite.add(engine.world, walls);
    };

    const makeBody = (box, x, y, angle) => Bodies.rectangle(x, y, box.w, box.h, {
      angle, chamfer: { radius: Math.min(box.w, box.h) * 0.12 },
      restitution: 0.25, friction: 0.35, frictionAir: 0.012, density: 0.002,
    });

    const layout = () => {
      const pw = W;
      W = field.clientWidth; H = field.clientHeight;
      makeWalls();
      const k = pw ? W / pw : 1;
      items = els.map((el, i) => {
        const box = measure(el);
        el.style.transformOrigin = `${box.cx}px ${box.cy}px`;
        const old = items[i], live = !!(old && old.live);
        if (live) Composite.remove(engine.world, old.body);
        const x = live ? Math.min(W - box.w / 2, Math.max(box.w / 2, old.body.position.x * k)) : 0;
        const body = makeBody(box, x, live ? Math.min(old.body.position.y, H - box.h / 2) : -H, live ? old.body.angle : 0);
        if (live) Composite.add(engine.world, body);
        return { el, box, body, live };
      });
    };

    const drop = () => {
      items.forEach((_, i) => {
        gsap.delayedCall(i * 0.12, () => {
          const it = items[i], { box, body } = it;
          Body.setPosition(body, { x: rand(box.w, Math.max(box.w + 1, W - box.w)), y: -box.h - rand(0, H * 0.3) });
          Body.setAngle(body, rand(-0.6, 0.6));
          Body.setAngularVelocity(body, rand(-0.08, 0.08));
          Composite.add(engine.world, body);
          it.live = true;
        });
      });
    };

    /* Ziehen und Werfen */
    let drag = null;
    const local = (e) => { const r = field.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    layout();
    els.forEach((el, i) => {
      el.addEventListener('pointerdown', (e) => {
        const it = items[i];
        if (!it.live) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const p = local(e), b = it.body;
        Sleeping.set(b, false);
        drag = Constraint.create({ pointA: p, bodyB: b, pointB: { x: p.x - b.position.x, y: p.y - b.position.y }, stiffness: 0.18, damping: 0.08, length: 0 });
        Composite.add(engine.world, drag);
        el.classList.add('is-drag');
      });
      el.addEventListener('pointermove', (e) => { if (drag && drag.bodyB === items[i].body) drag.pointA = local(e); });
      const end = () => { if (!drag || drag.bodyB !== items[i].body) return; Composite.remove(engine.world, drag); drag = null; el.classList.remove('is-drag'); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });

    /* Zeiger schubst die Buchstaben beim Darüberfahren */
    let last = null;
    field.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || drag) { last = null; return; }
      const p = local(e);
      if (last) {
        const vx = p.x - last.x, vy = p.y - last.y;
        const hit = Query.point(items.filter((it) => it.live).map((it) => it.body), p);
        hit.forEach((b) => { Sleeping.set(b, false); Body.applyForce(b, p, { x: vx * b.mass * 0.0009, y: vy * b.mass * 0.0009 }); });
      }
      last = p;
    }, { passive: true });
    field.addEventListener('pointerleave', () => { last = null; });

    /* Schritt mit festem Takt, nur im Bild */
    let visible = false, acc = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(field);
    gsap.ticker.add((time, dt) => {
      if (!visible) return;
      acc = Math.min(acc + dt, STEP * 3);
      while (acc >= STEP) { Engine.update(engine, STEP); acc -= STEP; }
      for (const { el, box, body, live } of items) {
        if (!live) continue;
        el.style.transform = `translate3d(${body.position.x - box.cx}px,${body.position.y - box.cy}px,0) rotate(${body.angle}rad)`;
      }
    });

    let lastW = window.innerWidth;
    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      layout();
    }, 250));

    /* erst fallen lassen, wenn der Bereich gut sichtbar ist */
    const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io2.disconnect(); drop(); } }, { threshold: 0.35 });
    io2.observe(field);
  }
}
