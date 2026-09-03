import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import {
  rootHasAgentLight,
  startViewFromGraph,
} from "../viewer/src/host/sceneOwnership.ts";

describe("scene ownership", () => {
  it("detects agent lights under root", () => {
    const root = new THREE.Group();
    assert.equal(rootHasAgentLight(root), false);
    root.add(new THREE.AmbientLight(0xffffff, 0.5));
    assert.equal(rootHasAgentLight(root), true);
  });

  it("copies start camera pose and leaves the camera parented", () => {
    const root = new THREE.Group();
    const cam = new THREE.PerspectiveCamera(12, 2, 0.01, 9);
    cam.position.set(4, 2, 6);
    cam.lookAt(0, 0, 0);
    root.add(cam);
    const view = startViewFromGraph(root);
    assert.ok(view);
    assert.ok(view.position.distanceTo(new THREE.Vector3(4, 2, 6)) < 1e-5);
    assert.equal(cam.parent, root);
    assert.equal(view.fov, 12);
    assert.equal(view.near, 0.01);
    assert.equal(view.far, 9);
    const toOrigin = new THREE.Vector3(0, 0, 0).sub(view.position).normalize();
    const look = view.target.clone().sub(view.position).normalize();
    assert.ok(look.dot(toOrigin) > 0.99);
  });
});
