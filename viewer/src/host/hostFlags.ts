/** Re-export shared CLI/viewer host flag helpers (single source of truth). */
export {
  DEFAULT_HOST_FLAGS,
  HOST_BOOL_KEYS,
  HOST_VIEW_VALUES,
  issuesForHostExport,
  resolveHostFlags,
  viewToDimensions,
  type HostFlagIssue,
  type HostBoolKey,
  type HostFlags,
  type HostView,
} from "../../../src/host-flags";
