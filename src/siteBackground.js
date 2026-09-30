/*
  Sternenstaub fest hinter der ganzen Seite.
  Hält an, solange schwarze Abschnitte (section.on-dark) den Bildschirm ganz verdecken,
  und auf Wunsch bis zu einem Ereignis (z. B. Ende des Intros).
*/
import { ScrollTrigger } from './utils/gsap.js';
import { $$ } from './utils/dom.js';
import { init } from './starfield.js';

export function initSiteBackground({ waitFor = null } = {}) {
  const host = document.createElement('div');
  host.className = 'site-bg';
  host.setAttribute('aria-hidden', 'true');
  document.body.prepend(host);
  const bg = init(host);

  let waiting = !!waitFor;
  const covered = new Set();
  const update = () => bg.suspend(waiting || covered.size > 0);
  if (waitFor) window.addEventListener(waitFor, () => { waiting = false; update(); }, { once: true });

  /* Direkt aufeinanderfolgende schwarze Abschnitte zählen als ein Block */
  const blocks = [];
  $$('main section.on-dark').forEach((s) => {
    const last = blocks[blocks.length - 1];
    if (last && last[last.length - 1].nextElementSibling === s) last.push(s); else blocks.push([s]);
  });
  blocks.forEach((b) => ScrollTrigger.create({
    trigger: b[0], start: 'top top',
    endTrigger: b[b.length - 1], end: 'bottom bottom',
    onToggle: (self) => { if (self.isActive) covered.add(b); else covered.delete(b); update(); },
  }));

  update();
  return bg;
}
