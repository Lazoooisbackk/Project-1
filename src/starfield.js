/*
  Sternenstaub-Hintergrund für einen fest stehenden Container (z. B. .site-bg).

    import { init } from './starfield.js';
    const sky = init(document.querySelector('.site-bg'), { count: 3200 });

  Alles auf der GPU, drei Draw-Calls pro Frame:
    1. Lichtschein: Fullscreen-Quad, Schwarz + Orchid-Schein unten links + Frozen-Schein oben rechts
       (additiv, atmend, wandert leicht mit dem Scroll)
    2. Sterne: ein instanzierter Quad pro Stern. Position, Drift, Parallax, Fallen, Umbruch,
       Glitzern, Aufblitzen, Halo und Lichtstreifen rechnen Vertex- und Fragment-Shader
    3. Sternschnuppe: ein Quad mit Kopf, Schweif und Bloom
  Die CPU rechnet pro Frame nur ein paar Zahlen: Scroll-Geschwindigkeit, Fall-Versatz und
  Streifenlänge je Ebene, Zeiger, Zustand der Sternschnuppe.

  Farben ändern:   DEFAULTS.colors unten, oder zur Laufzeit sky.setColors({ orchid: '#DA70D6' })
  Werte ändern:    DEFAULTS (Anzahl, Farbmix, Fallen, Streifen, Sternschnuppe, Glow, Lichtschein)
                   oder zur Laufzeit über sky.uniforms (z. B. sky.uniforms.uGlow.value = 1.4)
  Anhalten von außen (z. B. wenn der Hintergrund ganz verdeckt ist): sky.suspend(true / false)
*/
import * as THREE from 'three';
import './styles/starfield.css';

const DEFAULTS = {
  count: 3200,                   // Sterne auf dem Desktop; kleine Bildschirme bekommen anteilig weniger (mind. 78 %)
  mix: { white: 0.45, frozen: 0.30, orchid: 0.25 },
  colors: { base: '#0B0B0C', white: '#F5F3EE', frozen: '#A0BDDB', orchid: '#DA70D6' },
  bigShare: 0.08,                // Anteil großer Sterne (1,5–3,5 px) mit Halo, der Rest 0,3–1,5 px
  glow: 1,                       // Stärke der Halos und des Blooms
  twinkle: 1,                    // Stärke des Glitzerns (Zyklus 1–4 s)
  flashShare: 0.04,              // Anteil der Sterne, die ab und zu kurz hell aufblitzen
  drift: 1,                      // Eigenbewegung im Ruhezustand
  parallax: 25,                  // px Zeiger-Parallax der vordersten Ebene
  depth: [0.35, 0.65, 1.0],      // Parallax-Anteil der drei Ebenen
  fall: 0.5,                     // Fallgeschwindigkeit relativ zur Scroll-Geschwindigkeit
  layers: [0.4, 0.8, 1.3],       // Fallfaktoren der drei Ebenen
  smooth: 0.08,                  // Glättung der Scroll-Geschwindigkeit (lerp pro Frame, klingt in ca. 1 s aus)
  maxVel: 4000,                  // px/s, Obergrenze der gemessenen Scroll-Geschwindigkeit
  trail: 40,                     // px, max. Länge der Lichtstreifen
  trailTime: 0.04,               // s, Streifenlänge = Fallgeschwindigkeit × trailTime
  shootThreshold: 500,           // px/s (geglättete) Scroll-Geschwindigkeit, ab der eine Sternschnuppe starten kann
  cooldown: [3, 6],              // s Pause nach einer Sternschnuppe
  idle: [15, 30],                // s bis zur zufälligen Sternschnuppe im Ruhezustand
  shootLength: [150, 350],       // px Schweif
  shootDuration: [0.5, 0.9],     // s Flugdauer
  irid: 0.3,                     // Schillern (Weiß ↔ Frozen ↔ Orchid) der großen Sterne und der Sternschnuppe
  glowOrchid: { x: 0.14, y: 0.86, r: 0.50, a: 0.30 },  // Lichtschein: Mitte relativ, Radius relativ zur Höhe, Deckkraft
  glowFrozen: { x: 0.86, y: 0.12, r: 0.35, a: 0.25 },
  breathe: 0.10,                 // Lichtschein atmet ±10 %
  pointer: true,                 // Zeiger-Parallax (nie auf Touch)
  dpr: 1.5,                      // Obergrenze Pixel Ratio
  seed: 7,                       // gleiche Sterne bei jedem Besuch
};

