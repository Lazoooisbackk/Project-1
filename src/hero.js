import { gsap } from './utils/gsap.js';
import { $, asset, reducedMotion, isMobile, emit, debounce } from './utils/dom.js';
import { splitChars, splitLines } from './utils/split.js';
import { createStage } from './chromeO.js';
import { createFluid } from './fluidReveal.js';

export function initHero() {
  const stage = $('#stage'), canvas = $('#gl'), mark = $('#mark'), inner = $('#markInner');
  const charsEl = $('#markChars'), ghost = $('#oGhost'), bl = $('#bl'), readout = $('#readout'), hint = $('#hint');
  const tag = $('.hero__tag');
  const reduce = reducedMotion();

  const split = splitChars(charsEl);
  gsap.set(split.chars, { yPercent: 120 });
  let tagSplit = splitLines(tag);
  gsap.set(tagSplit.lines, { yPercent: 110 });
  window.addEventListener('resize', debounce(() => {
    tagSplit = splitLines(tag);
    gsap.set(tagSplit.lines, { yPercent: revealed ? 0 : 110 });
  }, 250));

  let revealed = false;
  const api = createStage({ canvas, stage, mark, inner, ghost, bl, readout, hint });
  const state = api.state;

  /* Fluid-Maske: Tinte legt die Schicht unter dem Papier frei */
  let fluid = null;
  if (state.ok && !reduce) {
    fluid = createFluid(api.renderer, { dyeRes: isMobile() ? 512 : 1024, splatRadius: 0.0014, splatForce: 6000 });
    fluid.resize(stage.clientWidth || 1, stage.clientHeight || 1);
    api.setFluid(fluid);
    let last = null;
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      if (last) {
        const dx = x - last.x, dy = y - last.y;
        if (Math.hypot(dx, dy) > 0.0005) fluid.splat(x, y, dx, dy, 0.9);
      }
      last = { x, y };
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { last = null; });
    stage.addEventListener('pointerdown', (e) => {
      const r = stage.getBoundingClientRect();
      last = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    }, { passive: true });
  }

  /* Optionales Video unter dem Papier: /public/hero/reveal.mp4 */
  const video = $('.hero__video');
  if (video && state.ok) {
    video.muted = true; video.loop = true; video.playsInline = true;
    video.addEventListener('canplay', () => { api.setVideo(video); video.play().catch(() => {}); }, { once: true });
    video.addEventListener('error', () => { video.remove(); }, { once: true });
    video.src = asset('hero/reveal.mp4');
  }

  /* Render-Loop nur, wenn der Hero sichtbar und der Tab aktiv ist */
  let inView = true;
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && !document.hidden) api.start(); else api.stop();
    if (video) { if (inView) video.play().catch(() => {}); else video.pause(); }
  }, { threshold: 0.01 });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) api.stop(); else if (inView) api.start(); });
  api.start();

  /* Layout erneut, sobald die Schrift geladen ist (Fit-Text braucht die Metriken) */
  document.fonts.load('500 100px "Newsreader"').then(() => api.layout()).catch(() => {});
  document.fonts.ready.then(() => api.layout());

  function reveal({ instant = false } = {}) {
    if (revealed) return;
    revealed = true;
    emit('loader:hero-reveal-start');
    api.layout();
    if (instant || reduce) {
      gsap.set(split.chars, { yPercent: 0 });
      gsap.set(tagSplit.lines, { yPercent: 0 });
      state.scale = 1; state.crumple = 1; state.loaded = true;
      emit('loader:hero-revealed');
      return;
    }
    const tl = gsap.timeline({ onComplete: () => emit('loader:hero-revealed') });
    tl.to(split.chars, { yPercent: 0, duration: 1.8, ease: 'power4.inOut', stagger: { each: 0.07, from: 'random' } }, 0.2)
      .add(() => { state.loaded = true; }, 1.5)
      .to(state, { scale: 1, duration: 1.1, ease: 'back.out(0.9)' }, 1.5)
      .to(state, { crumple: 1, duration: 1.3, ease: 'power2.inOut' }, 1.5)
      .to(tagSplit.lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.12 }, 1.9);
  }

  return { ...api, reveal, chars: split.chars, tagLines: tagSplit.lines, fluid };
}
