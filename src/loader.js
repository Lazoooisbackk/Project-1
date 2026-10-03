/*
  Intro: schwarze Fläche, „g“ und „O“, dazwischen öffnet sich ein Fenster mit wechselnden Folien-Ballons.
  Am Ende wird das weiße O zum Chrom-O, dann hebt sich der Vorhang. Spielt einmal pro Sitzung.
  Das weiße O ist dieselbe Kontur wie das O der Wortmarke (Newsreader), als SVG, damit der Übergang
  zum Chrom-O deckungsgleich ist.
*/
import { gsap } from './utils/gsap.js';
import { $, pad3, session, reducedMotion, isMobile } from './utils/dom.js';
import { lockScroll, unlockScroll } from './scroll.js';
import { preloadBalloons, balloonPicture } from './objects.js';
import { createMiniO } from './miniO.js';
import { content } from './content.js';
import { WORDMARK } from './wordmark.js';

const KEY = 'gs-intro-seen';
const within = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

export const introWillPlay = () => !session.get(KEY) && !reducedMotion();

/* Das weiße O als SVG vor die Grundlinien-Marke setzen: Höhe und Lage in em aus den Wortmarken-Einheiten */
function makeO(el) {
  const NS = 'http://www.w3.org/2000/svg';
  const b = WORDMARK.o.box;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'loader__o');
  svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', WORDMARK.o.d);
  p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  svg.style.height = `${b.h / 1000}em`;
  svg.style.verticalAlign = `${-(b.y + b.h - WORDMARK.baseline) / 1000}em`;   // Überhang unter die Grundlinie
  $('.loader__o-wrap', el).insertBefore(svg, $('.loader__bl', el));
  return svg;
}
export const preloadIntro = () => preloadBalloons(content.objects.intro);

