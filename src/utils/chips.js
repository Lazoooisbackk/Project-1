/*
  Auswahl-Knöpfe: <label class="chip"><input type="radio|checkbox">…</label>.
  Der angeklickte bekommt die Klasse „is-on“ (so braucht das Aussehen kein :has() im Browser).
*/
import { $$ } from './dom.js';

export function refreshChips(root = document) {
  $$('.chip input', root).forEach((input) => input.closest('.chip').classList.toggle('is-on', input.checked));
}

export function initChips(root = document) {
  root.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('.chip')) refreshChips(root); });
  refreshChips(root);
}
