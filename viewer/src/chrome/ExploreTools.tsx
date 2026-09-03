import type { GridState } from "../host/grid";
import { DEFAULT_GRID } from "../host/grid";
import { MultiSelectField } from "./MultiSelectField";
import { NumberField } from "./NumberField";

interface Props {
  grid: GridState;
  /** Scene dimensions — filters which grid planes appear in the menu. */
  dimensions: 2 | 3;
  showHelpers: boolean;
  showCameraReset: boolean;
  showPlayback: boolean;
  playing: boolean;
  /** Space toggles transport only when host camera is on. */
  spaceTogglesPlayback: boolean;
  onGridChange: (partial: Partial<GridState>) => void;
  onResetView: () => void;
  onTogglePlay: () => void;
}

type PlaneKey = "showFloor" | "showXY" | "showYZ";

const PLANES_3D: { key: PlaneKey; label: string }[] = [
  { key: "showFloor", label: "Floor (XZ)" },
  { key: "showXY", label: "XY" },
  { key: "showYZ", label: "YZ" },
];

/** 2D face-on: single plane, labeled Floor (XY). */
const PLANES_2D: { key: PlaneKey; label: string }[] = [
  { key: "showXY", label: "Floor (XY)" },
];

function planeOptions(dimensions: 2 | 3) {
  return dimensions === 2 ? PLANES_2D : PLANES_3D;
}

export function ExploreTools({
  grid,
  dimensions,
  showHelpers,
  showCameraReset,
  showPlayback,
  playing,
  spaceTogglesPlayback,
  onGridChange,
  onResetView,
  onTogglePlay,
}: Props) {
  const options = planeOptions(dimensions);
  const selected = options.filter((o) => grid[o.key]).map((o) => o.key);

  if (!showHelpers && !showCameraReset && !showPlayback) return null;

  return (
    <div className="flex flex-col gap-3">
      {showHelpers && (
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.55fr)_minmax(0,0.55fr)] items-end gap-2">
          <MultiSelectField
            label="Grid"
            options={options.map((o) => ({ value: o.key, label: o.label }))}
            value={selected}
            allSummary="All planes"
            onChange={(next) => {
              const set = new Set(next);
              const partial: Partial<GridState> = {};
              for (const o of options) {
                partial[o.key] = set.has(o.key);
              }
              onGridChange(partial);
            }}
          />

          <NumberField
            id="grid-size"
            label="Size"
            value={grid.size}
            defaultValue={DEFAULT_GRID.size}
            min={0.01}
            onCommit={(size) => onGridChange({ size })}
          />
          <NumberField
            id="grid-step"
            label="Step"
            value={grid.step}
            defaultValue={DEFAULT_GRID.step}
            min={0.01}
            onCommit={(step) => onGridChange({ step })}
          />
        </div>
      )}

      {(showPlayback || showCameraReset) && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {showPlayback && (
            <button
              type="button"
              className="text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={onTogglePlay}
            >
              {playing
                ? spaceTogglesPlayback
                  ? "Pause [Space]"
                  : "Pause"
                : spaceTogglesPlayback
                  ? "Play [Space]"
                  : "Play"}
            </button>
          )}
          {showCameraReset && (
            <button
              type="button"
              className="text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={onResetView}
            >
              Reset camera [R]
            </button>
          )}
        </div>
      )}
    </div>
  );
}
