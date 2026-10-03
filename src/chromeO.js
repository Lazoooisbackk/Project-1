/*
  Das Chrom-O: Form, Spiegel-Umgebung und Folien-Material.
  Verwendet von der Bühne im Start-Bereich (heroStage.js) und vom kleinen Chrom-O (miniO.js).
*/
import * as THREE from 'three';
import { NOISE, CRUMPLE } from './shaders.js';

/* Schrift der Wortmarke: daran wird das Chrom-O ausgemessen (Hero, Intro, kleine Os) */
export const MARK_FONT = (px) => `700 ${px}px Geist`;

/* Das O der fetten Grotesk als Röhre: fast gleichmäßig dick, oben und unten eine Spur dünner */
export function buildO(aspect) {
  const segU = 320, segV = 64;
  const A = aspect / 2, B = 0.5;
  const rMax = 0.116, rMin = 0.102, stress = 0;
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

/* Seitenverhältnis (Breite / Höhe) des O der Wortmarke, wie im Hero gemessen */
export function oAspect() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = MARK_FONT(100);
  const m = ctx.measureText('O');
  const L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  return R > 0 && A > 0 ? (L + R) / (A + D) : 0.933;
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
