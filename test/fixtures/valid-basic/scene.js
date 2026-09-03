import * as THREE from "three";

const scene = new THREE.Scene();
const size = Number(params.size) || 1;
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(size, size, size),
  new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    wireframe: params.style === "wire",
  }),
);
mesh.name = "box";
mesh.visible = params.visible !== false;
scene.add(mesh);

export { scene };
