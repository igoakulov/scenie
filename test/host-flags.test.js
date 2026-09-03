import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HOST_FLAGS,
  issuesForHostExport,
  resolveHostFlags,
} from "../dist/host-flags.js";

describe("resolveHostFlags", () => {
  it("defaults all true and view 3d when omitted", () => {
    assert.deepEqual(resolveHostFlags(undefined), DEFAULT_HOST_FLAGS);
    assert.deepEqual(resolveHostFlags({}), DEFAULT_HOST_FLAGS);
  });

  it("merges explicit false and view", () => {
    const f = resolveHostFlags({ lights: false, camera: false, view: "2d" });
    assert.equal(f.lights, false);
    assert.equal(f.helpers, true);
    assert.equal(f.camera, false);
    assert.equal(f.playback, true);
    assert.equal(f.view, "2d");
  });

  it("rejects unknown keys, non-booleans, bad view, null, and non-objects", () => {
    assert.throws(() => resolveHostFlags({ grid: false }), /host\.grid: unknown key/);
    assert.throws(() => resolveHostFlags({ loop: false }), /host\.loop: unknown key/);
    assert.throws(() => resolveHostFlags({ lights: 1 }), /host\.lights: want boolean/);
    assert.throws(() => resolveHostFlags({ view: "ortho" }), /host\.view: want "2d" or "3d"/);
    assert.throws(() => resolveHostFlags([]), /host: want plain object/);
    assert.throws(() => resolveHostFlags(null), /host: want plain object/);
  });
});

describe("issuesForHostExport", () => {
  it("matches CLI paths and collects multiple issues", () => {
    assert.deepEqual(issuesForHostExport(undefined), []);
    assert.deepEqual(issuesForHostExport({}), []);
    assert.deepEqual(issuesForHostExport(null), [
      { path: "host", message: "want plain object" },
    ]);
    const multi = issuesForHostExport({ loop: false, lights: "yes", camera: true });
    assert.ok(multi.some((i) => i.path === "host.loop" && i.message === "unknown key"));
    assert.ok(multi.some((i) => i.path === "host.lights" && i.message === "want boolean"));
    assert.equal(multi.some((i) => i.path === "host.camera"), false);
  });
});
