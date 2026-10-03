import { gsap } from './utils/gsap.js';
import { $, $$ } from './utils/dom.js';
import { lockScroll, unlockScroll, scrollTo } from './scroll.js';
import { content } from './content.js';

export function initNav({ sound } = {}) {
  const btn = $('.menu-btn'), menu = $('.menu'), dots = $$('.menu-btn__dot');
  const links = $$('.menu__link');
  if (!btn || !menu) return null;
  /* Vier Punkte im Quadrat („::“), die sich beim Öffnen zum X legen */
  const D = 3, DOT = 2.5, BAR = 15;
  const grid = [[-D, -D], [D, -D], [-D, D], [D, D]];
  dots.forEach((d, i) => gsap.set(d, { xPercent: -50, yPercent: -50, x: grid[i][0], y: grid[i][1] }));
  gsap.set(menu, { autoAlpha: 0 });
  gsap.set(links, { yPercent: 110 });

  let open = false;
  const label = $('.menu-btn__label', btn), text = $('.menu-btn__text', btn);

  function toggle(force) {
    open = typeof force === 'boolean' ? force : !open;
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (label) label.textContent = open ? content.nav.menuClose : content.nav.menuOpen;
    if (text) text.textContent = open ? 'Zu' : 'Menü';
    const tl = gsap.timeline({ defaults: { ease: 'studio', duration: 0.5 } });
    if (open) {
      lockScroll();
      tl.to(dots, { x: 0, y: 0, width: BAR, height: 1.5, rotation: (i) => (i === 0 || i === 3 ? 45 : -45) }, 0)
        .to(menu, { autoAlpha: 1, duration: 0.5 }, 0)
        .fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.06 }, 0.15);
    } else {
      tl.to(links, { yPercent: -110, duration: 0.5, ease: 'power3.in', stagger: 0.03 }, 0)
        .to(menu, { autoAlpha: 0, duration: 0.5 }, 0.2)
        .to(dots, { x: (i) => grid[i][0], y: (i) => grid[i][1], width: DOT, height: DOT, rotation: 0 }, 0)
        .add(() => { unlockScroll(); gsap.set(links, { yPercent: 110 }); });
    }
    if (sound) sound.click();
  }

  btn.addEventListener('click', () => toggle());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });
  links.forEach((a) => a.addEventListener('click', (e) => {
    const href = a.getAttribute('href') || '';
    const hash = href.replace(/^\.\//, '');
    if (hash.startsWith('#') && document.querySelector(hash)) {
      e.preventDefault();
      toggle(false);
      setTimeout(() => scrollTo(hash, { offset: 0 }), 450);
    } else {
      toggle(false);
    }
  }));

  return { toggle, isOpen: () => open };
}
