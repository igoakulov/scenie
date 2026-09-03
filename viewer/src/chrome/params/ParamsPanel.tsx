/**
 * Explore params: accordion sections for `type: "card"` (multiple open).
 */
import type { ReactNode } from "react";
import type { ParamsNode } from "../../host/paramsTree";
import { MathText } from "../../math/renderMath";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  cardValue,
  nodeKey,
  renderLeaf,
  type OnParamChange,
  type ParamsPanelProps,
} from "./shared";

export function ParamsPanel({ tree, params, onChange }: ParamsPanelProps) {
  if (tree.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <NodeList nodes={tree} params={params} onChange={onChange} />
    </div>
  );
}

/**
 * Non-cards render inline; consecutive cards share one Accordion (peer dividers).
 * Nested cards recurse inside panel content as nested Roots.
 */
function NodeList({
  nodes,
  params,
  onChange,
}: {
  nodes: ParamsNode[];
  params: ParamsPanelProps["params"];
  onChange: OnParamChange;
}) {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i]!;
    if (node.type !== "card") {
      out.push(
        <div key={nodeKey(node, i)} className="min-w-0">
          {renderLeaf(node, params, onChange)}
        </div>,
      );
      i += 1;
      continue;
    }
    const batch: Extract<ParamsNode, { type: "card" }>[] = [];
    const start = i;
    while (i < nodes.length && nodes[i]!.type === "card") {
      batch.push(nodes[i] as Extract<ParamsNode, { type: "card" }>);
      i += 1;
    }
    const values = batch.map((c, j) => cardValue(c, start + j));
    // Extra air before a nested card block when it follows fields/notes (not indent).
    const afterLeaves = start > 0;
    out.push(
      <Accordion
        key={`acc-${start}-${values.join("|")}`}
        multiple
        defaultValue={values}
        className={afterLeaves ? "mt-1 w-full" : "w-full"}
      >
        {batch.map((card, j) => {
          const value = values[j]!;
          return (
            <AccordionItem key={value} value={value}>
              <AccordionTrigger>
                <MathText as="span" text={card.title} />
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex min-w-0 flex-col gap-3">
                  <NodeList
                    nodes={card.children}
                    params={params}
                    onChange={onChange}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>,
    );
  }
  return <>{out}</>;
}