export async function runLoader({ hero, fonts }) {
  const el = $('#loader');
  const g = $('.loader__g', el), win = $('.loader__win', el), bl = $('.loader__bl', el);
  const o = makeO(el);
  const counter = $('.loader__counter', el), chromeCanvas = $('.loader__chrome', el);

  const finish = () => {
    el.hidden = true;
    document.body.classList.remove('is-loading');
    unlockScroll();
    session.set(KEY, '1');
  };

  /* Späterer Besuch in dieser Sitzung: sofort überspringen */
  if (session.get(KEY)) {
    el.hidden = true;
    document.body.classList.remove('is-loading');
    await within(fonts, 3000);
    hero.reveal({ instant: true });
    return;
  }

  document.body.classList.add('is-loading');
  lockScroll();

  /* Weniger Bewegung: kein Karussell, 400 ms Überblendung */
  if (reducedMotion()) {
    await within(fonts, 3000);
    await gsap.to(el, { opacity: 0, duration: 0.4, ease: 'none' }).then();
    finish();
    hero.reveal({ instant: true });
    return;
  }

  /* Alles vor dem Start laden und dekodieren: Schriften und Ballons */
  counter.textContent = '100';
  const [balloons] = await Promise.all([within(preloadIntro(), 9000, []), within(fonts, 4000)]);

  const items = balloons.map((b) => {
    const pic = balloonPicture(b.id, { className: 'loader__item', format: b.format });
    win.appendChild(pic);
    gsap.set(pic, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });
    return pic;
  });
  await Promise.all(items.map((p) => p.querySelector('img').decode().catch(() => {})));

  /* Chrom-O deckungsgleich über das weiße O legen (Maße aus der Kontur, unabhängig von Transformationen) */
  const placeChrome = () => {
    const fs = parseFloat(getComputedStyle(o).fontSize);
    const b = WORDMARK.o.box, k = fs / 1000;
    const w = b.w * k, h = b.h * k, size = h * 1.9;
    const cx = w / 2;
    const cy = bl.offsetTop + (b.y + b.h - WORDMARK.baseline) * k - h / 2;   // Grundlinie liegt bei bl
    Object.assign(chromeCanvas.style, { width: `${size}px`, height: `${size}px`, left: `${cx - size / 2}px`, top: `${cy - size / 2}px` });
    return h / size;
  };
  const fill = placeChrome();
  const chrome = hero.state.ok ? createMiniO(chromeCanvas, { fill, crumple: 0, scale: 1, spin: 0.55, observe: false, aspect: WORDMARK.o.box.w / WORDMARK.o.box.h }) : null;
  if (!chrome) chromeCanvas.remove();
  else window.addEventListener('resize', placeChrome);

  const has = items.length > 0;
  const gapW = isMobile() ? '10rem' : '20rem';
  gsap.set(g, { yPercent: 100, opacity: 1 });
  gsap.set(o, { scale: 0, opacity: 1 });

  const tl = gsap.timeline();

  /* 1–3: „g“ steigt aus der Maske, „O“ wächst, danach öffnet sich das Fenster */
  tl.to(g, { yPercent: 0, duration: 1, ease: 'power4.inOut' }, 0)
    .to(o, { scale: 1, duration: 1, ease: 'power4.inOut' }, 0);
  if (has) tl.to(win, { width: gapW, duration: 1.2, ease: 'power4.inOut' }, 1);

  /* 4: Karussell. Der erste Ballon ploppt herein, danach wechseln sie etwa alle 240 ms. */
  const POP = 1.5, POP_D = 0.8, SWAP = 0.24, RUN = 2.6;
  let current = null;
  if (has) {
    tl.call(() => {
      current = items[0];
      gsap.fromTo(current, { scale: 0, rotation: 0, opacity: 1 }, { scale: 1, rotation: 15, duration: POP_D, ease: 'back.out(0.9)' });
    }, null, POP);
  }
  const S0 = POP + POP_D;
  if (items.length > 1) {
    const swaps = Math.floor(RUN / SWAP);
    for (let i = 1; i <= swaps; i++) {
      const next = items[i % items.length];
      tl.call(() => {
        if (current && current !== next) { gsap.killTweensOf(current); gsap.set(current, { opacity: 0 }); }
        gsap.killTweensOf(next);
        gsap.fromTo(next, { opacity: 0, scale: 0.8, rotation: gsap.utils.random(-12, 12) }, { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(1.2)' });
        current = next;
      }, null, S0 + i * SWAP);
    }
  }

  /* Zähler 100 → 000 über die Dauer des Karussells */
  const E0 = S0 + RUN;
  const count = { v: 100 };
  tl.to(count, {
    v: 0, duration: RUN, ease: 'power2.inOut',
    onUpdate: () => {
      const txt = pad3(count.v);
      counter.textContent = txt;
      if (txt === '000') counter.classList.add('is-zero');
    },
  }, S0);

  /* 5: Der letzte Ballon verschwindet, das Fenster schließt sich: g und O rücken zu „gO“ zusammen */
  tl.call(() => {
    if (!current) return;
    gsap.killTweensOf(current);
    gsap.to(current, { scale: 0, duration: 0.6, ease: 'power4.inOut' });
  }, null, E0 + 0.5);
  if (has) tl.to(win, { width: '1rem', duration: 0.8, ease: 'power4.inOut' }, E0 + 0.6);
  const M = has ? E0 + 1.4 : E0;

  /* Das weiße O wird an Ort und Stelle zum Chrom-O, erst glatt, dann zerknittert */
  if (chrome) {
    tl.call(() => { chrome.restart(); chrome.start(); }, null, M)
      .to(o, { opacity: 0, duration: 0.4, ease: 'none' }, M)
      .to(chromeCanvas, { opacity: 1, duration: 0.4, ease: 'none' }, M)
      .fromTo(chrome.state, { crumple: 0 }, { crumple: 1, duration: 0.9, ease: 'power2.inOut' }, M + 0.1);
  }

  /* 6: Abgang. Zähler aus, Vorhang nach oben, g sinkt, das O schrumpft, der Start-Bereich übernimmt */
  const X = M + (chrome ? 1.15 : 0.3);
  tl.to(counter, { opacity: 0, duration: 0.5, ease: 'none' }, X - 0.5)
    .to(el, { height: 0, duration: 1.8, ease: 'power4.inOut' }, X)
    .to(g, { yPercent: 100, duration: 1, ease: 'power4.inOut' }, X)
    .to(chrome ? chrome.state : o, { scale: 0, duration: 1, ease: 'power4.inOut' }, X)
    .add(() => { unlockScroll(); hero.reveal(); }, X);

  await tl.then();
  if (chrome) { window.removeEventListener('resize', placeChrome); chrome.dispose(); }
  finish();
}
