import * as THREE from "three";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uMouse;
  uniform float uMouseRadius;
  uniform float uMouseStrength;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aPhase;
  attribute float aBright;

  varying float vDepth;
  varying float vPhase;
  varying float vBright;

  void main() {
    vec3 pos = position;

    vec3 toMouse = pos - uMouse;
    float dist = length(toMouse);
    float falloff = smoothstep(uMouseRadius, 0.0, dist);
    pos += normalize(toMouse + vec3(0.0001)) * falloff * uMouseStrength;

    pos.y += sin(uTime * 0.6 + aPhase * 2.0) * 0.012;
    pos.x += cos(uTime * 0.4 + aPhase * 3.0) * 0.008;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vDepth = -mvPosition.z;
    vPhase = aPhase;
    vBright = aBright;

    gl_PointSize = aSize * uPixelRatio * (190.0 / vDepth);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uTime;

  varying float vDepth;
  varying float vPhase;
  varying float vBright;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.0, d);
    float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + vPhase * 6.0);

    vec3 col = mix(uColor2, uColor1, smoothstep(0.5, 0.05, d));
    float alpha = core * twinkle * vBright;
    alpha *= clamp(7.0 / vDepth, 0.2, 1.6);

    gl_FragColor = vec4(col, alpha);
  }
`;

function createScene(canvas, options = {}) {
  const cfg = {
    count: 6500,
    radius: 2.4,
    tube: 0.35,
    scatter: 0.55,
    color1: new THREE.Color(0xffd1b0),
    color2: new THREE.Color(0xff5e1f),
    rotationSpeed: 0.05,
    rotationX: -0.55,
    rotationZ: 0.45,
    mouseRadius: 1.1,
    mouseStrength: 0.55,
    cameraZ: 6,
    fov: 45,
    parallaxStrength: 0.18,
    flatness: 1.0,
    ...options,
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.1, 100);
  camera.position.z = cfg.cameraZ;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const positions = new Float32Array(cfg.count * 3);
  const sizes = new Float32Array(cfg.count);
  const phases = new Float32Array(cfg.count);
  const brights = new Float32Array(cfg.count);

  for (let i = 0; i < cfg.count; i++) {
    const isDust = Math.random() > 0.78;
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;

    const radiusJitter = (Math.random() - 0.5) * cfg.scatter * (isDust ? 2.4 : 1.0);
    const tubeJitter = (Math.random() - 0.5) * cfg.tube * (isDust ? 1.6 : 0.8);

    const r = cfg.tube + tubeJitter;
    const major = cfg.radius + radiusJitter + r * Math.cos(v);

    const x = major * Math.cos(u);
    const y = r * Math.sin(v) * cfg.flatness + (isDust ? (Math.random() - 0.5) * 0.45 : 0);
    const z = major * Math.sin(u);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    sizes[i] = (Math.random() * 1.4 + 0.4) * (isDust ? 0.55 : 1.0);
    phases[i] = Math.random() * Math.PI * 2;
    brights[i] = isDust ? 0.35 + Math.random() * 0.45 : 0.7 + Math.random() * 0.55;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aBright", new THREE.BufferAttribute(brights, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(100, 100, 100) },
      uMouseRadius: { value: cfg.mouseRadius },
      uMouseStrength: { value: cfg.mouseStrength },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uColor1: { value: cfg.color1 },
      uColor2: { value: cfg.color2 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.rotation.x = cfg.rotationX;
  points.rotation.z = cfg.rotationZ;
  scene.add(points);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const mouseWorld = new THREE.Vector3(100, 100, 100);
  const mouseLocal = new THREE.Vector3();
  const mouseScreen = new THREE.Vector2(0, 0);
  const mouseScreenLerped = new THREE.Vector2(0, 0);
  let mouseInside = false;

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    mouseScreen.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseScreen.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (cx >= 0 && cx <= rect.width && cy >= 0 && cy <= rect.height) {
      mouseInside = true;
      mouseNDC.x = (cx / rect.width) * 2 - 1;
      mouseNDC.y = -(cy / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNDC, camera);
      raycaster.ray.intersectPlane(plane, mouseWorld);
    } else {
      mouseInside = false;
    }
  }

  window.addEventListener("mousemove", onMouseMove, { passive: true });

  const clock = new THREE.Clock();
  let rotationBase = 0;
  let frameId = null;
  // Each Three.js scene has its own visibility flag. The IntersectionObserver
  // below flips it as the canvas enters/leaves the viewport. While the
  // canvas is off-screen we stop scheduling rAF entirely — rendering 7000
  // GPU particles when nobody can see them is wasted work and the #1
  // reason the contact-section scene used to burn battery on every page.
  let inView = false;

  function animate() {
    if (document.hidden || !inView) {
      frameId = null;
      return;
    }
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    rotationBase += cfg.rotationSpeed * dt;

    mouseScreenLerped.x += (mouseScreen.x - mouseScreenLerped.x) * 0.08;
    mouseScreenLerped.y += (mouseScreen.y - mouseScreenLerped.y) * 0.08;

    points.rotation.y = rotationBase + mouseScreenLerped.x * cfg.parallaxStrength;
    points.rotation.x = cfg.rotationX + mouseScreenLerped.y * cfg.parallaxStrength * 0.6;

    if (mouseInside) {
      mouseLocal.copy(mouseWorld);
      points.worldToLocal(mouseLocal);
      material.uniforms.uMouse.value.copy(mouseLocal);
    } else {
      material.uniforms.uMouse.value.set(100, 100, 100);
    }

    material.uniforms.uTime.value = t;
    renderer.render(scene, camera);

    frameId = requestAnimationFrame(animate);
  }

  const startLoop = () => {
    if (!frameId) {
      // Reset clock delta so we don't get a giant catch-up jump after
      // a long pause (e.g. user scrolled away for 10 seconds).
      clock.getDelta();
      frameId = requestAnimationFrame(animate);
    }
  };

  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) startLoop();
  }, { rootMargin: "200px" });
  io.observe(canvas);

  const onVisibility = () => {
    if (!document.hidden && inView) startLoop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    destroy() {
      if (frameId) cancelAnimationFrame(frameId);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

export function initParticleFields() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  if (!window.WebGLRenderingContext) return;

  const heroCanvas = document.querySelector(".hero__canvas");
  if (heroCanvas) {
    createScene(heroCanvas, {
      count: 7000,
      radius: 2.6,
      tube: 0.42,
      scatter: 0.6,
      rotationX: -0.6,
      rotationZ: 0.5,
      cameraZ: 6,
      mouseRadius: 1.3,
      mouseStrength: 0.6,
      parallaxStrength: 0.2,
      flatness: 1.0,
    });
  }

  const contactCanvas = document.querySelector(".contact__canvas");
  if (contactCanvas) {
    createScene(contactCanvas, {
      count: 4500,
      radius: 2.9,
      tube: 0.18,
      scatter: 0.45,
      rotationX: -1.05,
      rotationZ: 0.3,
      rotationSpeed: 0.035,
      cameraZ: 7,
      mouseRadius: 1.5,
      mouseStrength: 0.5,
      parallaxStrength: 0.14,
      flatness: 0.25,
    });
  }
}
