/** Chrome field that should receive keys instead of the scene. */
export function isTypingTarget(
  target: EventTarget | null | undefined,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
