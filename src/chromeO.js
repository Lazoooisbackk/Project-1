/*
  Das Chrom-O und die transparente Hero-Fläche über dem Verlauf. Portiert aus der ursprünglichen
  Logo-Seite (index.html). Intro-Zustände (Skalierung, Knitter) werden von
  außen (Loader/Hero) über `state` gesteuert.
*/
import * as THREE from 'three';
import { NOISE, CRUMPLE, QUAD_V, SHADE_F } from './shaders.js';
import { content } from './content.js';
import { pad3 } from './utils/dom.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/* Serifen-O als Röhre: dicke Seiten, dünn oben und unten, leicht geneigte Achse */
export function buildO(aspect) {
  const segU = 320, segV = 64;
  const A = aspect / 2, B = 0.5;
  const rMax = 0.108, rMin = 0.044, stress = -0.22;
  const rt = (th) => rMin + (rMax - rMin) * Math.pow(Math.cos(th - stress), 2);
  const center = (th) => { const r = rt(th); return [(A - r) * Math.cos(th), (B - r) * Math.sin(th)]; };
  const pos = new Float32Array(segU * segV * 3), aT = new Float32Array(segU * segV);
  let k = 0;
  for (let i = 0; i < segU; i++) {
    const th = (i / segU) * Math.PI * 2;
    const c = center(th), c1 = center(th + 1e-3), c0 = center(th - 1e-3);
    let tx = c1[0] - c0[0], ty = c1[1] - c0[1];
    const len = Math.hypot(tx, ty); tx /= len; ty /= len;
    const nx = ty, ny = -tx, r = rt(th);
    for (let j = 0; j < segV; j++) {
      const ph = (j / segV) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
      pos[k * 3] = c[0] + r * cp * nx;
      pos[k * 3 + 1] = c[1] + r * cp * ny;
      pos[k * 3 + 2] = r * sp;
      aT[k] = r / rMax;
      k++;
    }
  }
  const idx = [];
  for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const a = i * segV + j, b = ((i + 1) % segU) * segV + j;
    const c = ((i + 1) % segU) * segV + (j + 1) % segV, d = i * segV + (j + 1) % segV;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* Seitenverhältnis (Breite / Höhe) des Newsreader-O, wie im Hero gemessen */
export function oAspect() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '500 100px Newsreader';
  const m = ctx.measureText('O');
  const L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  return R > 0 && A > 0 ? (L + R) / (A + D) : 0.75 / 0.715;
}

