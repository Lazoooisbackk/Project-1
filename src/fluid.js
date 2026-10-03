/*
  Flüssigkeits-Simulation (Stable Fluids) für den Wisch-Effekt im Start-Bereich.
  Geschwindigkeit, Druck und „Tinte“ liegen in Render-Targets; die Tinte dient danach als Maske.
  Eigene Umsetzung mit three.js: Advektion, Divergenz, Druck (Jacobi), Gradient abziehen.

  Pinsel: Der Zeiger malt pro Bild einen Linienzug (bis zu 32 Teilstrecken) in EINEM Durchgang.
  Jede Teilstrecke ist eine Kapsel, nicht ein Tupfer: so bleibt der Strich auch bei schnellen
  Bewegungen glatt und gleich dick, ohne Perlen und ohne Ruckeln.
  Die Gitter haben das Seitenverhältnis der Fläche (kurze Seite = Auflösung), damit die Strömung
  nicht verzerrt und die Kante nicht treppig wird. Eine leichte Oberflächenspannung rundet die Kante.
*/
import * as THREE from 'three';

export const MAX_SEGMENTS = 32;

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const ADVECT = `precision highp float; varying vec2 vUv;
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uTexel; uniform float uDt; uniform float uDissipation;
void main(){
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
  gl_FragColor = uDissipation * texture2D(uSource, coord);
}`;

/* Tinte: wie oben, dazu ein Hauch Oberflächenspannung (Mittelwert der Nachbarn), der zackige Ränder rundet */
const ADVECT_DYE = `precision highp float; varying vec2 vUv;
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uTexel; uniform vec2 uDyeTexel;
uniform float uDt; uniform float uDissipation; uniform float uTension;
void main(){
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
  float c = texture2D(uSource, coord).r;
  float n = texture2D(uSource, coord + vec2(uDyeTexel.x, 0.0)).r + texture2D(uSource, coord - vec2(uDyeTexel.x, 0.0)).r
          + texture2D(uSource, coord + vec2(0.0, uDyeTexel.y)).r + texture2D(uSource, coord - vec2(0.0, uDyeTexel.y)).r;
  float v = mix(c, n * 0.25, uTension) * uDissipation;
  gl_FragColor = vec4(v, v, v, 1.0);
}`;

/* Linienzug als Kapseln: Abstand jedes Pixels zur nächsten Teilstrecke (Seitenverhältnis berücksichtigt).
   Gibt nur den Beitrag aus; das Mischen macht die Grafikkarte (Tinte: Maximum, Geschwindigkeit: Addition),
   und gezeichnet wird nur im Rechteck um den Strich. */
const STROKE = `precision highp float; varying vec2 vUv;
#define MAXS ${MAX_SEGMENTS}
uniform vec4 uSeg[MAXS];     // Anfang (xy) und Ende (zw) in 0..1
uniform vec2 uVel[MAXS];     // Schub der Teilstrecke
uniform int uCount;
uniform float uAspect;
uniform float uRadius;
uniform float uAmount;       // > 0: Tinte (Höhe), sonst Geschwindigkeit
uniform float uForce;
void main(){
  vec2 p = vUv; p.x *= uAspect;
  float best = 0.0; vec2 vel = vec2(0.0);
  for (int i = 0; i < MAXS; i++) {
    if (i >= uCount) break;
    vec2 a = uSeg[i].xy, b = uSeg[i].zw;
    a.x *= uAspect; b.x *= uAspect;
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
    vec2 d = p - (a + ab * t);
    float w = exp(-dot(d, d) / uRadius);
    if (w > best) { best = w; vel = uVel[i]; }
  }
  if (uAmount > 0.0) gl_FragColor = vec4(vec3(best * uAmount), 1.0);
  else gl_FragColor = vec4(vel * uForce * best, 0.0, 0.0);
}`;

const DIVERGENCE = `precision highp float; varying vec2 vUv;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  vec2 C = texture2D(uVelocity, vUv).xy;
  float L = texture2D(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture2D(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture2D(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  float B = texture2D(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  if (vUv.x - uTexel.x < 0.0) L = -C.x;
  if (vUv.x + uTexel.x > 1.0) R = -C.x;
  if (vUv.y + uTexel.y > 1.0) T = -C.y;
  if (vUv.y - uTexel.y < 0.0) B = -C.y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const PRESSURE = `precision highp float; varying vec2 vUv;
