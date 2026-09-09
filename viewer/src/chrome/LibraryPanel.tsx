import { useEffect, useState, type ReactNode } from "react";
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import { userFacingError } from "../host/viewerError";
import { cn } from "@/lib/utils";
import { CopyHitbox, CopyIconButton } from "./CopyHitbox";

export interface SceneListEntry {
  id: string;
  title?: string;
}

const SCENIE_SKILL_URL =
  "https://github.com/igoakulov/scenie/blob/main/skills/scenie/SKILL.md";

const SKILL_INSTALL_CMD =
  "npx skills add igoakulov/scenie --skill scenie -g -y";

const INIT_CMD = "scenie init";

const NEW_SCENE_PROMPT = "With Scenie skill, create a scene with ...";

const ROW = cn(
  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed",
  "text-foreground hover:bg-muted",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

const CRUMB = cn(
  "min-w-0 truncate rounded-sm text-muted-foreground hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

async function fetchSceneList(): Promise<SceneListEntry[]> {
  const res = await fetch("/api/scenes", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.text()).trim();
    throw new Error(body || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("want array");
  }
  return data.filter(
    (row): row is SceneListEntry =>
      row !== null &&
      typeof row === "object" &&
      typeof (row as SceneListEntry).id === "string" &&
      (row as SceneListEntry).id.length > 0,
  );
}

function childrenAt(entries: SceneListEntry[], cwd: string) {
  const prefix = cwd ? `${cwd}/` : "";
  const folders = new Map<string, number>();
  const scenes: SceneListEntry[] = [];
  for (const e of entries) {
    if (cwd && !e.id.startsWith(prefix)) continue;
    const rest = cwd ? e.id.slice(prefix.length) : e.id;
    const slash = rest.indexOf("/");
    if (slash === -1) {
      if (rest) scenes.push(e);
    } else {
      const name = rest.slice(0, slash);
      folders.set(name, (folders.get(name) ?? 0) + 1);
    }
  }
  const folderRows = [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }));
  return { folderRows, scenes };
}

/** `rel` is the posix id or folder under scenes/ (empty = root). */
export function PathCrumbs({
  rel,
  onGo,
  id,
}: {
  rel: string;
  onGo?: (next: string) => void;
  id?: string;
}) {
  const parts = rel ? rel.split("/") : [];
  const current = parts[parts.length - 1];
  const parent = parts.slice(0, -1).join("/");
  const parentName = parts.length >= 2 ? parts[parts.length - 2] : null;
  const collapsed = parts.length >= 3;
  const go = onGo && rel ? onGo : undefined;
  return (
    <nav
      id={id}
      aria-label="Scenes"
      title={rel ? `scenes/${rel}` : "scenes"}
      className="flex h-5 min-w-0 items-center gap-1 text-xs leading-none text-muted-foreground"
    >
      {go ? (
        <button
          type="button"
          className={cn(CRUMB, "shrink-0 p-0 leading-none")}
          onClick={() => go("")}
        >
          Scenes
        </button>
      ) : (
        <span className="shrink-0 leading-none">Scenes</span>
      )}
      {rel ? (
        <span className="shrink-0" aria-hidden>
          /
        </span>
      ) : null}
      {collapsed && (
        <>
          <span className="shrink-0" aria-hidden>
            …
          </span>
          <span className="shrink-0" aria-hidden>
            /
          </span>
        </>
      )}
      {parentName && (
        <>
          {go ? (
            <button
              type="button"
              title={parent}
              className={cn(CRUMB, "p-0 leading-none")}
              onClick={() => go(parent)}
            >
              {parentName}
            </button>
          ) : (
            <span className="min-w-0 truncate leading-none">{parentName}</span>
          )}
          <span className="shrink-0" aria-hidden>
            /
          </span>
        </>
      )}
      {rel ? (
        <span className="min-w-0 truncate leading-none text-foreground">
          {current}
        </span>
      ) : null}
    </nav>
  );
}

/** Copyable line — mono for shell commands, sans for prose prompts. */
function CopyRow({ text, mono = true }: { text: string; mono?: boolean }) {
  return (
    <CopyHitbox text={text} contentClassName={mono ? "font-mono" : "font-sans"}>
      {text}
    </CopyHitbox>
  );
}

function EmptyLibrary() {
  return (
    <div className="flex min-w-0 flex-col gap-3 text-xs/relaxed text-muted-foreground">
      <h2 className="m-0 text-sm font-medium tracking-tight text-foreground">
        Create scenes
      </h2>

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="sheet-selectable m-0">
          1. Ask your AI agent to run this command to install the{" "}
          <a
            href={SCENIE_SKILL_URL}
            className="text-foreground/90 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Scenie skill
          </a>
          :
        </p>
        <CopyRow text={SKILL_INSTALL_CMD} />
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <p className="sheet-selectable m-0">
          2. Ask your AI agent to add scenes
        </p>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="sheet-selectable m-0">…example scenes with command:</p>
          <CopyRow text={INIT_CMD} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="sheet-selectable m-0">
            …or build a new scene from a prompt:
          </p>
          <CopyRow text={NEW_SCENE_PROMPT} mono={false} />
        </div>
      </div>
    </div>
  );
}

export function LibraryPanel({
  onOpen,
  active = true,
}: {
  onOpen: (id: string) => void;
  active?: boolean;
}) {
  const [entries, setEntries] = useState<SceneListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cwd, setCwd] = useState("");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = async () => {
      setError(null);
      try {
        const list = await fetchSceneList();
        if (!cancelled) setEntries(list);
      } catch (err) {
        if (!cancelled) {
          setEntries(null);
          setError(userFacingError(err));
        }
      }
    };
    void load();
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [active]);

  const hasList = entries !== null && entries.length > 0;
  const { folderRows, scenes } = hasList
    ? childrenAt(entries, cwd)
    : { folderRows: [], scenes: [] };

  let body: ReactNode;
  if (error) {
    body = (
      <div className="group flex min-w-0 items-start gap-1">
        <p className="sheet-selectable m-0 min-w-0 flex-1 whitespace-pre-line text-xs text-muted-foreground">
          {error}
        </p>
        <CopyIconButton text={error} className="mt-0.5" />
      </div>
    );
  } else if (entries === null) {
    body = <p className="m-0 text-xs text-muted-foreground">Loading…</p>;
  } else if (entries.length === 0) {
    body = <EmptyLibrary />;
  } else {
    body = (
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {folderRows.map((folder) => {
          const next = cwd ? `${cwd}/${folder.name}` : folder.name;
          return (
            <li key={`d:${next}`}>
              <button
                type="button"
                title={next}
                className={cn(ROW, "group")}
                onClick={() => setCwd(next)}
              >
                <FolderIcon
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 truncate">
                  {folder.name}{" "}
                  <span className="text-muted-foreground">({folder.count})</span>
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </button>
            </li>
          );
        })}
        {scenes.map((entry) => {
          const label = entry.title?.trim() || entry.id;
          return (
            <li key={entry.id}>
              <button
                type="button"
                title={label}
                className={ROW}
                onClick={() => onOpen(entry.id)}
              >
                <FileIcon
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-1.5"
      {...(hasList
        ? { "aria-labelledby": "library-scenes-heading" }
        : { "aria-label": "Library" })}
    >
      {hasList && (
        <PathCrumbs rel={cwd} onGo={setCwd} id="library-scenes-heading" />
      )}
      {body}
    </section>
  );
}
