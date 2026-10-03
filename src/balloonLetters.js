/*
  Ballon-Buchstaben für den Wisch-Effekt im Start-Bereich.
  Jeder Buchstabe von „guskic studi“ ist ein eigenes 3D-Objekt, aufgeblasen wie ein Folien-Ballon:
  1. Der SVG-Pfad wird gerastert, daraus entsteht ein Distanzfeld (Abstand zum Umriss).
  2. Ein feines Gitter wird über das Distanzfeld zu einer runden Röhre hochgewölbt
     (Querschnitt fast ein Kreis), vorn und hinten, am Rand eine schmale gepresste Naht.
  3. Im Vertex-Shader knittert die Folie an der Naht, auf der Wölbung kaum.
  Die Szene wird mit einer orthografischen Kamera in CSS-Pixeln gezeichnet, damit jeder Ballon
  genau auf seinem flachen Buchstaben sitzt.
  (ExtrudeGeometry mit großer Fase wurde probiert: sie ergibt gehrte, geschliffene Kanten statt runder Ballons.)
*/
import * as THREE from 'three';
import { NOISE } from './shaders.js';
import { WORDMARK } from './wordmark.js';

/* Form der Ballons (Einheiten der Wortmarke; ein Grundstrich von Geist Bold ist ca. 150 breit) */
export const BALLOON = {
  stroke: 150,          // Strichstärke
  bulge: 20,            // so weit wölbt sich der Ballon über den Umriss hinaus (≈ 13 % der Strichstärke)
  seam: 9,              // Breite der gepressten Naht am Rand
  puff: 0.22,           // breite Stellen (Kreuzungen) wölben sich etwas weiter
  step: 6,              // Gitterabstand der Oberfläche
  raster: 2,            // Einheiten pro Pixel im Distanzfeld
  soften: 12,           // Rundung der Ecken (Weichzeichner des Distanzfelds)
  dome: 34,             // Glättung der Wölbung im Inneren
  wrinkle: 5,           // Stärke der Knitter an der Naht
  color: 0xe9e6e3,      // Perlweiße Folie, schillert (Dünnfilm) wie das Chrom-O
  metalness: 0.45,
  roughness: 0.17,
  iridescence: 0.9,
  envMapIntensity: 1.3,
};

const rnd = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

/* Euklidische Distanztransformation (Felzenszwalb & Huttenlocher), quadrierte Abstände in Pixeln */
function edt(grid, w, h) {
  const INF = 1e20, n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (len) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    pass(h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}

/* Kasten-Weichzeichner, zweimal (≈ Dreiecksfilter) */
function blur(src, w, h, rad) {
  let a = src, b = new Float32Array(w * h);
  for (let p = 0; p < 2; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -rad; x <= rad; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * rad + 1);
        acc += a[y * w + Math.min(w - 1, x + rad + 1)] - a[y * w + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * rad + 1);
        acc += b[Math.min(h - 1, y + rad + 1) * w + x] - b[Math.max(0, y - rad) * w + x];
      }
    }
  }
  return a;
}

