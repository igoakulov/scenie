/** Capture the first `new THREE.Scene()` while a scene module loads. */
export function installSceneCapture(SceneCtor: { prototype: object }): {
  get(): object | null;
  restore(): void;
} {
  let captured: object | null = null;
  const proto = SceneCtor.prototype as { isScene?: boolean };
  Object.defineProperty(proto, "isScene", {
    configurable: true,
    enumerable: true,
    get() {
      return true;
    },
    set(this: object, v: boolean) {
      Object.defineProperty(this, "isScene", {
        value: v,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      if (v && captured == null) captured = this;
    },
  });
  return {
    get: () => captured,
    restore() {
      delete proto.isScene;
    },
  };
}
