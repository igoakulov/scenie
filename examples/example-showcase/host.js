import * as THREE from "three";

export const host = {
  lights: false,
  helpers: false,
  camera: false,
};

export function params() {
  return [
    {
      type: "card",
      title: "Flight",
      children: [
        {
          type: "note",
          text: "Click the canvas to lock the mouse (Esc releases). WASD fly, Q/E down/up, Shift boost, Ctrl slow, arrows look, scroll changes speed. Coasting when you let go.",
        },
        {
          type: "label",
          label: "Craft",
          value: () => "world-up yaw/pitch · FOV punches on boost",
        },
      ],
    },
    {
      type: "card",
      title: "Solar system",
      children: [
        {
          type: "note",
          text: "Compressed layout so every world is flyable. Outer periods follow real ratios more loosely than the inner system. $1$ Earth year $= 25/$time-scale seconds.",
        },
        {
          key: "time_scale",
          type: "number",
          label: "Time scale",
          min: 0,
          max: 80,
          step: 0.1,
          default: 0.2,
          unit: "×",
        },
        {
          key: "planet_scale",
          type: "number",
          label: "Planet scale",
          min: 0.4,
          max: 3.5,
          step: 0.1,
          default: 1,
          unit: "×",
        },
        {
          key: "sun_glow",
          type: "number",
          label: "Sun glow",
          min: 0.2,
          max: 2.4,
          step: 0.1,
          default: 1.1,
          unit: "×",
        },
        {
          key: "layers",
          type: "multiselect",
          label: "Show",
          options: ["orbits", "labels", "moons", "asteroids", "atmospheres", "comet", "kuiper"],
          default: ["orbits", "labels", "moons", "asteroids", "atmospheres", "comet", "kuiper"],
        },
        {
          key: "detail",
          type: "select",
          label: "Detail",
          options: ["high", "medium", "low"],
          default: "high",
        },
        {
          key: "elliptical",
          type: "boolean",
          label: "Elliptical orbits",
          default: true,
        },
        {
          type: "label",
          label: "Earth year",
          value: (q) => `${(25 / Math.max(0.001, q.time_scale ?? 0.2)).toFixed(2)} s`,
        },
        {
          type: "label",
          label: "Named bodies",
          value: (q) => {
            const L = q.layers || [];
            let n = 10;
            if (L.includes("moons")) n += 11;
            if (L.includes("comet")) n += 1;
            return String(n);
          },
        },
      ],
    },
  ];
}

const keys = Object.create(null);
const look = { yaw: 0, pitch: 0 };
const vel = new THREE.Vector3();
const wish = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");
let speed = 6.5;
let canvasRef = null;

function isDown(code) {
  return !!keys[code];
}

function onKey(ev, down) {
  const { code, key } = ev;
  if (key === "/" || key === "r" || key === "R" || code === "KeyR") return;
  keys[code] = down;
  if (
    down &&
    (code.startsWith("Key") ||
      code.startsWith("Arrow") ||
      code === "ShiftLeft" ||
      code === "ShiftRight" ||
      code === "ControlLeft" ||
      code === "ControlRight" ||
      code === "Space")
  ) {
    ev.preventDefault();
  }
}

function onMouseMove(ev) {
  if (!canvasRef || document.pointerLockElement !== canvasRef) return;
  look.yaw -= ev.movementX * 0.0022;
  look.pitch -= ev.movementY * 0.0022;
  const lim = Math.PI * 0.49;
  if (look.pitch > lim) look.pitch = lim;
  if (look.pitch < -lim) look.pitch = -lim;
}

function onPointerDown(ev) {
  if (ev.button !== 0) return;
  canvasRef?.requestPointerLock?.();
  canvasRef?.focus?.();
}

function onWheel(ev) {
  ev.preventDefault();
  const k = Math.exp(-ev.deltaY * 0.0012);
  speed = Math.min(48, Math.max(0.6, speed * k));
}

function onBlur() {
  for (const k of Object.keys(keys)) keys[k] = false;
}

export function bindInput(canvas, camera) {
  canvasRef = canvas;
  canvas.tabIndex = 0;

  camera.near = 0.06;
  camera.far = 700;
  camera.fov = 58;
  camera.rotation.order = "YXZ";
  camera.position.set(10.6, 2.55, 12.4);
  camera.lookAt(0.4, 0.15, 0);
  camera.updateProjectionMatrix();
  look.yaw = camera.rotation.y;
  look.pitch = camera.rotation.x;
  vel.set(0, 0, 0);

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));
  document.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("blur", onBlur);
}

export function updateView(dt, camera) {
  if (isDown("ArrowLeft")) look.yaw += 1.35 * dt;
  if (isDown("ArrowRight")) look.yaw -= 1.35 * dt;
  if (isDown("ArrowUp")) look.pitch += 1.05 * dt;
  if (isDown("ArrowDown")) look.pitch -= 1.05 * dt;
  const lim = Math.PI * 0.49;
  if (look.pitch > lim) look.pitch = lim;
  if (look.pitch < -lim) look.pitch = -lim;

  euler.set(look.pitch, look.yaw, 0);
  camera.quaternion.setFromEuler(euler);

  const boost = isDown("ShiftLeft") || isDown("ShiftRight");
  const slow = isDown("ControlLeft") || isDown("ControlRight");
  const mul = (boost ? 3.4 : 1) * (slow ? 0.22 : 1);
  const sp = speed * mul;

  let x = 0;
  let y = 0;
  let z = 0;
  if (isDown("KeyW")) z -= 1;
  if (isDown("KeyS")) z += 1;
  if (isDown("KeyA")) x -= 1;
  if (isDown("KeyD")) x += 1;
  if (isDown("KeyE") || isDown("Space")) y += 1;
  if (isDown("KeyQ")) y -= 1;
  const thrusting = x !== 0 || y !== 0 || z !== 0;
  if (thrusting) {
    const len = Math.hypot(x, y, z) || 1;
    wish.set(x / len, y / len, z / len).multiplyScalar(sp);
    wish.applyQuaternion(camera.quaternion);
  } else {
    wish.set(0, 0, 0);
  }
  const k = 1 - Math.exp(-(thrusting ? 9 : 5) * dt);
  vel.lerp(wish, k);
  camera.position.addScaledVector(vel, dt);

  const targetFov = boost && thrusting ? 71 : 58;
  const fovK = 1 - Math.exp(-5.5 * dt);
  const next = camera.fov + (targetFov - camera.fov) * fovK;
  if (Math.abs(next - camera.fov) > 0.04) {
    camera.fov = next;
    camera.updateProjectionMatrix();
  }
}
