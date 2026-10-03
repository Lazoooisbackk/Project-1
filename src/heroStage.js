/*
  Die Bühne im Start-Bereich: eine Leinwand, ein Renderer.
  1. Flüssigkeits-Simulation: der Zeiger malt eine Maske.
  2. Misch-Durchgang: mix(Basis, Folienwelt, Maske).
     Basis      = weiße Seite mit den schwarzen Buchstaben „guskic studi“
     Folienwelt = schwarze Seite, dieselben Buchstaben als echte 3D-Ballons (src/balloonLetters.js),
                  in ein eigenes Render-Target gezeichnet, nur solange Tinte da ist
     Die Maske hat eine feste, scharfe Kante: wie verschüttete Tinte von oben.
  3. Darüber im selben Bild: das Chrom-O (immer sichtbar, auf Weiß und auf Schwarz).
*/
import * as THREE from 'three';
import { buildO, makeEnv, makeFoilMaterial, oAspect } from './chromeO.js';
import { createFluid, fluidSupported } from './fluid.js';
import { WORDMARK } from './wordmark.js';
import { isMobile } from './utils/dom.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const QUAD_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const MIX_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D tDye;     // Maske aus der Simulation
uniform sampler2D tBase;    // weiß mit schwarzen Buchstaben
uniform sampler2D tReveal;  // schwarz mit den Ballon-Buchstaben (fertige sRGB-Farben)
uniform vec2 uDyeTexel;
uniform float uThreshold;   // Kante der Tinte
uniform float uMaskOn;
uniform float uRevealOn;
uniform float uFill;        // 0..1: ganze Fläche als Folienwelt (zum Prüfen und für das Vorschaubild)
uniform vec4 uSh;           // Schatten unter dem Chrom-O: Mitte (uv), Radien
uniform float uShA;
uniform float uAspect;

/* Tinte über 9 Punkte gemittelt: glatte Kante ohne Pixeltreppen */
float dyeAt(vec2 uv){
  vec2 e = uDyeTexel * 1.25;
  float c = texture2D(tDye, uv).r * 0.25;
  c += (texture2D(tDye, uv + vec2(e.x, 0.0)).r + texture2D(tDye, uv - vec2(e.x, 0.0)).r
      + texture2D(tDye, uv + vec2(0.0, e.y)).r + texture2D(tDye, uv - vec2(0.0, e.y)).r) * 0.125;
  c += (texture2D(tDye, uv + e).r + texture2D(tDye, uv - e).r
      + texture2D(tDye, uv + vec2(e.x, -e.y)).r + texture2D(tDye, uv + vec2(-e.x, e.y)).r) * 0.0625;
  return c;
}

