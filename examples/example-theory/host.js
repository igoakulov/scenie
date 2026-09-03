export function params() {
  return [
    {
      type: "card",
      title: "Vectors",
      children: [
        {
          type: "note",
          text: "Arrows start at the origin. $\\mathbf{u}=u_x\\hat{\\imath}+u_y\\hat{\\jmath}+u_z\\hat{k}$.",
        },
        {
          type: "card",
          title: "Vector $\\mathbf{u}$",
          children: [
            { key: "u_x", type: "number", label: "$u_x$", min: -4, max: 4, step: 0.1, default: 2.2, unit: "u" },
            { key: "u_y", type: "number", label: "$u_y$", min: -4, max: 4, step: 0.1, default: 0.8, unit: "u" },
            { key: "u_z", type: "number", label: "$u_z$", min: -4, max: 4, step: 0.1, default: 0.4, unit: "u" },
            {
              type: "label",
              label: "$\\|\\mathbf{u}\\|$",
              value: (q) => Math.hypot(q.u_x ?? 0, q.u_y ?? 0, q.u_z ?? 0).toFixed(2),
            },
          ],
        },
        {
          type: "card",
          title: "Vector $\\mathbf{v}$",
          children: [
            { key: "v_x", type: "number", label: "$v_x$", min: -4, max: 4, step: 0.1, default: 0.5, unit: "u" },
            { key: "v_y", type: "number", label: "$v_y$", min: -4, max: 4, step: 0.1, default: 1.9, unit: "u" },
            { key: "v_z", type: "number", label: "$v_z$", min: -4, max: 4, step: 0.1, default: 0.6, unit: "u" },
            {
              type: "label",
              label: "$\\|\\mathbf{v}\\|$",
              value: (q) => Math.hypot(q.v_x ?? 0, q.v_y ?? 0, q.v_z ?? 0).toFixed(2),
            },
          ],
        },
      ],
    },
    {
      type: "card",
      title: "Addition $\\mathbf{u}+\\mathbf{v}$",
      children: [
        {
          type: "note",
          text: "Parallelogram / tip-to-tail: $\\mathbf{u}+\\mathbf{v}=(u_x+v_x,\\,u_y+v_y,\\,u_z+v_z)$.",
        },
        {
          type: "label",
          label: "$\\mathbf{u}+\\mathbf{v}$",
          value: (q) => {
            const x = (q.u_x ?? 0) + (q.v_x ?? 0);
            const y = (q.u_y ?? 0) + (q.v_y ?? 0);
            const z = (q.u_z ?? 0) + (q.v_z ?? 0);
            return `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
          },
        },
        {
          type: "label",
          label: "$\\|\\mathbf{u}+\\mathbf{v}\\|$",
          value: (q) =>
            Math.hypot(
              (q.u_x ?? 0) + (q.v_x ?? 0),
              (q.u_y ?? 0) + (q.v_y ?? 0),
              (q.u_z ?? 0) + (q.v_z ?? 0),
            ).toFixed(2),
        },
      ],
    },
    {
      type: "card",
      title: "Scalar stretch $c\\mathbf{u}$",
      children: [
        {
          type: "note",
          text: "$c\\mathbf{u}$ stays on the line through $\\mathbf{u}$. Negative $c$ flips the arrow.",
        },
        { key: "c", type: "number", label: "Scalar $c$", min: -3, max: 3, step: 0.1, default: 1.6 },
        {
          type: "label",
          label: "$c\\mathbf{u}$",
          value: (q) => {
            const c = q.c ?? 0;
            return `(${((q.u_x ?? 0) * c).toFixed(1)}, ${((q.u_y ?? 0) * c).toFixed(1)}, ${((q.u_z ?? 0) * c).toFixed(1)})`;
          },
        },
        {
          type: "label",
          label: "$\\|c\\mathbf{u}\\|$",
          value: (q) => (Math.abs(q.c ?? 0) * Math.hypot(q.u_x ?? 0, q.u_y ?? 0, q.u_z ?? 0)).toFixed(2),
        },
      ],
    },
    {
      type: "card",
      title: "Display",
      children: [
        {
          key: "layers",
          type: "multiselect",
          label: "Show",
          options: ["basis", "u", "v", "sum", "parallelogram", "scaled"],
          default: ["basis", "u", "v", "sum", "parallelogram", "scaled"],
        },
        { key: "show_labels", type: "boolean", label: "Labels", default: true },
      ],
    },
  ];
}

export function validateParams(params) {
  const issues = [];
  const uLen = Math.hypot(params.u_x ?? 0, params.u_y ?? 0, params.u_z ?? 0);
  if (uLen < 1e-6) issues.push({ key: "u_x", message: "u is the zero vector — addition and stretch are still defined, but the arrow vanishes" });
  return issues;
}
