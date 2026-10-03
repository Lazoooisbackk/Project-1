/*
  Flüssigkeits-Simulation (Stable Fluids) für den Wisch-Effekt im Start-Bereich.
  Geschwindigkeit, Druck und „Tinte“ liegen in Render-Targets; die Tinte dient danach als Maske.
  Eigene Umsetzung mit three.js: Advektion, Divergenz, Druck (Jacobi), Gradient abziehen.
*/
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const ADVECT = `precision highp float; varying vec2 vUv;
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uTexel; uniform float uDt; uniform float uDissipation;
void main(){
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
  gl_FragColor = uDissipation * texture2D(uSource, coord);
}`;

const SPLAT = `precision highp float; varying vec2 vUv;
uniform sampler2D uTarget; uniform float uAspect; uniform vec3 uColor; uniform vec2 uPoint; uniform float uRadius;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
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
  simResolution: 256,
  dyeResolution: 512,
  velocityDissipation: 0.962,   // pro Bild bei 60 fps
  dyeDissipation: 0.988,
  pressureIterations: 20,
  splatRadius: 0.0011,
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

  const rt = (size, filter) => new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: filter, magFilter: filter,
    depthBuffer: false, stencilBuffer: false,
  });
  const double = (size, filter) => ({
    read: rt(size, filter), write: rt(size, filter),
    swap() { const t = this.read; this.read = this.write; this.write = t; },
    dispose() { this.read.dispose(); this.write.dispose(); },
  });

  const velocity = double(o.simResolution, THREE.LinearFilter);
  const pressure = double(o.simResolution, THREE.NearestFilter);
  const dye = double(o.dyeResolution, THREE.LinearFilter);
  const divergence = rt(o.simResolution, THREE.NearestFilter);
  const simTexel = new THREE.Vector2(1 / o.simResolution, 1 / o.simResolution);

  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const advect = mat(ADVECT, { uVelocity: { value: null }, uSource: { value: null }, uTexel: { value: simTexel }, uDt: { value: 0 }, uDissipation: { value: 1 } });
  const splat = mat(SPLAT, { uTarget: { value: null }, uAspect: { value: 1 }, uColor: { value: new THREE.Vector3() }, uPoint: { value: new THREE.Vector2() }, uRadius: { value: o.splatRadius } });
  const diverge = mat(DIVERGENCE, { uVelocity: { value: null }, uTexel: { value: simTexel } });
  const press = mat(PRESSURE, { uPressure: { value: null }, uDivergence: { value: null }, uTexel: { value: simTexel } });
  const gradient = mat(GRADIENT, { uPressure: { value: null }, uVelocity: { value: null }, uTexel: { value: simTexel } });
  const clear = mat(CLEAR, { uTexture: { value: null }, uValue: { value: 0.8 } });

  const pass = (material, target) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };

  let aspect = 1;
  const queue = [];

  /* x, y in 0..1 (y nach oben), dx/dy = Bewegung in derselben Einheit, amount = Menge Tinte */
  function addSplat(x, y, dx, dy, amount = 1) {
    queue.push({ x, y, dx, dy, amount });
    if (queue.length > 48) queue.shift();
  }

  function applySplats() {
    while (queue.length) {
      const s = queue.shift();
      splat.uniforms.uAspect.value = aspect;
      splat.uniforms.uPoint.value.set(s.x, s.y);
      splat.uniforms.uRadius.value = o.splatRadius;
      splat.uniforms.uTarget.value = velocity.read.texture;
      splat.uniforms.uColor.value.set(s.dx * o.splatForce, s.dy * o.splatForce, 0);
      pass(splat, velocity.write); velocity.swap();
      splat.uniforms.uTarget.value = dye.read.texture;
      splat.uniforms.uColor.value.set(s.amount, s.amount, s.amount);
      pass(splat, dye.write); dye.swap();
    }
  }

  function step(dt) {
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    const k = Math.min(dt, 1 / 30) * 60;      // 1 bei 60 fps

    applySplats();

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

    advect.uniforms.uVelocity.value = velocity.read.texture;
    advect.uniforms.uSource.value = dye.read.texture;
    advect.uniforms.uDissipation.value = Math.pow(o.dyeDissipation, k);
    pass(advect, dye.write); dye.swap();

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
  }

  return {
    options: o,
    addSplat,
    step,
    setAspect(a) { aspect = a; },
    get texture() { return dye.read.texture; },
    dispose() {
      velocity.dispose(); pressure.dispose(); dye.dispose(); divergence.dispose();
      [advect, splat, diverge, press, gradient, clear].forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
}
