import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HOST_FLAGS,
  resolveHostFlags,
} from "../dist/host-flags.js";

describe("resolveHostFlags", () => {
  it("defaults, merges, and rejects bad shapes", () => {
    assert.deepEqual(resolveHostFlags(undefined), DEFAULT_HOST_FLAGS);
    const f = resolveHostFlags({ lights: false, camera: false, view: "2d" });
    assert.equal(f.lights, false);
    assert.equal(f.helpers, true);
    assert.equal(f.camera, false);
    assert.equal(f.view, "2d");
    assert.throws(() => resolveHostFlags({ grid: false }), /host\.grid: unknown key/);
    assert.throws(() => resolveHostFlags({ lights: 1 }), /host\.lights: want boolean/);
    assert.throws(() => resolveHostFlags({ view: "ortho" }), /host\.view/);
    assert.throws(() => resolveHostFlags(null), /host: want plain object/);
  });
});
