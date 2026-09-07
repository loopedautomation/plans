/**
 * What a link to a page looks like before anyone clicks it.
 *
 * Unfurlers do not run JavaScript, and the reader is a client-side app, so
 * the shell they fetch used to carry nothing: a plan pasted into a chat
 * previewed as a bare URL. This module is the two halves of the fix — the
 * `<meta>` tags the shell gains when its id resolves, and the 1200×630 card
 * they point at — built from one extraction so the card and the tags never
 * disagree about what a page is called.
 *
 * The page is public; the id is the address. A preview shows a strict
 * subset of what one click shows, so what it shows is a deliberate act of
 * publishing and not a leak: the first heading, the opening paragraph, and
 * the status and owner the reader itself already wears. Nothing else from
 * the frontmatter reaches the card.
 *
 * The frontmatter reading here mirrors src/matter.ts on purpose — the same
 * "`---` at byte 0, line-based `key: value`" contract, and no YAML library —
 * because the server is plain JS and cannot import the app's TypeScript.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** The first block of the file, as the app reads it: null when there is none. */
export function splitFrontmatter(text) {
  if (!/^---[ \t]*\r?\n/.test(text)) return { matter: null, body: text };
  const close = text.match(/\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!close || close.index === undefined) return { matter: null, body: text };
  const open = text.indexOf("\n") + 1;
  return { matter: text.slice(open, close.index), body: text.slice(close.index + close[0].length) };
}

/** One top-level `key: value`, quotes stripped; null when absent or empty. */
export function matterValue(matter, key) {
  if (!matter) return null;
  for (const line of matter.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m || m[1].toLowerCase() !== key.toLowerCase()) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    return v.length ? v : null;
  }
  return null;
}

