function stubElement(): Record<string, unknown> {
  const el: Record<string, unknown> = {
    style: {},
    textContent: "",
    innerHTML: "",
    className: "",
    width: 0,
    height: 0,
    setAttribute() {},
    getAttribute() {
      return null;
    },
    appendChild() {
      return el;
    },
    removeChild() {
      return el;
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    getContext(type: string) {
      if (type !== "2d") return null;
      return new Proxy(
        { canvas: el },
        {
          get(t, prop) {
            if (prop in t) return t[prop as keyof typeof t];
            if (prop === "createLinearGradient" || prop === "createRadialGradient") {
              return () => ({ addColorStop() {} });
            }
            if (prop === "createImageData") {
              return (w: number, h = w) => ({
                data: new Uint8ClampedArray(w * h * 4),
                width: w,
                height: h,
              });
            }
            if (prop === "getImageData") {
              return (_x: number, _y: number, w: number, h: number) => ({
                data: new Uint8ClampedArray(w * h * 4),
                width: w,
                height: h,
              });
            }
            return () => {};
          },
          set(t, prop, v) {
            (t as Record<string | symbol, unknown>)[prop] = v;
            return true;
          },
        },
      );
    },
  };
  return el;
}

/** Fake `document` so CLI import of scene.js can construct CSS2D / canvas textures. */
export function installDocumentStub(): () => void {
  if (typeof (globalThis as { document?: unknown }).document !== "undefined") {
    return () => {};
  }
  const doc = {
    createElement: () => stubElement(),
    createElementNS: () => stubElement(),
    addEventListener() {},
    removeEventListener() {},
    body: stubElement(),
    head: stubElement(),
  };
  (globalThis as { document: unknown }).document = doc;
  return () => {
    delete (globalThis as { document?: unknown }).document;
  };
}
