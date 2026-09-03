import { useCallback, useEffect, useRef, useState } from "react";
import { PanelRightIcon, PanelRightCloseIcon } from "lucide-react";
import { SummaryPanel } from "./chrome/SummaryPanel";
import { ExploreTools } from "./chrome/ExploreTools";
import { LibraryPanel } from "./chrome/LibraryPanel";
import { ParamsPanel } from "./chrome/params";
import { Button } from "@/components/ui/button";
import { loadScene, viewToDimensions, type LoadedScene } from "./host/loadScene";
import type { ParamValue } from "./host/defaults";
import {
  DEFAULT_GRID,
  SceneHost,
  type GridState,
} from "./host/SceneHost";
import { gridForDimensions } from "./host/grid";
import { userFacingError } from "./host/viewerError";
import { CopyIconButton } from "./chrome/CopyHitbox";
import { cn } from "@/lib/utils";

type SheetTab = "library" | "summary" | "explore";

function readSceneFromUrl(): string | null {
  const scene = new URLSearchParams(window.location.search).get("scene");
  if (!scene || !scene.trim()) return null;
  return scene.trim();
}

/** Session-only Grid prefs keyed by scene id (and no-selection shell). */
const gridByKey = new Map<string, GridState>();
const NO_SCENE_KEY = "__none__";

function gridKey(sceneId: string | null): string {
  return sceneId ?? NO_SCENE_KEY;
}

function paramBagsEqual(
  a: Record<string, ParamValue>,
  b: Record<string, ParamValue>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length || av.some((x, i) => x !== bv[i])) return false;
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

