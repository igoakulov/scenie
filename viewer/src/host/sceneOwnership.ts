import * as THREE from "three";

export function rootHasAgentLight(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (found) return;
    if (o instanceof THREE.Light) found = true;
  });
  return found;
}

export type StartView = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
  near?: number;
  far?: number;
};

export function poseFromCamera(agent: THREE.Camera): StartView {
  agent.updateWorldMatrix(true, false);
  const position = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  agent.getWorldPosition(position);
  agent.getWorldQuaternion(quat);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
  const target = position.clone().addScaledVector(dir, 8);
  const view: StartView = { position, target, near: agent.near, far: agent.far };
  if (agent instanceof THREE.PerspectiveCamera) view.fov = agent.fov;
  return view;
}

export function firstCameraInGraph(root: THREE.Object3D): THREE.Camera | null {
  const cameras: THREE.Camera[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Camera) cameras.push(o);
  });
  return cameras[0] ?? null;
}

export function startViewFromGraph(root: THREE.Object3D): StartView | null {
  const agent = firstCameraInGraph(root);
  if (!agent) return null;
  root.updateWorldMatrix(true, true);
  return poseFromCamera(agent);
}

export function asCamera(value: unknown): THREE.Camera | null {
  if (value instanceof THREE.Camera) return value;
  const obj = value as { isCamera?: boolean } | null;
  if (obj && obj.isCamera) return value as THREE.Camera;
  return null;
}
