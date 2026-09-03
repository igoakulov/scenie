/**
 * Scene-lifetime DOM listener tracking.
 * While active, wraps addEventListener/removeEventListener on canvas, window, document.
 * `scene` bucket: dropped on graph remount. `input` bucket: dropped on scene switch.
 */

type ListenerOptions = boolean | AddEventListenerOptions | undefined;

type Bucket = "scene" | "input";

type Tracked = {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options: ListenerOptions;
  bucket: Bucket;
};

type PatchedTarget = {
  target: EventTarget;
  add: typeof EventTarget.prototype.addEventListener;
  remove: typeof EventTarget.prototype.removeEventListener;
};

function optionsCapture(options: ListenerOptions): boolean {
  if (typeof options === "boolean") return options;
  if (options && typeof options === "object") return Boolean(options.capture);
  return false;
}

function removalOptions(options: ListenerOptions): boolean | EventListenerOptions {
  if (typeof options === "boolean") return options;
  if (options && typeof options === "object") {
    return { capture: Boolean(options.capture) };
  }
  return false;
}

export class SceneSideEffects {
  private tracked: Tracked[] = [];
  private patched: PatchedTarget[] = [];
  private active = false;
  private bucket: Bucket = "scene";

  get isActive(): boolean {
    return this.active;
  }

  setBucket(bucket: Bucket): void {
    this.bucket = bucket;
  }

  start(canvas: EventTarget): void {
    if (this.active) return;
    this.active = true;
    this.tracked = [];
    this.patched = [];
    this.bucket = "scene";

    const targets: EventTarget[] = [canvas, window, document];
    for (const target of targets) {
      this.patchTarget(target);
    }
  }

  stopBucket(bucket: Bucket): void {
    const drop = this.tracked.filter((t) => t.bucket === bucket);
    this.tracked = this.tracked.filter((t) => t.bucket !== bucket);
    this.removeAll(drop);
    if (this.tracked.length === 0) this.unpatch();
  }

  stop(): void {
    this.stopBucket("scene");
    this.stopBucket("input");
  }

  private unpatch(): void {
    for (const p of this.patched) {
      p.target.addEventListener = p.add;
      p.target.removeEventListener = p.remove;
    }
    this.patched = [];
    this.active = false;
  }

  private removeAll(entries: Tracked[]): void {
    for (const entry of entries) {
      try {
        entry.target.removeEventListener(
          entry.type,
          entry.listener,
          removalOptions(entry.options),
        );
      } catch {
        // Best-effort; target may already be gone.
      }
    }
  }

  private patchTarget(target: EventTarget): void {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);

    this.patched.push({ target, add, remove });

    target.addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (listener != null) {
        this.tracked.push({
          target,
          type,
          listener,
          options,
          bucket: this.bucket,
        });
      }
      return add(type, listener as EventListenerOrEventListenerObject, options);
    };

    target.removeEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => {
      if (listener != null) {
        const cap = optionsCapture(options);
        this.tracked = this.tracked.filter(
          (t) =>
            !(
              t.target === target &&
              t.type === type &&
              t.listener === listener &&
              optionsCapture(t.options) === cap
            ),
        );
      }
      return remove(
        type,
        listener as EventListenerOrEventListenerObject,
        options,
      );
    };
  }
}
