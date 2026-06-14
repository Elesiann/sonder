import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from "postprocessing";
import { FACETS, getSoul, prefetch } from "./soul.js";
import { createAudio } from "./audio.js";

// ---- palette: a sober dusk. a few muted hues so the crowd has variety
// without turning into a fairground. weights sum to 1; amber is the rare
// "lit window". nothing glows. ----
const PALETTE = [
  { color: new THREE.Color(0x7d8bb0), weight: 0.4 }, // slate blue — most people
  { color: new THREE.Color(0x5f6fa6), weight: 0.22 }, // deeper periwinkle
  { color: new THREE.Color(0x6b89b0), weight: 0.2 }, // dusty blue
  { color: new THREE.Color(0x5e93a6), weight: 0.1 }, // cool teal-blue (a breath of cyan)
  { color: new THREE.Color(0xcf9d68), weight: 0.08 }, // warm amber — the rare lit window
];
const NOTICE = new THREE.Color(0xffae5c); // the one you notice — a warm, defined light

function pickHue() {
  let r = Math.random();
  for (const p of PALETTE) if ((r -= p.weight) < 0) return p.color;
  return PALETTE[0].color;
}

const COUNT = 2400;
const SPREAD = 72; // the crowd is a volume you stand inside, not an oval you face
const FOG_DENSITY = 0.0085; // how fast distant souls dissolve into the dusk
const DPR = Math.min(devicePixelRatio, 2);

const app = document.getElementById("app");
const scrim = document.getElementById("scrim");
const hintEl = document.getElementById("hint");
const introEl = document.getElementById("intro");
const card = document.getElementById("card");
// a faint warm glow trailing the cursor — your presence in the dusk, nothing more
const cursorGlow = document.createElement("div");
cursorGlow.id = "cursor";
document.body.appendChild(cursorGlow);

// the one piece of visible UI: ambient sound, off by default
const audio = createAudio();
const soundBtn = document.createElement("button");
soundBtn.id = "sound";
soundBtn.type = "button";
soundBtn.setAttribute("aria-label", "ambient sound: off");
soundBtn.innerHTML = `
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <g class="waves"><path d="M16 8.6a5 5 0 0 1 0 6.8" /><path d="M18.7 6a8.5 8.5 0 0 1 0 12" /></g>
    <line class="slash" x1="15.5" y1="7.5" x2="22" y2="16.5" />
  </svg>`;
document.body.appendChild(soundBtn);
soundBtn.addEventListener("click", async () => {
  const isOn = await audio.toggle();
  soundBtn.classList.toggle("on", isOn);
  soundBtn.setAttribute("aria-label", `ambient sound: ${isOn ? "on" : "off"}`);
});

const f = {
  name: card.querySelector(".name"),
  age: card.querySelector(".age"),
  summary: card.querySelector(".summary"),
  facets: card.querySelector(".facets"),
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0); // transparent — the CSS dusk shows through
app.appendChild(renderer.domElement);
renderer.domElement.style.cursor = "grab";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 2, 34); // inside the field — people near and far, all around

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 8; // you can press in among them
controls.maxDistance = 96;
controls.autoRotate = true; // unhurried drift — like turning your head in a crowd
controls.autoRotateSpeed = 0.22;

// ---- the crowd ----
const positions = new Float32Array(COUNT * 3);
const aColor = new Float32Array(COUNT * 3);
const aSeed = new Float32Array(COUNT); // each soul breathes on its own phase
const aScale = new Float32Array(COUNT);
const tmp = new THREE.Color();

// ---- the slow current ----
// the crowd is not a screensaver drifting at random — everyone is going
// somewhere, on a shared, unhurried flow. each soul moves at its own pace and
// wanders its own path, so people cross and pass, but no one's speed says
// anything about who they are (you can't read a life from the outside). the
// flow wraps within a bounded volume, so the field stays full as it streams.
const FLOW = new THREE.Vector3(1, 0, 0.36).normalize(); // direction everyone drifts
const FLOW_LEN = SPREAD * 1.15; // half-length of the streaming volume before wrap
const FLOW_SPEED = 1.1; // base pace — contemplative, a slow walk
const homeAlong = new Float32Array(COUNT); // home distance along the flow axis
const homePerp = new Float32Array(COUNT * 3); // home position minus its along-component
const aPace = new Float32Array(COUNT); // per-soul speed factor — paths vary, no meaning

