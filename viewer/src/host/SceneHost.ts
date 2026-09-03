import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  discoverAnnotations,
  disposeAnnotations,
  stripForeignCss2dOverlays,
  syncAnnotationTexts,
} from "./annotations";
import {
  DEFAULT_GRID,
  GridController,
  type GridState,
} from "./grid";
import type { ParamValue } from "./defaults";
import {
  importSceneGraph,
  type LoadedScene,
  type ParamsChange,
  type SceneMetadata,
} from "./loadScene";
import {
  DEFAULT_HOST_FLAGS,
  viewToDimensions,
  type HostFlags,
} from "./hostFlags";
import {
  asCamera,
  firstCameraInGraph,
  poseFromCamera,
  rootHasAgentLight,
} from "./sceneOwnership";
import { SceneSideEffects } from "./sceneSideEffects";

const BG = 0x09090b;
const IDLE_ORBIT_SPEED = 1.0;

export interface PlaybackUi {
  show: boolean;
  playing: boolean;
}

export interface SceneHostOptions {
  container: HTMLElement;
  onError?: (message: string) => void;
}

export class SceneHost {
  private container: HTMLElement;
  private onError?: (message: string) => void;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private root: THREE.Group;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls: OrbitControls;
  private grid: GridController;
  private defaultLights: THREE.Light[] = [];
  private defaultBg = new THREE.Color(BG);
  private raf = 0;
  private disposed = false;
  private annotations: ReturnType<typeof discoverAnnotations> = [];
  private view: "2d" | "3d" = "3d";
  private defaultCamPos = new THREE.Vector3(6, 4, 8);
  private defaultTarget = new THREE.Vector3(0, 0, 0);
  private ro: ResizeObserver;
  private sideEffects = new SceneSideEffects();
  private flags: HostFlags = { ...DEFAULT_HOST_FLAGS };
  private hostNavActive = true;
  private hostControlsConnected = true;

  private loaded: LoadedScene | null = null;
  private sceneParams: Record<string, ParamValue> = {};
  private t = 0;
  private playing = false;
  private lastFrameMs: number | null = null;
  private updateFaulted = false;
  private updateViewFaulted = false;
  private playbackListeners = new Set<() => void>();

