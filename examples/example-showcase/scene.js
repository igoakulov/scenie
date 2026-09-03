import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010105);

const SEG = 72;
const SEG_SMALL = 28;
const STAR_N = 7000;
const AST_N = 420;
const KUIPER_N = 260;
const WIND_N = 280;
const planetScale = 0.5;
const sunGlow = 1.1;
let elliptical = true, timeScale = 0.2, windCount = WIND_N;

const layerObjs = {
  orbits: [],
  labels: [],
  moons: [],
  asteroids: [],
  atmospheres: [],
  comet: [],
  kuiper: [],
};
const planetBodies = [];
const glowSprites = [];
const orbitRecords = [];
let cometCore = null, starsDim = null, starsBright = null;

const geoCache = new Map();
function unitSphere(seg) {
  let g = geoCache.get(seg);
  if (!g) {
    g = new THREE.SphereGeometry(1, seg, Math.max(12, (seg * 0.55) | 0));
    geoCache.set(seg, g);
  }
  return g;
}

function h3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}
function n3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n000 = h3(ix, iy, iz);
  const n100 = h3(ix + 1, iy, iz);
  const n010 = h3(ix, iy + 1, iz);
  const n110 = h3(ix + 1, iy + 1, iz);
  const n001 = h3(ix, iy, iz + 1);
  const n101 = h3(ix + 1, iy, iz + 1);
  const n011 = h3(ix, iy + 1, iz + 1);
  const n111 = h3(ix + 1, iy + 1, iz + 1);
  const x00 = n000 + (n100 - n000) * ux;
  const x10 = n010 + (n110 - n010) * ux;
  const x01 = n001 + (n101 - n001) * ux;
  const x11 = n011 + (n111 - n011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}
