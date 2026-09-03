import type { SceneMetadata } from "../host/loadScene";
import { DescriptionText } from "../math/DescriptionText";
import { CopyIconButton } from "./CopyHitbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/** Title copy control pastes `id: "title"` for agent reference. */
export function SummaryPanel({
  id,
  metadata,
}: {
  id: string;
  metadata: SceneMetadata;
}) {
  const copyText = `${id}: "${metadata.title}"`;

  const tags = metadata.tags.filter((t) => t.trim().length > 0);
  const tagsCopy = tags.join(", ");
  const attributionRows = metadata.attribution
    ? Object.entries(metadata.attribution).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && Boolean(entry[1]),
      )
    : [];
  const attributionCopy = attributionRows
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const hasMeta = tags.length > 0 || attributionRows.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-2.5 text-xs/relaxed">
      <div className="flex min-w-0 items-center gap-1 px-0.5">
        <h1
          className="m-0 min-w-0 flex-1 truncate text-sm font-medium tracking-tight"
          title={metadata.title}
        >
          {metadata.title}
        </h1>
        <CopyIconButton text={copyText} />
      </div>

      {metadata.description.trim().length > 0 && (
        <div className="flex min-w-0 items-start gap-1">
          <DescriptionText
            text={metadata.description}
            className="min-w-0 flex-1 text-muted-foreground [&_.katex]:text-foreground"
          />
          <CopyIconButton
            text={metadata.description}
            className="mt-0.5"
          />
        </div>
      )}

      {hasMeta && (
        <Accordion className="w-full">
          {tags.length > 0 && (
            <AccordionItem value="tags">
              <AccordionTrigger>Tags</AccordionTrigger>
              <AccordionContent>
                <div className="flex min-w-0 items-start gap-1">
                  <p className="sheet-selectable m-0 min-w-0 flex-1 wrap-anywhere text-xs/relaxed text-muted-foreground">
                    {tagsCopy}
                  </p>
                  <CopyIconButton text={tagsCopy} className="mt-0.5" />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          {attributionRows.length > 0 && (
            <AccordionItem value="attribution">
              <AccordionTrigger>Attribution</AccordionTrigger>
              <AccordionContent>
                <div className="flex min-w-0 items-start gap-1">
                  <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0">
                    {attributionRows.map(([key, value]) => (
                      <li
                        key={key}
                        className="sheet-selectable m-0 min-w-0 wrap-anywhere text-xs/relaxed text-muted-foreground"
                      >
                        <span className="text-foreground/80">{key}:</span>{" "}
                        {value}
                      </li>
                    ))}
                  </ul>
                  <CopyIconButton text={attributionCopy} className="mt-0.5" />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}
    </div>
  );
}
