/*
  Text-Splitting für Zeilen, Wörter und Buchstaben, jeweils mit Maske.
  Die Maske bekommt padding-bottom .15em und margin-bottom -.15em (CSS),
  damit Unterlängen nicht abgeschnitten werden.
*/

const wrap = (cls, inner, extra = '') => `<span class="${cls}-mask${extra}"><span class="${cls}">${inner}</span></span>`;

export function splitChars(el, { spaceClass = 'ch-mask ch-mask--space' } = {}) {
  if (!el.dataset.original) el.dataset.original = el.innerHTML;
  const words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
  el.innerHTML = words
    .map((w) => `<span class="w-block">${Array.from(w).map((c) => wrap('ch', c)).join('')}</span>`)
    .join(`<span class="${spaceClass}"> </span>`);
  return {
    chars: Array.from(el.querySelectorAll('.ch')),
    masks: Array.from(el.querySelectorAll('.ch-mask')),
    revert: () => { el.innerHTML = el.dataset.original; },
  };
}

export function splitWords(el) {
  if (!el.dataset.original) el.dataset.original = el.innerHTML;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => wrap('w', w)).join(' ');
  return {
    words: Array.from(el.querySelectorAll('.w')),
    revert: () => { el.innerHTML = el.dataset.original; },
  };
}

export function splitLines(el) {
  if (!el.dataset.original) el.dataset.original = el.innerHTML;
  el.innerHTML = el.dataset.original;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w-tmp">${w}</span>`).join(' ');
  const spans = Array.from(el.querySelectorAll('.w-tmp'));
  const lines = [];
  let top = null;
  spans.forEach((s) => {
    const t = s.offsetTop;
    if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; }
    lines[lines.length - 1].push(s.textContent);
  });
  el.innerHTML = lines.map((l) => wrap('line', l.join(' '))).join('');
  return {
    lines: Array.from(el.querySelectorAll('.line')),
    revert: () => { el.innerHTML = el.dataset.original; },
  };
}