const TAU = Math.PI * 2;
const MARGIN = 60;               // px außerhalb des Bildes, in denen Sterne umbrechen (Streifen + Halo)

/* kleiner deterministischer Zufall */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Hex -> sRGB 0..1 (die Shader rechnen direkt in sRGB, wie Ebenen in einem Design-Tool) */
const srgb = (hex, out = new THREE.Vector3()) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return out.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const rgbList = (hex) => { const v = srgb(hex); return `${Math.round(v.x * 255)}, ${Math.round(v.y * 255)}, ${Math.round(v.z * 255)}`; };

const PEARL = /* glsl */ `
vec3 pearl(float x) {
  x = fract(x) * 3.0;
  vec3 a = x < 1.0 ? uWhite : (x < 2.0 ? uFrozen : uOrchid);
  vec3 b = x < 1.0 ? uFrozen : (x < 2.0 ? uOrchid : uWhite);
  return mix(a, b, smoothstep(0.0, 1.0, fract(x)));
}`;

const QUAD_V = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/* 1. Lichtschein */
const GLOW_F = /* glsl */ `
varying vec2 vUv;
uniform vec2 uView;
uniform vec3 uBase, uOrchid, uFrozen;
uniform vec4 uGlowA, uGlowB;
uniform float uSeed;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uView;
  float fa = 1.0 - smoothstep(0.0, uGlowA.z, length(p - uGlowA.xy));
  float fb = 1.0 - smoothstep(0.0, uGlowB.z, length(p - uGlowB.xy));
  fa *= 0.5 + 0.5 * fa; fb *= 0.5 + 0.5 * fb;
  vec3 col = uBase + uOrchid * uGlowA.w * fa + uFrozen * uGlowB.w * fb;
  /* Dither nur im Schein: gegen Banding, das echte Schwarz bleibt unberührt */
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) / 255.0 * step(1e-5, fa + fb);
  gl_FragColor = vec4(col, 1.0);
}`;

/* 2. Sterne: aA = (seed.x, seed.y, Ebene, Größe px), aB = (Farbe 0/1/2, Halo, Helligkeit, Farbton-Seed),
      aC = (Glitzer-Periode, -Phase, Blitz-Periode oder 0, Blitz-Phase), aD = Drift px/s */
const STAR_V = /* glsl */ `
uniform vec2 uView, uPar;
uniform vec3 uFall, uTrail, uDepth, uWhite, uFrozen, uOrchid;
uniform float uTime, uMargin, uTwinkle, uIrid, uDrift;
attribute vec4 aA, aB, aC;
attribute vec2 aD;
varying vec2 vLocal;
varying vec3 vColor;
varying float vSize, vHalo, vTrail;
float pick(vec3 v, float l) { return l < 0.5 ? v.x : (l < 1.5 ? v.y : v.z); }
${PEARL}
void main() {
  float layer = aA.z, size = aA.w, halo = aB.y;
  vec2 span = uView + 2.0 * uMargin;
  vec2 p = aA.xy * span + aD * uTime * uDrift + vec2(0.0, pick(uFall, layer)) + uPar * pick(uDepth, layer);
  p = mod(p, span) - uMargin;

  /* Quad um den Kopf, nach hinten (entgegen der Fallrichtung) um die Streifenlänge verlängert */
  float trail = pick(uTrail, layer);
  float L = abs(trail) > 0.5 ? abs(trail) : 0.0;
  float back = trail >= 0.0 ? -1.0 : 1.0;
  float R = halo > 0.5 ? size * 6.0 + 2.0 : max(size, 1.0) * 1.5 + 1.0;
  vec2 local = vec2(position.x * R, position.y < 0.0 ? -R : R + L);
  vec2 world = p + vec2(local.x, local.y * back);

  vec3 col = aB.x < 0.5 ? uWhite : (aB.x < 1.5 ? uFrozen : uOrchid);
  if (halo > 0.5) col = mix(col, pearl(uTime * 0.05 + aB.w), uIrid);
  float tw = 1.0 - uTwinkle * 0.45 * (0.5 + 0.5 * sin(6.2831853 * uTime / aC.x + aC.y));
  float fl = 0.0;
  if (aC.z > 0.0) { float ft = mod(uTime + aC.w, aC.z); fl = ft < 0.35 ? sin(3.14159265 * ft / 0.35) : 0.0; }
  vColor = col * aB.z * (tw + fl * 2.2);
  vLocal = local; vSize = size; vHalo = halo; vTrail = L;
  gl_Position = vec4(world.x / uView.x * 2.0 - 1.0, 1.0 - world.y / uView.y * 2.0, 0.0, 1.0);
}`;

