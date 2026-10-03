/*
  Die Wortmarke als SVG: ein Pfad pro Buchstabe („guskic studi“) und ein unsichtbarer Pfad für das O.
  Auf dem O-Pfad sitzt das Chrom-O; ohne WebGL wird er als normaler Buchstabe gefüllt (CSS).
*/
import { WORDMARK } from '../wordmark.js';

const NS = 'http://www.w3.org/2000/svg';

export function buildWordmark({ className = 'wm' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${WORDMARK.width} ${WORDMARK.height}`);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const letters = WORDMARK.letters.map((l) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', l.d);
    p.setAttribute('class', 'wm__l');
    svg.appendChild(p);
    return p;
  });
  const o = document.createElementNS(NS, 'path');
  o.setAttribute('d', WORDMARK.o.d);
  o.setAttribute('class', 'wm__o');
  svg.appendChild(o);
  return { svg, letters, o };
}
