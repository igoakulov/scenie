import { useEffect, useState, type ReactNode } from "react";
import { userFacingError } from "../host/viewerError";
import { cn } from "@/lib/utils";
import { CopyHitbox } from "./CopyHitbox";

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

async function fetchSceneList(): Promise<SceneListEntry[]> {
  const res = await fetch("/api/scenes", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
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

function SectionHeading({ id, children }: { id?: string; children: string }) {
  return (
    <h2 id={id} className="m-0 px-2 text-xs font-normal text-muted-foreground">
      {children}
    </h2>
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

export function LibraryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [entries, setEntries] = useState<SceneListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const list = await fetchSceneList();
        if (!cancelled) setEntries(list);
      } catch (err) {
        if (!cancelled) {
          setEntries(null);
          setError(userFacingError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasList = entries !== null && entries.length > 0;

  let body: ReactNode;
  if (error) {
    body = (
      <p
        className="sheet-selectable m-0 px-2 text-xs text-muted-foreground"
        title={error}
      >
        {error}
      </p>
    );
  } else if (entries === null) {
    body = <p className="m-0 px-2 text-xs text-muted-foreground">Loading…</p>;
  } else if (entries.length === 0) {
    body = <EmptyLibrary />;
  } else {
    body = (
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {entries.map((entry) => {
          const label = entry.title?.trim() || entry.id;
          return (
            <li key={entry.id}>
              <button
                type="button"
                title={label}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed",
                  "text-foreground hover:bg-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                onClick={() => onOpen(entry.id)}
              >
                <span
                  aria-hidden
                  className="size-1 shrink-0 rounded-full bg-muted-foreground/70"
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
    <div className="flex min-w-0 flex-col gap-4">
      <section
        className="flex min-w-0 flex-col gap-1.5"
        {...(hasList
          ? { "aria-labelledby": "library-scenes-heading" }
          : { "aria-label": "Library" })}
      >
        {hasList && (
          <SectionHeading id="library-scenes-heading">Scenes</SectionHeading>
        )}
        {body}
      </section>
    </div>
  );
}
