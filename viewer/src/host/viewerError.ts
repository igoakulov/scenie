/**
 * Viewport banner: one string, shown and copied as-is.
 */

export function userFacingError(
  err: unknown,
  sceneId?: string | null,
): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.trim() || "Unknown error";
  const id = sceneId?.trim() || undefined;
  const who = id ? `Scene ${id}` : "This scene";
  const tagged = (rest: string) => (id ? `${who}: ${rest}` : rest);

  const missingFile = msg.match(/\b(metadata\.json|scene\.js): missing\b/i)
    ?? msg.match(/\b(metadata\.json|scene\.js).*HTTP 404\b/i);
  if (missingFile) {
    return `${who} has no ${missingFile[1]}.`;
  }
  const badImport = msg.match(/\b(scene\.js|host\.js): import failed\b/i);
  if (badImport) {
    return `${who} couldn't load ${badImport[1]} (syntax error or bad import).`;
  }
  if (/\b(metadata\.json|scene\.js|host\.js): unreachable\b/i.test(msg)) {
    return "Couldn't reach the local server — is `scenie show` still running?";
  }
  if (/\bHTTP 404\b/i.test(msg)) {
    return id
      ? `Scene ${id} is missing a required file.`
      : "A file for this scene is missing.";
  }
  if (/\bHTTP 5\d\d\b/i.test(msg)) {
    return "The local server returned an error — is `scenie show` still running?";
  }
  if (/\bHTTP \d{3}\b/i.test(msg)) {
    return "Couldn't load scene files from the server.";
  }
  if (
    /failed to fetch|networkerror|load failed/i.test(msg) &&
    !/module/i.test(msg)
  ) {
    return "Couldn't reach the local server — is `scenie show` still running?";
  }

  if (/metadata\.json.*missing title|missing title\/description/i.test(msg)) {
    return tagged("metadata.json needs a title and description.");
  }
  if (/metadata\.json.*tags/i.test(msg)) {
    return tagged("metadata.json tags must be a list of strings.");
  }
  if (/metadata\.json.*invalid json|unexpected token|json\.parse/i.test(msg)) {
    return tagged("metadata.json isn't valid JSON.");
  }
  if (/metadata\.json/i.test(msg)) {
    return tagged("Couldn't read metadata.json.");
  }

  if (/want scene export or constructed|must export a THREE\.Scene or construct/i.test(msg)) {
    return tagged("scene.js must export a THREE.Scene (or construct one).");
  }
  if (/bindInput want function/i.test(msg)) {
    return tagged(
      "host.js must export a bindInput function when host.camera is false.",
    );
  }

  if (/^host: want plain object$/i.test(msg)) {
    return tagged(
      'Invalid host export — use a plain object or omit it. Allowed keys: lights, helpers, camera, playback (booleans), view ("2d" or "3d").',
    );
  }
  if (/^host\.view: /i.test(msg)) {
    return tagged('host.view must be "2d" or "3d".');
  }
  if (/^host\.\w+: unknown key$/i.test(msg)) {
    const key = msg.match(/host\.(\w+)/)?.[1] ?? "key";
    return tagged(
      `Unknown host flag “${key}”. Allowed: lights, helpers, camera, playback, view.`,
    );
  }
  if (/^host\.\w+: want boolean$/i.test(msg)) {
    const key = msg.match(/host\.(\w+)/)?.[1] ?? "flag";
    return tagged(`Host flag “${key}” must be true or false.`);
  }
  if (/^host[:.]/i.test(msg)) {
    return tagged(`Invalid host export: ${stripPrefix(msg, /^host:\s*/i)}.`);
  }

  if (/^bindInput\(\) threw:/i.test(msg)) {
    return tagged(
      `bindInput() failed: ${stripPrefix(msg, /^bindInput\(\) threw:\s*/i)}.`,
    );
  }
  if (/^update\(\) threw:/i.test(msg)) {
    return tagged(
      `update() failed: ${stripPrefix(msg, /^update\(\) threw:\s*/i)}.`,
    );
  }
  if (/^applyParams threw:/i.test(msg)) {
    return tagged(
      `applyParams failed: ${stripPrefix(msg, /^applyParams threw:\s*/i)}.`,
    );
  }
  if (/^updateView\(\) threw:/i.test(msg)) {
    return tagged(
      `updateView() failed: ${stripPrefix(msg, /^updateView\(\) threw:\s*/i)}.`,
    );
  }
  if (/^params\(\) threw:/i.test(msg)) {
    return tagged(
      `host.js params() failed: ${stripPrefix(msg, /^params\(\) threw:\s*/i)}.`,
    );
  }
  if (/^onParamsChange threw:/i.test(msg)) {
    return tagged(
      `onParamsChange failed: ${stripPrefix(msg, /^onParamsChange threw:\s*/i)}.`,
    );
  }

  if (/^want array$/i.test(msg) || /^HTTP \d+$/i.test(msg)) {
    return "Couldn't load the scene list.";
  }

  if (msg.length > 220) {
    return `${msg.slice(0, 200).trim()}…`;
  }
  if (!/[.!?]$/.test(msg)) {
    return tagged(`${msg}.`);
  }
  return id ? tagged(msg) : msg;
}

function stripPrefix(s: string, re: RegExp): string {
  return s.replace(re, "").trim() || s;
}
