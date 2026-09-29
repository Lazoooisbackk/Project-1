/*
  Intro-Loader: „Ein O, viele Materialien“. Spielt einmal pro Session (sessionStorage).
  Timings nach Brief, Abschnitt 3.
*/
import { gsap } from './utils/gsap.js';
import { $, rand, pad3, session, reducedMotion, isMobile } from './utils/dom.js';
import { lockScroll, unlockScroll } from './scroll.js';
import { preloadMaterials, materialPicture } from './materials.js';
import { createMiniO } from './miniO.js';

const KEY = 'gs-intro-seen';
const within = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

export const introWillPlay = () => !session.get(KEY) && !reducedMotion();

export async function runLoader({ hero, fonts }) {
  const el = $('#loader');
  const g = $('.loader__g', el), o = $('.loader__o', el), win = $('.loader__win', el);
  const counter = $('.loader__counter', el), chromeCanvas = $('.loader__chrome', el);

  const finish = () => {
    el.hidden = true;
    document.body.classList.remove('is-loading');
    unlockScroll();
    session.set(KEY, '1');
  };

  /* Späterer Besuch in dieser Session: sofort überspringen */
  if (session.get(KEY)) {
    el.hidden = true;
    document.body.classList.remove('is-loading');
    await within(fonts, 3000);
    hero.reveal({ instant: true });
    return;
  }

  document.body.classList.add('is-loading');
  lockScroll();

  /* Reduzierte Bewegung: kein Karussell, 400 ms Fade */
  if (reducedMotion()) {
    await within(fonts, 3000);
    await gsap.to(el, { opacity: 0, duration: 0.4, ease: 'none' }).then();
    finish();
    hero.reveal({ instant: true });
    return;
  }

  /* Alles vor dem Start laden und dekodieren: Schriften, die vier Material-Os, das Chrom-O */
  counter.textContent = '100';
  const [mats] = await Promise.all([within(preloadMaterials(), 9000, []), within(fonts, 4000)]);

  const items = mats.map((m) => {
    const pic = materialPicture(m, { className: 'loader__item', format: m.format });
    pic.style.setProperty('--ar', `${m.w} / ${m.h}`);
    win.appendChild(pic);
    gsap.set(pic, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });
    return pic;
  });
  await Promise.all(items.map((p) => p.querySelector('img').decode().catch(() => {})));

  const chrome = hero.state.ok ? createMiniO(chromeCanvas, { fill: 0.7, crumple: 0, scale: 0, spin: 0.55, observe: false }) : null;
  if (!chrome) chromeCanvas.remove();

  const hasContent = items.length > 0 || !!chrome;
  const gapW = isMobile() ? '10rem' : '20rem';
  gsap.set(g, { yPercent: 100, opacity: 1 });
  gsap.set(o, { scale: 0, opacity: 1 });

  const tl = gsap.timeline();

  /* 1–3: „g“ steigt aus der Maske, „O“ skaliert auf, danach öffnet sich das Bildfenster */
  tl.to(g, { yPercent: 0, duration: 1, ease: 'power4.inOut' }, 0)
    .to(o, { scale: 1, duration: 1, ease: 'power4.inOut' }, 0);
  if (hasContent) tl.to(win, { width: gapW, duration: 1.2, ease: 'power4.inOut' }, 1);

  /* 4: Karussell. Wolke → Moos → Pixel → Puffy, zweimal, dann das echte Chrom-O */
  const C0 = 1 + 0.5;
  let current = null;
  const swapTo = (next, first) => {
    if (current && current !== next) { gsap.killTweensOf(current); gsap.set(current, { opacity: 0 }); }
    gsap.killTweensOf(next);
    if (first) gsap.fromTo(next, { scale: 0, rotation: 0, opacity: 1 }, { scale: 1, rotation: 8, duration: 0.8, ease: 'back.out(0.9)' });
    else gsap.fromTo(next, { scale: 0.85, opacity: 0, rotation: rand(-8, 8) }, { scale: 1, opacity: 1, duration: 0.32, ease: 'back.out(1.2)' });
    current = next;
  };

  let t = C0;
  [...items, ...items].forEach((item, i) => {
    tl.call(() => swapTo(item, i === 0), null, t);
    t += i === 0 ? 0.5 : 0.24;
  });

  if (chrome) {
    tl.call(() => {
      if (current) { gsap.killTweensOf(current); gsap.set(current, { opacity: 0 }); }
      current = null;
      chrome.start();
    }, null, t)
      .fromTo(chrome.state, { scale: 0 }, { scale: 1, duration: 0.8, ease: 'back.out(0.9)' }, t)
      .fromTo(chrome.state, { crumple: 0 }, { crumple: 1, duration: 0.9, ease: 'power2.inOut' }, t);
  }

  const carouselEnd = Math.max(t + 0.45, C0 + 2.6);
  const count = { v: 100 };
  tl.to(count, {
    v: 0, duration: carouselEnd - C0, ease: 'power2.inOut',
    onUpdate: () => {
      const txt = pad3(count.v);
      counter.textContent = txt;
      if (txt === '000') counter.classList.add('is-zero');
      hero.state.progress = 100 - count.v;
    },
  }, C0);

  await tl.then();
  counter.textContent = '000';
  counter.classList.add('is-zero');

  /* 5: Exit. Objekt weg, Fenster zu, Zähler aus, Vorhang von unten nach oben */
  const E = gsap.timeline();
  if (chrome) E.to(chrome.state, { scale: 0, duration: 0.6, ease: 'power4.inOut' }, 0.5);
  else if (current) E.to(current, { scale: 0, duration: 0.6, ease: 'power4.inOut' }, 0.5);
  if (hasContent) E.to(win, { width: '1rem', duration: 0.8, ease: 'power4.inOut' }, 0.6);
  E.to(counter, { opacity: 0, duration: 0.5, ease: 'none' }, 0.6)
    .to(el, { height: 0, duration: 1.8, ease: 'power4.inOut' }, 1.4)
    .to(g, { yPercent: 100, duration: 1, ease: 'power4.inOut' }, 1.4)
    .to(o, { scale: 0, duration: 1, ease: 'power4.inOut' }, 1.4)
    .add(() => { unlockScroll(); hero.reveal(); }, 1.4);

  await E.then();
  if (chrome) chrome.dispose();
  finish();
}
