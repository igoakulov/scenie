import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const scene = new THREE.Scene();

const COL = {
  i: 0xc0392b,
  j: 0x1e8449,
  k: 0x2471a3,
  u: 0xd35400,
  v: 0x6c3483,
  sum: 0x0e6655,
  scaled: 0xb7950b,
  dash: 0x7f8c8d,
  origin: 0x2c3e50,
};

const u = new THREE.Vector3(params.u_x ?? 0, params.u_y ?? 0, params.u_z ?? 0);
const v = new THREE.Vector3(params.v_x ?? 0, params.v_y ?? 0, params.v_z ?? 0);
const w = u.clone().add(v);
const c = params.c ?? 1;
const cu = u.clone().multiplyScalar(c);
const layers = new Set(params.layers ?? []);
const showLabels = params.show_labels !== false;

const origin = new THREE.Vector3();

scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshBasicMaterial({ color: COL.origin }),
  ),
);

function addArrow(dir, color) {
  const len = dir.length();
  if (len < 1e-4) return null;
  const headLen = Math.min(0.22, Math.max(0.08, len * 0.18));
  const arrow = new THREE.ArrowHelper(dir.clone().normalize(), origin, len, color, headLen, headLen * 0.55);
  scene.add(arrow);
  return arrow;
}

function addLabel(pos, text) {
  if (!showLabels || !text) return;
  const el = document.createElement("div");
  el.textContent = text;
  const obj = new CSS2DObject(el);
  const n = pos.lengthSq() < 1e-8 ? new THREE.Vector3(0.12, 0.12, 0) : pos.clone().normalize().multiplyScalar(0.16);
  obj.position.copy(pos).add(n);
  scene.add(obj);
}

function addDashed(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({
      color: COL.dash,
      dashSize: 0.12,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.75,
    }),
  );
  line.computeLineDistances();
  scene.add(line);
}

if (layers.has("basis")) {
  const i = new THREE.Vector3(1, 0, 0);
  const j = new THREE.Vector3(0, 1, 0);
  const k = new THREE.Vector3(0, 0, 1);
  addArrow(i, COL.i);
  addArrow(j, COL.j);
  addArrow(k, COL.k);
  addLabel(i, "$\\hat{\\imath}$");
  addLabel(j, "$\\hat{\\jmath}$");
  addLabel(k, "$\\hat{k}$");
}

if (layers.has("parallelogram") && u.length() > 1e-4 && v.length() > 1e-4) {
  const positions = new Float32Array([0, 0, 0, u.x, u.y, u.z, w.x, w.y, w.z, v.x, v.y, v.z]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  scene.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: COL.sum,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  addDashed(u, w);
  addDashed(v, w);
}

if (layers.has("u")) {
  addArrow(u, COL.u);
  addLabel(u, "$\\mathbf{u}$");
}

if (layers.has("v")) {
  addArrow(v, COL.v);
  addLabel(v, "$\\mathbf{v}$");
}

if (layers.has("sum")) {
  addArrow(w, COL.sum);
  addLabel(w, "$\\mathbf{u}+\\mathbf{v}$");
}

if (layers.has("scaled")) {
  addArrow(cu, COL.scaled);
  addLabel(cu, "$c\\mathbf{u}$");
}

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
camera.position.set(5.4, 3.5, 7.0);
camera.lookAt(0.5, 0.7, 0.2);

export { camera };
