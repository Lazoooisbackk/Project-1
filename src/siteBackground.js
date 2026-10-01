/*
  Sternenstaub fest hinter der ganzen Seite, auch hinter den Milchglas-Abschnitten.
  Hält auf Wunsch bis zu einem Ereignis an (z. B. Ende des Intros).
*/
import { init } from './starfield.js';

export function initSiteBackground({ waitFor = null } = {}) {
  const host = document.createElement('div');
  host.className = 'site-bg';
  host.setAttribute('aria-hidden', 'true');
  document.body.prepend(host);
  const bg = init(host);

  if (waitFor) {
    bg.suspend(true);
    window.addEventListener(waitFor, () => bg.suspend(false), { once: true });
  }
  return bg;
}