function fbm(x, y, z, oct = 5) {
  let v = 0, a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * n3(x, y, z);
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    a *= 0.5;
  }
  return v;
}
function dirFromUv(u, v) {
  const th = u * Math.PI * 2;
  const ph = v * Math.PI;
  const s = Math.sin(ph);
  return [s * Math.cos(th), Math.cos(ph), s * Math.sin(th)];
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function canvasTex(w, h, paint, opts = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(w, h);
  paint(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = opts.wrapS ?? THREE.RepeatWrapping;
  tex.wrapT = opts.wrapT ?? THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function paintPlanet(w, h, shade) {
  return canvasTex(w, h, (d, W, H) => {
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const p = dirFromUv(u, v);
        const col = shade(p[0], p[1], p[2], u, v);
        const i = (y * W + x) << 2;
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = col[3] ?? 255;
      }
    }
  });
}

function rockShade(seed, pal, crater = 1) {
  return (x, y, z) => {
    const n = fbm(x * 3.2 + seed, y * 3.2, z * 3.2, 5);
    const n2 = fbm(x * 8 + seed * 2, y * 8, z * 8, 3);
    let cr = 0;
    if (crater) {
      const c = n3(x * 6 + 9, y * 6, z * 6 + seed);
      cr = Math.pow(clamp01(0.55 - Math.abs(c - 0.42) * 3.2), 2) * crater;
    }
    const t = clamp01(n * 0.75 + n2 * 0.25 - cr * 0.35);
    const ice = clamp01((Math.abs(y) - 0.82) * 5);
    return [
      lerp(pal[0], pal[3], t) + ice * 40,
      lerp(pal[1], pal[4], t) + ice * 40,
      lerp(pal[2], pal[5], t) + ice * 45,
    ];
  };
}

function bandShade(seed, bands, spot) {
  return (x, y, z, u, v) => {
    const warp = (fbm(x * 2.2 + seed, y * 6, z * 2.2, 4) - 0.5) * 0.18;
    const yy = clamp01(v + warp);
    let r = 0, g = 0, b = 0, wsum = 0;
    for (let i = 0; i < bands.length; i++) {
      const bd = bands[i];
      const k = Math.exp(-Math.pow((yy - bd.y) / bd.w, 2));
      r += bd.c[0] * k;
      g += bd.c[1] * k;
      b += bd.c[2] * k;
      wsum += k;
    }
    const inv = 1 / Math.max(1e-5, wsum);
    r *= inv;
    g *= inv;
    b *= inv;
    const turb = fbm(x * 5 + seed, y * 14, z * 5, 4);
    r = clamp01(r + (turb - 0.5) * 0.14) * 255;
    g = clamp01(g + (turb - 0.5) * 0.1) * 255;
    b = clamp01(b + (turb - 0.5) * 0.06) * 255;
    if (spot) {
      const dx = x - spot.x;
      const dy = y - spot.y;
      const dz = z - spot.z;
      const s = Math.exp(-(dx * dx * 18 + dy * dy * 70 + dz * dz * 18) * spot.k);
      r = lerp(r, spot.c[0], s);
      g = lerp(g, spot.c[1], s);
      b = lerp(b, spot.c[2], s);
    }
    return [r, g, b];
  };
}

const maps = {
  mercury: paintPlanet(768, 384, rockShade(1.2, [92, 82, 74, 180, 168, 150], 1.3)),
  venus: paintPlanet(768, 384, (x, y, z) => {
    const n = fbm(x * 2.4, y * 3.1, z * 2.4, 5);
    const swirl = fbm(x * 1.4 + n, y * 6, z * 1.4, 4);
    const t = clamp01(n * 0.55 + swirl * 0.5);
    return [lerp(210, 255, t), lerp(150, 210, t), lerp(70, 120, t)];
  }),
  earth: paintPlanet(1024, 512, (x, y, z) => {
    const n = fbm(x * 2.6 + 4, y * 2.6, z * 2.6, 6);
    const n2 = fbm(x * 6, y * 6, z * 6, 3);
    const land = n > 0.5;
    const mtn = land && n2 > 0.62;
    const ice = Math.abs(y) > 0.78 + n * 0.08 || (Math.abs(y) > 0.62 && n > 0.58);
    if (ice) return [236, 244, 255];
    if (mtn) return [118, 108, 88];
    if (land) {
      const veg = clamp01((n - 0.5) * 3);
      return [lerp(62, 40, veg) + 40, lerp(110, 150, veg), lerp(48, 55, veg)];
    }
    const deep = clamp01((0.5 - n) * 2);
    return [lerp(40, 8, deep), lerp(90, 28, deep), lerp(160, 90, deep)];
  }),
  earthNight: paintPlanet(1024, 512, (x, y, z) => {
    const n = fbm(x * 2.6 + 4, y * 2.6, z * 2.6, 6);
    const land = n > 0.5 && Math.abs(y) < 0.74;
    const city = h3(Math.floor(x * 80), Math.floor(y * 80), Math.floor(z * 80));
    const cluster = fbm(x * 14, y * 14, z * 14, 2);
    if (land && city > 0.78 && cluster > 0.48) {
      const a = (city - 0.78) * 8;
      return [255 * a, 200 * a, 90 * a];
    }
    return [0, 0, 0];
  }),
  earthCloud: paintPlanet(1024, 512, (x, y, z) => {
    const n = fbm(x * 3.2 + 11, y * 2.2, z * 3.2, 5);
    const bands = Math.pow(clamp01(n - 0.48), 1.2);
    const a = bands * 220;
    return [235, 240, 255, a];
  }),
  mars: paintPlanet(768, 384, (x, y, z) => {
    const n = fbm(x * 3 + 2, y * 3, z * 3, 5);
    const dust = fbm(x * 7, y * 7, z * 7, 3);
    const ice = clamp01((Math.abs(y) - 0.72) * 6);
    const t = clamp01(n * 0.7 + dust * 0.3);
    return [
      lerp(110, 200, t) + ice * 50,
      lerp(40, 90, t) + ice * 60,
      lerp(22, 48, t) + ice * 70,
    ];
  }),
  jupiter: paintPlanet(1024, 512, bandShade(
    3.1,
    [
      { y: 0.08, w: 0.08, c: [0.55, 0.38, 0.22] },
      { y: 0.2, w: 0.07, c: [0.85, 0.72, 0.52] },
      { y: 0.35, w: 0.09, c: [0.72, 0.55, 0.38] },
      { y: 0.5, w: 0.1, c: [0.9, 0.82, 0.68] },
      { y: 0.65, w: 0.08, c: [0.62, 0.42, 0.28] },
      { y: 0.8, w: 0.09, c: [0.82, 0.7, 0.5] },
      { y: 0.93, w: 0.07, c: [0.7, 0.62, 0.55] },
    ],
    { x: 0.55, y: 0.18, z: 0.2, k: 1, c: [180, 70, 45] }
  )),
  saturn: paintPlanet(768, 384, bandShade(6.4, [
    { y: 0.12, w: 0.1, c: [0.78, 0.7, 0.5] },
    { y: 0.3, w: 0.09, c: [0.9, 0.82, 0.62] },
    { y: 0.5, w: 0.12, c: [0.85, 0.76, 0.55] },
    { y: 0.7, w: 0.1, c: [0.72, 0.64, 0.46] },
    { y: 0.88, w: 0.09, c: [0.8, 0.74, 0.58] },
  ])),
  uranus: paintPlanet(640, 320, (x, y, z) => {
    const n = fbm(x * 2, y * 5, z * 2, 4);
    const t = clamp01(0.45 + n * 0.3 + Math.abs(y) * 0.1);
    return [lerp(130, 190, t), lerp(210, 240, t), lerp(210, 230, t)];
  }),
  neptune: paintPlanet(640, 320, (x, y, z) => {
    const n = fbm(x * 2.4, y * 6, z * 2.4, 4);
    const spot = Math.exp(-(x + 0.4) * (x + 0.4) * 10 - (y - 0.2) * (y - 0.2) * 40);
    const t = clamp01(0.35 + n * 0.4);
    return [lerp(25, 70, t) + spot * 20, lerp(70, 130, t), lerp(170, 230, t) + spot * 10];
  }),
  pluto: paintPlanet(512, 256, (x, y, z) => {
    const n = fbm(x * 4 + 8, y * 4, z * 4, 5);
    const heart = Math.exp(-((x - 0.25) * (x - 0.25) * 8 + (y - 0.15) * (y - 0.15) * 14 + z * z * 6));
    const t = clamp01(n);
    return [
      lerp(90, 160, t) + heart * 80,
      lerp(80, 140, t) + heart * 70,
      lerp(75, 130, t) + heart * 60,
    ];
  }),
  moon: paintPlanet(512, 256, rockShade(9.1, [70, 70, 72, 190, 188, 180], 1.6)),
  io: paintPlanet(384, 192, (x, y, z) => {
    const n = fbm(x * 5, y * 5, z * 5, 4);
    const t = clamp01(n);
    return [lerp(200, 255, t), lerp(170, 90, t), lerp(40, 30, t)];
  }),
  europa: paintPlanet(384, 192, (x, y, z) => {
    const n = fbm(x * 8, y * 3, z * 8, 4);
    const crack = Math.pow(Math.abs(n - 0.5) * 2, 0.4);
    return [lerp(180, 230, crack), lerp(200, 240, crack), lerp(210, 245, crack)];
  }),
  ganymede: paintPlanet(384, 192, rockShade(4.4, [80, 74, 68, 170, 160, 145], 0.8)),
  callisto: paintPlanet(384, 192, rockShade(5.5, [50, 48, 46, 130, 120, 110], 1.4)),
  titan: paintPlanet(384, 192, (x, y, z) => {
    const n = fbm(x * 3, y * 3, z * 3, 4);
    const t = clamp01(n);
    return [lerp(160, 210, t), lerp(100, 140, t), lerp(40, 70, t)];
  }),
  charon: paintPlanet(256, 128, rockShade(7.7, [88, 82, 90, 160, 150, 155], 1)),
};

function ringTex(kind) {
  const H = 1024;
  return canvasTex(
    12,
    H,
    (d, W) => {
      for (let y = 0; y < H; y++) {
        const u = y / (H - 1);
        let a = 0, r = 220, g = 205, b = 170;
        if (kind === "saturn") {
          if (u < 0.18) a = 0.12 * (u / 0.18);
          else if (u < 0.52) a = 0.82;
          else if (u < 0.57) a = 0.04;
          else if (u < 0.86) a = 0.5;
          else if (u < 0.89) a = 0.07;
          else a = 0.22 * (1 - u) / 0.11;
          const grain = 0.75 + h3(y * 0.15, 2, 1) * 0.35;
          a *= grain;
        } else if (kind === "uranus") {
          a = u > 0.35 && u < 0.8 ? 0.18 * (0.5 + h3(y, 1, 2) * 0.5) : 0.03;
          r = 180;
          g = 190;
          b = 200;
        } else {
          a = 0.08 * Math.exp(-Math.pow((u - 0.55) / 0.25, 2));
          r = 200;
          g = 190;
          b = 160;
        }
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) << 2;
          const n = 0.9 + h3(x, y, 3) * 0.1;
          d[i] = r * n;
          d[i + 1] = g * n;
          d[i + 2] = b * n;
          d[i + 3] = clamp01(a) * 255;
        }
      }
    },
    { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping }
  );
}

