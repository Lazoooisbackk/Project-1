/*
  Text unter der Tinte im Hero: dort, wo die schillernd weiße Tinte liegt, wird heller Text dunkel.

  Ebenen (von unten): Sternenstaub → heller DOM-Text → Hero-Canvas (Tinte, Chrom-O, Textkopie).
  Der Hero-Canvas liegt dafür über dem Text und über der Navigation (pointer-events: none).
  Er zeichnet nach dem Chrom-O eine Kopie aller hellen Texte und Formen im Hero und in der Navigation,
  gerastert aus den echten DOM-Positionen (gleiche Schrift, Größe, Laufweite, Grundlinie, Clipping).

  Die Kopie wird mit dem Mischmodus (DST_ALPHA, ONE_MINUS_SRC_ALPHA) gezeichnet: Sie erscheint nur dort,
  wo der Canvas selbst schon deckt (Tinte, Glow, Glitzer, Chrom-O, Schatten). Ihre Farbe ist
  mix(hell, dunkel, m) mit demselben Maskenwert m wie die Tinte. Ergebnis:
  - ohne Tinte und ohne Chrom-O: Canvas durchsichtig, der echte DOM-Text bleibt sichtbar (unverändert)
  - über Chrom-O und Schatten: helle Kopie, also wie bisher Text über dem O
  - in der Tinte: dunkler Text (#0B0B0C, Labels #5F5B54) auf Weiß, mit der weichen Kante der Tinte

  Die Kopien werden nur neu gerastert, wenn sich etwas ändert (Reveal fertig, Schriften, Resize,
  Navigation). Ausnahme: das Readout ändert sich laufend und wird nur neu gerastert, solange Tinte
  aktiv ist. Bis die Kopien bereit sind, bleibt die alte Ebenenreihenfolge und die Tinte ist aus.
*/
import * as THREE from 'three';
import { $ } from './utils/dom.js';

const TEXT_DARK = '#0B0B0C';
const LABEL_DARK = '#5F5B54';
const INK_HOLD = 3500;  // ms nach dem letzten Strich, so lange ist noch Tinte sichtbar (Dye klingt ab)

/* Grundlinie so runden wie der Browser den echten Text: Chromium auf ganze CSS-Pixel (gemessen),
   WebKit und Gecko auf Gerätepixel. Waagerecht bleibt die Subpixel-Lage. */
const BLINK = !!(navigator.userAgentData && navigator.userAgentData.brands
  && navigator.userAgentData.brands.some((b) => /Chromium/i.test(b.brand)));
const snapBaseline = (y, pr) => (BLINK ? Math.round(y) : Math.round(y * pr) / pr);

const COPY_V = /* glsl */ `
uniform vec4 uRect;     // x, y, Breite, Höhe in CSS-px relativ zum Hero (y nach unten)
uniform vec2 uStage;    // Hero-Größe in CSS-px
varying vec2 vUv;
void main() {
  vUv = uv;
  vec2 p = uRect.xy + vec2(uv.x, 1.0 - uv.y) * uRect.zw;
  gl_Position = vec4(p.x / uStage.x * 2.0 - 1.0, 1.0 - p.y / uStage.y * 2.0, 0.0, 1.0);
}`;

const COPY_F = /* glsl */ `
uniform sampler2D tCopy;
uniform sampler2D tMask;
uniform float uMaskOn, uInkFill;
uniform vec2 uBuf;
uniform vec3 uLight, uDark;
varying vec2 vUv;
void main() {
  float t = texture2D(tCopy, vUv).a;
  if (t < 0.002) discard;
  /* derselbe Maskenwert wie die Tinte in SHADE_F */
  float a = 0.0;
  if (uMaskOn > 0.5) {
    vec3 dye = texture2D(tMask, gl_FragCoord.xy / uBuf).rgb;
    a = max(dye.r, max(dye.g, dye.b));
  }
  a = max(a, uInkFill);
  float m = smoothstep(0.06, 0.55, a);
  gl_FragColor = vec4(mix(uLight, uDark, m) * t, t);
}`;

