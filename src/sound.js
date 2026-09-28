/*
  Optionaler Sound: weiche UI-Klicks und ein leises Ambient-Rauschen (WebAudio, keine Dateien).
  Standardmäßig aus. Ein- und Ausblenden über 0.35 s.
*/
import { $ } from './utils/dom.js';
import { content } from './content.js';

export function initSound() {
  const btn = $('.sound');
  let ctx = null, master = null, ambientGain = null, on = false;

  const ensure = () => {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);

    /* Ambient: rosa-ähnliches Rauschen, tief gefiltert */
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.08;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    ambientGain = ctx.createGain(); ambientGain.gain.value = 0;
    src.connect(lp).connect(ambientGain).connect(master);
    src.start();
  };

  const click = (soft = false) => {
    if (!on || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(soft ? 1400 : 900, t);
    osc.frequency.exponentialRampToValueAtTime(soft ? 900 : 420, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(soft ? 0.05 : 0.11, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (soft ? 0.05 : 0.09));
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.1);
  };

  const set = (v) => {
    on = v;
    if (btn) { btn.setAttribute('aria-pressed', String(v)); const l = btn.querySelector('.sound__label'); if (l) l.textContent = v ? content.nav.soundOn : content.nav.soundOff; }
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    ambientGain.gain.cancelScheduledValues(t);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, t);
    ambientGain.gain.linearRampToValueAtTime(v ? 0.35 : 0, t + 0.35);
  };

  if (btn) {
    btn.addEventListener('click', () => { ensure(); set(!on); if (on) click(); });
  }
  document.addEventListener('pointerenter', (e) => {
    if (!on) return;
    const t = e.target;
    if (t && t.closest && t.closest('a, button')) click(true);
  }, true);

  return { click, isOn: () => on };
}
