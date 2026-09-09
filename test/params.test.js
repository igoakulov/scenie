import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultsFromWritable,
  resolveLabelValue,
  validateParamsTree,
} from "../dist/validate/params.js";

describe("validateParamsTree", () => {
  it("accepts nested cards and flat defaults", () => {
    const { nodes, writable, issues } = validateParamsTree(
      [
        {
          type: "card",
          title: "Demo",
          children: [
            { type: "note", text: "Hello" },
            {
              key: "size",
              type: "number",
              label: "Size",
              min: 0,
              max: 10,
              default: 1,
            },
            { key: "on", type: "boolean", label: "On", default: false },
            {
              key: "kind",
              type: "select",
              label: "Kind",
              options: ["a", "b"],
              default: "a",
            },
            { type: "label", label: "Area", value: (p) => String(p.size) },
            {
              type: "card",
              title: "Nested",
              children: [
                {
                  key: "nested_n",
                  type: "number",
                  label: "N",
                  min: 1,
                  max: 3,
                  default: 2,
                },
              ],
            },
          ],
        },
      ],
      "params",
    );
    assert.equal(issues.length, 0, JSON.stringify(issues));
    assert.equal(nodes?.length, 1);
    assert.equal(writable?.length, 4);
    assert.deepEqual(defaultsFromWritable(writable), {
      size: 1,
      on: false,
      kind: "a",
      nested_n: 2,
    });
    const area = nodes[0].children.find((n) => n.type === "label");
    assert.equal(resolveLabelValue(area.value, { size: 3 }), "3");
  });

  it("rejects duplicate keys, unknown types, and incomplete numbers", () => {
    const dup = validateParamsTree(
      [
        {
          type: "card",
          title: "A",
          children: [
            {
              key: "x",
              type: "number",
              label: "X",
              min: 0,
              max: 1,
              default: 0,
            },
            {
              type: "card",
              title: "B",
              children: [
                {
                  key: "x",
                  type: "number",
                  label: "X2",
                  min: 0,
                  max: 1,
                  default: 1,
                },
              ],
            },
          ],
        },
      ],
      "params",
    );
    assert.ok(dup.issues.some((i) => i.message.includes("duplicate")));

    const unknown = validateParamsTree(
      [{ type: "vector", key: "v", label: "V", default: [0, 0, 1] }],
      "params",
    );
    assert.ok(unknown.issues.some((i) => i.path.endsWith(".type")));

    const incomplete = validateParamsTree(
      [
        {
          type: "card",
          title: "C",
          children: [{ key: "n", type: "number", label: "N", default: 1 }],
        },
      ],
      "params",
    );
    assert.ok(incomplete.issues.some((i) => i.path.includes("min")));
  });
});
