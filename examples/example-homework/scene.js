import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const scene = new THREE.Scene();

const L = Number(params.L ?? 0.8);
const m = Number(params.m ?? 0.25);
const theta0Deg = Number(params.theta0 ?? 30);
const g = Number(params.g ?? 9.8);
const theta0 = (theta0Deg * Math.PI) / 180;
const mode = params.mode ?? "animate";
const overlays = new Set(params.overlays ?? ["path", "forces", "energy", "height"]);

const hDrop = L * (1 - Math.cos(theta0));
const vBottom = Math.sqrt(Math.max(0, 2 * g * hDrop));
const TBottom = m * (g + (vBottom * vBottom) / L);
const ETot = m * g * hDrop;
const mg = m * g;

const pivot = new THREE.Vector3(0, 0, 0);
const bobR = 0.05 * Math.cbrt(Math.max(m, 0.05) / 0.25);
const arcR = Math.min(0.22, 0.28 * L);

const col = {
  support: 0x8b95a3,
  string: 0x9eb0c2,
  bob: 0x3d8bfd,
  ghost: 0x7aa7e0,
  path: 0x5b8fd6,
  vertical: 0x6a7380,
  angle: 0xf0a05a,
  vel: 0x3dd68c,
  tension: 0xff6b4a,
  weight: 0xc084fc,
  pe: 0x5b9dff,
  ke: 0xff9f43,
  height: 0x7dcea0,
  mark: 0x8b95a3,
};

function label(text) {
  const el = document.createElement("div");
  el.textContent = text;
  const obj = new CSS2DObject(el);
  scene.add(obj);
  return { el, obj };
}

function setLabel(item, text, x, y, on) {
  item.el.textContent = on ? text : "";
  item.obj.position.set(x, y, 0.04);
  item.obj.visible = Boolean(on && text);
}

function lineGeom(points) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return geo;
}

function addLine(points, material) {
  const mesh = new THREE.Line(lineGeom(points), material);
  if (material.isLineDashedMaterial) mesh.computeLineDistances();
  scene.add(mesh);
  return mesh;
}

const supportMat = new THREE.MeshBasicMaterial({ color: col.support });
const support = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.04), supportMat);
support.position.set(0, 0.01, 0);
scene.add(support);

const pivotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), supportMat);
scene.add(pivotMesh);

const vertical = addLine(
  [new THREE.Vector3(0, 0.02, -0.02), new THREE.Vector3(0, -L - 0.08, -0.02)],
  new THREE.LineDashedMaterial({ color: col.vertical, dashSize: 0.045, gapSize: 0.028, depthTest: false }),
);

const pathCurve = new THREE.EllipseCurve(0, 0, L, L, -Math.PI / 2 - theta0, -Math.PI / 2 + theta0, false, 0);
const pathLine = addLine(
  pathCurve.getPoints(64),
  new THREE.LineBasicMaterial({ color: col.path, transparent: true, opacity: 0.45, depthTest: false }),
);
pathLine.visible = overlays.has("path");

const startPos = new THREE.Vector3(L * Math.sin(theta0), -L * Math.cos(theta0), 0);
const ghostString = addLine(
  [pivot.clone(), startPos.clone()],
  new THREE.LineDashedMaterial({ color: col.ghost, dashSize: 0.04, gapSize: 0.025, depthTest: false }),
);
const ghostBob = new THREE.Mesh(
  new THREE.SphereGeometry(bobR, 16, 12),
  new THREE.MeshBasicMaterial({ color: col.ghost, transparent: true, opacity: 0.28, depthTest: false }),
);
ghostBob.position.copy(startPos);
scene.add(ghostBob);

const bottomMark = addLine(
  [new THREE.Vector3(-0.07, -L, -0.01), new THREE.Vector3(0.07, -L, -0.01)],
  new THREE.LineBasicMaterial({ color: col.mark, depthTest: false }),
);

const hTop = -L * Math.cos(theta0);
const hX = startPos.x + bobR + 0.08;
const heightGroup = new THREE.Group();
const heightMat = new THREE.LineBasicMaterial({ color: col.height, depthTest: false });
heightGroup.add(new THREE.Line(lineGeom([new THREE.Vector3(hX - 0.04, hTop, 0), new THREE.Vector3(hX + 0.04, hTop, 0)]), heightMat));
heightGroup.add(new THREE.Line(lineGeom([new THREE.Vector3(hX, hTop, 0), new THREE.Vector3(hX, -L, 0)]), heightMat));
heightGroup.add(new THREE.Line(lineGeom([new THREE.Vector3(hX - 0.04, -L, 0), new THREE.Vector3(hX + 0.04, -L, 0)]), heightMat));
scene.add(heightGroup);
heightGroup.visible = overlays.has("height");