export function App() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<SceneHost | null>(null);

  const [sheetOpen, setSheetOpen] = useState(true);
  const [sceneId, setSceneId] = useState<string | null>(() => readSceneFromUrl());
  const [sheetTab, setSheetTab] = useState<SheetTab>(() =>
    readSceneFromUrl() ? "summary" : "library",
  );
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [liveParams, setLiveParams] = useState<Record<string, ParamValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridState>(() => {
    const id = readSceneFromUrl();
    return gridByKey.get(gridKey(id)) ?? { ...DEFAULT_GRID };
  });
  const [loading, setLoading] = useState(false);
  const [playback, setPlayback] = useState({ show: false, playing: false });

  const hasScene = sceneId != null;
  const sceneIdRef = useRef(sceneId);
  sceneIdRef.current = sceneId;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const rt = new SceneHost({
      container: host,
      onError: (message) =>
        setError(userFacingError(message, sceneIdRef.current)),
    });
    hostRef.current = rt;
    const initial = gridByKey.get(gridKey(readSceneFromUrl())) ?? {
      ...DEFAULT_GRID,
    };
    rt.setGridState(initial);
    const unsub = rt.subscribePlayback(() => {
      setPlayback(rt.getPlaybackUi());
    });
    setPlayback(rt.getPlaybackUi());
    return () => {
      unsub();
      rt.dispose();
      hostRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setSheetOpen((o) => !o);
      } else if (e.key === "r" || e.key === "R") {
        const flags = hostRef.current?.getHostFlags();
        if (flags && !flags.camera) return;
        e.preventDefault();
        hostRef.current?.resetView();
      } else if (e.key === " " || e.code === "Space") {
        // When camera: false, Space is free for the scene (jump/fly); use Explore Play/Pause.
        const flags = hostRef.current?.getHostFlags();
        if (flags && !flags.camera) return;
        const ui = hostRef.current?.getPlaybackUi();
        if (!ui?.show) return;
        e.preventDefault();
        hostRef.current?.togglePlaying();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load / unload canvas from selection only — sheet tab does not clear selection.
  useEffect(() => {
    const rt = hostRef.current;
    if (!rt) return;

    if (!sceneId) {
      rt.showEmpty();
      setLoaded(null);
      setLiveParams({});
      setError(null);
      setLoading(false);
      document.title = "Scenie";
      const saved = gridByKey.get(NO_SCENE_KEY) ?? { ...DEFAULT_GRID };
      setGrid(saved);
      rt.setGridState(saved);
      return;
    }

    let cancelled = false;
    // Drop previous scene UI immediately so Summary/Explore never flash old content.
    setLoading(true);
    setError(null);
    setLoaded(null);
    setLiveParams({});
    rt.showEmpty();

    void (async () => {
      try {
        const scene = await loadScene(sceneId);
        if (cancelled) return;
        const dim = viewToDimensions(scene.host.view);
        const saved = gridByKey.get(sceneId) ?? { ...DEFAULT_GRID };
        const next = gridForDimensions(saved, dim);
        gridByKey.set(sceneId, next);
        setGrid(next);
        rt.setGridState(next);
        await rt.mountScene(scene);
        setLoaded(scene);
        setLiveParams({ ...scene.params });
        document.title = `${scene.metadata.title} · Scenie`;
      } catch (err) {
        if (cancelled) return;
        setError(userFacingError(err, sceneId));
        setLoaded(null);
        setLiveParams({});
        rt.showEmpty();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // If selection is cleared while on a scene tab, land on Library.
  useEffect(() => {
    if (!hasScene && sheetTab !== "library") {
      setSheetTab("library");
    }
  }, [hasScene, sheetTab]);

  const onGridChange = useCallback(
    (partial: Partial<GridState>) => {
      setGrid((prev) => {
        const dim = loaded ? viewToDimensions(loaded.host.view) : 3;
        const merged: GridState = {
          ...prev,
          ...partial,
          step: Math.max(0.01, partial.step ?? prev.step),
          size: Math.max(0.01, partial.size ?? prev.size),
          showFloor: partial.showFloor ?? prev.showFloor,
          showXY: partial.showXY ?? prev.showXY,
          showYZ: partial.showYZ ?? prev.showYZ,
        };
        const next = gridForDimensions(merged, dim);
        hostRef.current?.setGridState(next);
        gridByKey.set(gridKey(sceneId), next);
        return next;
      });
    },
    [sceneId, loaded?.host.view],
  );

  const openScene = useCallback((id: string) => {
    const next = id.trim();
    if (!next) return;
    setSceneId(next);
    setSheetTab("summary");
    const url = new URL(window.location.href);
    url.searchParams.set("scene", next);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const onParamChange = useCallback(
    (key: string, value: ParamValue) => {
      const rt = hostRef.current;
      if (!loaded || !rt) return;

      setLiveParams((prev) => {
        let next: Record<string, ParamValue> = {
          ...prev,
          [key]: Array.isArray(value) ? [...value] : value,
        };
        if (typeof loaded.module.onParamsChange === "function") {
          try {
            next = loaded.module.onParamsChange(next, { key, value });
          } catch (err) {
            setError(
              userFacingError(
                new Error(
                  `onParamsChange threw: ${err instanceof Error ? err.message : String(err)}`,
                ),
                loaded.id,
              ),
            );
            return prev;
          }
        }

        // Blur after a live parse re-commits the same value — skip the graph.
        if (paramBagsEqual(prev, next)) return prev;

        if (typeof loaded.module.applyParams === "function") {
          try {
            rt.applyParams(next, { key, value });
            setError(null);
          } catch (err) {
            setError(userFacingError(err, loaded.id));
          }
          return next;
        }

        void (async () => {
          try {
            await rt.remountWithParams(next);
            setError(null);
          } catch (err) {
            setError(userFacingError(err, loaded.id));
          }
        })();

        return next;
      });
    },
    [loaded],
  );

  const onSheetTabChange = useCallback(
    (value: string | number | null) => {
      if (value === "library") {
        setSheetTab("library");
        return;
      }
      if ((value === "summary" || value === "explore") && sceneId) {
        setSheetTab(value);
      }
    },
    [sceneId],
  );

  const toggleSheet = () => setSheetOpen((o) => !o);

  const panelBtn = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title="Toggle panel [/]"
      aria-label="Toggle panel [/]"
      onClick={toggleSheet}
    >
      {sheetOpen ? (
        <PanelRightCloseIcon className="size-5" data-icon="inline-start" />
      ) : (
        <PanelRightIcon className="size-5" data-icon="inline-start" />
      )}
    </Button>
  );

  return (
    <div className="app-shell">
      {/* Single stable control — never remounts between open/closed (avoids flash). */}
      <div className="panel-toggle-float">{panelBtn}</div>

      <div className="viewport">
        <div className="viewport-canvas-host" ref={canvasHostRef} />
        {error && (
          <div className="viewport-error" role="alert">
            <p className="m-0 min-w-0 flex-1">{error}</p>
            <CopyIconButton
              text={error}
              className="text-destructive hover:text-destructive"
            />
          </div>
        )}
      </div>

      <aside
        className={cn("sheet", sheetOpen ? "sheet-open" : "sheet-closed")}
        aria-hidden={!sheetOpen}
      >
        <div className="sheet-inner">
          <header className="sheet-header">
            <div
              role="tablist"
              aria-label="Sheet"
              className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg bg-muted p-0.75 text-muted-foreground"
            >
              {(
                [
                  { id: "library" as const, label: "Library", disabled: false },
                  {
                    id: "summary" as const,
                    label: "Summary",
                    disabled: !hasScene,
                  },
                  {
                    id: "explore" as const,
                    label: "Explore",
                    disabled: !hasScene,
                  },
                ] as const
              ).map((tab) => {
                const active = sheetTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={tab.disabled}
                    className={cn(
                      "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors outline-none",
                      "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                      "disabled:pointer-events-none disabled:opacity-50",
                      active
                        ? "bg-background text-foreground dark:border-input dark:bg-input/30"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onSheetTabChange(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>
          <div className="sheet-body">
            <div className="sheet-scroll">
              <div className="min-w-0 px-3 py-3">
                {sheetTab === "library" && (
                  <LibraryPanel onOpen={openScene} />
                )}
                {sheetTab === "summary" &&
                  hasScene &&
                  loaded &&
                  loaded.id === sceneId && (
                    <SummaryPanel id={loaded.id} metadata={loaded.metadata} />
                  )}
                {sheetTab === "summary" &&
                  hasScene &&
                  (!loaded || loaded.id !== sceneId) &&
                  loading && (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  )}
                {sheetTab === "explore" && hasScene && (
                  <div className="flex min-w-0 flex-col gap-3">
                    {loaded && loaded.id === sceneId ? (
                      <>
                        <ExploreTools
                          grid={grid}
                          dimensions={viewToDimensions(loaded.host.view)}
                          showHelpers={loaded.host.helpers}
                          showCameraReset={loaded.host.camera}
                          showPlayback={playback.show}
                          playing={playback.playing}
                          spaceTogglesPlayback={loaded.host.camera}
                          onGridChange={onGridChange}
                          onResetView={() => hostRef.current?.resetView()}
                          onTogglePlay={() =>
                            hostRef.current?.togglePlaying()
                          }
                        />
                        {loaded.paramsTree.length > 0 && (
                          <ParamsPanel
                            tree={loaded.paramsTree}
                            params={liveParams}
                            onChange={onParamChange}
                          />
                        )}
                      </>
                    ) : loading ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
