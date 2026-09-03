export const PARAMS_PREAMBLE =
  "const params = globalThis.__scenieParams ?? {};\n";

export function withParamsPreamble(source: string): string {
  return PARAMS_PREAMBLE + source;
}
