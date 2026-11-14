import { $$, reducedMotion } from './utils/dom.js';

/* Das iPhone bei den Arbeiten.
   Ruhe: liegt schräg (Kamera rechts), im Display steht quer das Logo des Betriebs, es schwebt ganz leicht.
   Zeiger drauf (oder erster Tipp am Handy): es richtet sich ins Hochformat auf, das Logo weicht der Seite, die von selbst durchläuft.
   Solange der Zeiger drauf ist, neigt es sich zu ihm, ein Lichtfleck wandert übers Glas, Drücken drückt es leicht ein.
   Zeiger weg: zurück in die Schräglage, wieder das Logo. Läuft nur, solange es zu sehen ist. */
const TILT = 60;              // Schräglage in Grad (im Uhrzeigersinn, Kamera nach rechts)
const LEAN = -6;              // in der Schräglage leicht nach hinten geneigt, damit man den Rand sieht
const MAX = 12;               // stärkste Neigung zum Zeiger in Grad
const LAYERS = 22;            // Schichten für den Rand (Dicke)
const HALF = 2.41;            // halbe Dicke in cqw (8,75 mm bei 78 mm Breite)

const edgeColor = (t) => {    // Rand: Mitte hell poliert, zu den Kanten dunkel (gemessen am Foto)
  const k = Math.pow(1 - Math.abs(t - .5) * 2, .8);
  const mix = (a, b) => Math.round(a + (b - a) * k);
  return `rgb(${mix(62, 168)}, ${mix(31, 106)}, ${mix(37, 115)})`;
};
const clamp = (v) => Math.min(1, Math.max(-1, v));

export function initIphones() {
  const phones = $$('[data-iph]');
  if (!phones.length || reducedMotion()) return;

  let raf = 0, last = 0;
  const t0 = performance.now();
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const up = (it) => { it.upright = true; it.el.classList.add('is-up'); wake(); };
  const down = (it) => { it.upright = it.pressed = false; it.nx = it.ny = 0; it.el.classList.remove('is-up'); wake(); };
  const point = (it, e) => {
    const r = it.el.getBoundingClientRect();
    it.nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
    it.ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const items = phones.map((el, n) => {
    const spin = el.querySelector('.iph__spin');
    const frag = document.createDocumentFragment();
    for (let i = 0; i < LAYERS; i++) {
      const t = i / (LAYERS - 1);
      const e = document.createElement('i');
      e.className = 'iph__edge';
      e.style.setProperty('--z', `${((t - .5) * 2 * (HALF - .05)).toFixed(3)}cqw`);
      e.style.setProperty('--c', edgeColor(t));
      frag.appendChild(e);
    }
    spin.insertBefore(frag, spin.firstChild);
    el.classList.add('is-3d');

    const card = el.closest('a') || el;
    const it = {
      el, card, n, visible: false, upright: false, pressed: false, touched: false, nx: 0, ny: 0,
      rz: TILT, ry: 0, rx: LEAN, lift: 0, press: 1, gx: 30, gy: 20, glow: 0,
    };
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { point(it, e); up(it); } });
    card.addEventListener('pointermove', (e) => { if (it.upright) { point(it, e); wake(); } });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') down(it); });
    card.addEventListener('pointerdown', (e) => {
      it.touched = e.pointerType !== 'mouse';
      if (it.upright) { it.pressed = true; point(it, e); wake(); }
    });
    card.addEventListener('pointerup', () => { it.pressed = false; wake(); });
    card.addEventListener('pointercancel', () => { it.pressed = false; wake(); });
    card.addEventListener('focusin', () => { if (!it.touched) up(it); });
    card.addEventListener('focusout', () => { if (!it.touched) down(it); });
    /* Handy: der erste Tipp richtet es auf, erst der zweite öffnet die Seite */
    card.addEventListener('click', (e) => { if (it.touched && !it.upright) { e.preventDefault(); up(it); } });
    return it;
  });

  /* Tipp irgendwo anders am Handy: zurück in die Schräglage */
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    items.forEach((it) => { if (it.upright && !it.card.contains(e.target)) down(it); });
  }, { passive: true });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const it = items.find((x) => x.el === en.target);
      it.visible = en.isIntersecting;
      if (!it.visible && it.upright && it.touched) down(it);
    });
    wake();
  }, { rootMargin: '80px' });
  items.forEach((it) => io.observe(it.el));
  document.addEventListener('visibilitychange', wake);

  function tick(now) {
    raf = 0;
    const dt = Math.min(.05, last ? (now - last) / 1000 : .016);
    last = now;
    const t = (now - t0) / 1000;
    const k = 1 - Math.exp(-dt * 6);             // weiches Nachziehen, gleich schnell bei 60 und 120 Hz
    let any = false;
    for (const it of items) {
      if (!it.visible) continue;
      any = true;
      const aim = it.upright
        ? { rz: 0, ry: it.nx * MAX, rx: -it.ny * MAX * .7, lift: -6, press: it.pressed ? .965 : 1, gx: 50 + it.nx * 45, gy: 50 + it.ny * 45, glow: 1 }
        : { rz: TILT + Math.sin(t * .5 + it.n * 2) * 1.5, ry: Math.sin(t * .6 + it.n * 2) * 5, rx: LEAN + Math.sin(t * .45 + it.n) * 2, lift: Math.sin(t * .8 + it.n * 2) * 3, press: 1, gx: 30, gy: 20, glow: .25 };
      for (const key in aim) it[key] += (aim[key] - it[key]) * (key === 'press' ? Math.min(1, k * 2.5) : k);
      paint(it);
    }
    if (any && !document.hidden) raf = requestAnimationFrame(tick); else last = 0;
  }

  function paint(it) {
    const s = it.el.style;
    s.setProperty('--rz', `${it.rz.toFixed(2)}deg`);
    s.setProperty('--ry', `${it.ry.toFixed(2)}deg`);
    s.setProperty('--rx', `${it.rx.toFixed(2)}deg`);
    s.setProperty('--lift', `${it.lift.toFixed(2)}px`);
    s.setProperty('--press', it.press.toFixed(4));
    s.setProperty('--gx', `${it.gx.toFixed(1)}%`);
    s.setProperty('--gy', `${it.gy.toFixed(1)}%`);
    s.setProperty('--glow', it.glow.toFixed(3));
    s.setProperty('--floor', (0.7 + 0.5 * (it.rz / TILT)).toFixed(3));   // Schatten: schräg breiter, aufrecht schmaler
  }
  items.forEach(paint);
}
