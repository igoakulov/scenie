export function params() {
  return [
    {
      type: "card",
      title: "N",
      children: [
        {
          key: "n",
          type: "number",
          label: "N",
          min: 0,
          max: 10,
          default: 0,
        },
      ],
    },
  ];
}

export function validateParams(p) {
  if (p.n < 1) {
    return [{ key: "n", message: "n must be at least 1" }];
  }
  return [];
}