const rgb01 = (css) => {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean);
  return { r: +r / 255, g: +g / 255, b: +b / 255, a: +a };
};
const hex01 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/* Rechteck mit runden Ecken (eigener Pfad statt ctx.roundRect, für ältere Safari) */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createInkText({ api, stage, debug = false }) {
  const renderer = api.renderer;
  const canvas = renderer.domElement;
  const shade = api.shade;
  const menu = $('.menu');

  /* Was kopiert wird. fixed: liegt fest im Fenster, verschiebt sich gegenüber dem Hero beim Scrollen. */
  const ITEMS = [
    { key: 'top', sel: '.hero__bar--top', dark: LABEL_DARK },
    { key: 'center', sel: '.hero__center', dark: TEXT_DARK },
    { key: 'bottom', sel: '.hero__bar--bottom', exclude: '#readout', dark: LABEL_DARK },
    { key: 'readout', sel: '#readout', dark: LABEL_DARK, dynamic: true },
    { key: 'nav', sel: '.nav', dark: TEXT_DARK, fixed: true, shapes: true },
  ];

  const scene = new THREE.Scene();
  const cam = new THREE.Camera();
  const plane = new THREE.PlaneGeometry(1, 1);
  const stageSize = new THREE.Vector2(1, 1), buf = new THREE.Vector2(1, 1);

  const items = ITEMS.map((spec, i) => {
    const c2d = document.createElement('canvas');
    const mat = new THREE.ShaderMaterial({
      vertexShader: COPY_V, fragmentShader: COPY_F,
      uniforms: {
        tCopy: { value: null },
        tMask: shade.tMask, uMaskOn: shade.uMaskOn, uInkFill: shade.uInkFill,
        uBuf: { value: buf }, uStage: { value: stageSize },
        uRect: { value: new THREE.Vector4() },
        uLight: { value: new THREE.Vector3(1, 1, 1) },
        uDark: { value: hex01(spec.dark) },
      },
      transparent: true, depthTest: false, depthWrite: false,
      /* nur dort zeichnen, wo der Canvas schon deckt; die Deckkraft des Canvas bleibt unverändert */
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation, blendEquationAlpha: THREE.AddEquation,
      blendSrc: THREE.DstAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.DstAlphaFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = i;
    scene.add(mesh);
    return { ...spec, c2d, mat, mesh, tex: null, x: 0, y: 0, w: 0, h: 0, text: '' };
  });

  /* ---------- Rastern aus dem DOM ---------- */
  const baseCache = new Map();   // Schrift -> Abstand Oberkante Zeichenbox bis Grundlinie (aus dem echten Layout)
  const range = document.createRange();

  const hidden = (el) => !!el.closest('.sr-only, [hidden]');
  function visible(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.01) return false;
    }
    return true;
  }
  /* Clipping wie im DOM: Schnitt aller Vorfahren mit overflow != visible (bis einschließlich Hero) */
  function clipOf(el) {
    let c = { l: -Infinity, t: -Infinity, r: Infinity, b: Infinity };
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = n.getBoundingClientRect();
        c = { l: Math.max(c.l, r.left), t: Math.max(c.t, r.top), r: Math.min(c.r, r.right), b: Math.min(c.b, r.bottom) };
      }
      if (n === stage) break;
    }
    return c;
  }
  /* Grundlinie aus dem Layout: leere Inline-Box direkt vor dem Text, ihre Unterkante ist die Grundlinie */
  function baselineOffset(node, font, firstTop) {
    if (baseCache.has(font)) return baseCache.get(font);
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
    node.parentNode.insertBefore(probe, node);
    const off = probe.getBoundingClientRect().bottom - firstTop;
    probe.remove();
    baseCache.set(font, off);
    return off;
  }

  function collect(item, root) {
    const draws = [];
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = tw.nextNode(); node; node = tw.nextNode()) {
      const el = node.parentElement;
      if (!el || (item.exclude && el.closest(item.exclude)) || hidden(el)) continue;
      const str = node.data;
      if (!str.trim()) continue;
      const cs = getComputedStyle(el);
      const col = rgb01(cs.color);
      if (!col || col.a < 0.01 || !visible(el)) continue;
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const upper = cs.textTransform === 'uppercase';
      const clip = clipOf(el);
      const chars = [];
      for (let i = 0; i < str.length;) {
        const len = str.codePointAt(i) > 0xffff ? 2 : 1;
        const ch = str.slice(i, i + len);
        if (!/\s/.test(ch)) {
          range.setStart(node, i); range.setEnd(node, i + len);
          const r = range.getBoundingClientRect();
          if (r.width > 0 || r.height > 0) chars.push({ ch: upper ? ch.toUpperCase() : ch, r });
        }
        i += len;
      }
      if (!chars.length) continue;
      const off = baselineOffset(node, font, chars[0].r.top);
      const fs = parseFloat(cs.fontSize);
      for (const { ch, r } of chars) {
        draws.push({
          kind: 'text', ch, font, x: r.left, y: r.top + off, clip,
          box: { l: r.left - fs * 0.35, t: r.top - fs * 0.15, r: r.right + fs * 0.35, b: r.bottom + fs * 0.15 },
        });
      }
    }
    if (item.shapes) {
      /* Formen in der Navigation (Sound-Schalter, Menü-Punkte): Hintergrund und Rahmen in der Textfarbe */
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (hidden(el)) continue;
        const cs = getComputedStyle(el);
        const bg = rgb01(cs.backgroundColor), bc = rgb01(cs.borderTopColor), bw = parseFloat(cs.borderTopWidth) || 0;
        const hasBg = bg && bg.a > 0.01, hasBorder = bw > 0 && cs.borderTopStyle !== 'none' && bc && bc.a > 0.01;
        if ((!hasBg && !hasBorder) || !visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        draws.push({
          kind: 'shape', r, radius: parseFloat(cs.borderTopLeftRadius) || 0, fill: hasBg, stroke: hasBorder ? bw : 0, clip: clipOf(el),
          box: { l: r.left - 1, t: r.top - 1, r: r.right + 1, b: r.bottom + 1 },
        });
      }
    }
    return draws;
  }

  function rasterize(item) {
    const root = $(item.sel);
    const draws = root ? collect(item, root) : [];
    if (!draws.length) { item.mesh.visible = false; return; }
    const pr = renderer.getPixelRatio();
    const sr = stage.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const d of draws) { l = Math.min(l, d.box.l); t = Math.min(t, d.box.t); r = Math.max(r, d.box.r); b = Math.max(b, d.box.b); }
    /* am Pixelraster des Canvas ausrichten: Texel liegen 1:1 auf Bildschirmpixeln, die Schrift bleibt scharf */
    const ox = item.fixed ? 0 : sr.left, oy = item.fixed ? 0 : sr.top;
    const x0 = Math.floor((l - ox) * pr) / pr, y0 = Math.floor((t - oy) * pr) / pr;
    const W = Math.max(1, Math.ceil((r - ox - x0) * pr)), H = Math.max(1, Math.ceil((b - oy - y0) * pr));
    const c2d = item.c2d;
    const resized = c2d.width !== W || c2d.height !== H;
    if (resized) { c2d.width = W; c2d.height = H; }
    const ctx = c2d.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(pr, 0, 0, pr, -(ox + x0) * pr, -(oy + y0) * pr);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (const d of draws) {
      ctx.save();
      const c = d.clip;
      if (Number.isFinite(c.l)) { ctx.beginPath(); ctx.rect(c.l, c.t, c.r - c.l, c.b - c.t); ctx.clip(); }
      if (d.kind === 'text') {
        ctx.font = d.font;
        ctx.fillText(d.ch, d.x, snapBaseline(d.y, pr));
      } else {
        /* Ränder wie im Browser auf ganze Gerätepixel */
        const snap = (v) => Math.round(v * pr) / pr;
        const x = snap(d.r.left), y = snap(d.r.top), w = snap(d.r.right) - x, h = snap(d.r.bottom) - y;
        if (d.fill) { roundRectPath(ctx, x, y, w, h, d.radius); ctx.fill(); }
        if (d.stroke) { ctx.lineWidth = d.stroke; roundRectPath(ctx, x + d.stroke / 2, y + d.stroke / 2, w - d.stroke, h - d.stroke, d.radius - d.stroke / 2); ctx.stroke(); }
      }
      ctx.restore();
    }
    /* Texturgröße ändert sich: neue Textur (WebGL2 legt den Speicher fest an) */
    if (!item.tex || resized) {
      if (item.tex) item.tex.dispose();
      item.tex = new THREE.CanvasTexture(c2d);
      item.tex.minFilter = item.tex.magFilter = THREE.LinearFilter;
      item.tex.generateMipmaps = false;
      item.mat.uniforms.tCopy.value = item.tex;
    }
    item.tex.needsUpdate = true;
    const col = rgb01(getComputedStyle(root).color);
    if (col) item.mat.uniforms.uLight.value.set(col.r, col.g, col.b);
    Object.assign(item, { x: x0, y: y0, w: W / pr, h: H / pr });
    item.text = root.textContent;
    item.mesh.visible = true;
  }

  /* ---------- Zustand und Ebenen ---------- */
  let ready = false, revealed = false, menuOpen = false;
  let lastInk = -Infinity, navDirtyUntil = 0, timer = 0;

  function layer() {
    canvas.classList.toggle('is-ink-over', ready && !menuOpen);
    canvas.classList.toggle('is-ink-mid', ready && menuOpen);
    shade.uInkFill.value = ready && debug ? 1 : 0;
  }
  function rasterizeAll() {
    timer = 0;
    if (!revealed) return;
    baseCache.clear();
    items.forEach(rasterize);
    navObs.takeRecords();
    ready = true;
    layer();
    if (!api.state.running) api.layout();
  }
  function invalidate(delay = 350) {
    ready = false;
    layer();
    clearTimeout(timer);
    timer = setTimeout(rasterizeAll, delay);
  }

  /* Navigation: Änderungen (Sound-Schalter, Menü-Punkte) eine Weile pro Frame nachrastern, CSS-Übergänge inklusive */
  const navObs = new MutationObserver(() => { navDirtyUntil = performance.now() + 600; });
  const navEl = $('.nav');
  if (navEl) navObs.observe(navEl, { subtree: true, attributes: true, childList: true, characterData: true });

  /* Menü offen: Canvas unter Navigation und Menü, Kopie der Navigation aus. Erst nach dem Ausblenden wieder darüber. */
  const syncMenu = () => {
    if (!menu) return;
    const open = menu.getAttribute('aria-hidden') === 'false' || getComputedStyle(menu).visibility !== 'hidden';
    if (open === menuOpen) return;
    menuOpen = open;
    if (!open) navDirtyUntil = performance.now() + 600;
    layer();
  };
  const menuObs = new MutationObserver(syncMenu);
  if (menu) menuObs.observe(menu, { attributes: true, attributeFilter: ['aria-hidden', 'style'] });

  window.addEventListener('loader:hero-revealed', () => { revealed = true; invalidate(0); });
  window.addEventListener('resize', () => invalidate(), { passive: true });
  const ro = new ResizeObserver(() => { if (revealed) invalidate(); });
  ro.observe(stage);
  const mark = $('#mark');
  if (mark) ro.observe(mark);
  document.fonts.ready.then(() => { if (revealed) invalidate(0); });

  /* ---------- Pro Frame, direkt nach dem Chrom-O ---------- */
  api.setOverlay((now) => {
    if (!ready) return;
    const sr = stage.getBoundingClientRect();
    const pr = renderer.getPixelRatio();
    stageSize.set(sr.width, sr.height);
    renderer.getDrawingBufferSize(buf);
    const inkOn = debug || now - lastInk < INK_HOLD;
    for (const item of items) {
      if (item.dynamic && inkOn) {
        const root = $(item.sel);
        if (root && root.textContent !== item.text) rasterize(item);
      }
      if (item.fixed) {
        if (menuOpen) { item.mesh.visible = false; continue; }
        if (now < navDirtyUntil) { rasterize(item); navObs.takeRecords(); }
        if (!item.tex) continue;
        item.mesh.visible = true;
        /* fest im Fenster: Lage gegenüber dem Hero aus dem Scroll, auf Gerätepixel gerundet */
        const x = Math.round((item.x - sr.left) * pr) / pr, y = Math.round((item.y - sr.top) * pr) / pr;
        item.mat.uniforms.uRect.value.set(x, y, item.w, item.h);
      } else {
        item.mat.uniforms.uRect.value.set(item.x, item.y, item.w, item.h);
      }
    }
    renderer.render(scene, cam);
  });

  return {
    get ready() { return ready; },
    /* vom Hero bei jedem Tintenstrich aufgerufen */
    touch() { lastInk = performance.now(); },
    refresh: () => invalidate(0),
  };
}
