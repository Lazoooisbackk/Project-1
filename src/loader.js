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
  const g = $('.loader__g', el), o = $('.loader__o', el), win = $('.loader__win', el), bl = $('.loader__bl', el);
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

  /* Chrom-O deckungsgleich über das weiße O legen (gleiche Messung wie im Hero) */
  const placeChrome = () => {
    const fs = parseFloat(getComputedStyle(o).fontSize);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `500 ${fs}px Newsreader`;
    const m = ctx.measureText('O');
    let L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
    if (!(R > 0 && A > 0)) { L = -0.03 * fs; R = 0.72 * fs; A = 0.7 * fs; D = 0.015 * fs; }
    const h = A + D, size = h * 1.9;
    const cx = o.offsetLeft + (R - L) / 2, cy = bl.offsetTop - (A - D) / 2;
    Object.assign(chromeCanvas.style, { width: `${size}px`, height: `${size}px`, left: `${cx - size / 2}px`, top: `${cy - size / 2}px` });
    return h / size;
  };
  const fill = placeChrome();
  const chrome = hero.state.ok ? createMiniO(chromeCanvas, { fill, crumple: 0, scale: 1, spin: 0.55, observe: false }) : null;
  if (!chrome) chromeCanvas.remove();
  else window.addEventListener('resize', placeChrome);

  const hasContent = items.length > 0;
  const gapW = isMobile() ? '10rem' : '20rem';
  gsap.set(g, { yPercent: 100, opacity: 1 });
  gsap.set(o, { scale: 0, opacity: 1 });

  const tl = gsap.timeline();

  /* 1–3: „g“ steigt aus der Maske, „O“ skaliert auf, danach öffnet sich das Bildfenster */
  tl.to(g, { yPercent: 0, duration: 1, ease: 'power4.inOut' }, 0)
    .to(o, { scale: 1, duration: 1, ease: 'power4.inOut' }, 0);
  if (hasContent) tl.to(win, { width: gapW, duration: 1.2, ease: 'power4.inOut' }, 1);

  /* 4: Karussell. Wolke → Moos → Pixel → Puffy, zweimal, dann das echte Chrom-O.
     Tempo: erstes O steht FIRST_HOLD s, danach wechselt alle SWAP s ein neues. */
  const FIRST_HOLD = 0.35, SWAP = 0.15, SWAP_IN = 0.2;
  const C0 = 1 + 0.5;
  let current = null;
  const swapTo = (next, first) => {
    if (current && current !== next) { gsap.killTweensOf(current); gsap.set(current, { opacity: 0 }); }
    gsap.killTweensOf(next);
    if (first) gsap.fromTo(next, { scale: 0, rotation: 0, opacity: 1 }, { scale: 1, rotation: 8, duration: 0.8, ease: 'back.out(0.9)' });
    else gsap.fromTo(next, { scale: 0.85, opacity: 0, rotation: rand(-8, 8) }, { scale: 1, opacity: 1, duration: SWAP_IN, ease: 'back.out(1.2)' });
    current = next;
  };

  let t = C0;
  [...items, ...items].forEach((item, i) => {
    tl.call(() => swapTo(item, i === 0), null, t);
    t += i === 0 ? FIRST_HOLD : SWAP;
  });

  /* Zähler 100 → 000 über die Dauer des Karussells */
  const E0 = t;
  const carouselEnd = E0 + 0.45;
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

  /* 5: Das letzte O verschwindet, das Fenster schließt sich: g und O rücken zu „gO“ zusammen */
  tl.call(() => {
    if (!current) return;
    gsap.killTweensOf(current);
    gsap.to(current, { scale: 0, duration: 0.5, ease: 'power4.inOut' });
  }, null, E0);
  if (hasContent) tl.to(win, { width: '1rem', duration: 0.8, ease: 'power4.inOut' }, E0 + 0.1);
  const M = hasContent ? E0 + 0.9 : E0;

  /* 6: Das weiße O verwandelt sich an Ort und Stelle in das Chrom-O, erst glatt, dann zerknittert */
  if (chrome) {
    tl.call(() => { chrome.restart(); chrome.start(); }, null, M)
      .to(o, { opacity: 0, duration: 0.4, ease: 'none' }, M)
      .to(chromeCanvas, { opacity: 1, duration: 0.4, ease: 'none' }, M)
      .fromTo(chrome.state, { crumple: 0 }, { crumple: 1, duration: 0.9, ease: 'power2.inOut' }, M + 0.15);
  }

  /* 7: Exit. Zähler aus, Vorhang von unten nach oben, g sinkt, das O schrumpft */
  const X = M + (chrome ? 1.3 : 0.3);
  tl.to(counter, { opacity: 0, duration: 0.5, ease: 'none' }, X - 0.6)
    .to(el, { height: 0, duration: 1.8, ease: 'power4.inOut' }, X)
    .to(g, { yPercent: 100, duration: 1, ease: 'power4.inOut' }, X)
    .to(chrome ? chrome.state : o, { scale: 0, duration: 1, ease: 'power4.inOut' }, X)
    .add(() => { unlockScroll(); hero.reveal(); }, X);

  await tl.then();
  if (chrome) { window.removeEventListener('resize', placeChrome); chrome.dispose(); }
  finish();
}
