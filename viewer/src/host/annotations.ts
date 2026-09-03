import * as THREE from "three";
import { fillMathElement } from "../math/renderMath";

type CSS2DLike = THREE.Object3D & {
  isCSS2DObject?: boolean;
  element: HTMLElement;
};

function isCSS2D(obj: THREE.Object3D): obj is CSS2DLike {
  return Boolean((obj as CSS2DLike).isCSS2DObject && (obj as CSS2DLike).element);
}

export function discoverAnnotations(root: THREE.Object3D): CSS2DLike[] {
  const found: CSS2DLike[] = [];
  root.traverse((obj) => {
    if (!isCSS2D(obj)) return;
    obj.element.className = "css2d-label";
    obj.element.style.pointerEvents = "none";
    found.push(obj);
  });
  syncAnnotationTexts(found);
  return found;
}

export function syncAnnotationTexts(handles: CSS2DLike[]): void {
  for (const h of handles) {
    const el = h.element;
    const hasKatex = el.querySelector(".katex") != null;
    const text = el.textContent ?? "";
    if (hasKatex) {
      h.visible = true;
      continue;
    }
    if (!text.trim()) {
      h.visible = false;
      continue;
    }
    h.visible = true;
    fillMathElement(el, text);
  }
}

export function disposeAnnotations(handles: CSS2DLike[]): void {
  for (const h of handles) {
    h.element.remove();
  }
}

export function stripForeignCss2dOverlays(
  root: THREE.Object3D,
  hostOverlay: HTMLElement,
): void {
  root.traverse((obj) => {
    if (!isCSS2D(obj)) return;
    const parent = obj.element.parentNode;
    if (parent && parent !== hostOverlay) {
      (parent as Element).remove();
    }
  });
}