/** Inline markdown taken off a line, so a preview reads as prose. */
function plain(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut at a word, with an ellipsis, when the text runs past `max`. */
function truncate(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut.slice(0, max)).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * The card's facts, from a page's markdown and its stored name.
 *
 * The title is the first heading, or the name the page was published under.
 * The description is `description:` from the frontmatter when the author
 * wrote one — the one way to say what a preview should show instead of the
 * opening line — and otherwise the first paragraph of prose: not a heading,
 * not a fence, not an HTML comment (the comment format, which must not
 * surface here any more than on the page), not a quote's `[!NOTE]` label.
 */
export function extract(markdown, name) {
  const { matter, body } = splitFrontmatter(markdown ?? "");
  const lines = body.split(/\r?\n/);
  let title = null;
  let description = matterValue(matter, "description");
  let para = [];
  let fence = null;
  let comment = false;
  const flush = () => {
    if (description === null && para.length) description = truncate(plain(para.join(" ")), 200);
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (fence) {
      if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (comment) {
      if (line.includes("-->")) comment = false;
      continue;
    }
    const t = line.trim();
    if (/^(```|~~~)/.test(t)) {
      flush();
      fence = t.slice(0, 3);
      continue;
    }
    if (t.startsWith("<!--")) {
      flush();
      if (!t.includes("-->")) comment = true;
      continue;
    }
    const h = t.match(/^#{1,6}\s+(.*?)\s*#*$/);
    if (h) {
      flush();
      if (title === null) title = plain(h[1]);
      continue;
    }
    if (!t) {
      flush();
      if (title !== null && description !== null) break;
      continue;
    }
    if (/^(---|\*\*\*|___)\s*$/.test(t) || /^<\/?[a-z][^>]*>$/i.test(t)) {
      flush();
      continue;
    }
    // A quote's opening label is an alert's kind, not its text.
    para.push(t.replace(/^>\s?/, "").replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, ""));
  }
  flush();
  return {
    title: title || name || "Plan",
    description: description ?? "",
    status: matterValue(matter, "status"),
    owner: matterValue(matter, "owner") ?? matterValue(matter, "assignee"),
  };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The `<head>` lines for one page, escaped, ready to stand in for the placeholder. */
export function metaTags(facts, { pageUrl, imageUrl }) {
  const tags = [
    ["property", "og:type", "article"],
    ["property", "og:title", facts.title],
    ["property", "og:description", facts.description],
    ["property", "og:url", pageUrl],
    ["property", "og:image", imageUrl],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", facts.title],
    ["name", "twitter:description", facts.description],
    ["name", "twitter:image", imageUrl],
  ];
  return [`<title>${esc(facts.title)}</title>`, ...tags.map(([k, n, v]) => `<meta ${k}="${esc(n)}" content="${esc(v)}" />`)].join(
    "\n    ",
  );
}

/** What the shell carries where the tags go; the server swaps it out. */
export const PLACEHOLDER = "<!-- og -->";

/* ---------------------------------------------------------------------------
   The card.

   Satori turns an element tree into SVG in pure JS and resvg rasterises it
   to PNG — the major unfurlers do not render an SVG og:image — with no
   browser anywhere near the server. Both are loaded on first use, so a
   deployment that never has a card asked of it never pays for them, and a
   failure to load them is a failure to draw, answered like any other.
   --------------------------------------------------------------------------- */

const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));
let fonts = null;
let libs = null;

async function tools() {
  if (!libs) {
    libs = Promise.all([import("satori"), import("@resvg/resvg-js")]).then(([s, r]) => ({
      satori: s.default,
      Resvg: r.Resvg,
    }));
  }
  if (!fonts) {
    fonts = Promise.all([readFile(`${ASSETS}Inter-Regular.ttf`), readFile(`${ASSETS}Inter-SemiBold.ttf`)]).then(
      ([regular, semibold]) => [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: semibold, weight: 600, style: "normal" },
      ],
    );
  }
  return { ...(await libs), fonts: await fonts };
}

/** Satori takes React-shaped elements; this is the four lines of React it needs. */
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } });

/** The night paper's colours: a card is one picture, and dark reads best in chat. */
const PAPER = "#0f1013";
const INK = "#e6e3dc";
const INK2 = "#b9b5ac";
const INK3 = "#8d939b";
const TONES = {
  draft: "#9aa0ab",
  ready: "#93a8e4",
  review: "#d8ab52",
  approved: "#d492b5",
  busy: "#d8ab52",
  done: "#8fb877",
};

function card(facts) {
  const status = facts.status?.trim().toLowerCase() ?? null;
  const tone = status ? (TONES[status] ?? INK3) : null;
  const title = truncate(facts.title, 90);
  const description = truncate(facts.description, 200);
  return h(
    "div",
    {
      style: {
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px 56px",
        background: PAPER,
        color: INK,
        fontFamily: "Inter",
      },
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 24 } },
      h(
        "div",
        {
          style: {
            fontSize: title.length > 48 ? 56 : 68,
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            display: "flex",
          },
        },
        title,
      ),
      description
        ? h("div", { style: { fontSize: 30, lineHeight: 1.4, color: INK2, display: "flex" } }, description)
        : null,
    ),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, color: INK3 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 20 } },
        status
          ? h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 18px",
                  border: `2px solid ${tone}`,
                  borderRadius: 999,
                  color: tone,
                  fontWeight: 600,
                  fontSize: 22,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                },
              },
              status,
            )
          : null,
        facts.owner ? h("div", { style: { display: "flex" } }, `@${facts.owner}`) : null,
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 600, color: INK2 } },
        h("div", { style: { width: 14, height: 14, borderRadius: 999, background: INK2, display: "flex" } }),
        "plans",
      ),
    ),
  );
}

/** The card as PNG bytes. Throws when it cannot draw; the route falls back. */
export async function renderCard(facts) {
  const { satori, Resvg, fonts } = await tools();
  const svg = await satori(card(facts), { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

/**
 * A card with nothing on it but the wordmark, for when drawing fails —
 * bizarre unicode, an empty document, a font gone missing. An unfurler
 * that gets an error caches the brokenness; this it can show.
 */
let fallback = null;
export async function fallbackCard() {
  if (!fallback) {
    fallback = renderCard({ title: "plans", description: "", status: null, owner: null }).catch(() => null);
  }
  return (await fallback) ?? (fallback = readFile(`${ASSETS}og-fallback.png`).catch(() => Buffer.alloc(0)));
}

/** A cheap, unique-enough hash for a PNG's ETag. */
export function etag(buf) {
  let h = 2166136261;
  for (let i = 0; i < buf.length; i++) h = Math.imul(h ^ buf[i], 16777619);
  return `"${(h >>> 0).toString(16)}"`;
}
/** Where a page lives in the world: the deployment's own name, else the request's. */
export function publicOrigin(req) {
  const env = process.env.PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}
