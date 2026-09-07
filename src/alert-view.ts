/**
 * GitHub-flavoured alerts: a blockquote whose first line is `[!NOTE]` and the
 * like, drawn as a coloured callout with a badge.
 *
 * The markdown is left exactly as written — the label stays in the document
 * as text, so the file on disk and the Source view never learn anything
 * happened — and the callout is a pair of decorations: one on the blockquote
 * node carrying the kind, one over the label's characters so CSS can dress
 * them as a badge. Where the app does not render (another viewer, GitHub's
 * own fallback) the same text degrades to a quote with a bracketed label,
 * which is what the syntax was designed to do.
 */
import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node as PMNode } from "@milkdown/kit/prose/model";

type AlertState = { signature: string; set: DecorationSet };

const key = new PluginKey<AlertState>("plans-alert");

export const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

const LABEL = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?=\s|$)/;

/**
 * The label, if this blockquote opens with one. It must be the very first
 * thing in the first paragraph, as GitHub requires: `> text [!NOTE]` is prose.
 */
function labelOf(quote: PMNode): { kind: AlertKind; length: number } | null {
  const first = quote.firstChild;
  if (!first || first.type.name !== "paragraph") return null;
  const lead = first.firstChild;
  if (!lead || !lead.isText) return null;
  const m = LABEL.exec(lead.text ?? "");
  if (!m) return null;
  return { kind: m[1].toLowerCase() as AlertKind, length: m[0].length };
}

function build(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "blockquote") return;
    const hit = labelOf(node);
    if (!hit) return;
    decos.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: "alert",
        "data-alert": hit.kind,
      }),
    );
    // pos + 1 is inside the quote, + 1 again is inside its first paragraph.
    // The badge shows the word alone: the `[!` and `]` stay in the text for
    // the file and the caret, but are drawn at no size.
    const start = pos + 2;
    const end = start + hit.length;
    // Three ranges, none overlapping: ProseMirror splits overlapping inline
    // decorations into adjacent spans anyway, so the badge is the word's span.
    decos.push(Decoration.inline(start, start + 2, { class: "alert-brace" }));
    decos.push(Decoration.inline(start + 2, end - 1, { class: "alert-label" }));
    decos.push(Decoration.inline(end - 1, end, { class: "alert-brace" }));
  });
  return DecorationSet.create(doc, decos);
}

/** Every quote's opening label, joined: the only thing a rebuild depends on. */
function signature(doc: PMNode): string {
  const parts: string[] = [];
  doc.descendants((node) => {
    if (node.type.name !== "blockquote") return;
    const hit = labelOf(node);
    parts.push(hit ? `${hit.kind}@${node.nodeSize}` : "-");
  });
  return parts.join(" ");
}

export const alertView = $prose(
  () =>
    new Plugin({
      key,
      state: {
        init: (_, state) => ({ signature: signature(state.doc), set: build(state.doc) }),
        // Same shape as the mermaid plugin: map the decorations through an
        // ordinary edit, rebuild only when a quote's label or extent changed.
        apply(tr, old) {
          if (!tr.docChanged) return old;
          const now = signature(tr.doc);
          const mapped = old.set.map(tr.mapping, tr.doc);
          const intact = mapped.find().length === old.set.find().length;
          if (now === old.signature && intact) return { signature: now, set: mapped };
          return { signature: now, set: build(tr.doc) };
        },
      },
      props: {
        decorations: (state) => key.getState(state)?.set,
      },
    }),
);
