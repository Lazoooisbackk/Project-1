/*
  Intro-Loader. Spielt einmal pro Session (sessionStorage), danach wird er sofort übersprungen.
  Timings siehe Brief, Abschnitt 3.
*/
import { gsap } from './utils/gsap.js';
import { $, $$, rand, pad3, session, reducedMotion, isMobile, emit } from './utils/dom.js';
import { lockScroll, unlockScroll } from './scroll.js';
import { OBJECT_NAMES } from './objects.js';

const KEY = 'gs-intro-seen';

export async function runLoader({ hero, objects, fonts }) {
  const el = $('#loader');
  const g = $('.loader__g', el), o = $('.loader__o', el), gap = $('.loader__gap', el);
  const objs = $('.loader__objs', el), counter = $('.loader__counter', el);
  const reduce = reducedMotion();

  const finish = () => {
    el.hidden = true;
    document.body.classList.remove('is-loading');
    unlockScroll();
    session.set(KEY, '1');
  };

  /* Zweiter Besuch in dieser Session: sofort überspringen */
  if (session.get(KEY)) {
    el.hidden = true;
    document.body.classList.remove('is-loading');
    await Promise.all([fonts, objects]);
    hero.reveal({ instant: true });
    return;
  }

  document.body.classList.add('is-loading');
  lockScroll();

  /* Reduzierte Bewegung: kein Karussell, nur 400 ms Fade */
  if (reduce) {
    await Promise.all([fonts, objects]);
    await gsap.to(el, { opacity: 0, duration: 0.4, ease: 'none' }).then();
    finish();
    hero.reveal({ instant: true });
    return;
  }

  const gapWidth = isMobile() ? '10rem' : '20rem';
  counter.textContent = '100';
  gsap.set(g, { yPercent: 100, opacity: 1 });
  gsap.set(o, { scale: 0, opacity: 1 });

  /* 1–3: Buchstaben erscheinen, Lücke öffnet sich */
  const tlA = gsap.timeline();
  tlA.to(g, { yPercent: 0, duration: 1, ease: 'power4.inOut' }, 0)
    .to(o, { scale: 1, duration: 1, ease: 'power4.inOut' }, 0)
    .to(gap, { width: gapWidth, duration: 1.2, ease: 'power4.inOut' }, 0.85);

  const [, loaded] = await Promise.all([tlA.then(), objects, fonts]);
  const urls = (loaded && loaded.urls) || [];

  /* 4: Objekt-Karussell + Zähler 100 → 000 */
  const imgs = urls.map((src, i) => {
    const img = document.createElement('img');
    img.className = 'loader__obj';
    img.src = src; img.alt = ''; img.decoding = 'sync';
    img.setAttribute('aria-hidden', 'true');
    img.dataset.name = OBJECT_NAMES[i] || '';
    objs.appendChild(img);
    return img;
  });
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));

  const count = { v: 100 };
  const CAROUSEL = 2.4;
  const tlB = gsap.timeline();
  let current = null;
  if (imgs.length) {
    current = imgs[0];
    tlB.fromTo(current, { scale: 0, rotation: 0, opacity: 1 }, { scale: 1, rotation: 15, duration: 0.8, ease: 'back.out(0.9)' }, 0.5);
    let t = 1.3, i = 1;
    while (t < 0.5 + CAROUSEL) {
      const next = imgs[i % imgs.length], prev = imgs[(i - 1) % imgs.length];
      /* overwrite: die noch laufende Einblendung des vorigen Objekts wird gekillt, sonst überschreibt sie das Ausblenden */
      tlB.to(prev, { opacity: 0, duration: 0.08, ease: 'none', overwrite: 'auto' }, t);
      tlB.fromTo(next, { scale: 0.8, opacity: 0, rotation: rand(-15, 15) }, { scale: 1, opacity: 1, duration: 0.32, ease: 'back.out(1.2)', immediateRender: false }, t);
      current = next;
      t += rand(0.18, 0.22); i++;
    }
  }
  tlB.to(count, {
    v: 0, duration: CAROUSEL, ease: 'power2.inOut',
    onUpdate: () => { counter.textContent = pad3(count.v); hero.state.progress = 100 - count.v; },
  }, 0.5);
  await tlB.then();
  counter.textContent = '000';

  /* 5: Exit, Vorhang hebt sich von unten nach oben */
  const tlC = gsap.timeline();
  if (imgs.length) tlC.to(imgs, { scale: 0, duration: 0.6, ease: 'power4.inOut' }, 0.5);
  tlC.to(gap, { width: '1rem', duration: 0.8, ease: 'power4.inOut' }, 0.6)
    .to(counter, { opacity: 0, duration: 0.5, ease: 'none' }, 0.6)
    .to(el, { height: 0, duration: 1.8, ease: 'power4.inOut' }, 1.4)
    .to(g, { yPercent: 100, duration: 1.0, ease: 'power4.inOut' }, 1.4)
    .to(o, { scale: 0, duration: 1.0, ease: 'power4.inOut' }, 1.4)
    .add(() => { unlockScroll(); hero.reveal(); }, 1.5);
  await tlC.then();
  finish();
}