/* Vorzeichenbehafteter Abstand zum Umriss (innen positiv), in Einheiten der Wortmarke */
function distanceField(d, box, pad) {
  const B = BALLOON, r = B.raster;
  const w = Math.ceil((box.w + 2 * pad) / r), h = Math.ceil((box.h + 2 * pad) / r);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1 / r, 0, 0, 1 / r, (pad - box.x) / r, (pad - box.y) / r);
  ctx.fill(new Path2D(d));
  const a = ctx.getImageData(0, 0, w, h).data;
  const INF = 1e20, inG = new Float64Array(w * h), outG = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const inside = a[i * 4 + 3] > 127;
    inG[i] = inside ? INF : 0;     // Abstand innen zum nächsten Außenpixel
    outG[i] = inside ? 0 : INF;    // Abstand außen zum nächsten Innenpixel
  }
  edt(inG, w, h); edt(outG, w, h);
  let sdf = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) sdf[i] = (inG[i] > 0 ? Math.sqrt(inG[i]) - 0.5 : -(Math.sqrt(outG[i]) - 0.5)) * r;
  /* Umriss: leicht weichgezeichnet (runde Ecken). Höhe: stärker weichgezeichnet, damit auf der
     Mittellinie der Striche und an Kreuzungen keine Grate entstehen */
  const smooth = blur(sdf.slice(), w, h, Math.max(1, Math.round(B.dome / r)));
  sdf = blur(sdf, w, h, Math.max(1, Math.round(B.soften / r)));
  const ox = box.x - pad, oy = box.y - pad;
  /* bilinear abtasten; x, y in Einheiten der Wortmarke */
  const sampler = (f) => (x, y) => {
    let fx = (x - ox) / r - 0.5, fy = (y - oy) / r - 0.5;
    fx = Math.min(w - 1.001, Math.max(0, fx)); fy = Math.min(h - 1.001, Math.max(0, fy));
    const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * w + x0;
    return (f[i] * (1 - tx) + f[i + 1] * tx) * (1 - ty) + (f[i + w] * (1 - tx) + f[i + w + 1] * tx) * ty;
  };
  return { edge: sampler(sdf), dome: sampler(smooth) };
}

/* Höhe der Ballonhaut über dem Abstand S zum aufgeblasenen Umriss, dazu die Steigung dh/dS */
function profile(S) {
  const B = BALLOON;
  const Rb = B.stroke / 2 + B.bulge - B.seam;
  if (S <= 0) return [0, 30];
  if (S < B.seam) return [1.5 * (S / B.seam), 1.5 / B.seam];
  const x = (S - B.seam) / Rb;
  if (x >= 1) return [1.5 + Rb + (S - B.seam - Rb) * B.puff, B.puff];
  const c = Math.sqrt(1 - (1 - x) * (1 - x));
  return [1.5 + Rb * c, Math.min(30, (1 - x) / Math.max(c, 1e-3))];
}

