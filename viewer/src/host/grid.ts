import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export interface GridState {
  step: number;
  /** Half-width from origin (grid runs −size…+size). */
  size: number;
  showFloor: boolean;
  showXY: boolean;
  showYZ: boolean;
}

export const DEFAULT_GRID: GridState = {
  step: 1,
  size: 10,
  showFloor: true,
  showXY: false,
  showYZ: false,
};

/**
 * 2D: only the XY plane is meaningful (UI label "Floor (XY)").
 * Clears Floor (XZ) / YZ. If the classic 3D default (floor on, XY off) is
 * present, map it to Floor (XY) on so the grid stays visible.
 */
export function gridForDimensions(
  grid: GridState,
  dimensions: 2 | 3,
): GridState {
  if (dimensions === 2) {
    let showXY = grid.showXY;
    if (!showXY && grid.showFloor && !grid.showYZ) {
      showXY = true;
    }
    return {
      ...grid,
      showFloor: false,
      showXY,
      showYZ: false,
    };
  }
  return grid;
}

const GRID_COLOR = 0xaab2bd;
const AXIS_COLOR = 0xe6e8eb;

export class GridController {
  readonly group = new THREE.Group();
  private state: GridState = { ...DEFAULT_GRID };

  constructor() {
    this.group.name = "__scenie_grid__";
    // Draw before scene content; materials use LessDepth so coplanar scene wins.
    this.group.renderOrder = -1;
    this.rebuild();
  }

  getState(): GridState {
    return { ...this.state };
  }

  setState(partial: Partial<GridState>): void {
    this.state = {
      ...this.state,
      ...partial,
      step: Math.max(0.01, partial.step ?? this.state.step),
      size: Math.max(0.01, partial.size ?? this.state.size),
      showFloor: partial.showFloor ?? this.state.showFloor,
      showXY: partial.showXY ?? this.state.showXY,
      showYZ: partial.showYZ ?? this.state.showYZ,
    };
    this.rebuild();
  }

  private rebuild(): void {
    while (this.group.children.length) {
      const c = this.group.children[0]!;
      this.group.remove(c);
      disposeObject(c);
    }

    const { step, size, showFloor, showXY, showYZ } = this.state;

    if (showFloor) this.group.add(makeGridPlane("xz", size, step));
    if (showXY) this.group.add(makeGridPlane("xy", size, step));
    if (showYZ) this.group.add(makeGridPlane("yz", size, step));

    const showX = showFloor || showXY;
    const showY = showXY || showYZ;
    const showZ = showFloor || showYZ;
    if (showX || showY || showZ) {
      this.group.add(makeAxes(size, { showX, showY, showZ }));
    }
  }

  dispose(): void {
    while (this.group.children.length) {
      const c = this.group.children[0]!;
      this.group.remove(c);
      disposeObject(c);
    }
  }
}

function makeGridPlane(
  plane: "xz" | "xy" | "yz",
  half: number,
  step: number,
): THREE.Object3D {
  const full = half * 2;
  const divisions = Math.max(1, Math.round(full / step));
  const grid = new THREE.GridHelper(full, divisions, GRID_COLOR, GRID_COLOR);
  if (Array.isArray(grid.material)) {
    for (const m of grid.material) styleRefMaterial(m, 0.22);
  } else {
    styleRefMaterial(grid.material, 0.22);
  }
  if (plane === "xy") grid.rotation.x = Math.PI / 2;
  else if (plane === "yz") grid.rotation.z = Math.PI / 2;
  grid.name = `__grid_${plane}__`;
  grid.renderOrder = -1;
  return grid;
}

/** Scene wins when coplanar: LessDepth fails at equal depth (default LessEqual lets axes repaint over). */
function styleRefMaterial(m: THREE.Material, opacity: number): void {
  m.transparent = true;
  m.opacity = opacity;
  m.depthWrite = false;
  m.depthTest = true;
  m.depthFunc = THREE.LessDepth;
}

function makeAxes(
  extent: number,
  which: { showX: boolean; showY: boolean; showZ: boolean },
): THREE.Group {
  const g = new THREE.Group();
  g.name = "__grid_axes__";
  const len = Math.max(extent, 1);
  const arrowLen = Math.min(0.35, len * 0.12);

  const addAxis = (dir: THREE.Vector3, label: string) => {
    const pos = dir.clone().multiplyScalar(len);
    const neg = dir.clone().multiplyScalar(-len);
    const geo = new THREE.BufferGeometry().setFromPoints([neg, pos]);
    const lineMat = new THREE.LineBasicMaterial({ color: AXIS_COLOR });
    styleRefMaterial(lineMat, 0.75);
    const axisLine = new THREE.Line(geo, lineMat);
    axisLine.renderOrder = -1;
    g.add(axisLine);

    // Arrow + label on the positive end only
    const arrow = new THREE.ArrowHelper(
      dir,
      pos.clone().addScaledVector(dir, -arrowLen),
      arrowLen,
      AXIS_COLOR,
      arrowLen * 0.55,
      arrowLen * 0.35,
    );
    styleRefMaterial(arrow.line.material as THREE.Material, 0.85);
    styleRefMaterial(arrow.cone.material as THREE.Material, 0.85);
    arrow.renderOrder = -1;
    g.add(arrow);

    const el = document.createElement("div");
    el.className = "axis-label";
    el.textContent = label;
    el.style.pointerEvents = "none";
    const chip = new CSS2DObject(el);
    chip.position.copy(pos).addScaledVector(dir, Math.max(0.25, len * 0.04));
    chip.name = `__axis_label_${label}__`;
    g.add(chip);
  };

  if (which.showX) addAxis(new THREE.Vector3(1, 0, 0), "X");
  if (which.showY) addAxis(new THREE.Vector3(0, 1, 0), "Y");
  if (which.showZ) addAxis(new THREE.Vector3(0, 0, 1), "Z");
  return g;
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof CSS2DObject) {
      child.element.remove();
      return;
    }
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material).dispose();
    }
  });
}
