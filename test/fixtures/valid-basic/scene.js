import * as THREE from "three";

const scene = new THREE.Scene();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x4488ff }),
);
mesh.name = "box";
scene.add(mesh);

export function applyParams(params) {
  const size = Number(params.size) || 1;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BoxGeometry(size, size, size);
  mesh.material.wireframe = params.style === "wire";
  mesh.visible = params.visible !== false;
}
applyParams(params, { key: "", value: params });

export { scene };