function letterGeometry(letter, seed) {
  const B = BALLOON, box = letter.box, pad = B.bulge + B.dome * 2 + 3 * B.step;
  const field = distanceField(letter.d, box, pad);
  const R = B.stroke / 2 + B.bulge;
  const S = (x, y) => field.edge(x, y) + B.bulge;
  /* am Rand der genaue Abstand, nach innen hin der geglättete */
  const Sh = (x, y) => {
    const a = S(x, y);
    if (a <= 0) return a;
    const k = Math.min(1, Math.max(0, (a - 0.25 * R) / (0.55 * R)));
    const t = k * k * (3 - 2 * k);
    return a + (field.dome(x, y) + B.bulge - a) * t;
  };
  const H = (x, y) => profile(Sh(x, y))[0];
  const x0 = box.x - pad, y0 = box.y - pad;
  const nx = Math.ceil((box.w + 2 * pad) / B.step) + 1, ny = Math.ceil((box.h + 2 * pad) / B.step) + 1;
  const val = new Float32Array(nx * ny), hg = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * B.step, y = y0 + j * B.step, id = j * nx + i;
    val[id] = S(x, y);
    hg[id] = val[id] > 0 ? H(x, y) : 0;
  }

  /* Gitterpunkte, die gebraucht werden: alles innen, dazu außen liegende Nachbarn (die auf den Umriss rutschen) */
  const index = new Int32Array(nx * ny).fill(-1);
  const pos = [], nor = [], seamA = [];
  const tris = [];
  const n = new THREE.Vector3();
  const vertex = (i, j) => {
    const id = j * nx + i;
    if (index[id] >= 0) return index[id];
    let x = x0 + i * B.step, y = y0 + j * B.step, s = val[id], h;
    if (s <= 0) {
      /* außen: entlang des Gefälles genau auf den Umriss schieben; die Haut steht dort senkrecht */
      const e = 0.75;
      let gx = (S(x + e, y) - S(x - e, y)) / (2 * e), gy = (S(x, y + e) - S(x, y - e)) / (2 * e);
      const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
      const m = Math.min(-s, B.step * 1.5);
      x += gx * m; y += gy * m;
      s = 0; h = 0;
      n.set(-30 * gx, -30 * gy, 1).normalize();
    } else {
      h = hg[id];
      const L = i > 0 ? hg[id - 1] : 0, Rr = i < nx - 1 ? hg[id + 1] : 0;
      const U = j > 0 ? hg[id - nx] : 0, D = j < ny - 1 ? hg[id + nx] : 0;
      n.set(-(Rr - L) / (2 * B.step), -(D - U) / (2 * B.step), 1).normalize();
    }
    index[id] = pos.length / 3;
    pos.push(x, y, h);
    nor.push(n.x, n.y, n.z);
    seamA.push(1 - Math.min(1, s / (B.stroke * 0.32)));
    return index[id];
  };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    const ins = (k) => val[k] > 0;
    if (ins(a) || ins(b) || ins(d)) tris.push(vertex(i, j), vertex(i + 1, j), vertex(i + 1, j + 1));
    if (ins(a) || ins(d) || ins(c)) tris.push(vertex(i, j), vertex(i + 1, j + 1), vertex(i, j + 1));
  }
  /* Rückseite: gespiegelt, Dreiecke umgedreht */
  const nf = pos.length / 3;
  for (let k = 0; k < nf; k++) {
    pos.push(pos[k * 3], pos[k * 3 + 1], -pos[k * 3 + 2]);
    nor.push(nor[k * 3], nor[k * 3 + 1], -nor[k * 3 + 2]);
    seamA.push(seamA[k]);
  }
  const tf = tris.length;
  for (let t = 0; t < tf; t += 3) tris.push(tris[t] + nf, tris[t + 2] + nf, tris[t + 1] + nf);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aSeam', new THREE.Float32BufferAttribute(seamA, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(pos.length / 3).fill(seed), 1));
  g.setIndex(tris);
  const c = new THREE.Vector3(box.x + box.w / 2, box.y + box.h / 2, 0);
  g.translate(-c.x, -c.y, 0);
  g.computeBoundingSphere();
  return { geometry: g, center: c };
}

/* Eigenes Fotostudio für die Ballons: fast schwarz, dazu harte, helle Softboxen.
   So entstehen klare Glanzlichter und dunkle Spiegelungen wie bei polierter Folie. */
function makeBalloonEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      float y=normalize(vP).y;
      /* heller Raum, damit die weiße Folie weiß bleibt; oben dunkler für Kontrast in den Spiegelungen */
      vec3 c=y>0.0?mix(vec3(0.22,0.21,0.24),vec3(0.05,0.05,0.07),pow(y,0.6)):mix(vec3(0.22,0.21,0.24),vec3(0.46,0.44,0.44),pow(-y,0.6));
      gl_FragColor=vec4(c,1.0); }`,
  })));
  const panel = (w, h, col, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(11, 2.2, [8, 8, 8], [0, 3.4, 8.6]);    // breite Softbox vorn oben: Glanzband auf den waagrechten Bögen
  panel(0.55, 9, [7, 7, 7], [-2.2, 0, 9.4]);  // zwei schmale Lichtstreifen neben der Kamera:
  panel(0.4, 9, [4, 4, 4.3], [2.6, 0, 9.4]);  // senkrechte Glanzlinien auf den Stämmen
  panel(9, 0.6, [3.5, 3.5, 3.6], [0.5, -2.8, 9]);  // schmaler Streifen vorn unten
  panel(1.1, 7, [7, 7, 7.4], [-8, 0.5, 4]);    // Streifen links
  panel(1.0, 6, [4.5, 5, 6], [8, 1, 3]);       // kühler Streifen rechts
  panel(2, 2, [3, 1.6, 0.9], [4, 3, -8]);      // warmer Rücken
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.01).texture;
  pm.dispose();
  return tex;
}

function makeMaterial(env) {
  const B = BALLOON;
  const mat = new THREE.MeshPhysicalMaterial({
    color: B.color, metalness: B.metalness, roughness: B.roughness,
    clearcoat: 1, clearcoatRoughness: 0.08,
    iridescence: B.iridescence, iridescenceIOR: 1.4, iridescenceThicknessRange: [220, 620],
    envMap: env, envMapIntensity: B.envMapIntensity,
  });
  const uniforms = { uWrinkle: { value: B.wrinkle } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = `uniform float uWrinkle;\nattribute float aSeed;\nattribute float aSeam;\n${NOISE}
