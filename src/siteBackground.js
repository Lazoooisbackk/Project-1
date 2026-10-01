/*
  Sternenstaub fest hinter der ganzen Seite, auch hinter den Milchglas-Abschnitten.
  Auf dem Glas („Arbeiten“ und „Leistungen“) bleiben die Sterne scharf sichtbar: der Glasbereich
  wird pro Frame aus den Abschnitten und --glass-fade gemessen (gleiche Kanten wie in sections.css).
  Hält auf Wunsch bis zu einem Ereignis an (z. B. Ende des Intros).
*/
import { $$ } from './utils/dom.js';
import { init } from './starfield.js';

function glassArea() {
  const panes = $$('main .works, main .services');
  if (!panes.length) return null;
  /* Länge des weichen Übergangs, so wie das CSS sie auflöst */
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:var(--glass-fade);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  return () => {
    const fade = probe.offsetHeight;
    const first = panes[0].getBoundingClientRect(), last = panes[panes.length - 1].getBoundingClientRect();
    /* .works::before beginnt fade/2 über „Arbeiten“ und blendet über fade ein, .services::before blendet über fade aus */
    return { top: first.top - fade / 2, fadeTop: fade, bottom: last.bottom, fadeBottom: fade };
  };
}

export function initSiteBackground({ waitFor = null } = {}) {
  const host = document.createElement('div');
  host.className = 'site-bg';
  host.setAttribute('aria-hidden', 'true');
  document.body.prepend(host);
  const bg = init(host, { glass: glassArea() });

  if (waitFor) {
    bg.suspend(true);
    window.addEventListener(waitFor, () => bg.suspend(false), { once: true });
  }
  return bg;
}