for (let i = 0; i < COUNT; i++) {
  const r = SPREAD * Math.cbrt(Math.random()); // denser toward the middle
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta) * 0.82; // flattened a touch
  const z = r * Math.cos(phi);
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  // decompose the home position into "along the flow" and "perpendicular to it"
  const s = x * FLOW.x + y * FLOW.y + z * FLOW.z;
  homeAlong[i] = s;
  homePerp[i * 3] = x - FLOW.x * s;
  homePerp[i * 3 + 1] = y - FLOW.y * s;
  homePerp[i * 3 + 2] = z - FLOW.z * s;
  aPace[i] = 0.7 + Math.random() * 0.6;

  tmp.copy(pickHue()).multiplyScalar(0.5 + Math.random() * 0.6);
  aColor[i * 3] = tmp.r;
  aColor[i * 3 + 1] = tmp.g;
  aColor[i * 3 + 2] = tmp.b;

  aSeed[i] = Math.random();
  aScale[i] = 1.0 + Math.random() * 1.4;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geo.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
geo.setAttribute("aScale", new THREE.BufferAttribute(aScale, 1));

const crowdMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending, // not additive — additive reads as "party", we want dusk
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0 }, // master fade (intro + dim-on-select)
    uSizeScale: { value: 1.0 },
    uPixelRatio: { value: DPR },
    uFogDensity: { value: FOG_DENSITY },
    uFocusZ: { value: 0 }, // view-space depth of the noticed soul
    uFocusAmt: { value: 0 }, // 0 = whole crowd sharp, 1 = depth-of-field engaged
    uFocusRange: { value: 26.0 }, // how quickly souls off the focal plane blur
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uSizeScale;
    uniform float uPixelRatio;
    uniform float uFogDensity;
    uniform float uFocusZ;
    uniform float uFocusAmt;
    uniform float uFocusRange;
    attribute vec3 aColor;
    attribute float aSeed;
    attribute float aScale;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vDefocus;
    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = -mv.z;
      // each soul breathes on its own phase — the crowd is alive
      float breathe = 0.82 + 0.18 * sin(uTime * 0.6 + aSeed * 6.2831853);
      // depth of field: souls off the noticed soul's focal plane swell and fade
      // into bokeh, so the one you noticed stays sharp in a softening crowd.
      float defocus = uFocusAmt * clamp(abs(dist - uFocusZ) / uFocusRange, 0.0, 1.0);
      vDefocus = defocus;
      gl_PointSize = aScale * uSizeScale * breathe * (180.0 / dist) * uPixelRatio * (1.0 + defocus * 2.2);
      gl_PointSize = min(gl_PointSize, 88.0 * uPixelRatio); // never a giant blob in your face
      // dusk dissolve (exp2 fog) folded into alpha so distant souls fade into the sky
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      // souls right on top of the camera fade out, so moving through the crowd is clean
      float nearFade = smoothstep(1.5, 13.0, dist);
      vAlpha = uOpacity * (1.0 - fog) * nearFade * (0.7 + 0.3 * breathe) * (1.0 - 0.8 * defocus);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vDefocus;
    void main() {
      // crisp core, soft halo — a defined point, never a hard square.
      // defocused souls melt to a wider, softer disc (bokeh).
      float d = length(gl_PointCoord - 0.5);
      float edge0 = mix(0.18, 0.0, vDefocus);
      float a = (1.0 - smoothstep(edge0, 0.5, d)) * vAlpha;
      if (a < 0.003) discard;
      gl_FragColor = vec4(vColor, a);
    }
  `,
});
const crowd = new THREE.Points(geo, crowdMat);
scene.add(crowd);

// the soul you happen to be noticing — this one is allowed to glow
const disc = softDisc();
const noticeMat = new THREE.SpriteMaterial({
  map: disc,
  color: NOTICE,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending, // a single warm light, intentional — not the whole field
});
const notice = new THREE.Sprite(noticeMat);
notice.scale.setScalar(3.8);
scene.add(notice);

// ---- light: a single, restrained bloom pass ----
// the crowd barely blooms (it's dusk, not neon); the warm amber souls and the
// one you notice carry the glow. half-float buffer keeps the bloom smooth.
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const bloom = new BloomEffect({
  intensity: 1.05,
  luminanceThreshold: 0.12,
  luminanceSmoothing: 0.5,
  radius: 0.8,
  mipmapBlur: true,
});
composer.addPass(new EffectPass(camera, bloom));

// ---- picking ----
const ray = new THREE.Raycaster();
ray.params.Points.threshold = 1.2; // ~ point size; tune the two together
const ndc = new THREE.Vector2();
let hovered = -1;
let selected = -1;
let crowdNow = 0; // current master opacity (lerped)
let crowdTarget = 1; // 1 normally, lower when one soul has your attention
let introK = 0; // 0 → 1 over the opening
let revealToken = 0; // guards async reveals against rapid re-clicks / conceal

const pick = (x, y) => {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(crowd)[0];
  return hit ? hit.index : -1;
};

addEventListener("pointermove", (e) => {
  const h = pick(e.clientX, e.clientY);
  if (h !== hovered) {
    hovered = h;
    if (hovered >= 0) prefetch(hovered); // warm the cache before the click lands
  }
  renderer.domElement.style.cursor = hovered >= 0 ? "pointer" : "grab";
  cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  if (!document.body.classList.contains("has-cursor")) document.body.classList.add("has-cursor");
});
addEventListener("pointerleave", () => document.body.classList.remove("has-cursor"));

// tell a click (notice someone) apart from an orbit-drag (look around)
let down = null;
addEventListener("pointerdown", (e) => {
  down = [e.clientX, e.clientY];
  prefetch(pick(e.clientX, e.clientY)); // covers touch, where there's no hover
  dismissIntro();
});
addEventListener("pointerup", (e) => {
  if (!down) return;
  const dragged = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
  down = null;
  if (dragged > 6) return; // it was a look-around, leave it to OrbitControls
  const i = pick(e.clientX, e.clientY);
  if (i >= 0) reveal(i);
  else conceal();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") conceal();
});

function reveal(i) {
  const token = ++revealToken;
  // the world responds to the click at once — the crowd recedes, the camera
  // turns, the corner darkens — even while the life is still loading.
  selected = i;
  crowdTarget = 0.4;
  scrim.classList.add("show");
  hintEl.classList.add("hide");
  audio.noticed(); // a soft bell, if sound is on



  getSoul(i)
    .then((p) => {
      if (token !== revealToken) return; // a newer click or a conceal won

      f.name.textContent = p.name;
      f.age.textContent = p.age;
      f.summary.textContent = p.summary; // the primary portrait

      // secondary facets, rendered data-driven (N of them)
      f.facets.replaceChildren();
      for (const { key, label } of FACETS) {
        const row = document.createElement("p");
        row.className = "line facet";
        const l = document.createElement("span");
        l.className = "label";
        l.textContent = label;
        const v = document.createElement("span");
        v.className = "val";
        v.textContent = p.secondary[key];
        row.append(l, v);
        f.facets.append(row);
      }

      // stagger every line (works for the dynamic facet rows too)
      card.querySelectorAll(".line").forEach((el, idx) => {
        el.style.transitionDelay = `${0.05 + idx * 0.12}s`;
      });

      card.classList.remove("show");
      void card.offsetWidth; // restart the staggered reveal
      card.classList.add("show");
    })
    .catch(() => {
      // engine unreachable — leave the world dimmed, but never fake a person
      if (token === revealToken) hintEl.classList.remove("hide");
    });
}

function conceal() {
  revealToken++; // cancel any in-flight reveal
  card.classList.remove("show");
  scrim.classList.remove("show");
  selected = -1;
  crowdTarget = 1;
}

// ---- opening ----
let introGone = false;
function dismissIntro() {
  if (introGone) return;
  introGone = true;
  introEl.classList.add("gone");
  hintEl.classList.add("ready");
}
setTimeout(dismissIntro, 5500);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---- loop ----
const clock = new THREE.Clock();
const focusPos = new THREE.Vector3();
const targetGoal = new THREE.Vector3();
const tmpView = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  crowdMat.uniforms.uTime.value = t;

  // stream the crowd along the slow current. the one you've stopped for pauses;
  // the rest keep flowing past, indifferent — you, halted, against the current.
  const pos = geo.attributes.position.array;
  const twoLen = 2 * FLOW_LEN;
  for (let i = 0; i < COUNT; i++) {
    if (i === selected) continue; // the noticed soul holds still
    let s = homeAlong[i] + FLOW_SPEED * aPace[i] * t;
    s = ((((s + FLOW_LEN) % twoLen) + twoLen) % twoLen) - FLOW_LEN; // wrap into [-LEN, LEN]
    const ph = aSeed[i] * 6.2831853;
    pos[i * 3] = FLOW.x * s + homePerp[i * 3] + Math.sin(t * 0.22 + ph) * 1.3;
    pos[i * 3 + 1] = FLOW.y * s + homePerp[i * 3 + 1] + Math.sin(t * 0.31 + ph * 1.7) * 1.0;
    pos[i * 3 + 2] = FLOW.z * s + homePerp[i * 3 + 2] + Math.cos(t * 0.19 + ph) * 1.3;
  }
  geo.attributes.position.needsUpdate = true;

  // the crowd materialises out of the dusk, then obeys attention
  introK = t < 2.6 ? 1 - Math.pow(1 - t / 2.6, 3) : 1; // ease-out cubic fade-in
  crowdNow += (crowdTarget - crowdNow) * 0.07;
  crowdMat.uniforms.uOpacity.value = introK * crowdNow;

  // the soul you noticed lights up; the camera turns its attention toward them
  const focus = selected >= 0 ? selected : hovered;
  if (focus >= 0) notice.position.copy(focusPos.fromBufferAttribute(geo.attributes.position, focus));
  const noticeTarget = selected >= 0 ? 0.85 : hovered >= 0 ? 0.32 : 0;
  noticeMat.opacity += (noticeTarget - noticeMat.opacity) * 0.15;

  // depth of field engages only on an actual selection (hover would jitter):
  // the crowd softens to bokeh, the noticed soul stays sharp on the focal plane.
  const focusTarget = selected >= 0 ? 1 : 0;
  crowdMat.uniforms.uFocusAmt.value += (focusTarget - crowdMat.uniforms.uFocusAmt.value) * 0.06;
  if (selected >= 0) {
    tmpView.fromBufferAttribute(geo.attributes.position, selected).applyMatrix4(camera.matrixWorldInverse);
    crowdMat.uniforms.uFocusZ.value = -tmpView.z;
  }

  if (selected >= 0) targetGoal.fromBufferAttribute(geo.attributes.position, selected);
  else targetGoal.set(0, 0, 0);
  controls.target.lerp(targetGoal, 0.035);

  controls.update();
  composer.render();
}
frame();

// dev-only test hook: lets Playwright drive reveal/conceal without pixel-hunting
// for a point. stripped from production builds.
if (import.meta.env.DEV) {
  window.__sonder = {
    reveal,
    conceal,
    count: COUNT,
    get selected() {
      return selected;
    },
  };
}

// soft round sprite for the noticed soul's glow
function softDisc() {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.95)"); // a defined core, not a foggy cloud
  g.addColorStop(0.35, "rgba(255,255,255,0.3)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}
