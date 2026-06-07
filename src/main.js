import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FACETS, getSoul, prefetch } from "./soul.js";

// ---- palette: a sober dusk. a few muted hues so the crowd has variety
// without turning into a fairground. weights sum to 1; amber is the rare
// "lit window". nothing glows. ----
const PALETTE = [
  { color: new THREE.Color(0x8b919e), weight: 0.42 }, // cool grey — most people
  { color: new THREE.Color(0x77879c), weight: 0.2 }, // dusty blue
  { color: new THREE.Color(0x9a8a9e), weight: 0.15 }, // faded mauve
  { color: new THREE.Color(0x869a8f), weight: 0.13 }, // muted sage
  { color: new THREE.Color(0xc79a63), weight: 0.1 }, // warm amber — lit from within
];
const NOTICE = new THREE.Color(0xf4e6c2); // the one you happen to notice

function pickHue() {
  let r = Math.random();
  for (const p of PALETTE) if ((r -= p.weight) < 0) return p.color;
  return PALETTE[0].color;
}

const COUNT = 2400;
const SPREAD = 48;
const FOG_DENSITY = 0.009; // how fast distant souls dissolve into the dusk
const DPR = Math.min(devicePixelRatio, 2);

const app = document.getElementById("app");
const scrim = document.getElementById("scrim");
const hintEl = document.getElementById("hint");
const introEl = document.getElementById("intro");
const card = document.getElementById("card");
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
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 3, 80);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 28;
controls.maxDistance = 150;
controls.autoRotate = true; // unhurried drift
controls.autoRotateSpeed = 0.28;

// ---- the crowd ----
const positions = new Float32Array(COUNT * 3);
const aColor = new Float32Array(COUNT * 3);
const aSeed = new Float32Array(COUNT); // each soul breathes on its own phase
const aScale = new Float32Array(COUNT);
const tmp = new THREE.Color();

for (let i = 0; i < COUNT; i++) {
  const r = SPREAD * Math.cbrt(Math.random()); // denser toward the middle
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.58; // flattened a little
  positions[i * 3 + 2] = r * Math.cos(phi);

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
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uSizeScale;
    uniform float uPixelRatio;
    uniform float uFogDensity;
    attribute vec3 aColor;
    attribute float aSeed;
    attribute float aScale;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = -mv.z;
      // each soul breathes on its own phase — the crowd is alive
      float breathe = 0.82 + 0.18 * sin(uTime * 0.6 + aSeed * 6.2831853);
      gl_PointSize = aScale * uSizeScale * breathe * (180.0 / dist) * uPixelRatio;
      // dusk dissolve (exp2 fog) folded into alpha so distant souls fade into the sky
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      vAlpha = uOpacity * (1.0 - fog) * (0.7 + 0.3 * breathe);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      // crisp core, soft halo — a defined point, never a hard square
      float d = length(gl_PointCoord - 0.5);
      float a = (1.0 - smoothstep(0.18, 0.5, d)) * vAlpha;
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
notice.scale.setScalar(5.0);
scene.add(notice);

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
});

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
});

// ---- loop ----
const clock = new THREE.Clock();
const focusPos = new THREE.Vector3();
const targetGoal = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  crowdMat.uniforms.uTime.value = t;

  // the crowd materialises out of the dusk, then obeys attention
  introK = t < 2.6 ? 1 - Math.pow(1 - t / 2.6, 3) : 1; // ease-out cubic fade-in
  crowdNow += (crowdTarget - crowdNow) * 0.07;
  crowdMat.uniforms.uOpacity.value = introK * crowdNow;

  // the soul you noticed lights up; the camera turns its attention toward them
  const focus = selected >= 0 ? selected : hovered;
  if (focus >= 0) notice.position.copy(focusPos.fromBufferAttribute(geo.attributes.position, focus));
  const noticeTarget = selected >= 0 ? 0.55 : hovered >= 0 ? 0.28 : 0;
  noticeMat.opacity += (noticeTarget - noticeMat.opacity) * 0.15;

  if (selected >= 0) targetGoal.fromBufferAttribute(geo.attributes.position, selected);
  else targetGoal.set(0, 0, 0);
  controls.target.lerp(targetGoal, 0.035);

  controls.update();
  renderer.render(scene, camera);
}
frame();

// soft round sprite for the noticed soul's glow
function softDisc() {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.7)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}