float wrinkleAt(vec3 p){
  vec3 q = p * 0.014 + vec3(aSeed * 7.1, aSeed * 3.3, aSeed * 5.7);
  float n = (1.0 - abs(snoise(q))) * 0.6 + (1.0 - abs(snoise(q * 2.3 + 9.1))) * 0.4;
  return n - 0.6;
}
` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  /* An der Naht knittert die Folie am stärksten, auf der Wölbung kaum */
  float wAmp = uWrinkle * (0.12 + 0.88 * aSeam * aSeam);
  vec3 wn = normalize(objectNormal);
  vec3 wt1 = normalize(abs(wn.z) < 0.9 ? cross(wn, vec3(0.0, 0.0, 1.0)) : cross(wn, vec3(1.0, 0.0, 0.0)));
  vec3 wt2 = cross(wn, wt1);
  float wf0 = wrinkleAt(position);
  float wf1 = wrinkleAt(position + wt1 * 4.0);
  float wf2 = wrinkleAt(position + wt2 * 4.0);
  objectNormal = normalize(wn - (wt1 * (wf1 - wf0) + wt2 * (wf2 - wf0)) * wAmp * 0.5 / 4.0);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  transformed += wn * wf0 * wAmp;`);
    /* Die Ballons landen in einem Render-Target: Tonwerte (ACES) und sRGB hier selbst anwenden,
       dann reicht ein 8-Bit-Ziel und der Misch-Shader übernimmt die Farben direkt */
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
  vec3 bc = gl_FragColor.rgb;
  bc = clamp((bc * (2.51 * bc + 0.03)) / (bc * (2.43 * bc + 0.59) + 0.14), 0.0, 1.0);
  gl_FragColor.rgb = mix(bc * 12.92, 1.055 * pow(bc, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, bc));`);
  };
  return mat;
}

export async function createBalloonLetters(renderer, { seed = 11 } = {}) {
  const scene = new THREE.Scene();
  const env = makeBalloonEnv(renderer);
  scene.environment = env;
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
  const material = makeMaterial(env);
  const r = rnd(seed);
  const deg = THREE.MathUtils.degToRad;

  /* Buchstabe für Buchstabe bauen, mit Pausen dazwischen, damit die Seite flüssig bleibt */
  const idle = () => new Promise((res) => (window.requestIdleCallback ? requestIdleCallback(res, { timeout: 300 }) : setTimeout(res, 16)));
  const letters = [];
  for (let i = 0; i < WORDMARK.letters.length; i++) {
    await idle();
    const { geometry, center } = letterGeometry(WORDMARK.letters[i], i + 1);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    letters.push({
      mesh, center,
      rx: deg((r() * 2 - 1) * 7), ry: deg((r() * 2 - 1) * 7), rz: deg((r() * 2 - 1) * 4),
      scale: 1.04 + r() * 0.1, z: (i % 2 ? 1 : -1) * 160 + (r() * 2 - 1) * 30,
      phase: r() * Math.PI * 2, speed: 0.35 + r() * 0.3,
    });
  }

  /* Federn: jeder Ballon hat eine eigene kleine Auslenkung (Kippen, Drehen, Wippen), die der Zeiger anstößt */
  letters.forEach((L) => { L.sx = 0; L.sy = 0; L.sz = 0; L.vx = 0; L.vy = 0; L.vz = 0; L.bob = 0; L.vb = 0; L.px = 0; L.py = 0; L.ph = 0; });

  let k = 1;
  /* mark: Lage der SVG-Wortmarke in der Bühne (CSS-Pixel); rect: Ausschnitt, den die Kamera zeigt */
  function layout(mark, rect) {
    camera.left = rect.x; camera.right = rect.x + rect.w; camera.top = -rect.y; camera.bottom = -(rect.y + rect.h);
    camera.updateProjectionMatrix();
    k = mark.width / WORDMARK.width;
    letters.forEach((L) => {
      L.px = mark.left + L.center.x * k;
      L.py = mark.top + L.center.y * k;
      L.ph = WORDMARK.height * k;
      L.mesh.position.set(L.px, -L.py, L.z * k);
      L.mesh.scale.set(k * L.scale, -k * L.scale, k * L.scale);
    });
  }

  /* Zeiger bei x, y (Pixel der Bühne), Bewegung dx, dy seit dem letzten Ereignis */
  function poke(x, y, dx, dy) {
    letters.forEach((L) => {
      const r = L.ph * 0.75;
      const d = Math.hypot(x - L.px, y - L.py);
      if (d > r) return;
      const f = Math.pow(1 - d / r, 2) / Math.max(L.ph, 1);
      L.vy += dx * f * 2.2;           // seitlich gewischt: der Ballon dreht sich weg
      L.vx += dy * f * 2.2;           // von oben/unten: er kippt
      L.vz += (dx * (y - L.py) - dy * (x - L.px)) * f * 0.006;
      L.vb += Math.hypot(dx, dy) * f * 18;
    });
  }

  /* t, dt in Sekunden, ptr in -1..1: langsames Wackeln, Federn, der Zeiger dreht leicht mit (die Glanzlichter wandern) */
  function update(t, dt, ptr, still = false) {
    const h = Math.min(Math.max(dt, 0), 1 / 30);
    letters.forEach((L) => {
      if (!still && h > 0) {
        /* gedämpfte Feder: weich wie ein Folienballon, schwingt zwei-, dreimal nach */
        const K = 38, C = 4.2;
        L.vx += (-K * L.sx - C * L.vx) * h; L.sx += L.vx * h;
        L.vy += (-K * L.sy - C * L.vy) * h; L.sy += L.vy * h;
        L.vz += (-K * L.sz - C * L.vz) * h; L.sz += L.vz * h;
        L.vb += (-K * L.bob - C * L.vb) * h; L.bob += L.vb * h;
        L.sx = Math.max(-0.6, Math.min(0.6, L.sx)); L.sy = Math.max(-0.7, Math.min(0.7, L.sy));
        L.sz = Math.max(-0.35, Math.min(0.35, L.sz)); L.bob = Math.max(-0.12, Math.min(0.12, L.bob));
      }
      const a = still ? 0 : t * L.speed + L.phase;
      L.mesh.rotation.set(
        L.rx + Math.sin(a) * 0.035 + ptr.y * 0.16 + L.sx,
        L.ry + Math.cos(a * 0.8) * 0.045 + ptr.x * 0.22 + L.sy,
        L.rz + Math.sin(a * 0.6 + 1.3) * 0.02 + L.sz,
      );
      const s = k * L.scale * (1 + L.bob);
      L.mesh.scale.set(s, -s, s);
      L.mesh.position.y = -L.py + Math.sin(a * 0.9) * L.ph * 0.006;
    });
  }

  return {
    scene, camera, layout, update, poke,
    dispose() { letters.forEach((L) => L.mesh.geometry.dispose()); material.dispose(); env.dispose(); },
  };
}
