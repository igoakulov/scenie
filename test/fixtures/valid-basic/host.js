export function params() {
  return [
    {
      type: "card",
      title: "Box",
      children: [
        { key: "size", type: "number", label: "Size", min: 0.1, max: 5, default: 1, step: 0.1 },
        { key: "visible", type: "boolean", label: "Visible", default: true },
        { key: "style", type: "select", label: "Style", options: ["solid", "wire"], default: "solid" },
        { type: "label", label: "Hint", value: "Unit cube" },
        { type: "note", text: "Simple demo mesh." },
      ],
    },
  ];
}