/* Studio für die Spiegelungen: dunkle Decke, heller Papierboden, Softboxen, ein kobaltblauer und ein warmer Streifen */
export function makeEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      float y=normalize(vP).y;
      vec3 top=vec3(0.035,0.036,0.045), hor=vec3(0.10,0.10,0.115), flo=vec3(0.62,0.60,0.57);
      vec3 c=y>0.0?mix(hor,top,pow(y,0.6)):mix(hor,flo,pow(-y,0.5));
      gl_FragColor=vec4(c,1.0); }`,
  })));
  const panel = (w, h, col, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(8, 3, [6, 6, 6], [0, 7, 4]);
  panel(1, 9, [5, 5, 5.2], [-8, 0, 3]);
  panel(1.2, 7, [0.6, 1.1, 5], [8, 1, -1]);
  panel(3, 2, [5, 2.4, 1.1], [3, 2, -8]);
  panel(2.4, 1.2, [1.4, 1.4, 1.4], [0, -2, 9]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}

/* Chromfolie: Physical-Material mit Knitter im Vertex-Shader. uniforms = { uAmt, uSeed } */
export function makeFoilMaterial(uniforms, opts = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.1, flatShading: true,
    iridescence: 0.5, iridescenceIOR: 1.45, iridescenceThicknessRange: [200, 560], envMapIntensity: 1.1,
    ...opts,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAmt = uniforms.uAmt; sh.uniforms.uSeed = uniforms.uSeed;
    sh.vertexShader = 'uniform float uAmt;\nuniform float uSeed;\nattribute float aT;\n' + NOISE + CRUMPLE + '\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += objectNormal * crumple(position) * mix(0.55, 1.0, aT);');
  };
  return mat;
}

/* Tinten-Effekt im Hero (Uniforms, 0..1): Farbton-Stärke der Perlmutt-Interferenz, Lichtstreifen,
   Glitzer-Dichte (1 = max. ca. 1,6 % der Fläche gleichzeitig), heller Rand und Glow der Tinte.
   Zur Laufzeit: hero.ink.uSparkle.value = 0.8 */
export const INK = { irid: 0.4, streak: 0.7, sparkle: 0.5, bloom: 0.8 };

export function createStage({ canvas, stage, mark, inner, ghost, bl, readout, hint }) {
  const state = {
    ok: false,
    scale: 0,        // 0..1, Skalierung des O (Intro)
    crumple: 0,      // 0..1, Knitterstärke (Intro)
    loaded: false,   // Readout zeigt Rotation statt "Laden"
    running: false,  // Render-Loop aktiv
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const api = { state, layout: () => {}, crumpleAgain: () => {}, start: () => {}, stop: () => {}, setFluid: () => {}, setVideo: () => {}, renderer: null, ink: null, dispose: () => {} };

  if (window.matchMedia('(pointer: coarse)').matches) hint.textContent = content.hero.hintTouch;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-gl');
    readout.textContent = content.hero.noGl;
    return api;
  }
  state.ok = true;
  api.renderer = renderer;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.environment = makeEnv(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.z = 10;

  const quad = new THREE.PlaneGeometry(2, 2), fsCam = new THREE.Camera();
  const shadeMat = new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: new THREE.Vector2() }, uSh: { value: new THREE.Vector4(0.5, 0.5, 0.2, 0.1) }, uShA: { value: 0 }, uAspect: { value: 1 },
      tMask: { value: null }, uMaskOn: { value: 0 }, tVideo: { value: null }, uVideoOn: { value: 0 }, uVideoFit: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
      uIrid: { value: INK.irid }, uStreak: { value: INK.streak }, uSparkle: { value: INK.sparkle }, uBloom: { value: INK.bloom }, uDpr: { value: 1 },
    },
    vertexShader: QUAD_V, fragmentShader: SHADE_F, depthTest: false, depthWrite: false,
  });
  const { uIrid, uStreak, uSparkle, uBloom } = shadeMat.uniforms;
  api.ink = { uIrid, uStreak, uSparkle, uBloom };
  const bgScene = new THREE.Scene();
  const bq = new THREE.Mesh(quad, shadeMat);
  bq.frustumCulled = false;
  bgScene.add(bq);

  const U = { uAmt: { value: 0 }, uSeed: { value: 0 } };
  const mat = makeFoilMaterial(U);

  let mesh = null, box = null, baseScale = 1;
  const mctx = document.createElement('canvas').getContext('2d');

  function fitMark() {
    mark.style.fontSize = '100px';
    const w100 = inner.offsetWidth;
    const fs = Math.min((mark.clientWidth / w100) * 100 * 0.995, innerHeight * 0.3);
    mark.style.fontSize = fs.toFixed(2) + 'px';
    return fs;
  }
  const off = (el) => { let x = 0, y = 0; for (let n = el; n && n !== stage; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return { x, y }; };
  function glyphBox(fs) {
    mctx.font = `500 ${fs}px Newsreader`;
    const m = mctx.measureText('O');
    let L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
    if (!(R > 0 && A > 0)) { L = -0.03 * fs; R = 0.72 * fs; A = 0.7 * fs; D = 0.015 * fs; }
    const o = off(ghost), base = off(bl).y;
    return { cx: o.x + (R - L) / 2, cy: base - (A - D) / 2, w: L + R, h: A + D };
  }

  let fluid = null, video = null;
  api.setFluid = (f) => { fluid = f; shadeMat.uniforms.uMaskOn.value = f ? 1 : 0; if (f) shadeMat.uniforms.tMask.value = f.texture; };
  api.setVideo = (videoEl) => {
    if (!videoEl) { shadeMat.uniforms.uVideoOn.value = 0; video = null; return; }
    video = videoEl;
    const tex = new THREE.VideoTexture(videoEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    shadeMat.uniforms.tVideo.value = tex;
    shadeMat.uniforms.uVideoOn.value = 1;
    fitVideo();
  };
  function fitVideo() {
    if (!video || !video.videoWidth) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    const va = video.videoWidth / video.videoHeight, sa = w / h;
    /* cover: Skalierung der UV, damit das Video den Stage-Bereich füllt */
    if (sa > va) shadeMat.uniforms.uVideoFit.value.set(1, va / sa);
    else shadeMat.uniforms.uVideoFit.value.set(sa / va, 1);
  }

  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    shadeMat.uniforms.uAspect.value = w / h;
    shadeMat.uniforms.uDpr.value = renderer.getPixelRatio();
    const fs = fitMark();
    box = glyphBox(fs);
    if (!mesh) { mesh = new THREE.Mesh(buildO(box.w / box.h), mat); scene.add(mesh); }
    const wpp = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h;
    mesh.position.set((box.cx - w / 2) * wpp, -(box.cy - h / 2) * wpp, 0);
    baseScale = box.h * wpp;
    if (fluid) fluid.resize(w, h);
    fitVideo();
    if (!state.running) renderFrame(performance.now(), 0);
  }
  api.layout = layout;

  const ptr = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  let spin = null, seed = 0;
  const crumpleAgain = () => { if (!spin) spin = { t: performance.now(), s0: seed }; };
  api.crumpleAgain = crumpleAgain;
  stage.addEventListener('click', crumpleAgain);
  addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && (e.target === document.body || stage.contains(e.target))) { e.preventDefault(); crumpleAgain(); }
  });

  const deg = (r) => { let d = THREE.MathUtils.radToDeg(r); d = ((d % 360) + 540) % 360 - 180; return (d < 0 ? '−' : '+') + Math.abs(d).toFixed(1).padStart(5, '0') + '°'; };
  const T0 = performance.now();
  let last = T0, raf = 0;

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
    const ry = cur.x * 0.6 + Math.sin(t * 0.4) * 0.16 * drift + spinA;
    const rx = cur.y * 0.42 + Math.cos(t * 0.31) * 0.05 * drift;
    if (mesh) { mesh.rotation.set(rx, ry, 0); mesh.scale.setScalar(baseScale * Math.max(state.scale, 0.001)); mesh.visible = state.scale > 0.001; }

    shadeMat.uniforms.uLight.value.set(cur.x, -cur.y);
    shadeMat.uniforms.uTime.value = t;
    if (box) {
      const w = stage.clientWidth, h = stage.clientHeight;
      shadeMat.uniforms.uSh.value.set(
        (box.cx - cur.x * box.h * 0.12) / w,
        1 - (box.cy + box.h * 0.1 - cur.y * box.h * 0.06) / h,
        (box.w * 0.62) / h, (box.h * 0.56) / h);
      shadeMat.uniforms.uShA.value = 0.09 * clamp01(state.scale);
    }

    readout.textContent = state.loaded
      ? `X ${deg(rx)}  Y ${deg(ry)}  Knitter ${U.uAmt.value.toFixed(2)}`
      : `${content.hero.loading} ${pad3(state.progress || 0)}`;

    if (fluid) { fluid.step(dt); shadeMat.uniforms.tMask.value = fluid.texture; }

    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(bgScene, fsCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!state.running) return;
    const dt = (now - last) / 1000; last = now;
    renderFrame(now, dt);
    raf = requestAnimationFrame(loop);
  }
  api.start = () => { if (state.running) return; state.running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  api.stop = () => { state.running = false; cancelAnimationFrame(raf); };
  api.dispose = () => { api.stop(); renderer.dispose(); };

  layout();
  let pending = false;
  new ResizeObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; layout(); }); }).observe(stage);
  return api;
}
