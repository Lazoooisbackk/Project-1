import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, reducedMotion, isMobile } from '../utils/dom.js';
import { content } from '../content.js';

/*
  Showreel: Video vollflächig, darüber eine Buchstaben-Wolke, die sich beim
  Scrollen zum Satz zusammensetzt. Danach schrumpft das Video in einen Rahmen.
  Ton ist aus; der Schalter blendet ihn ein und aus.
*/
export function initReel() {
  const section = $('.reel');
  if (!section) return;
  const reduce = reducedMotion();
  const pin = $('.reel__pin', section), frame = $('.reel__frame', section);
  const video = $('.reel__video', section), btn = $('.reel__sound', section);
  const cloud = $('.reel__cloud', section);
  const t = content.reel;

  /* Wolke: Buchstaben ohne Maske, inneres Span für die Zeiger-Parallaxe */
  const text = cloud.textContent.trim();
  cloud.setAttribute('aria-label', text);
  cloud.innerHTML = text.split(' ').map((w) => `<span class="w-block" aria-hidden="true">${Array.from(w).map((c) => `<span class="reel__ch"><i>${c}</i></span>`).join('')}</span>`).join(' ');
  const chars = $$('.reel__ch', cloud);
  const depth = chars.map(() => Math.pow(Math.random(), 1.4));

  /* Video: spielt nur im Bild */
  let visible = false, failed = false;
  const play = () => { const p = video.play(); if (p) p.catch(() => {}); };
  const sources = $$('source', video);
  (sources[sources.length - 1] || video).addEventListener('error', () => { failed = true; section.classList.add('is-novideo'); });
  if (!reduce) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (failed) return;
      if (visible) play(); else video.pause();
    }, { threshold: 0.05 }).observe(section);
  }

  /* Ton-Schalter */
  const setSound = (on) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? t.soundOnAria : t.soundOffAria);
    $('.reel__sound-text', btn).textContent = on ? t.soundOn : t.soundOff;
    btn.classList.toggle('is-on', on);
    gsap.killTweensOf(video, 'volume');
    if (on) {
      video.muted = false; video.volume = 0;
      gsap.to(video, { volume: 1, duration: 0.6, ease: 'power2.out' });
      if (video.paused) play();
    } else {
      gsap.to(video, { volume: 0, duration: 0.35, ease: 'power2.in', onComplete: () => { video.muted = true; } });
    }
  };
  btn.addEventListener('click', () => setSound(btn.getAttribute('aria-pressed') !== 'true'));

  if (reduce) {
    section.classList.add('is-static');
    return;
  }

  /* Endrahmen als Abstand zum Rand */
  const inset = () => (isMobile()
    ? { y: window.innerHeight * 0.22, x: 16 }
    : { y: window.innerHeight * 0.14, x: window.innerWidth * 0.2 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section, start: 'top top', end: () => `+=${window.innerHeight * 1.8}`,
      pin, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
    },
  });

  chars.forEach((c, i) => {
    const d = depth[i];
    tl.fromTo(c, {
      x: () => rand(-0.48, 0.48) * window.innerWidth,
      y: () => rand(-0.42, 0.42) * window.innerHeight,
      scale: 0.35 + d * 2.4,
      rotation: rand(-50, 50),
      opacity: 0.25 + d * 0.6,
    }, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: true }, rand(0, 0.15));
  });
  tl.to(frame, {
    '--fy': () => `${inset().y}px`, '--fx': () => `${inset().x}px`, '--fr': '6px',
    duration: 0.35, ease: 'power2.inOut',
  }, 0.62);
  tl.to(cloud, { yPercent: -40, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.62);
  tl.fromTo($('.reel__label', section), { opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: true }, 0.85);

  /* Parallaxe der Wolke je Tiefe, nur solange sie verstreut ist */
  if (!window.matchMedia('(hover: none)').matches) {
    const movers = chars.map((c) => {
      const i = c.firstElementChild;
      return { x: gsap.quickTo(i, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(i, 'y', { duration: 0.9, ease: 'power3.out' }) };
    });
    section.addEventListener('pointermove', (e) => {
      const k = 1 - Math.min(1, tl.progress() / 0.5);
      const nx = (e.clientX / window.innerWidth - 0.5) * 2, ny = (e.clientY / window.innerHeight - 0.5) * 2;
      movers.forEach((m, i) => { const a = (12 + depth[i] * 60) * k; m.x(nx * a); m.y(ny * a); });
    }, { passive: true });
  }

  window.addEventListener('loader:hero-revealed', () => ScrollTrigger.refresh(), { once: true });
}
