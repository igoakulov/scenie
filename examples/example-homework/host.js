export const host = {
  helpers: false,
  lights: false,
  view: "2d",
};

function num(q, key, fallback) {
  const v = Number(q[key]);
  return Number.isFinite(v) ? v : fallback;
}

function derived(q) {
  const L = num(q, "L", 0.8);
  const m = num(q, "m", 0.25);
  const g = num(q, "g", 9.8);
  const th = (num(q, "theta0", 30) * Math.PI) / 180;
  const h = L * (1 - Math.cos(th));
  const v = Math.sqrt(Math.max(0, 2 * g * h));
  const T = m * (g + (v * v) / Math.max(L, 1e-9));
  const E = m * g * h;
  return { L, m, g, th, h, v, T, E };
}

function fmt(x, digits) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function params() {
  return [
    {
      type: "card",
      title: "Setup",
      children: [
        {
          type: "note",
          text: "Released from rest at $\\theta_0$ from the vertical. Take $U=0$ at the lowest point. String massless and inextensible; no drag.",
        },
        { key: "L", type: "number", label: "Length $L$", min: 0.4, max: 1.4, step: 0.05, default: 0.8, unit: "m" },
        { key: "m", type: "number", label: "Mass $m$", min: 0.05, max: 1.5, step: 0.05, default: 0.25, unit: "kg" },
        { key: "theta0", type: "number", label: "Release $\\theta_0$", min: 5, max: 75, step: 1, default: 30, unit: "°" },
        { key: "g", type: "number", label: "Gravity $g$", min: 1, max: 20, step: 0.05, default: 9.8, unit: "m/s²" },
        {
          key: "mode",
          type: "select",
          label: "Pose",
          options: ["animate", "at release", "at bottom"],
          default: "animate",
        },
        {
          key: "overlays",
          type: "multiselect",
          label: "Show",
          options: ["path", "forces", "energy", "height"],
          default: ["path", "forces", "energy", "height"],
        },
      ],
    },
    {
      type: "card",
      title: "1. Speed at the bottom",
      children: [
        {
          type: "note",
          text: "Height above the bottom is $h=L(1-\\cos\\theta)$. From rest, $mgh=\\tfrac12 mv^2$, so $v=\\sqrt{2gL(1-\\cos\\theta_0)}$.",
        },
        { type: "label", label: "$h=L(1-\\cos\\theta_0)$", value: (q) => `${fmt(derived(q).h, 3)} m` },
        { type: "label", label: "$v_{\\mathrm{bottom}}$", value: (q) => `${fmt(derived(q).v, 3)} m/s` },
        { type: "label", label: "Total $E=mgh$", value: (q) => `${fmt(derived(q).E, 3)} J` },
      ],
    },
    {
      type: "card",
      title: "2. Tension at the bottom",
      children: [
        {
          type: "note",
          text: "Radial law: $T-mg\\cos\\theta=mv^2/L$. At the bottom $\\theta=0$, so $T=mg+mv^2/L=mg(3-2\\cos\\theta_0)$.",
        },
        { type: "label", label: "$mg$", value: (q) => `${fmt(derived(q).m * derived(q).g, 3)} N` },
        { type: "label", label: "$mv^2/L$", value: (q) => `${fmt(derived(q).T - derived(q).m * derived(q).g, 3)} N` },
        { type: "label", label: "$T_{\\mathrm{bottom}}$", value: (q) => `${fmt(derived(q).T, 3)} N` },
      ],
    },
  ];
}

export function validateParams(p) {
  const issues = [];
  if (num(p, "L", 0.8) <= 0) issues.push({ key: "L", message: "length must be positive" });
  if (num(p, "m", 0.25) <= 0) issues.push({ key: "m", message: "mass must be positive" });
  if (num(p, "g", 9.8) <= 0) issues.push({ key: "g", message: "g must be positive" });
  return issues;
}