const STAR_F = /* glsl */ `
uniform float uDpr, uGlow;
varying vec2 vLocal;
varying vec3 vColor;
varying float vSize, vHalo, vTrail;
void main() {
  /* Punkte unter 1 Gerätepixel: gleicher Fußabdruck, weniger Energie (kein Flimmern) */
  float px = 1.0 / uDpr;
  float s = max(vSize, 1.25 * px);
  float sg = 0.5 * s;
  float energy = (vSize * vSize) / (s * s);
  float d2 = dot(vLocal, vLocal);
  float core = exp(-d2 / (2.0 * sg * sg)) * energy;
  float hs = sg * 3.5;
  float halo = vHalo * uGlow * 0.22 * exp(-d2 / (2.0 * hs * hs));
  /* Lichtstreifen hinter dem Kopf: dünn, zum Ende hin ausblendend, in der Farbe des Sterns */
  float tr = 0.0;
  if (vTrail > 0.0 && vLocal.y > 0.0 && vLocal.y < vTrail) {
    float k = vLocal.y / vTrail;
    float w = max(0.45 * s, 0.6 * px);
    tr = exp(-vLocal.x * vLocal.x / (2.0 * w * w)) * (1.0 - k) * (1.0 - k) * 0.6 * min(1.0, energy * 2.0 + 0.3);
  }
  gl_FragColor = vec4(vColor * (core + halo + tr), 1.0);
}`;

/* 3. Sternschnuppe: vLocal.x = Abstand hinter dem Kopf entlang der Flugrichtung, vLocal.y = seitlich (px) */
const SHOOT_V = /* glsl */ `
uniform vec2 uView, uHead, uDir;
uniform float uLen;
varying vec2 vLocal;
void main() {
  const float W = 24.0;
  float a = position.y < 0.0 ? -W : uLen + W;
  float b = position.x * W;
  vec2 side = vec2(-uDir.y, uDir.x);
  vec2 world = uHead - uDir * a + side * b;
  vLocal = vec2(a, b);
  gl_Position = vec4(world.x / uView.x * 2.0 - 1.0, 1.0 - world.y / uView.y * 2.0, 0.0, 1.0);
}`;

const SHOOT_F = /* glsl */ `
uniform vec3 uWhite, uFrozen, uOrchid;
uniform float uLen, uAlpha, uTime, uGlow, uIrid;
varying vec2 vLocal;
${PEARL}
void main() {
  float a = vLocal.x, b = vLocal.y;
  float r2 = a * a + b * b;
  float head = exp(-r2 / 2.0);
  float rim = max(exp(-r2 / (2.0 * 1.9 * 1.9)) - head, 0.0);
  float bloom = 0.35 * uGlow * exp(-r2 / (2.0 * 6.5 * 6.5));
  float tail = 0.0, k = 0.0;
  if (a > 0.0 && a < uLen) {
    k = a / uLen;
    float w = mix(1.1, 0.35, k);
    float fade = 1.0 - k;
    tail = pow(fade, 1.6) * exp(-b * b / (2.0 * w * w)) * 0.9;
    float wb = w * 4.0;
    tail += 0.25 * uGlow * fade * fade * exp(-b * b / (2.0 * wb * wb));
  }
  vec3 tc = k < 0.5 ? mix(uWhite, uFrozen, k * 2.0) : mix(uFrozen, uOrchid, (k - 0.5) * 2.0);
  tc = mix(tc, pearl(uTime * 0.6 + k * 1.5), uIrid * 0.5);
  vec3 col = uWhite * (head + bloom * 0.8) + uFrozen * rim * 0.9 + tc * tail;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}`;