  constructor(opts: SceneHostOptions) {
    this.container = opts.container;
    this.onError = opts.onError;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(BG, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.width = "100%";
    this.labelRenderer.domElement.style.height = "100%";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.defaultBg;

    this.root = new THREE.Group();
    this.root.name = "scene-root";
    this.scene.add(this.root);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(6, 10, 8);
    const fill = new THREE.DirectionalLight(0xffffff, 0.28);
    fill.position.set(-6, 4, -8);
    this.defaultLights = [ambient, key, fill];
    for (const light of this.defaultLights) this.scene.add(light);

    this.grid = new GridController();
    this.scene.add(this.grid.group);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.copy(this.defaultCamPos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = IDLE_ORBIT_SPEED;
    this.controls.target.copy(this.defaultTarget);
    this.controls.addEventListener("start", this.onControlsStart);
    this.applyCameraMode("3d");

    this.ro = new ResizeObserver(() => this.resizeNow());
    this.ro.observe(this.container);
    this.resizeNow();
    this.loop();
  }

  getHostFlags(): HostFlags {
    return { ...this.flags };
  }

  getGridState(): GridState {
    return this.grid.getState();
  }

  setGridState(partial: Partial<GridState>): void {
    this.grid.setState(partial);
  }

  getPlaybackUi(): PlaybackUi {
    return {
      show: this.isTransportEligible(),
      playing: this.playing,
    };
  }

  subscribePlayback(cb: () => void): () => void {
    this.playbackListeners.add(cb);
    return () => {
      this.playbackListeners.delete(cb);
    };
  }

  setPlaying(playing: boolean): void {
    if (!this.isTransportEligible()) return;
    if (this.playing === playing) return;
    this.playing = playing;
    if (playing) this.updateFaulted = false;
    this.applyAutoRotate();
    this.notifyPlayback();
  }

  togglePlaying(): void {
    if (!this.isTransportEligible()) return;
    this.setPlaying(!this.playing);
  }

  resetView(): void {
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.copy(this.defaultTarget);
    if (this.hostNavActive) this.controls.update();
    if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
    }
  }

  private clearRoot(): void {
    disposeAnnotations(this.annotations);
    this.annotations = [];
    while (this.root.children.length) {
      const c = this.root.children[0]!;
      this.root.remove(c);
      disposeTree(c);
    }
  }

  private tearDownSceneContent(dropInput: boolean): void {
    this.sideEffects.stopBucket("scene");
    if (dropInput) this.sideEffects.stopBucket("input");
    try {
      this.loaded?.module.dispose?.();
    } catch (err) {
      this.onError?.(
        `dispose() threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    this.clearRoot();
    document.exitPointerLock?.();
    if (this.hostNavActive) this.reassertHostControls();
  }

  private reassertHostControls(): void {
    this.controls.disconnect();
    const c = this.controls as OrbitControls & {
      _pointers?: unknown[];
      _pointerPositions?: Record<string, unknown>;
      state: number;
    };
    if (Array.isArray(c._pointers)) c._pointers.length = 0;
    if (c._pointerPositions && typeof c._pointerPositions === "object") {
      for (const k of Object.keys(c._pointerPositions)) delete c._pointerPositions[k];
    }
    c.state = -1;
    this.controls.connect();
    this.hostControlsConnected = true;
    this.controls.enabled = true;
    this.controls.update();
  }

  async mountScene(loaded: LoadedScene): Promise<void> {
    this.tearDownSceneContent(true);
    this.loaded = loaded;
    this.flags = { ...loaded.host };
    this.view = loaded.host.view;
    this.sceneParams = { ...loaded.params };
    this.t = 0;
    this.updateFaulted = false;
    this.updateViewFaulted = false;
    this.lastFrameMs = null;
    this.applyCameraMode(this.view);
    this.applyHostPolicy();
    this.resetView();
    await this.mountGraph({ adoptStartCamera: true, bindInput: true });
    this.playing = this.hasUpdate() || this.isIdleOrbitEligible();
    this.kickUpdateOnce();
    this.applyAutoRotate();
    this.notifyPlayback();
    this.restartLoop();
  }

  applyParams(params: LoadedScene["params"], change: ParamsChange): void {
    const apply = this.loaded?.module.applyParams;
    if (typeof apply !== "function") return;
    this.writeLiveParams(params);
    try {
      apply(this.sceneParams, change);
    } catch (err) {
      throw new Error(
        `applyParams threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    stripForeignCss2dOverlays(this.root, this.labelRenderer.domElement);
    this.annotations = discoverAnnotations(this.root);
    this.applyDefaultLightsPolicy();
    this.kickUpdateOnce();
  }

  async remountWithParams(params: LoadedScene["params"]): Promise<void> {
    this.tearDownSceneContent(false);
    this.sceneParams = { ...params };
    if (this.hasUpdate()) this.t = 0;
    this.updateFaulted = false;
    this.updateViewFaulted = false;
    this.applyHostPolicy();
    await this.mountGraph({ adoptStartCamera: false, bindInput: false });
    if (this.hasUpdate()) {
      if (!this.flags.playback) this.playing = true;
    } else if (!this.isIdleOrbitEligible()) {
      this.playing = false;
    }
    this.kickUpdateOnce();
    this.applyAutoRotate();
    this.notifyPlayback();
    this.restartLoop();
  }

  /** Keep the object scene.js closed over (`const params = __scenieParams`). */
  private writeLiveParams(params: LoadedScene["params"]): void {
    const bag = this.sceneParams;
    for (const k of Object.keys(bag)) delete bag[k];
    Object.assign(bag, params);
  }

  private async mountGraph(opts: {
    adoptStartCamera: boolean;
    bindInput: boolean;
  }): Promise<void> {
    const loaded = this.loaded;
    if (!loaded) return;
    this.sideEffects.start(this.renderer.domElement);
    this.sideEffects.setBucket("scene");
    try {
      let imported;
      try {
        imported = await importSceneGraph(
          loaded.id,
          this.sceneParams,
          loaded.injectParams,
        );
      } catch (err) {
        this.sideEffects.stopBucket("scene");
        throw err;
      }
      const content =
        asObject3D(imported.scene) ?? asObject3D(imported.captured);
      if (!content) {
        this.sideEffects.stopBucket("scene");
        throw new Error("scene.js must export a THREE.Scene or construct one");
      }
      loaded.module.scene = imported.scene ?? imported.captured;
      loaded.module.camera = imported.camera;
      loaded.module.update = imported.update;
      loaded.module.dispose = imported.dispose;
      loaded.module.applyParams = imported.applyParams;
      this.root.add(content);
      this.stripForeignWebGLCanvases();
      stripForeignCss2dOverlays(this.root, this.labelRenderer.domElement);
      this.applyDefaultLightsPolicy();
      if (this.flags.camera && opts.adoptStartCamera) {
        const cam =
          asCamera(imported.camera) ?? firstCameraInGraph(this.root);
        if (cam) this.applyStartView(cam);
      }
      if (opts.bindInput && typeof loaded.module.bindInput === "function") {
        this.sideEffects.setBucket("input");
        try {
          loaded.module.bindInput(this.renderer.domElement, this.camera);
        } catch (err) {
          this.sideEffects.stopBucket("input");
          throw new Error(
            `bindInput() threw: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        this.sideEffects.setBucket("scene");
      }
      this.annotations = discoverAnnotations(this.root);
    } finally {
      this.restartLoop();
    }
  }

  private applyStartView(cam: THREE.Camera): void {
    const start = poseFromCamera(cam);
    this.defaultCamPos.copy(start.position);
    this.defaultTarget.copy(start.target);
    this.camera.position.copy(start.position);
    this.controls.target.copy(start.target);
    if (start.near != null) this.camera.near = start.near;
    if (start.far != null) this.camera.far = start.far;
    if (
      start.fov != null &&
      this.camera instanceof THREE.PerspectiveCamera
    ) {
      this.camera.fov = start.fov;
    }
    this.camera.updateProjectionMatrix();
    if (this.hostNavActive) this.controls.update();
  }

  private stripForeignWebGLCanvases(): void {
    for (const el of document.querySelectorAll("canvas")) {
      if (el === this.renderer.domElement) continue;
      if (el.getContext("webgl2") || el.getContext("webgl")) el.remove();
    }
  }

  private hasUpdate(): boolean {
    return typeof this.loaded?.module.update === "function";
  }

  private hasUpdateView(): boolean {
    return typeof this.loaded?.module.updateView === "function";
  }

  private isIdleOrbitEligible(): boolean {
    return (
      !this.hasUpdate() &&
      this.flags.camera &&
      this.flags.playback &&
      this.view === "3d" &&
      this.loaded != null
    );
  }

  private isTransportEligible(): boolean {
    if (!this.flags.playback || this.loaded == null) return false;
    return this.hasUpdate() || this.isIdleOrbitEligible();
  }

  /** Import silences rAF; a host frame in that window never reschedules. */
  private restartLoop(): void {
    if (this.disposed) return;
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  private kickUpdateOnce(): void {
    if (!this.hasUpdate() || !this.loaded) return;
    try {
      this.loaded.module.update!(this.t, 0);
    } catch (err) {
      this.handleUpdateError(err);
    }
  }

  private handleUpdateError(err: unknown): void {
    this.playing = false;
    this.updateFaulted = true;
    this.applyAutoRotate();
    this.notifyPlayback();
    const msg = `update() threw: ${err instanceof Error ? err.message : String(err)}`;
    this.onError?.(msg);
  }

  private handleUpdateViewError(err: unknown): void {
    this.updateViewFaulted = true;
    const msg = `updateView() threw: ${err instanceof Error ? err.message : String(err)}`;
    this.onError?.(msg);
  }

  private applyAutoRotate(): void {
    const on = this.isIdleOrbitEligible() && this.playing;
    this.controls.autoRotate = on;
  }

  private onControlsStart = (): void => {
    if (!this.isIdleOrbitEligible()) return;
    if (this.playing) this.setPlaying(false);
  };

  private notifyPlayback(): void {
    for (const cb of this.playbackListeners) cb();
  }

  private applyHostPolicy(): void {
    this.setHostNavActive(this.flags.camera);
    this.grid.group.visible = this.flags.helpers;
  }

  private setHostNavActive(active: boolean): void {
    this.hostNavActive = active;
    if (active) {
      if (!this.hostControlsConnected) {
        this.controls.connect();
        this.hostControlsConnected = true;
      }
      this.controls.enabled = true;
    } else {
      this.controls.enabled = false;
      if (this.hostControlsConnected) {
        this.controls.disconnect();
        this.hostControlsConnected = false;
      }
      this.controls.autoRotate = false;
    }
  }

  private applyDefaultLightsPolicy(): void {
    if (!this.flags.lights) {
      for (const light of this.defaultLights) light.visible = false;
      return;
    }
    const agentLit = rootHasAgentLight(this.root);
    for (const light of this.defaultLights) {
      light.visible = !agentLit;
    }
  }

  private copySceneAtmosphere(): void {
    const content = this.root.children[0] as THREE.Object3D | undefined;
    if (content && (content as THREE.Scene).isScene) {
      const s = content as THREE.Scene;
      this.scene.background = s.background ?? this.defaultBg;
      this.scene.fog = s.fog;
      this.scene.environment = s.environment;
    } else {
      this.scene.background = this.defaultBg;
      this.scene.fog = null;
      this.scene.environment = null;
    }
  }

  showEmpty(): void {
    this.tearDownSceneContent(true);
    this.loaded = null;
    this.sceneParams = {};
    this.flags = { ...DEFAULT_HOST_FLAGS };
    this.view = "3d";
    this.t = 0;
    this.playing = false;
    this.updateFaulted = false;
    this.updateViewFaulted = false;
    this.lastFrameMs = null;
    this.controls.autoRotate = false;
    this.scene.background = this.defaultBg;
    this.scene.fog = null;
    this.scene.environment = null;
    for (const light of this.defaultLights) light.visible = true;
    this.grid.group.visible = true;
    this.setHostNavActive(true);
    this.applyCameraMode("3d");
    this.resetView();
    this.notifyPlayback();
    this.restartLoop();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.removeEventListener("start", this.onControlsStart);
    this.tearDownSceneContent(true);
    this.playbackListeners.clear();
    this.grid.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  private applyCameraMode(view: "2d" | "3d"): void {
    const dim = viewToDimensions(view);
    const aspect = this.aspect();
    const prevPos = this.camera.position.clone();
    const prevTarget = this.controls.target.clone();

    if (dim === 2) {
      const frustum = 8;
      this.camera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2,
        (frustum * aspect) / 2,
        frustum / 2,
        -frustum / 2,
        0.05,
        500,
      );
      this.defaultCamPos.set(0, 0, 12);
      this.defaultTarget.set(0, 0, 0);
      this.camera.position.copy(this.defaultCamPos);
      this.controls.object = this.camera;
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = true;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    } else {
      this.camera = new THREE.PerspectiveCamera(55, aspect, 0.05, 500);
      this.defaultCamPos.set(6, 4, 8);
      this.defaultTarget.set(0, 0, 0);
      this.camera.position.copy(
        prevPos.lengthSq() > 0.01 ? prevPos : this.defaultCamPos,
      );
      this.controls.object = this.camera;
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = false;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      this.controls.target.copy(prevTarget);
    }
    if (this.hostNavActive) this.controls.update();
  }

  private aspect(): number {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    return w / h;
  }

  private resizeNow(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);

    this.renderer.setSize(w, h, true);
    this.labelRenderer.setSize(w, h);

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    } else {
      const frustum = 8;
      const aspect = w / h;
      this.camera.left = (-frustum * aspect) / 2;
      this.camera.right = (frustum * aspect) / 2;
      this.camera.top = frustum / 2;
      this.camera.bottom = -frustum / 2;
      this.camera.updateProjectionMatrix();
    }

    if (this.hostNavActive) this.controls.update();
    this.copySceneAtmosphere();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private loop = (now: number = performance.now()): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    let dt = 0;
    if (this.lastFrameMs != null) {
      dt = Math.min(0.1, (now - this.lastFrameMs) / 1000);
    }
    this.lastFrameMs = now;

    if (
      this.hasUpdate() &&
      this.loaded &&
      !this.updateFaulted &&
      (this.playing || !this.flags.playback)
    ) {
      this.t += dt;
      try {
        this.loaded.module.update!(this.t, dt);
      } catch (err) {
        this.handleUpdateError(err);
      }
    }

    if (this.hasUpdateView() && this.loaded && !this.updateViewFaulted) {
      try {
        this.loaded.module.updateView!(dt, this.camera);
      } catch (err) {
        this.handleUpdateViewError(err);
      }
    }

    if (this.annotations.length) syncAnnotationTexts(this.annotations);

    if (this.hostNavActive || this.controls.autoRotate) {
      this.controls.update();
    }
    this.copySceneAtmosphere();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach(disposeMaterial);
      else disposeMaterial(mat);
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  const rec = mat as unknown as Record<string, unknown>;
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object" && (v as { isTexture?: boolean }).isTexture) {
      (v as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}

export type { SceneMetadata, GridState, HostFlags };
export { DEFAULT_GRID, DEFAULT_HOST_FLAGS };

function asObject3D(value: unknown): THREE.Object3D | null {
  if (value instanceof THREE.Object3D) return value;
  const obj = value as { isObject3D?: boolean } | null;
  if (obj && obj.isObject3D) return value as THREE.Object3D;
  return null;
}