const sunVert = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const sunFrag = /* glsl */ `
uniform float uTime;
uniform float uGlow;
varying vec3 vPos;
varying vec3 vN;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}
void main() {
  vec3 p = normalize(vPos);
  float t = uTime * 0.22;
  float n = fbm(p * 3.4 + vec3(t, t * 0.7, -t * 0.4));
  n = fbm(p * 2.2 + n * 1.8 + vec3(-t * 0.5, t, t * 0.3));
  float limb = pow(clamp(dot(normalize(vN), vec3(0.0, 0.0, 1.0)) * 0.35 + 0.75, 0.0, 1.0), 1.4);
  vec3 hot = vec3(1.0, 0.95, 0.72);
  vec3 mid = vec3(1.0, 0.55, 0.12);
  vec3 cool = vec3(0.75, 0.12, 0.02);
  vec3 col = mix(cool, mid, n);
  col = mix(col, hot, pow(n, 2.2));
  col *= 1.15 * uGlow * limb;
  float spot = smoothstep(0.62, 0.78, fbm(p * 5.0 + 4.0));
  col *= 1.0 - spot * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`;
const atmVert = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const atmFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uPow;
uniform float uGain;
uniform float uTime;
uniform float uAurora;
varying vec3 vW;
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(n, v)), uPow);
  vec3 col = uColor * f * uGain;
  if (uAurora > 0.001) {
    float polar = pow(abs(n.y), 7.0);
    float band = 0.55 + 0.45 * sin(uTime * 1.8 + n.x * 14.0 + n.z * 9.0);
    col += vec3(0.15, 1.0, 0.45) * polar * band * uAurora * f;
  }
  gl_FragColor = vec4(col, clamp(f * uGain, 0.0, 1.0));
}
`;
const coronaFrag = /* glsl */ `
uniform float uTime;
uniform float uGlow;
varying vec3 vW;
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(n, v)), 2.6);
  float boil = 0.7 + 0.3 * sin(uTime * 0.8 + n.x * 8.0);
  vec3 col = mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.2, 0.02), f) * f * 1.4 * uGlow * boil;
  gl_FragColor = vec4(col, f * 0.85);
}
`;

function glowSprite(color, size) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color.replace("1)", "0.45)"));
  grd.addColorStop(0.55, color.replace("1)", "0.12)"));
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  s.userData.baseSize = size;
  return s;
}

const SUN_R = 1.08;
const sunMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uGlow: { value: sunGlow } },
  vertexShader: sunVert,
  fragmentShader: sunFrag,
});
const sun = new THREE.Mesh(unitSphere(SEG), sunMat);
sun.scale.setScalar(SUN_R);
scene.add(sun);

const coronaMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uGlow: { value: sunGlow } },
  vertexShader: atmVert,
  fragmentShader: coronaFrag,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
});
const corona = new THREE.Mesh(unitSphere(40), coronaMat);
corona.scale.setScalar(SUN_R * 1.55);
scene.add(corona);
function addSunGlow(color, size) {
  const s = glowSprite(color, size);
  glowSprites.push(s);
  scene.add(s);
  return s;
}
addSunGlow("rgba(255,210,80,1)", 5.4);
addSunGlow("rgba(255,120,20,1)", 9.2);
addSunGlow("rgba(255,60,10,1)", 14.5);

const sunLight = new THREE.PointLight(0xfff1c8, 14, 0, 1.05);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x1a2438, 0.32));
scene.add(new THREE.HemisphereLight(0x334466, 0x050308, 0.18));

function makeLabel(text, y) {
  const el = document.createElement("div");
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.set(0, y, 0);
  obj.userData.labelText = text;
  layerObjs.labels.push(obj);
  return obj;
}

function planetMat(map, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map,
    roughness: extra.roughness ?? 0.72,
    metalness: extra.metalness ?? 0.04,
    emissive: extra.emissive ?? 0x000000,
    emissiveMap: extra.emissiveMap ?? null,
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    bumpMap: extra.bumpMap ?? map,
    bumpScale: extra.bumpScale ?? 0.012,
  });
}

function addAtmosphere(parent, radius, color, gain, pow, aurora = 0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPow: { value: pow },
      uGain: { value: gain },
      uTime: { value: 0 },
      uAurora: { value: aurora },
    },
    vertexShader: atmVert,
    fragmentShader: atmFrag,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  mat.userData.baseGain = gain;
  const mesh = new THREE.Mesh(unitSphere(36), mat);
  mesh.scale.setScalar(radius);
  parent.add(mesh);
  layerObjs.atmospheres.push(mesh);
  atmMats.push(mat);
  return mat;
}

function addRings(parent, inner, outer, tex, tilt = 0) {
  const geo = new THREE.RingGeometry(inner, outer, 160, 6);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    uv.setXY(i, Math.atan2(y, x) / (Math.PI * 2) + 0.5, (r - inner) / (outer - inner));
  }
  uv.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.55,
    metalness: 0.12,
    alphaTest: 0.04,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2 + tilt;
  parent.add(mesh);
  return mesh;
}

function ellipsePts(a, e, n) {
  const pts = [];
  const ee = elliptical ? e : 0;
  for (let i = 0; i <= n; i++) {
    const M = (i / n) * Math.PI * 2;
    const E = M + ee * Math.sin(M);
    pts.push(new THREE.Vector3(a * (Math.cos(E) - ee), 0, a * Math.sqrt(Math.max(0, 1 - ee * ee)) * Math.sin(E)));
  }
  return pts;
}

function kepler(a, e, M) {
  const ee = elliptical ? e : 0;
  const E = M + ee * Math.sin(M) + 0.5 * ee * ee * Math.sin(2 * M);
  return [a * (Math.cos(E) - ee), a * Math.sqrt(Math.max(0, 1 - ee * ee)) * Math.sin(E)];
}

const movers = [];
const atmMats = [coronaMat];

function addOrbitLine(root, a, e, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(ellipsePts(a, e, 256));
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geo, mat);
  root.add(line);
  orbitRecords.push({ line, a, e });
  layerObjs.orbits.push(line);
  return line;
}

function mountMoon(parent, spec, planetR) {
  const pivot = new THREE.Group();
  parent.add(pivot);
  layerObjs.moons.push(pivot);
  const r = spec.r * planetScale;
  const mesh = new THREE.Mesh(unitSphere(SEG_SMALL), planetMat(spec.map ?? maps.moon, { roughness: 0.86, bumpScale: 0.02 }));
  mesh.scale.setScalar(r);
  const dist = spec.dist * planetScale;
  mesh.position.set(dist, 0, 0);
  pivot.add(mesh);
  if (spec.atm) addAtmosphere(mesh, 1.18, spec.atm, 0.7, 2.4);
  if (spec.name) mesh.add(makeLabel(spec.name, 1.35));
  addOrbitLine(pivot, dist, 0.02, 0x667788);
  movers.push({
    kind: "moon",
    body: mesh,
    a: dist,
    e: 0.02,
    period: spec.period,
    phase: spec.phase ?? Math.random() * Math.PI * 2,
    spin: spec.spin ?? 6,
  });
  return mesh;
}

const BODIES = [
  {
    name: "Mercury",
    a: 2.85,
    e: 0.205,
    inc: 7,
    period: 0.241,
    spin: 3.2,
    tilt: 0.03,
    r: 0.145,
    map: maps.mercury,
    color: 0xb0a89c,
    phase: 0.4,
  },
  {
    name: "Venus",
    a: 4.15,
    e: 0.007,
    inc: 3.4,
    period: 0.615,
    spin: -1.15,
    tilt: 177,
    r: 0.23,
    map: maps.venus,
    color: 0xe6c98a,
    atm: { c: 0xffd9a0, g: 0.85, p: 2.1, s: 1.06 },
    clouds: { map: maps.venus, s: 1.018, op: 0.35 },
    phase: 1.7,
    rough: 0.55,
  },
  {
    name: "Earth",
    a: 5.55,
    e: 0.017,
    inc: 0,
    period: 1,
    spin: 8.2,
    tilt: 23.4,
    r: 0.245,
    map: maps.earth,
    color: 0x4d8fd6,
    atm: { c: 0x6eb6ff, g: 1.15, p: 2.8, s: 1.12, aurora: 0.9 },
    clouds: { map: maps.earthCloud, s: 1.02, op: 0.55 },
    night: maps.earthNight,
    phase: 0.15,
    rough: 0.48,
    moons: [{ name: "Moon", dist: 0.62, r: 0.067, period: 0.075, map: maps.moon, spin: 2.4 }],
  },
  {
    name: "Mars",
    a: 7.15,
    e: 0.093,
    inc: 1.85,
    period: 1.881,
    spin: 7.8,
    tilt: 25.2,
    r: 0.168,
    map: maps.mars,
    color: 0xc1440e,
    atm: { c: 0xff8a5a, g: 0.45, p: 3.2, s: 1.08 },
    phase: 2.4,
    moons: [
      { name: "Phobos", dist: 0.3, r: 0.02, period: 0.009, spin: 10 },
      { name: "Deimos", dist: 0.42, r: 0.014, period: 0.03, spin: 5 },
    ],
  },
  {
    name: "Jupiter",
    a: 11.35,
    e: 0.049,
    inc: 1.3,
    period: 11.86,
    spin: 18,
    tilt: 3.1,
    r: 0.74,
    map: maps.jupiter,
    color: 0xd4b48a,
    atm: { c: 0xe8d2a8, g: 0.4, p: 3.4, s: 1.06 },
    rings: { kind: "jup", inner: 1.12, outer: 1.55 },
    phase: 5.1,
    rough: 0.62,
    moons: [
      { name: "Io", dist: 1.22, r: 0.052, period: 0.18, map: maps.io, spin: 4 },
      { name: "Europa", dist: 1.48, r: 0.044, period: 0.36, map: maps.europa, spin: 3 },
      { name: "Ganymede", dist: 1.82, r: 0.06, period: 0.72, map: maps.ganymede, spin: 2.2 },
      { name: "Callisto", dist: 2.22, r: 0.054, period: 1.4, map: maps.callisto, spin: 1.6 },
    ],
  },
  {
    name: "Saturn",
    a: 15.15,
    e: 0.057,
    inc: 2.5,
    period: 29.46,
    spin: 16,
    tilt: 26.7,
    r: 0.62,
    map: maps.saturn,
    color: 0xe8d9a6,
    atm: { c: 0xffe8b0, g: 0.35, p: 3.2, s: 1.055 },
    rings: { kind: "saturn", inner: 1.22, outer: 2.35 },
    phase: 3.6,
    moons: [{ name: "Titan", dist: 1.55, r: 0.055, period: 0.44, map: maps.titan, atm: 0xffc080, spin: 2 }],
  },
  {
    name: "Uranus",
    a: 18.85,
    e: 0.046,
    inc: 0.8,
    period: 84,
    spin: -10,
    tilt: 97.8,
    r: 0.39,
    map: maps.uranus,
    color: 0x9fe7e4,
    atm: { c: 0xb0fff8, g: 0.4, p: 3.0, s: 1.07 },
    rings: { kind: "uranus", inner: 1.35, outer: 1.95 },
    phase: 1.1,
    rough: 0.45,
  },
  {
    name: "Neptune",
    a: 22.35,
    e: 0.01,
    inc: 1.8,
    period: 164.8,
    spin: 12,
    tilt: 28.3,
    r: 0.38,
    map: maps.neptune,
    color: 0x3a6adf,
    atm: { c: 0x5a8cff, g: 0.55, p: 2.9, s: 1.08 },
    phase: 4.8,
    rough: 0.42,
  },
  {
    name: "Pluto",
    a: 25.6,
    e: 0.25,
    inc: 17.1,
    period: 248,
    spin: -4.5,
    tilt: 122,
    r: 0.1,
    map: maps.pluto,
    color: 0xd2c4b0,
    phase: 0.9,
    moons: [{ name: "Charon", dist: 0.26, r: 0.05, period: 0.017, map: maps.charon, spin: 8 }],
  },
];

for (const b of BODIES) {
  const root = new THREE.Group();
  root.rotation.z = (b.inc * Math.PI) / 180;
  scene.add(root);
  addOrbitLine(root, b.a, b.e, b.color);

  const body = new THREE.Group();
  root.add(body);
  planetBodies.push(body);

  const tiltG = new THREE.Group();
  tiltG.rotation.z = (b.tilt * Math.PI) / 180;
  body.add(tiltG);

  const spinG = new THREE.Group();
  tiltG.add(spinG);

  const r = b.r * planetScale;
  const extra = {
    roughness: b.rough ?? 0.72,
    bumpScale: 0.016,
  };
  if (b.night) {
    extra.emissive = 0xffcc88;
    extra.emissiveMap = b.night;
    extra.emissiveIntensity = 0.85;
  }
  const mesh = new THREE.Mesh(unitSphere(b.r > 0.4 ? SEG : Math.max(32, SEG - 16)), planetMat(b.map, extra));
  mesh.scale.setScalar(r);
  spinG.add(mesh);

  if (b.clouds) {
    const cmat = new THREE.MeshStandardMaterial({
      map: b.clouds.map,
      transparent: true,
      opacity: b.clouds.op,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
    const clouds = new THREE.Mesh(unitSphere(SEG), cmat);
    clouds.scale.setScalar(r * b.clouds.s);
    spinG.add(clouds);
    movers.push({ kind: "spin", body: clouds, spin: b.spin * 0.7, period: 1e9, a: 0, e: 0, phase: 0 });
  }

  if (b.atm) {
    addAtmosphere(tiltG, r * b.atm.s, b.atm.c, b.atm.g, b.atm.p, b.atm.aurora ?? 0);
  }
  if (b.rings) {
    const tex = ringTex(b.rings.kind);
    addRings(tiltG, r * b.rings.inner, r * b.rings.outer, tex);
  }

  if (b.moons) {
    for (const m of b.moons) mountMoon(tiltG, m, r);
  }

  body.add(makeLabel(b.name, r + 0.18));

  movers.push({
    kind: "planet",
    body,
    spinG,
    a: b.a,
    e: b.e,
    period: b.period,
    phase: b.phase,
    spin: b.spin,
  });
}

sun.add(makeLabel("Sol", SUN_R + 0.28));

function makeBelt(count, r0, r1, ySpread, size0, size1, pal, speed) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.08, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const items = [];
  const color = new THREE.Color();
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  for (let i = 0; i < count; i++) {
    const u = h3(i, 1.7, 9);
    const a = lerp(r0, r1, u);
    const th = h3(i, 2.2, 4) * Math.PI * 2;
    const e = 0.04 + h3(i, 3, 1) * 0.08;
    const y = (h3(i, 5, 2) - 0.5) * ySpread;
    const s = lerp(size0, size1, h3(i, 8, 3));
    const rx = h3(i, 1, 1) * Math.PI * 2;
    const ry = h3(i, 2, 2) * Math.PI * 2;
    const rz = h3(i, 3, 3) * Math.PI * 2;
    items.push({ a, th, e, y, s, rx, ry, rz, tw: lerp(0.2, 1.4, h3(i, 9, 4)) });
    color.setHSL(pal.h + (h3(i, 4, 6) - 0.5) * pal.dh, pal.s, pal.l + (h3(i, 7, 1) - 0.5) * 0.12);
    mesh.setColorAt(i, color);
    dummy.position.set(a * Math.cos(th), y, a * Math.sin(th));
    dummy.scale.setScalar(s);
    dummy.rotation.set(rx, ry, rz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return { mesh, items, dummy, speed };
}

const asteroidBelt = makeBelt(AST_N, 8.15, 9.55, 0.28, 0.012, 0.045, { h: 0.08, dh: 0.04, s: 0.35, l: 0.42 }, 0.72);
const kuiperBelt = makeBelt(KUIPER_N, 26.6, 31.2, 1.1, 0.018, 0.055, { h: 0.55, dh: 0.08, s: 0.15, l: 0.62 }, 0.11);
layerObjs.asteroids.push(asteroidBelt.mesh);
layerObjs.kuiper.push(kuiperBelt.mesh);

let comet = null, cometTail = null, cometTail2 = null;
{
  const root = new THREE.Group();
  root.rotation.z = 0.32;
  scene.add(root);
  layerObjs.comet.push(root);
  addOrbitLine(root, 16.8, 0.78, 0x88ddff);
  const body = new THREE.Group();
  root.add(body);
  const core = new THREE.Mesh(
    unitSphere(16),
    new THREE.MeshStandardMaterial({ color: 0xccddff, emissive: 0x88aaff, emissiveIntensity: 0.4, roughness: 0.5 })
  );
  core.scale.setScalar(0.07 * planetScale);
  cometCore = core;
  body.add(core);
  body.add(makeLabel("Comet", 0.16));
  const mkTail = (n, color, size) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const p = new THREE.Points(g, m);
    body.add(p);
    return { g, n, p, seeds: Float32Array.from({ length: n * 3 }, (_, i) => h3(i * 0.17, 2, 9) - 0.5), drawN: n };
  };
  cometTail = mkTail(420, 0xaad4ff, 0.09);
  cometTail2 = mkTail(280, 0xffcc88, 0.07);
  comet = { body, a: 16.8, e: 0.78, period: 18.5, phase: 2.1 };
  movers.push({ kind: "planet", body, a: comet.a, e: comet.e, period: comet.period, phase: comet.phase, spin: 0, spinG: core });
}

const ecliptic = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 26, 96, 1),
  new THREE.MeshBasicMaterial({
    color: 0xffdca0,
    transparent: true,
    opacity: 0.035,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
ecliptic.rotation.x = -Math.PI / 2;
scene.add(ecliptic);

function milkyTex() {
  return canvasTex(1024, 512, (d, W, H) => {
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const band = Math.exp(-Math.pow((v - 0.5) / 0.09, 2));
        const dust = fbm(u * 8, v * 4, 2.2, 4);
        const star = h3(x * 0.37, y * 0.61, 3.1);
        const neb = fbm(u * 4 + 2, v * 3, 5, 3);
        let r = 4 + band * dust * 38 + neb * band * 18, g = 5 + band * dust * 32 + neb * band * 10, b = 10 + band * dust * 28;
        if (star > 0.985) {
          const t = (star - 0.985) / 0.015;
          r += 180 * t;
          g += 180 * t;
          b += 200 * t;
        }
        const i = (y * W + x) << 2;
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255;
      }
    }
  });
}
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(380, 32, 20),
  new THREE.MeshBasicMaterial({ map: milkyTex(), side: THREE.BackSide, depthWrite: false })
);
scene.add(sky);

function starfield(n, radius, size, bright) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = h3(i, 1, 8);
    const v = h3(i, 4, 3);
    const th = u * Math.PI * 2;
    const ph = Math.acos(2 * v - 1);
    const rr = radius * (0.86 + h3(i, 7, 2) * 0.14);
    pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = rr * Math.cos(ph);
    pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
    const sp = h3(i, 9, 1);
    const temp = h3(i, 2, 6);
    const mag = bright ? 0.75 + sp * 0.25 : 0.35 + sp * 0.45;
    col[i * 3] = mag * lerp(0.7, 1, temp);
    col[i * 3 + 1] = mag * lerp(0.8, 1, Math.abs(temp - 0.4));
    col[i * 3 + 2] = mag * lerp(1, 0.75, temp);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
}
starsDim = starfield(STAR_N, 320, 0.42, false);
starsBright = starfield((STAR_N / 7) | 0, 300, 0.95, true);
scene.add(starsDim);
scene.add(starsBright);

const windPos = new Float32Array(WIND_N * 3);
const windSeed = [];
for (let i = 0; i < WIND_N; i++) {
  const th = h3(i, 1, 2) * Math.PI * 2;
  const ph = Math.acos(2 * h3(i, 3, 4) - 1);
  const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
  const rad = 1.4 + h3(i, 5, 6) * 18;
  windSeed.push({ dir, rad, sp: 1.5 + h3(i, 8, 1) * 4 });
  windPos[i * 3] = dir.x * rad;
  windPos[i * 3 + 1] = dir.y * rad;
  windPos[i * 3 + 2] = dir.z * rad;
}
const windGeo = new THREE.BufferGeometry();
windGeo.setAttribute("position", new THREE.BufferAttribute(windPos, 3));
const wind = new THREE.Points(
  windGeo,
  new THREE.PointsMaterial({
    color: 0xffcc66,
    size: 0.06,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(wind);

const meteor = {
  line: null,
  t: 0,
  life: 0,
  from: new THREE.Vector3(),
  vel: new THREE.Vector3(),
};
{
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  const m = new THREE.LineBasicMaterial({
    color: 0xfff4d0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  meteor.line = new THREE.Line(g, m);
  scene.add(meteor.line);
}

function placeBelt(belt, years) {
  if (!belt) return;
  const { mesh, items, dummy, speed } = belt;
  const dummyQuat = dummy.quaternion;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const M = it.th + years * speed * (8 / it.a);
    const [x, z] = kepler(it.a, it.e, M);
    dummy.position.set(x, it.y, z);
    dummy.rotation.set(it.rx + years * it.tw, it.ry + years * it.tw * 0.6, it.rz);
    dummy.scale.setScalar(it.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  void dummyQuat;
}

function updateTail(tail, years) {
  if (!tail || !comet) return;
  const n = tail.drawN ?? tail.n;
  const pos = tail.g.attributes.position.array;
  const away = comet.body.position.clone().normalize();
  const side = new THREE.Vector3(-away.z, 0.15, away.x).normalize();
  const up = new THREE.Vector3().crossVectors(away, side).normalize();
  const stretch = 0.55 + 2.4 * (1 - Math.min(1, comet.body.position.length() / 22));
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const sx = tail.seeds[i * 3];
    const sy = tail.seeds[i * 3 + 1];
    const sz = tail.seeds[i * 3 + 2];
    const along = k * stretch * (2.2 + (tail === cometTail ? 1.6 : 0.7));
    const spread = k * k * 0.55;
    const wob = 0.12 * Math.sin(years * 8 + i);
    pos[i * 3] = away.x * along + (side.x * sx + up.x * sy) * spread + away.x * wob * sz;
    pos[i * 3 + 1] = away.y * along + (side.y * sx + up.y * sy) * spread;
    pos[i * 3 + 2] = away.z * along + (side.z * sx + up.z * sy) * spread + away.z * wob * sz * 0.5;
  }
  tail.g.attributes.position.needsUpdate = true;
}

export function applyParams(params, change) {
  void change;
  timeScale = params.time_scale ?? 0.2;
  elliptical = params.elliptical !== false;
  const L = new Set(params.layers ?? ["orbits", "labels", "moons", "asteroids", "atmospheres", "comet", "kuiper"]);
  const ps = params.planet_scale ?? 1;
  const glow = params.sun_glow ?? 1.1;
  const detail = params.detail ?? "high";

  for (const rec of orbitRecords) {
    rec.line.geometry.setFromPoints(ellipsePts(rec.a, rec.e, 256));
  }

  for (const key of Object.keys(layerObjs)) {
    const on = L.has(key);
    for (const obj of layerObjs[key]) {
      if (key === "labels") obj.element.textContent = on ? obj.userData.labelText : "";
      else obj.visible = on;
    }
  }

  for (const g of planetBodies) g.scale.setScalar(ps);
  if (cometCore) cometCore.scale.setScalar(0.07 * planetScale * ps);

  sunMat.uniforms.uGlow.value = glow;
  coronaMat.uniforms.uGlow.value = glow;
  for (const s of glowSprites) {
    s.scale.setScalar(s.userData.baseSize * glow);
    s.material.opacity = 0.95 * glow;
  }
  for (const mesh of layerObjs.atmospheres) {
    const mat = mesh.material;
    if (mat.userData.baseGain != null) mat.uniforms.uGain.value = mat.userData.baseGain * glow;
  }

  const astN = detail === "high" ? AST_N : detail === "medium" ? 220 : 90;
  const kuiN = detail === "high" ? KUIPER_N : detail === "medium" ? 120 : 40;
  const starN = detail === "high" ? STAR_N : detail === "medium" ? 3800 : 1600;
  windCount = detail === "high" ? WIND_N : 140;
  const tailN = detail === "low" ? 180 : 420;
  const tail2N = detail === "low" ? 120 : 280;

  if (asteroidBelt) asteroidBelt.mesh.count = astN;
  if (kuiperBelt) kuiperBelt.mesh.count = kuiN;
  if (starsDim) starsDim.geometry.setDrawRange(0, starN);
  if (starsBright) starsBright.geometry.setDrawRange(0, (starN / 7) | 0);
  windGeo.setDrawRange(0, windCount);
  if (cometTail) {
    cometTail.drawN = tailN;
    cometTail.g.setDrawRange(0, tailN);
  }
  if (cometTail2) {
    cometTail2.drawN = tail2N;
    cometTail2.g.setDrawRange(0, tail2N);
  }
}
applyParams(params, { key: "", value: params });

export function update(t, dt) {
  const ts = timeScale;
  const years = t * ts / 25;
  sunMat.uniforms.uTime.value = t;
  coronaMat.uniforms.uTime.value = t;
  sun.rotation.y = t * 0.08;
  for (const am of atmMats) {
    if (am.uniforms.uTime) am.uniforms.uTime.value = t;
  }

  for (const m of movers) {
    if (m.a > 0) {
      const M = (years / m.period) * Math.PI * 2 + m.phase;
      const [x, z] = kepler(m.a, m.e, M);
      m.body.position.set(x, 0, z);
    }
    if (m.spinG) m.spinG.rotation.y = years * m.spin;
    else if (m.kind === "spin") m.body.rotation.y = years * m.spin;
    else if (m.kind === "moon") m.body.rotation.y = years * m.spin;
  }

  placeBelt(asteroidBelt, years);
  placeBelt(kuiperBelt, years);
  if (comet) {
    updateTail(cometTail, years);
    updateTail(cometTail2, years);
  }

  const wpos = windGeo.attributes.position.array;
  for (let i = 0; i < windCount; i++) {
    const s = windSeed[i];
    s.rad += dt * s.sp * (0.4 + ts * 0.04);
    if (s.rad > 22) s.rad = 1.35 + h3(i, t, 1) * 0.4;
    wpos[i * 3] = s.dir.x * s.rad;
    wpos[i * 3 + 1] = s.dir.y * s.rad;
    wpos[i * 3 + 2] = s.dir.z * s.rad;
  }
  windGeo.attributes.position.needsUpdate = true;

  meteor.life -= dt;
  if (meteor.life <= 0 && Math.random() < dt * 0.22) {
    const th = Math.random() * Math.PI * 2;
    const ph = (Math.random() - 0.5) * 0.7;
    meteor.from.set(Math.cos(th) * 14, 3 + Math.random() * 4, Math.sin(th) * 14);
    meteor.vel.set(-Math.sin(th) * 9, -2 - Math.random() * 3, Math.cos(th) * 9);
    meteor.life = 0.7 + Math.random() * 0.5;
    meteor.t = 0;
  }
  if (meteor.life > 0) {
    meteor.t += dt;
    const a = meteor.from.clone().addScaledVector(meteor.vel, meteor.t);
    const b = a.clone().addScaledVector(meteor.vel, -0.18);
    const arr = meteor.line.geometry.attributes.position.array;
    arr[0] = a.x;
    arr[1] = a.y;
    arr[2] = a.z;
    arr[3] = b.x;
    arr[4] = b.y;
    arr[5] = b.z;
    meteor.line.geometry.attributes.position.needsUpdate = true;
    meteor.line.material.opacity = Math.min(1, meteor.life * 2) * 0.85;
  } else {
    meteor.line.material.opacity = 0;
  }
}
