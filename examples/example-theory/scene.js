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

const origin = new THREE.Vector3();

scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshBasicMaterial({ color: COL.origin }),
  ),
);

function makeArrow(color) {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 1, color, 0.22, 0.12);
  scene.add(arrow);
  return arrow;
}

function makeLabel() {
  const el = document.createElement("div");
  const obj = new CSS2DObject(el);
  scene.add(obj);
  return { el, obj };
}

function makeDashed() {
  const geo = new THREE.BufferGeometry().setFromPoints([origin, new THREE.Vector3(1, 0, 0)]);
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
  return line;
}

const arrowI = makeArrow(COL.i);
const arrowJ = makeArrow(COL.j);
const arrowK = makeArrow(COL.k);
const arrowU = makeArrow(COL.u);
const arrowV = makeArrow(COL.v);
const arrowSum = makeArrow(COL.sum);
const arrowCu = makeArrow(COL.scaled);

const labelI = makeLabel();
const labelJ = makeLabel();
const labelK = makeLabel();
const labelU = makeLabel();
const labelV = makeLabel();
const labelSum = makeLabel();
const labelCu = makeLabel();

const dashUW = makeDashed();
const dashVW = makeDashed();

const paraGeo = new THREE.BufferGeometry();
paraGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
paraGeo.setIndex([0, 1, 2, 0, 2, 3]);
const paraMesh = new THREE.Mesh(
  paraGeo,
  new THREE.MeshBasicMaterial({
    color: COL.sum,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
scene.add(paraMesh);

function setArrow(arrow, dir, show) {
  const len = dir.length();
  if (!show || len < 1e-4) {
    arrow.visible = false;
    return;
  }
  arrow.visible = true;
  const headLen = Math.min(0.22, Math.max(0.08, len * 0.18));
  arrow.setDirection(dir.clone().normalize());
  arrow.setLength(len, headLen, headLen * 0.55);
}

function setLabel(label, pos, text, show) {
  if (!show || !text) {
    label.el.textContent = "";
    return;
  }
  label.el.textContent = text;
  const n = pos.lengthSq() < 1e-8 ? new THREE.Vector3(0.12, 0.12, 0) : pos.clone().normalize().multiplyScalar(0.16);
  label.obj.position.copy(pos).add(n);
}

function setDashed(line, a, b, show) {
  line.visible = show;
  if (!show) return;
  const pos = line.geometry.attributes.position;
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  line.computeLineDistances();
}

export function applyParams(params, change) {
  const u = new THREE.Vector3(params.u_x ?? 0, params.u_y ?? 0, params.u_z ?? 0);
  const v = new THREE.Vector3(params.v_x ?? 0, params.v_y ?? 0, params.v_z ?? 0);
  const w = u.clone().add(v);
  const cu = u.clone().multiplyScalar(params.c ?? 1);
  const layers = new Set(params.layers ?? []);
  const showLabels = params.show_labels !== false;

  const i = new THREE.Vector3(1, 0, 0);
  const j = new THREE.Vector3(0, 1, 0);
  const k = new THREE.Vector3(0, 0, 1);

  const showBasis = layers.has("basis");
  setArrow(arrowI, i, showBasis);
  setArrow(arrowJ, j, showBasis);
  setArrow(arrowK, k, showBasis);
  setLabel(labelI, i, "$\\hat{\\imath}$", showLabels && showBasis);
  setLabel(labelJ, j, "$\\hat{\\jmath}$", showLabels && showBasis);
  setLabel(labelK, k, "$\\hat{k}$", showLabels && showBasis);

  const showPara = layers.has("parallelogram") && u.length() > 1e-4 && v.length() > 1e-4;
  paraMesh.visible = showPara;
  if (showPara) {
    const p = paraGeo.attributes.position;
    p.setXYZ(0, 0, 0, 0);
    p.setXYZ(1, u.x, u.y, u.z);
    p.setXYZ(2, w.x, w.y, w.z);
    p.setXYZ(3, v.x, v.y, v.z);
    p.needsUpdate = true;
    paraGeo.computeBoundingSphere();
  }
  setDashed(dashUW, u, w, showPara);
  setDashed(dashVW, v, w, showPara);

  const showU = layers.has("u");
  setArrow(arrowU, u, showU);
  setLabel(labelU, u, "$\\mathbf{u}$", showLabels && showU);

  const showV = layers.has("v");
  setArrow(arrowV, v, showV);
  setLabel(labelV, v, "$\\mathbf{v}$", showLabels && showV);

  const showSum = layers.has("sum");
  setArrow(arrowSum, w, showSum);
  setLabel(labelSum, w, "$\\mathbf{u}+\\mathbf{v}$", showLabels && showSum);

  const showScaled = layers.has("scaled");
  setArrow(arrowCu, cu, showScaled);
  setLabel(labelCu, cu, "$c\\mathbf{u}$", showLabels && showScaled);
}
applyParams(params, { key: "", value: params });

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
camera.position.set(5.4, 3.5, 7.0);
camera.lookAt(0.5, 0.7, 0.2);

export { camera };