const stringGeo = new THREE.BufferGeometry();
stringGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
const stringLine = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: col.string, depthTest: false }));
scene.add(stringLine);

const bob = new THREE.Mesh(new THREE.SphereGeometry(bobR, 20, 16), new THREE.MeshBasicMaterial({ color: col.bob }));
scene.add(bob);

const angleLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: col.angle, depthTest: false }),
);
scene.add(angleLine);

const velArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.2, col.vel, 0.07, 0.045);
const tArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.2, col.tension, 0.07, 0.045);
const wArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.2, col.weight, 0.07, 0.045);
scene.add(velArrow, tArrow, wArrow);

const energyX = L + 0.42;
const barH = L;
const barW = 0.07;
const energyBase = -L;
const trackMat = new THREE.LineBasicMaterial({ color: col.mark, transparent: true, opacity: 0.7, depthTest: false });
const peMat = new THREE.MeshBasicMaterial({ color: col.pe, depthTest: false });
const keMat = new THREE.MeshBasicMaterial({ color: col.ke, depthTest: false });

function makeBar(mat, x) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(barW, 1, 0.02), mat);
  mesh.position.x = x;
  mesh.position.z = -0.01;
  scene.add(mesh);
  return mesh;
}

const peBar = makeBar(peMat, energyX);
const keBar = makeBar(keMat, energyX + 0.11);
const peTrack = addLine(
  [
    new THREE.Vector3(energyX - barW / 2, energyBase, 0),
    new THREE.Vector3(energyX + barW / 2, energyBase, 0),
    new THREE.Vector3(energyX + barW / 2, energyBase + barH, 0),
    new THREE.Vector3(energyX - barW / 2, energyBase + barH, 0),
    new THREE.Vector3(energyX - barW / 2, energyBase, 0),
  ],
  trackMat,
);
const keTrack = addLine(
  [
    new THREE.Vector3(energyX + 0.11 - barW / 2, energyBase, 0),
    new THREE.Vector3(energyX + 0.11 + barW / 2, energyBase, 0),
    new THREE.Vector3(energyX + 0.11 + barW / 2, energyBase + barH, 0),
    new THREE.Vector3(energyX + 0.11 - barW / 2, energyBase + barH, 0),
    new THREE.Vector3(energyX + 0.11 - barW / 2, energyBase, 0),
  ],
  trackMat,
);
const energyOn = overlays.has("energy");
peBar.visible = keBar.visible = peTrack.visible = keTrack.visible = energyOn;

const labSupport = label("fixed support");
const labL = label("$L$");
const labTheta = label("$\\theta$");
const labH = label("$h$");
const labBottom = label("bottom");
const labV = label("$\\vec v$");
const labT = label("$T$");
const labW = label("$mg$");
const labPE = label("$U$");
const labKE = label("$K$");
const labLive = label("");
const labAns = label("");

setLabel(labSupport, "fixed support", 0.28, 0.07, true);
setLabel(labBottom, "bottom", 0.16, -L - 0.02, true);
setLabel(labH, `$h=${hDrop.toFixed(3)}\\,\\mathrm{m}$`, hX + 0.16, (hTop - L) / 2, overlays.has("height"));
setLabel(
  labAns,
  `$v_{\\mathrm{bottom}}=${vBottom.toFixed(3)}\\,\\mathrm{m/s}$\\quad $T_{\\mathrm{bottom}}=${TBottom.toFixed(3)}\\,\\mathrm{N}$`,
  0.15,
  0.22,
  true,
);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(0.38, -0.34, 3.3);
camera.lookAt(0.38, -0.34, 0);

let theta = theta0;
let omega = 0;
if (mode === "at bottom") {
  theta = 0;
  omega = -vBottom / L;
} else if (mode === "at release") {
  theta = theta0;
  omega = 0;
}

function accel(th) {
  return -(g / L) * Math.sin(th);
}

function rk4(h) {
  const k1t = omega;
  const k1o = accel(theta);
  const k2t = omega + 0.5 * h * k1o;
  const k2o = accel(theta + 0.5 * h * k1t);
  const k3t = omega + 0.5 * h * k2o;
  const k3o = accel(theta + 0.5 * h * k2t);
  const k4t = omega + h * k3o;
  const k4o = accel(theta + h * k3t);
  theta += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
  omega += (h / 6) * (k1o + 2 * k2o + 2 * k3o + k4o);
}

function setArrow(helper, origin, dir, length, on) {
  const len = Math.max(length, 0);
  helper.visible = Boolean(on && len > 1e-4);
  if (!helper.visible) return;
  helper.position.copy(origin);
  helper.setDirection(dir);
  helper.setLength(len, Math.min(0.08, 0.28 * len), Math.min(0.05, 0.18 * len));
}