export function init(container, options = {}) {
  const o = {
    ...DEFAULTS, ...options,
    mix: { ...DEFAULTS.mix, ...options.mix },
    colors: { ...DEFAULTS.colors, ...options.colors },
    glowOrchid: { ...DEFAULTS.glowOrchid, ...options.glowOrchid },
    glowFrozen: { ...DEFAULTS.glowFrozen, ...options.glowFrozen },
  };
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduce.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const madeRelative = getComputedStyle(container).position === 'static';
  container.classList.add('sky-host');
  if (madeRelative) container.classList.add('sky-host--relative');

  let inView = true, held = false;
  let io = null;
  const cleanup = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanup.push(() => target.removeEventListener(type, fn, opts)); };

  /* ---------- Sterne erzeugen (einmal, deterministisch) ---------- */
  const COUNT = o.count;
  const A = new Float32Array(COUNT * 4), B = new Float32Array(COUNT * 4), C = new Float32Array(COUNT * 4), D = new Float32Array(COUNT * 2);
  {
    const rnd = mulberry32(o.seed);
    const cw = o.mix.white, cf = o.mix.white + o.mix.frozen;
    for (let i = 0; i < COUNT; i++) {
      const r = rnd();
      const layer = r < 0.5 ? 0 : r < 0.83 ? 1 : 2;
      const big = rnd() < o.bigShare;
      const size = big ? 1.5 + 2.0 * rnd() : 0.3 + 1.2 * Math.pow(rnd(), 1.6);
      const c = rnd();
      const color = c < cw ? 0 : c < cf ? 1 : 2;
      const bright = [0.55, 0.78, 1.0][layer] * (0.7 + 0.3 * rnd());
      A.set([rnd(), rnd(), layer, size], i * 4);
      B.set([color, big ? 1 : 0, bright, rnd()], i * 4);
      const flashP = rnd() < o.flashShare ? 7 + 13 * rnd() : 0;
      C.set([1 + 3 * rnd(), rnd() * TAU, flashP, rnd() * flashP], i * 4);
      const ang = rnd() * TAU, sp = (1 + 3 * rnd()) * (0.5 + 0.5 * layer);
      D.set([Math.cos(ang) * sp, Math.sin(ang) * sp], i * 2);
    }
  }
  const visibleCount = (w, h) => Math.round(COUNT * Math.min(1, Math.max(0.78, (w * h) / (1440 * 900))));

  /* ---------- CSS-Fallback: statische Sterne (2D-Canvas) und Lichtschein (CSS) ---------- */
  function mountCSS() {
    const el = document.createElement('div');
    el.className = 'sky sky--css';
    el.setAttribute('aria-hidden', 'true');
    const cv = document.createElement('canvas');
    el.appendChild(cv);
    container.prepend(el);
    const setColors = (colors = {}) => {
      Object.assign(o.colors, colors);
      el.style.setProperty('--sky-base', o.colors.base);
      el.style.setProperty('--sky-orchid-rgb', rgbList(o.colors.orchid));
      el.style.setProperty('--sky-frozen-rgb', rgbList(o.colors.frozen));
      draw();
    };
    function draw() {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, o.dpr);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pal = [o.colors.white, o.colors.frozen, o.colors.orchid].map(rgbList);
      const n = visibleCount(w, h);
      for (let i = 0; i < n; i++) {
        const size = A[i * 4 + 3], x = A[i * 4] * w, y = A[i * 4 + 1] * h;
        const alpha = Math.min(1, B[i * 4 + 2] * Math.min(1, size * size));
        if (B[i * 4 + 1] > 0.5) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
          g.addColorStop(0, `rgba(${pal[B[i * 4]]}, ${0.25 * o.glow})`);
          g.addColorStop(1, `rgba(${pal[B[i * 4]]}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);
        }
        ctx.fillStyle = `rgba(${pal[B[i * 4]]}, ${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, Math.max(size, 0.6) / 2, 0, TAU); ctx.fill();
      }
    }
    const ro2 = new ResizeObserver(draw);
    ro2.observe(container);
    setColors();
    return {
      mode: 'css', canvas: cv, element: el, uniforms: null,
      setColors,
      suspend(v = true) { held = v; },
      start() {}, stop() {}, render: draw,
      destroy() {
        ro2.disconnect(); cleanup.forEach((fn) => fn());
        el.remove();
        container.classList.remove('sky-host', 'sky-host--relative');
      },
    };
  }

  if (document.documentElement.classList.contains('no-gl')) return mountCSS();

  /* ---------- WebGL ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'sky';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  } catch (e) {
    canvas.remove();
    return mountCSS();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.dpr));
  renderer.autoClear = false;

  const view = new THREE.Vector2(1, 1);
  const pal = {
    uWhite: { value: srgb(o.colors.white) },
    uFrozen: { value: srgb(o.colors.frozen) },
    uOrchid: { value: srgb(o.colors.orchid) },
  };
  const uniforms = {
    uView: { value: view },
    uTime: { value: 0 },
    uDpr: { value: renderer.getPixelRatio() },
    uGlow: { value: o.glow },
    uIrid: { value: o.irid },
    uTwinkle: { value: o.twinkle },
    uDrift: { value: o.drift },
    uMargin: { value: MARGIN },
    uFall: { value: new THREE.Vector3() },
    uTrail: { value: new THREE.Vector3() },
    uDepth: { value: new THREE.Vector3(...o.depth) },
    uPar: { value: new THREE.Vector2() },
    uBase: { value: srgb(o.colors.base) },
    uGlowA: { value: new THREE.Vector4() },
    uGlowB: { value: new THREE.Vector4() },
    uSeed: { value: 0 },
    uHead: { value: new THREE.Vector2() },
    uDir: { value: new THREE.Vector2(1, 0) },
    uLen: { value: 0 },
    uAlpha: { value: 0 },
    ...pal,
  };
  const pick = (...keys) => Object.fromEntries(keys.map((k) => [k, uniforms[k]]));
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const cam = new THREE.Camera();
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false };

  const glowMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_V, fragmentShader: GLOW_F, depthTest: false, depthWrite: false,
    uniforms: { ...pick('uView', 'uBase', 'uGlowA', 'uGlowB', 'uSeed'), uOrchid: pal.uOrchid, uFrozen: pal.uFrozen },
  });
  const glow = new THREE.Mesh(quadGeo, glowMat);
  glow.frustumCulled = false;

  const starGeo = new THREE.InstancedBufferGeometry();
  starGeo.index = quadGeo.index;
  starGeo.setAttribute('position', quadGeo.getAttribute('position'));
  starGeo.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
  starGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4));
  starGeo.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 4));
  starGeo.setAttribute('aD', new THREE.InstancedBufferAttribute(D, 2));
  starGeo.instanceCount = COUNT;
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_V, fragmentShader: STAR_F, ...additive,
    uniforms: pick('uView', 'uPar', 'uFall', 'uTrail', 'uDepth', 'uWhite', 'uFrozen', 'uOrchid', 'uTime', 'uMargin', 'uTwinkle', 'uIrid', 'uDrift', 'uDpr', 'uGlow'),
  });
  const stars = new THREE.Mesh(starGeo, starMat);
  stars.frustumCulled = false;

  const shootMat = new THREE.ShaderMaterial({
    vertexShader: SHOOT_V, fragmentShader: SHOOT_F, ...additive,
    uniforms: pick('uView', 'uHead', 'uDir', 'uLen', 'uAlpha', 'uTime', 'uGlow', 'uIrid', 'uWhite', 'uFrozen', 'uOrchid'),
  });
  const shootMesh = new THREE.Mesh(quadGeo, shootMat);
  shootMesh.frustumCulled = false;
  shootMesh.visible = false;

  const scene = new THREE.Scene();
  scene.add(glow, stars, shootMesh);
  glow.renderOrder = 0; stars.renderOrder = 1; shootMesh.renderOrder = 2;

  /* ---------- Zustand ---------- */
  const rnd = Math.random;
  const range = ([a, b]) => a + (b - a) * rnd();
  let clock = 0, lastY = window.scrollY, vel = 0;
  const fall = [0, 0, 0];
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const shoot = { active: false, t0: 0, dur: 0, sx: 0, sy: 0, dx: 1, dy: 0, dist: 0, len: 0 };
  let cooldownUntil = 0, idleAt = range(o.idle);

  if (o.pointer && finePointer) {
    listen(window, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    listen(document.documentElement, 'mouseleave', () => { ptr.x = 0; ptr.y = 0; });
  }

  function spawnShoot() {
    const W = view.x, H = view.y, m = 30;
    const kind = Math.floor(rnd() * 3);
    let ang, sx, sy;
    if (kind === 0) { ang = range([18, 40]); sx = -m; sy = range([0.05, 0.45]) * H; }             // links -> rechts unten
    else if (kind === 1) { ang = 180 - range([18, 40]); sx = W + m; sy = range([0.05, 0.45]) * H; } // rechts -> links unten
    else { ang = 90 + range([-18, 18]); sx = range([0.2, 0.8]) * W; sy = -m; }                     // steil nach unten
    const dx = Math.cos(ang * Math.PI / 180), dy = Math.sin(ang * Math.PI / 180);
    const tx = dx > 0 ? (W + m - sx) / dx : dx < 0 ? (-m - sx) / dx : Infinity;
    const ty = dy > 0 ? (H + m - sy) / dy : dy < 0 ? (-m - sy) / dy : Infinity;
    const len = range(o.shootLength);
    Object.assign(shoot, { active: true, t0: clock, dur: range(o.shootDuration), sx, sy, dx, dy, len, dist: Math.min(tx, ty) + len });
    idleAt = clock + shoot.dur + range(o.idle);
  }
  function updateShoot() {
    if (!shoot.active) {
      const calm = Math.abs(vel) < 30;
      if (clock >= cooldownUntil && (Math.abs(vel) > o.shootThreshold || (calm && clock >= idleAt))) spawnShoot();
      else { shootMesh.visible = false; return; }
    }
    const u = Math.min((clock - shoot.t0) / shoot.dur, 1);
    const e = 1 - (1 - u) * (1 - u);                     // leichtes Ease-Out
    const d = shoot.dist * e;
    uniforms.uHead.value.set(shoot.sx + shoot.dx * d, shoot.sy + shoot.dy * d);
    uniforms.uDir.value.set(shoot.dx, shoot.dy);
    uniforms.uLen.value = Math.min(shoot.len, d);
    uniforms.uAlpha.value = Math.min(u / 0.08, 1) * (1 - Math.max((u - 0.85) / 0.15, 0));
    shootMesh.visible = true;
    if (u >= 1) {
      shoot.active = false; shootMesh.visible = false;
      cooldownUntil = clock + range(o.cooldown);
    }
  }

  function updateGlow() {
    const W = view.x, H = view.y, R = Math.min(H, W * 1.05);
    const sy = reduced() ? 0 : window.scrollY;
    const b = 1 + o.breathe * Math.sin(clock * TAU / 9);
    const b2 = 1 + o.breathe * Math.sin(clock * TAU / 11 + 1.7);
    const go = o.glowOrchid, gf = o.glowFrozen;
    uniforms.uGlowA.value.set(go.x * W + Math.sin(sy / 1700) * 0.04 * W, go.y * H + Math.cos(sy / 2100) * 0.05 * H, go.r * R, go.a * b);
    uniforms.uGlowB.value.set(gf.x * W - Math.sin(sy / 1900) * 0.04 * W, gf.y * H - Math.cos(sy / 2300) * 0.05 * H, gf.r * R, gf.a * b2);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    view.set(w, h);
    uniforms.uDpr.value = renderer.getPixelRatio();
    starGeo.instanceCount = visibleCount(w, h);
  }

  function render() {
    uniforms.uTime.value = clock;
    updateGlow();
    renderer.render(scene, cam);
  }

  let raf = 0, last = 0, running = false;
  function frame() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    clock += dt;
    const u = uniforms;
    u.uSeed.value = (u.uSeed.value + 1) % 1000;

    /* Scroll-Geschwindigkeit (px/s, + = nach unten), geglättet */
    const y = window.scrollY;
    const raw = dt > 0 ? (y - lastY) / dt : 0;
    lastY = y;
    const k = 1 - Math.pow(1 - o.smooth, dt * 60);
    vel += (Math.max(-o.maxVel, Math.min(o.maxVel, raw)) - vel) * k;
    if (Math.abs(vel) < 0.5) vel = 0;

    /* Fallen und Streifen je Ebene */
    const spanY = view.y + 2 * MARGIN;
    for (let l = 0; l < 3; l++) {
      const v = vel * o.fall * o.layers[l];
      fall[l] = (((fall[l] + v * dt) % spanY) + spanY) % spanY;
      u.uTrail.value.setComponent(l, Math.max(-o.trail, Math.min(o.trail, v * o.trailTime)));
    }
    u.uFall.value.set(fall[0], fall[1], fall[2]);

    /* Zeiger-Parallax, weich nachgezogen */
    const pk = 1 - Math.pow(1 - 0.05, dt * 60);
    ptr.sx += (ptr.x - ptr.sx) * pk; ptr.sy += (ptr.y - ptr.sy) * pk;
    u.uPar.value.set(ptr.sx * o.parallax, ptr.sy * o.parallax);

    updateShoot();
    render();
    raf = requestAnimationFrame(frame);
  }
  const start = () => {
    if (running || reduced()) return;
    running = true; last = performance.now();
    lastY = window.scrollY; vel = 0;                     // kein Sprung nach einer Pause
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const sync = () => {
    if (reduced()) { stop(); still(); return; }
    if (inView && !document.hidden && !held) start(); else stop();
  };

  /* Reduzierte Bewegung: statische Sterne, keine Streifen, keine Sternschnuppe */
  function still() {
    vel = 0; clock = 3;
    uniforms.uTrail.value.set(0, 0, 0);
    uniforms.uPar.value.set(0, 0);
    shoot.active = false; shootMesh.visible = false;
    render();
  }
  listen(mqReduce, 'change', sync);

  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) render(); });
  ro.observe(container);
  io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { rootMargin: '100px' });
  io.observe(container);
  listen(document, 'visibilitychange', sync);

  /* Kontext verloren (z. B. zu viele WebGL-Kontexte auf dem Handy): auf den CSS-Fallback umschalten */
  let api;
  listen(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    teardown();
    Object.assign(api, mountCSS());
  });

  renderer.compile(scene, cam);
  if (reduced()) still(); else render();
  sync();

  function teardown() {
    stop();
    ro.disconnect(); io.disconnect();
    cleanup.splice(0).forEach((fn) => fn());
    quadGeo.dispose(); starGeo.dispose();
    glowMat.dispose(); starMat.dispose(); shootMat.dispose();
    renderer.dispose();
    canvas.remove();
  }

  api = {
    mode: 'webgl', canvas, element: canvas, uniforms,
    setColors(colors = {}) {
      Object.assign(o.colors, colors);
      srgb(o.colors.white, pal.uWhite.value); srgb(o.colors.frozen, pal.uFrozen.value); srgb(o.colors.orchid, pal.uOrchid.value);
      srgb(o.colors.base, uniforms.uBase.value);
      if (!running) render();
    },
    suspend(v = true) { held = v; sync(); },
    start, stop, render,
    destroy() {
      teardown();
      container.classList.remove('sky-host', 'sky-host--relative');
    },
  };
  return api;
}
