import { gsap, ScrollTrigger } from './utils/gsap.js';
import { $, $$ } from './utils/dom.js';
import { lockScroll, unlockScroll, scrollTo } from './scroll.js';
import { content } from './content.js';

export function initNav({ sound } = {}) {
  const btn = $('.menu-btn'), menu = $('.menu'), dots = $$('.menu-btn__dot');
  const links = $$('.menu__link');
  if (!btn || !menu) return null;
  const grid = [[-6, -6], [6, -6], [-6, 6], [6, 6]];
  dots.forEach((d, i) => gsap.set(d, { x: grid[i][0], y: grid[i][1] }));
  gsap.set(menu, { autoAlpha: 0 });
  gsap.set(links, { yPercent: 110 });

  let open = false;
  const label = $('.menu-btn__label', btn);
  const root = document.documentElement;

  /* Farbe der Navigation: hell, solange ein schwarzer Abschnitt unter ihrer Mitte (--nav-h / 2) liegt */
  const nav = $('.nav'), onDark = new Set();
  $$('main section.on-dark').forEach((s) => ScrollTrigger.create({
    trigger: s, start: 'top 32px', end: 'bottom 32px',
    onToggle: (self) => {
      if (self.isActive) onDark.add(s); else onDark.delete(s);
      nav.classList.toggle('is-on-dark', onDark.size > 0);
    },
  }));

  function toggle(force) {
    open = typeof force === 'boolean' ? force : !open;
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    if (label) label.textContent = open ? content.nav.menuClose : content.nav.menuOpen;
    const tl = gsap.timeline({ defaults: { ease: 'studio', duration: 0.5 } });
    if (open) {
      lockScroll();
      root.classList.add('is-menu-open');
      tl.to(dots, { x: 0, y: 0, width: 22, height: 2, rotation: (i) => (i === 0 || i === 3 ? 45 : -45) }, 0)
        .to(menu, { autoAlpha: 1, duration: 0.5 }, 0)
        .fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.06 }, 0.15);
    } else {
      tl.to(links, { yPercent: -110, duration: 0.5, ease: 'power3.in', stagger: 0.03 }, 0)
        .to(menu, { autoAlpha: 0, duration: 0.5 }, 0.2)
        .add(() => { if (!open) root.classList.remove('is-menu-open'); }, 0.4)
        .to(dots, { x: (i) => grid[i][0], y: (i) => grid[i][1], width: 5, height: 5, rotation: 0 }, 0)
        .add(() => { unlockScroll(); gsap.set(links, { yPercent: 110 }); });
    }
    if (sound) sound.click();
  }

  btn.addEventListener('click', () => toggle());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });
  links.forEach((a) => a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      toggle(false);
      setTimeout(() => scrollTo(href, { offset: 0 }), 450);
    } else {
      toggle(false);
    }
  }));

  return { toggle, isOpen: () => open };
}