uniform sampler2D uPressure; uniform sampler2D uDivergence; uniform vec2 uTexel;
void main(){
  float L = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = `precision highp float; varying vec2 vUv;
uniform sampler2D uPressure; uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(v, 0.0, 1.0);
}`;

const CLEAR = `precision highp float; varying vec2 vUv;
uniform sampler2D uTexture; uniform float uValue;
void main(){ gl_FragColor = uValue * texture2D(uTexture, vUv); }`;

export const FLUID_DEFAULTS = {
  simResolution: 256,           // kurze Seite des Strömungsgitters
  dyeResolution: 1024,          // kurze Seite der Tinte: feine, glatte Kante
  velocityDissipation: 0.962,   // pro Bild bei 60 fps
  dyeDissipation: 0.986,
  dyeCap: 1.5,                  // höchste Tintenmenge an einer Stelle
  tension: 0.18,                // Oberflächenspannung: rundet die Kante, glättet Zacken
  pressureIterations: 20,
  splatRadius: 0.0095,          // dicker Pinsel: ein Strich ist bei 1440 px Breite ca. 250–350 px breit
  velocityRadius: 0.0016,       // Schub nur in der Mitte des Strichs: die Fläche fließt etwas, zerreißt aber nicht
  splatForce: 5900,
};

/* Kann der Browser in Halb-Float-Texturen zeichnen? Ohne das gibt es keinen Effekt. */
export function fluidSupported(renderer) {
  const gl = renderer.getContext();
  if (renderer.capabilities.isWebGL2) return !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  return false;
}

export function createFluid(renderer, options = {}) {
  const o = { ...FLUID_DEFAULTS, ...options };
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quad.frustumCulled = false;
  scene.add(quad);

  const rt = (w, h, filter) => new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: filter, magFilter: filter,
    depthBuffer: false, stencilBuffer: false,
  });
  const double = (w, h, filter) => ({
    read: rt(w, h, filter), write: rt(w, h, filter),
    swap() { const t = this.read; this.read = this.write; this.write = t; },
    dispose() { this.read.dispose(); this.write.dispose(); },
  });

  const simTexel = new THREE.Vector2(), dyeTexel = new THREE.Vector2();
  let velocity, pressure, dye, divergence;
  let aspect = 0;

  /* Gitter mit dem Seitenverhältnis der Fläche anlegen (neu bei Größenänderung) */
  const size = (res, a) => (a >= 1 ? [Math.round(res * a), res] : [res, Math.round(res / a)]);
  function allocate(a) {
    [velocity, pressure, dye, divergence].forEach((t) => t && t.dispose());
    const [sw, sh] = size(o.simResolution, a), [dw, dh] = size(o.dyeResolution, a);
    velocity = double(sw, sh, THREE.LinearFilter);
    pressure = double(sw, sh, THREE.NearestFilter);
    dye = double(dw, dh, THREE.LinearFilter);
    divergence = rt(sw, sh, THREE.NearestFilter);
    simTexel.set(1 / sw, 1 / sh);
    dyeTexel.set(1 / dw, 1 / dh);
  }
  allocate(1);

  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const advect = mat(ADVECT, { uVelocity: { value: null }, uSource: { value: null }, uTexel: { value: simTexel }, uDt: { value: 0 }, uDissipation: { value: 1 } });
  const advectDye = mat(ADVECT_DYE, {
    uVelocity: { value: null }, uSource: { value: null }, uTexel: { value: simTexel }, uDyeTexel: { value: dyeTexel },
    uDt: { value: 0 }, uDissipation: { value: 1 }, uTension: { value: o.tension },
  });
  const segs = Array.from({ length: MAX_SEGMENTS }, () => new THREE.Vector4());
  const vels = Array.from({ length: MAX_SEGMENTS }, () => new THREE.Vector2());
  const stroke = mat(STROKE, {
    uSeg: { value: segs }, uVel: { value: vels }, uCount: { value: 0 },
    uAspect: { value: 1 }, uRadius: { value: o.splatRadius }, uAmount: { value: 1 }, uForce: { value: o.splatForce },
  });
  stroke.blending = THREE.CustomBlending;
  stroke.blendSrc = THREE.OneFactor; stroke.blendDst = THREE.OneFactor;
  stroke.blendSrcAlpha = THREE.OneFactor; stroke.blendDstAlpha = THREE.OneFactor;
  stroke.transparent = true;
  const diverge = mat(DIVERGENCE, { uVelocity: { value: null }, uTexel: { value: simTexel } });
  const press = mat(PRESSURE, { uPressure: { value: null }, uDivergence: { value: null }, uTexel: { value: simTexel } });
  const gradient = mat(GRADIENT, { uPressure: { value: null }, uVelocity: { value: null }, uTexel: { value: simTexel } });
  const clear = mat(CLEAR, { uTexture: { value: null }, uValue: { value: 0.8 } });

  const pass = (material, target) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };

  /* Teilstrecken dieses Bilds: ax, ay → bx, by in 0..1 (y nach oben) */
  const pending = [];
  function addSegment(ax, ay, bx, by) {
    if (pending.length >= MAX_SEGMENTS) {
      /* zu viele: die letzte Strecke verlängern statt etwas zu verlieren */
      const l = pending[pending.length - 1];
      l[2] = bx; l[3] = by;
      return;
    }
    pending.push([ax, ay, bx, by]);
  }

  /* Rechteck um den Strich (in Pixeln des Ziels), Rand = Reichweite des Pinsels */
  function scissor(target, bb, radius) {
    const reach = Math.sqrt(radius * 6);                     // bis exp(-6): unsichtbar
    const rx = reach / (aspect || 1), ry = reach;
    const w = target.width, h = target.height;
    const x0 = Math.max(0, Math.floor((bb[0] - rx) * w)), y0 = Math.max(0, Math.floor((bb[1] - ry) * h));
    const x1 = Math.min(w, Math.ceil((bb[2] + rx) * w)), y1 = Math.min(h, Math.ceil((bb[3] + ry) * h));
    if (x1 <= x0 || y1 <= y0) return false;
    target.scissor.set(x0, y0, x1 - x0, y1 - y0);
    target.scissorTest = true;
    return true;
  }

  function applyStroke() {
    if (!pending.length) return;
    const n = pending.length;
    /* Schub: Richtung der Teilstrecke, Stärke = ganzer Weg des Zeigers in diesem Bild */
    let total = 0;
    const bb = [1, 1, 0, 0];
    for (let i = 0; i < n; i++) {
      const s = pending[i];
      total += Math.hypot(s[2] - s[0], s[3] - s[1]);
      bb[0] = Math.min(bb[0], s[0], s[2]); bb[1] = Math.min(bb[1], s[1], s[3]);
      bb[2] = Math.max(bb[2], s[0], s[2]); bb[3] = Math.max(bb[3], s[1], s[3]);
    }
    for (let i = 0; i < n; i++) {
      const s = pending[i];
      const dx = s[2] - s[0], dy = s[3] - s[1], l = Math.hypot(dx, dy) || 1;
      segs[i].set(s[0], s[1], s[2], s[3]);
      vels[i].set((dx / l) * total, (dy / l) * total);
    }
    pending.length = 0;
    const u = stroke.uniforms;
    u.uCount.value = n;
    u.uAspect.value = aspect || 1;

    /* Geschwindigkeit: schmaler Schub in der Mitte, addiert */
    stroke.blendEquation = THREE.AddEquation; stroke.blendEquationAlpha = THREE.AddEquation;
    u.uRadius.value = o.velocityRadius;
    u.uAmount.value = 0;
    if (scissor(velocity.read, bb, o.velocityRadius)) { pass(stroke, velocity.read); velocity.read.scissorTest = false; }

    /* Tinte: breiter Strich, als Maximum: Wiederholen macht ihn satt, aber nicht dicker */
    stroke.blendEquation = THREE.MaxEquation; stroke.blendEquationAlpha = THREE.MaxEquation;
    u.uRadius.value = o.splatRadius;
    u.uAmount.value = o.dyeCap;
    if (scissor(dye.read, bb, o.splatRadius)) { pass(stroke, dye.read); dye.read.scissorTest = false; }
  }

  function step(dt) {
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    const k = Math.min(dt, 1 / 30) * 60;      // 1 bei 60 fps

    applyStroke();

    diverge.uniforms.uVelocity.value = velocity.read.texture;
    pass(diverge, divergence);

    clear.uniforms.uTexture.value = pressure.read.texture;
    pass(clear, pressure.write); pressure.swap();

    press.uniforms.uDivergence.value = divergence.texture;
    for (let i = 0; i < o.pressureIterations; i++) {
      press.uniforms.uPressure.value = pressure.read.texture;
      pass(press, pressure.write); pressure.swap();
    }

    gradient.uniforms.uPressure.value = pressure.read.texture;
    gradient.uniforms.uVelocity.value = velocity.read.texture;
    pass(gradient, velocity.write); velocity.swap();

    advect.uniforms.uDt.value = Math.min(dt, 1 / 30);
    advect.uniforms.uVelocity.value = velocity.read.texture;
    advect.uniforms.uSource.value = velocity.read.texture;
    advect.uniforms.uDissipation.value = Math.pow(o.velocityDissipation, k);
    pass(advect, velocity.write); velocity.swap();

    advectDye.uniforms.uDt.value = Math.min(dt, 1 / 30);
    advectDye.uniforms.uVelocity.value = velocity.read.texture;
    advectDye.uniforms.uSource.value = dye.read.texture;
    advectDye.uniforms.uDissipation.value = Math.pow(o.dyeDissipation, k);
    advectDye.uniforms.uTension.value = Math.min(1, o.tension * k);
    pass(advectDye, dye.write); dye.swap();

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
  }

  return {
    options: o,
    addSegment,
    step,
    /* Seitenverhältnis der Fläche; bei spürbarer Änderung werden die Gitter neu angelegt */
    setAspect(a) {
      if (!(a > 0)) return;
      if (Math.abs(a - aspect) / a > 0.02) allocate(a);
      aspect = a;
    },
    get texture() { return dye.read.texture; },
    get dyeTexel() { return dyeTexel; },
    dispose() {
      velocity.dispose(); pressure.dispose(); dye.dispose(); divergence.dispose();
      [advect, advectDye, stroke, diverge, press, gradient, clear].forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
}