void main(){
  vec3 base = texture2D(tBase, vUv).rgb;
  vec2 q = vUv - uSh.xy; q.x *= uAspect;
  float sd = length(q / uSh.zw);
  base *= 1.0 - uShA * exp(-sd * sd * 1.6);

  float m = uFill;
  if (uMaskOn > 0.5) {
    /* schmale Schwelle: feste Fläche mit scharfer Kante; die Breite folgt dem Gefälle, damit die Kante überall ca. 1 px weich ist */
    float d = dyeAt(vUv);
    float band = clamp(fwidth(d) * 0.9, 0.0008, 0.012);
    m = max(m, smoothstep(uThreshold - band, uThreshold + band, d));
  }

  vec3 col = base;
  if (m > 0.0005) {
    vec3 reveal = uRevealOn > 0.5 ? texture2D(tReveal, vUv).rgb : vec3(0.0);
    col = mix(base, reveal, m);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createHeroStage({ canvas, stage, svg, ghost, reduce = false }) {
  const state = {
    ok: false,
    scale: 0,        // 0..1, Größe des Chrom-O (Intro)
    crumple: 0,      // 0..1, Knitter
    running: false,
    fluid: false,    // Wischen aktiv
    baked: false,    // Buchstaben liegen in der Leinwand
    reduce,
  };
  const api = { state, layout() {}, bake() {}, start() {}, stop() {}, crumpleAgain() {}, fill() {}, dispose() {} };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-gl');
    return api;
  }
  state.ok = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;

  /* Chrom-O */
  const scene = new THREE.Scene();
  scene.environment = makeEnv(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.z = 10;
  const U = { uAmt: { value: 0 }, uSeed: { value: 0 } };
  const foilMat = makeFoilMaterial(U);
  let mesh = null, box = null, baseScale = 1;

  /* Flüssigkeit: feine Tinte (Handy: halbe Auflösung) */
  const mobile = isMobile();
  const canFluid = !reduce && fluidSupported(renderer);
  /* Handy: der Pinsel misst sich an der Höhe der Fläche, im Hochformat deshalb kleiner.
     Die Kraft wird mit der halben Simulationsauflösung halbiert, sonst fließt die Fläche doppelt so weit. */
  const fluid = canFluid ? createFluid(renderer, mobile ? { simResolution: 128, dyeResolution: 512, splatRadius: 0.0019, velocityRadius: 0.0008, splatForce: 2950 } : {}) : null;

  /* Ballon-Buchstaben: eigene Szene, gezeichnet in ein Render-Target (mit Tiefe, Kantenglättung).
     Der Code dafür wird erst nachgeladen, damit der Start schnell bleibt. */
  let balloons = null, revealRT = null, balloonsQueued = false;
  /* erst nach dem Intro bauen, wenn der Browser Zeit hat (das Aufblasen rechnet einen Moment) */
  function queueBalloons() {
    if (!canFluid || balloonsQueued) return;
    balloonsQueued = true;
    import('./balloonLetters.js').then(({ createBalloonLetters }) => createBalloonLetters(renderer)).then((b) => {
      balloons = b;
      revealRT = new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        samples: (window.devicePixelRatio || 1) >= 2 ? 2 : 4,
      });
      mixMat.uniforms.tReveal.value = revealRT.texture;
      renderer.compile(balloons.scene, balloons.camera);   // Shader vorab übersetzen: kein Ruckeln beim ersten Wischen
      layoutBalloons();
      if (!state.running) renderFrame(performance.now(), 0);
    }).catch((e) => console.warn('Ballon-Buchstaben nicht verfügbar', e));
  }
  let lastInk = -1e9;          // Zeit des letzten Pinselstrichs
  const INK_LIFE = 4500;       // so lange (ms) kann Tinte sichtbar sein; danach ruhen Simulation und Ballons

  /* Texturen */
  const baseCanvas = document.createElement('canvas');
  const baseCtx = baseCanvas.getContext('2d');
  const baseTex = new THREE.CanvasTexture(baseCanvas);
  baseTex.minFilter = THREE.LinearFilter; baseTex.magFilter = THREE.LinearFilter; baseTex.generateMipmaps = false;

  const mixMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_V, fragmentShader: MIX_F, depthTest: false, depthWrite: false,
    extensions: { derivatives: true },
    uniforms: {
      tDye: { value: fluid ? fluid.texture : null }, tBase: { value: baseTex }, tReveal: { value: null },
      uDyeTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) }, uThreshold: { value: 0.16 },
      uMaskOn: { value: 0 }, uRevealOn: { value: 0 }, uFill: { value: 0 },
      uSh: { value: new THREE.Vector4(0.5, 0.5, 0.2, 0.1) }, uShA: { value: 0 }, uAspect: { value: 1 },
    },
  });
  if (fluid) mixMat.uniforms.uDyeTexel.value.set(1 / fluid.dyeResolution, 1 / fluid.dyeResolution);
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mixMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  /* Buchstaben in die Basis-Textur zeichnen (pixelgenau dort, wo das SVG steht) */
  function drawBase() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = renderer.getPixelRatio();
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (baseCanvas.width !== cw || baseCanvas.height !== ch) {
      baseCanvas.width = cw; baseCanvas.height = ch;
      baseTex.dispose();   // neue Größe: Textur auf der Grafikkarte neu anlegen, sonst sitzen die Buchstaben verschoben
    }
    baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    baseCtx.fillStyle = '#fff';
    baseCtx.fillRect(0, 0, cw, ch);

    const sr = stage.getBoundingClientRect(), r = svg.getBoundingClientRect();
    const k = (r.width / WORDMARK.width);
    const letters = state.baked ? WORDMARK.letters : [];
    if (letters.length) {
      baseCtx.setTransform(k * dpr, 0, 0, k * dpr, (r.left - sr.left) * dpr, (r.top - sr.top) * dpr);
      baseCtx.fillStyle = '#000';
      letters.forEach((l) => baseCtx.fill(new Path2D(l.d)));
    }
    baseTex.needsUpdate = true;
  }

  /* Ballons genau auf die flachen Buchstaben legen (gleiche Lage wie in drawBase) */
  function layoutBalloons() {
    if (!balloons) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const sr = stage.getBoundingClientRect(), r = svg.getBoundingClientRect();
    balloons.layout(w, h, { left: r.left - sr.left, top: r.top - sr.top, width: r.width });
    const pr = Math.min(window.devicePixelRatio || 1, 2) * (mobile ? 0.5 : 1);
    revealRT.setSize(Math.max(2, Math.round(w * pr)), Math.max(2, Math.round(h * pr)));
  }

  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const dpr = renderer.getPixelRatio();
    camera.aspect = w / h; camera.updateProjectionMatrix();
    mixMat.uniforms.uAspect.value = w / h;
    if (fluid) fluid.setAspect(w / h);

    /* Chrom-O genau auf den (unsichtbaren) Buchstaben O setzen */
    const sr = stage.getBoundingClientRect(), g = ghost.getBoundingClientRect();
    box = { cx: g.left - sr.left + g.width / 2, cy: g.top - sr.top + g.height / 2, w: g.width, h: g.height };
    const ar = box.w / box.h;
    if (!mesh) { mesh = new THREE.Mesh(buildO(Number.isFinite(ar) && ar > 0 ? ar : oAspect()), foilMat); scene.add(mesh); }
    const wpp = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h;
    mesh.position.set((box.cx - w / 2) * wpp, -(box.cy - h / 2) * wpp, 0);
    baseScale = box.h * wpp;

    drawBase();
    layoutBalloons();
    if (!state.running) renderFrame(performance.now(), 0);
  }
  api.layout = layout;

  /* Nach dem Intro: Buchstaben wandern vom SVG in die Leinwand, das Wischen wird scharf */
  api.bake = () => {
    if (!fluid) return false;       // ohne Simulation bleiben die Buchstaben im SVG stehen
    state.baked = true;
    queueBalloons();
    drawBase();
    state.fluid = !!fluid;
    mixMat.uniforms.uMaskOn.value = fluid ? 1 : 0;
    if (!state.running) renderFrame(performance.now(), 0);
    return !!fluid;
  };
  api.fill = (v) => { mixMat.uniforms.uFill.value = v; if (!state.running) renderFrame(performance.now(), 0); };

  /* Zeiger */
  const ptr = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let last = null;
  const toUv = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
  };
  const onMove = (e) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1;
    if (!state.fluid) return;
    const p = toUv(e);
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) { last = null; return; }
    if (last) {
      const dx = p.x - last.x, dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.0004) {
        /* schnelle Bewegung: mehrere Tupfer auf der Strecke, damit die Spur nicht abreißt */
        const n = Math.min(8, Math.max(1, Math.ceil(dist / 0.02)));
        for (let i = 1; i <= n; i++) fluid.addSplat(last.x + (dx * i) / n, last.y + (dy * i) / n, dx / n, dy / n, 1.0);
        lastInk = performance.now();
      }
    }
    last = p;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerleave', () => { last = null; });
  stage.addEventListener('pointerdown', (e) => { last = toUv(e); }, { passive: true });

  let spin = null, seed = 0;
  api.crumpleAgain = () => { if (!spin) spin = { t: performance.now(), s0: seed }; };

  const T0 = performance.now();
  let lastT = T0, raf = 0;

  function renderFrame(now, dtRaw) {
    const t = (now - T0) / 1000;
    const dt = Math.min(dtRaw, 1 / 30);
    cur.x += (ptr.x - cur.x) * 0.07; cur.y += (ptr.y - cur.y) * 0.07;

    let spinA = 0, bump = 0;
    if (spin) {
      const k = clamp01((now - spin.t) / 1200), e = easeInOut(k);
      spinA = state.reduce ? 0 : e * Math.PI * 2;
      seed = spin.s0 + e;
      bump = Math.sin(Math.PI * k) * 0.8;
      if (k >= 1) spin = null;
    }
    U.uSeed.value = seed;
    U.uAmt.value = state.crumple * (1 + bump);

    const drift = state.reduce ? 0 : 1;
    const ry = cur.x * 0.6 * drift + Math.sin(t * 0.4) * 0.16 * drift + spinA;
    const rx = cur.y * 0.42 * drift + Math.cos(t * 0.31) * 0.05 * drift;
    if (mesh) { mesh.rotation.set(rx, ry, 0); mesh.scale.setScalar(baseScale * Math.max(state.scale, 0.001)); mesh.visible = state.scale > 0.001; }

    /* Tinte und Ballons nur rechnen, solange Tinte sichtbar sein kann (oder ?foil=1) */
    const fill = mixMat.uniforms.uFill.value > 0;
    const inked = fluid && state.fluid && now - lastInk < INK_LIFE;
    if (inked) { fluid.step(dt); mixMat.uniforms.tDye.value = fluid.texture; }
    mixMat.uniforms.uMaskOn.value = inked ? 1 : 0;
    if (balloons && (inked || fill)) {
      balloons.update(t, cur, state.reduce);
      renderer.setRenderTarget(revealRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(balloons.scene, balloons.camera);
      renderer.setClearColor(0xffffff, 1);
      mixMat.uniforms.uRevealOn.value = 1;
    } else {
      mixMat.uniforms.uRevealOn.value = 0;
    }

    if (box) {
      const w = stage.clientWidth, h = stage.clientHeight;
      mixMat.uniforms.uSh.value.set(
        (box.cx - cur.x * box.h * 0.12) / w,
        1 - (box.cy + box.h * 0.12 - cur.y * box.h * 0.06) / h,
        (box.w * 0.66) / h, (box.h * 0.58) / h);
      mixMat.uniforms.uShA.value = 0.1 * clamp01(state.scale);
    }

    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(quadScene, quadCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!state.running) return;
    const dt = (now - lastT) / 1000; lastT = now;
    renderFrame(now, dt);
    raf = requestAnimationFrame(loop);
  }
  api.start = () => {
    if (state.running) return;
    state.running = true; lastT = performance.now(); raf = requestAnimationFrame(loop);
  };
  api.stop = () => { state.running = false; cancelAnimationFrame(raf); };
  api.dispose = () => { api.stop(); if (fluid) fluid.dispose(); if (balloons) balloons.dispose(); if (revealRT) revealRT.dispose(); renderer.dispose(); };

  layout();
  let pending = false;
  new ResizeObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; layout(); }); }).observe(stage);
  return api;
}