function setBar(mesh, x, height) {
  const h = Math.max(height, 1e-4);
  mesh.scale.set(1, h, 1);
  mesh.position.set(x, energyBase + h / 2, -0.01);
  mesh.visible = energyOn && height > 1e-4;
}

function applyPose() {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const bobPos = new THREE.Vector3(L * s, -L * c, 0);
  const arr = stringGeo.attributes.position.array;
  arr[0] = 0;
  arr[1] = 0;
  arr[2] = 0;
  arr[3] = bobPos.x;
  arr[4] = bobPos.y;
  arr[5] = bobPos.z;
  stringGeo.attributes.position.needsUpdate = true;
  stringGeo.computeBoundingSphere();
  bob.position.copy(bobPos);

  const a0 = -Math.PI / 2;
  const a1 = -Math.PI / 2 + theta;
  const curve = new THREE.EllipseCurve(0, 0, arcR, arcR, Math.min(a0, a1), Math.max(a0, a1), false, 0);
  angleLine.geometry.dispose();
  angleLine.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
  angleLine.visible = Math.abs(theta) > 0.02;

  const speed = Math.abs(omega * L);
  const U = m * g * L * (1 - c);
  const K = Math.max(0, ETot - U);
  const T = m * (g * c + (speed * speed) / L);

  const vDir = new THREE.Vector3(c, s, 0);
  if (omega < 0) vDir.multiplyScalar(-1);
  if (vDir.lengthSq() > 0) vDir.normalize();
  const vLen = Math.min(0.5, 0.12 + 0.22 * speed);
  setArrow(velArrow, bobPos, vDir, vLen, speed > 0.04);

  const showF = overlays.has("forces");
  const tDir = new THREE.Vector3(-s, c, 0);
  const fScale = 0.13;
  setArrow(tArrow, bobPos, tDir, fScale * T, showF);
  setArrow(wArrow, bobPos, new THREE.Vector3(0, -1, 0), fScale * mg, showF);

  setBar(peBar, energyX, ETot > 1e-9 ? (U / ETot) * barH : 0);
  setBar(keBar, energyX + 0.11, ETot > 1e-9 ? (K / ETot) * barH : 0);

  const mid = new THREE.Vector3(0.5 * L * s, -0.5 * L * c, 0);
  setLabel(labL, `$L=${L.toFixed(2)}\\,\\mathrm{m}$`, mid.x + 0.1 * c, mid.y + 0.1 * s, true);
  setLabel(labTheta, `$\\theta=${((theta * 180) / Math.PI).toFixed(1)}^\\circ$`, arcR * Math.sin(theta * 0.55) + 0.08, -arcR * Math.cos(theta * 0.55), Math.abs(theta) > 0.02);
  const vTip = bobPos.clone().addScaledVector(vDir, vLen + 0.04);
  setLabel(labV, `$v=${speed.toFixed(2)}\\,\\mathrm{m/s}$`, vTip.x, vTip.y, speed > 0.05);
  setLabel(labT, `$T=${T.toFixed(2)}\\,\\mathrm{N}$`, bobPos.x - 0.18 * s, bobPos.y + 0.18 * c, showF);
  setLabel(labW, "$mg$", bobPos.x + 0.12, bobPos.y - fScale * mg - 0.06, showF);
  setLabel(labPE, `$U=${U.toFixed(3)}\\,\\mathrm{J}$`, energyX, energyBase + barH + 0.08, energyOn);
  setLabel(labKE, `$K=${K.toFixed(3)}\\,\\mathrm{J}$`, energyX + 0.22, energyBase + barH + 0.08, energyOn);

  const place =
    Math.abs(theta - theta0) < 0.03 && Math.abs(omega) < 0.08
      ? "at release ($v=0$)"
      : Math.abs(theta) < 0.04
        ? "at bottom"
        : "swinging";
  setLabel(
    labLive,
    `$\\theta=${((theta * 180) / Math.PI).toFixed(1)}^\\circ$\\quad $v=${speed.toFixed(2)}\\,\\mathrm{m/s}$\\quad $T=${T.toFixed(2)}\\,\\mathrm{N}$\\quad ${place}`,
    0.2,
    -L - 0.2,
    true,
  );
}

applyPose();

export function update(t, dt) {
  if (mode === "animate") {
    let remain = Math.min(Math.max(dt, 0), 0.05);
    const h = 1 / 240;
    while (remain > 1e-8) {
      const step = Math.min(h, remain);
      rk4(step);
      remain -= step;
    }
  }
  applyPose();
}

export { camera };
