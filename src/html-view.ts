/**
 * Rendering the HTML that markdown files contain.
 *
 * Milkdown keeps HTML as an atom node whose DOM is the raw source text, so a
 * `<picture>` block or an `<!-- aside -->` shows up as literal characters in
 * the middle of the prose. This replaces that view with two behaviours:
 *
 *   - comments become a quiet margin marker that opens the comment on click;
 *   - everything else is rendered, with relative image paths resolved against
 *     the repository so a README cover actually appears.
 *
 * The markdown itself is untouched either way — the node still serialises back
 * to exactly the source it came from.
 */
import { diffWords } from "diff";
import { $prose, $view } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as PMNode } from "@milkdown/kit/prose/model";
import { htmlSchema } from "@milkdown/preset-commonmark";
import { api } from "./api";
import { colorFor, type Profile } from "./workspace";
import { attachMentions } from "./mentions";

const COMMENT = /^\s*<!--([\s\S]*?)-->\s*$/;

/* ===========================================================================
   <details>, folded and unfolded.
   ---------------------------------------------------------------------------
   remark ends the html node at the first blank line, so `<details>` and its
   `<summary>` arrive as one node, the body as ordinary markdown blocks, and
   `</details>` as a node of its own — a native <details> rendered from the
   opener alone has nothing inside it to fold. The opener is drawn as a head
   that toggles, the blocks up to the closer are hidden while it is folded,
   and the closer is never shown. The file is not touched: what is folded is
   remembered here, by the summary's text, for as long as the window lives.
   =========================================================================== */
const DETAILS_OPEN = /^<details\b([^>]*)>\s*(?:<summary\b[^>]*>([\s\S]*?)<\/summary>)?\s*$/i;
const DETAILS_CLOSE = /^<\/details>$/i;

/** Folded or not, by summary — an `open` attribute decides until it is clicked. */
const folds = new Map<string, boolean>();

function detailsOf(value: string): { open: boolean; summary: string } | null {
  const m = value.trim().match(DETAILS_OPEN);
  if (!m) return null;
  return { open: /\bopen\b/i.test(m[1] ?? ""), summary: (m[2] ?? "").trim() || "Details" };
}

function isFolded(d: { open: boolean; summary: string }): boolean {
  return folds.get(d.summary) ?? !d.open;
}

/**
 * What a handle may look like: `@name`, or `@name@host.tld` — a workspace's
 * login is an email, so the second `@` is part of the name, not the end of
 * it. Read as far as the first `@` used to mean `@ratul@example.com: …`
 * matched nothing as a turn, and the card showed the raw line, unsigned.
 */
const HANDLE = "[A-Za-z0-9_.+-]+(?:@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+)?";
const AUTHOR = new RegExp(`@(${HANDLE})`);
const TURN = new RegExp(`^@(${HANDLE}):\\s*(.*)$`);

/** Does this text mention the handle — whole, or as its short form before the `@`? */
export function mentionsHandle(text: string, handle: string): boolean {
  const names = [handle, shortHandle(handle)].map((h) => h.toLowerCase());
  const re = new RegExp(`@(${HANDLE})`, "g");
  for (const m of text.matchAll(re)) {
    const hit = m[1].toLowerCase();
    if (names.includes(hit) || names.includes(shortHandle(hit))) return true;
  }
  return false;
}

/** Author written into the comment as `@name`, if there is one. */
export function commentAuthor(body: string): string | null {
  return body.match(AUTHOR)?.[1] ?? null;
}

/**
 * The handle as it is drawn: an email keeps only what is before its `@`.
 * The file carries the whole login — that is what the member lookup and
 * the reply use — and the full form stays on the element's title.
 */
export function shortHandle(handle: string): string {
  const at = handle.indexOf("@");
  return at > 0 ? handle.slice(0, at) : handle;
}

/**
 * A thread is one comment with more than one voice in it: one line per turn,
 * each "@name: what they said". The strict reading — *every* non-empty line
 * must match — is what keeps prose that merely mentions an @handle rendering
 * as the single comment it is.
 */
export type CommentTurn = { who: string | null; text: string };

export function commentTurns(body: string): CommentTurn[] {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = lines.map((l) => l.match(TURN));
  if (lines.length > 0 && parsed.every(Boolean)) {
    return parsed.map((m) => ({ who: m![1], text: m![2] }));
  }
  return [{ who: commentAuthor(body), text: body }];
}

/** `@name` fit for a comment: "Ratul Maharaj" becomes "ratul-maharaj". */
export function authorSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_.-]/g, "");
}

/**
 * A reply appended to a comment's source. The first reply promotes a one-line
 * comment to the block form — one line per turn — which is also how a person
 * would write it by hand.
 */
export function withReply(value: string, author: string, text: string): string {
  const body = value.match(COMMENT)?.[1] ?? "";
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const reply = author ? `@${author}: ${text}` : text;
  return `<!--\n${[...lines, reply].join("\n")}\n-->`;
}

/* ===========================================================================
   Suggestions: a comment with a diff in it.
   ---------------------------------------------------------------------------
   A suggestion is one more thing a person or an agent says *about* the
   document, so it goes where the other things they say go — into the file, as
   a comment, invisible to every markdown tool that does not know the form.
   The document never lies about what it currently says; the proposal sits
   beside it.

   The grammar, and why it is this one:

       <!--
       @claude suggests:
       the block exactly as it reads now
       ---
       what it should say instead
       -->

   A signed head, the old text, a lone `---`, the new text. The head cannot be
   read as a thread turn — `TURN` wants `@name:` with the colon against the
   handle, and `@claude suggests:` puts a word between them — so an ordinary
   multi-turn comment never parses as a suggestion, and a suggestion never
   parses as a thread. The separator is a marker rather than `- `/`+ ` line
   prefixes because a proposal for a list item, or for any paragraph that
   opens with `- `, would need escaping the moment it was prefixed, and the
   old side has to survive verbatim: it is the address.

   That is the whole of the location logic. A line number rots the moment
   anything above it moves; a quote self-locates, and when it matches nothing
   the card says so rather than being silently wrong.
   =========================================================================== */

/** `@name suggests:`, or `suggests:` where git had no name to sign with. */
const SUGGESTS = new RegExp(`^(?:@(${HANDLE})\\s+)?suggests:$`);

/** The line between the two sides. Exactly one, or this is not a suggestion. */
const SPLIT = "---";

export type Suggestion = { who: string | null; old: string; new: string };

/**
 * A suggestion, or null for anything else a comment might be.
 *
 * Strict on purpose, in both directions: a body missing the head, missing the
 * separator, carrying two of them, or proposing a change to nothing at all is
 * not a suggestion and renders as the comment it is. Better a proposal that
 * shows up as prose than prose that shows up as a proposal with buttons.
 */
export function suggestion(value: string): Suggestion | null {
  const body = value.match(COMMENT)?.[1];
  if (body == null) return null;
  const lines = body.split(/\r?\n/);
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const head = lines.shift()?.trim() ?? "";
  const m = head.match(SUGGESTS);
  if (!m) return null;
  const at = lines.flatMap((l, i) => (l.trim() === SPLIT ? [i] : []));
  if (at.length !== 1) return null;
  const old = lines.slice(0, at[0]).join("\n").trim();
  const next = lines.slice(at[0] + 1).join("\n").trim();
  if (!old) return null;
  return { who: m[1] ?? null, old, new: next };
}

/** The block a suggestion is written as — the parser's inverse. */
export function suggestionBlock(who: string, old: string, next: string): string {
  const head = who ? `@${who} suggests:` : "suggests:";
  return `<!--\n${head}\n${old.trim()}\n${SPLIT}\n${next.trim()}\n-->`;
}

/**
 * Whitespace is not content.
 *
 * The quote is written from what ProseMirror had; the file is what remark
 * serialised, and the two disagree about wrapping and about runs of spaces
 * often enough that a byte-exact comparison would miss the very paragraph the
 * suggestion was written against. Anything looser than this starts guessing.
 */
function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Where a suggestion applies: a node's own range, or null when it is stale. */
export type Span = { from: number; to: number };

/**
 * The nearest block before `before` whose text is the quote.
 *
 * Proximity *and* a quote: proximity alone was what the comment placement
 * rule was always one step short of, and a quote alone would find the first
 * paragraph in the document that happens to read the same. Blocks that
 * contain the suggestion are skipped — a proposal cannot be about the
 * paragraph it is sitting inside, and replacing that range would take the
 * proposal with it.
 */
export function suggestionTarget(doc: PMNode, before: number, old: string): Span | null {
  const want = normal(old);
  if (!want) return null;
  const hits: Span[] = [];
  doc.descendants((node, pos) => {
    if (pos >= before) return false;
    if (!node.isTextblock) return;
    if (pos + node.nodeSize > before) return false;
    if (normal(node.textContent) === want) hits.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  return hits.length ? hits[hits.length - 1] : null;
}

/** What the card can do about a suggestion, decided by whoever draws it. */
type SuggestionActs = {
  /** Replace the target with the proposal; absent when nothing matched. */
  accept: (() => void) | null;
  /** Put the proposal in where the block sits, for a stale one. */
  insert: () => void;
  /** Take the block away and leave the document as it stands. */
  reject: () => void;
};

/** Old against new, word by word, the way a redline reads. */
function wordDiff(old: string, next: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "md-suggestion-diff";
  for (const part of diffWords(old, next)) {
    const piece = document.createElement("span");
    piece.className = part.added
      ? "md-suggestion-in"
      : part.removed
        ? "md-suggestion-out"
        : "md-suggestion-same";
    piece.textContent = part.value;
    el.appendChild(piece);
  }
  return el;
}

/**
 * The suggestion card: who proposed it, what it changes, and two buttons.
 *
 * Unlike a comment this is not behind a marker. A proposal nobody can see is
 * a proposal nobody answers, and the card is the only place the change is
 * shown — the target paragraph above is left exactly as it reads, so nobody's
 * cursor lands in a battlefield of marks while they are typing in it.
 *
 * Read-only surfaces (the share page) get the card without its buttons: the
 * proposal is part of the conversation the page exists to show, and there is
 * nobody there to accept it.
 */
function suggestionCard(
  s: Suggestion,
  stale: boolean,
  acts: SuggestionActs,
): { dom: HTMLElement; destroy: () => void } {
  const dom = document.createElement("span");
  dom.className = stale ? "md-suggestion stale" : "md-suggestion";
  dom.setAttribute("data-type", "html");

  const head = document.createElement("span");
  head.className = "md-suggestion-who";
  const who = s.who ? profileOf(s.who) : null;
  if (who) {
    head.append(faceDom(who), handleDom(s.who!, colorFor(who.login)));
  } else if (s.who && htmlContext.tint) {
    head.appendChild(handleDom(s.who, colorFor(s.who)));
  } else if (s.who) {
    const name = document.createElement("span");
    name.className = "md-suggestion-handle";
    name.textContent = `@${shortHandle(s.who)}`;
    name.title = `@${s.who}`;
    head.appendChild(name);
  }
  const verb = document.createElement("span");
  verb.className = "md-suggestion-verb";
  verb.textContent = stale ? "suggested — the text it changes is gone" : "suggests";
  head.appendChild(verb);

  const body = stale ? document.createElement("span") : wordDiff(s.old, s.new);
  if (stale) {
    body.className = "md-suggestion-diff";
    const piece = document.createElement("span");
    piece.className = "md-suggestion-in";
    piece.textContent = s.new || "(nothing — it proposed a deletion)";
    body.appendChild(piece);
  }

  dom.append(head, body);

  if (!htmlContext.readOnly) {
    const acted = document.createElement("span");
    acted.className = "md-suggestion-acts";
    const button = (label: string, title: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "md-suggestion-act";
      b.textContent = label;
      b.title = title;
      // Inside the editor's DOM: without this a click moves the caret and the
      // transaction below is dispatched against a selection that just moved.
      b.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        run();
      });
      return b;
    };
    if (acts.accept) {
      acted.appendChild(
        button("Accept", "Replace the passage above with this", acts.accept),
      );
    } else {
      acted.appendChild(
        button("Insert here", "Put the proposed text in where this card sits", acts.insert),
      );
    }
    acted.appendChild(button("Reject", "Take the proposal away, unchanged", acts.reject));
    dom.appendChild(acted);
  }

  return { dom, destroy: () => {} };
}

/**
 * The comment card, shared between the two ways a comment can arrive: as one
 * node (a single-line comment, or anything the app itself wrote) rendered by
 * the node view, and as a run of per-line nodes gathered by the decoration
 * plugin below. `replace` writes the whole comment back — the reply field goes
 * through it, so both arrivals get threads for free.
 */
function commentCard(
  value: string,
  replace: (next: string) => void,
): { dom: HTMLElement; destroy: () => void } {
  const body = (value.match(COMMENT)?.[1] ?? value).trim();
  const turns = commentTurns(body);

  const dom = document.createElement("span");
  dom.className = "md-comment";
  dom.setAttribute("data-type", "html");
  dom.setAttribute("data-value", value);

  const mark = document.createElement("button");
  mark.className = "md-comment-mark";
  mark.type = "button";
  mark.textContent = turns.length > 1 ? `comment +${turns.length}` : "comment";
  mark.title = body;
  /*
   * Named in the latest turn, this thread is asking for you: tint the mark.
   * A render-side rule only — the file carries nothing extra, so the copied
   * repository file and the public page keep today's rendering.
   */
  const me = htmlContext.author;
  const last = turns[turns.length - 1];
  if (me && last && mentionsHandle(last.text, me)) mark.classList.add("for-you");

  const card = document.createElement("span");
  card.className = "md-comment-card";
  for (const t of turns) {
    const turn = document.createElement("span");
    turn.className = "md-comment-turn";
    const meta = document.createElement("span");
    meta.className = "md-comment-who";
    const who = t.who ? profileOf(t.who) : null;
    if (who) {
      // A member: the same face and colour their cursor wears.
      meta.append(faceDom(who), handleDom(t.who!, colorFor(who.login)));
    } else if (t.who && htmlContext.tint) {
      // A handle with nobody to look it up against: the colour alone, which
      // is a hash of the handle and says nothing about who holds it.
      meta.appendChild(handleDom(t.who, colorFor(t.who)));
    } else {
      meta.textContent = t.who ? `@${shortHandle(t.who)}` : "comment";
      if (t.who) meta.title = `@${t.who}`;
    }
    const text = document.createElement("span");
    text.className = "md-comment-text";
    text.textContent = t.text;
    turn.append(meta, text);
    card.appendChild(turn);
  }

  // The reply lands in the file, not in an inbox: one more line in the block.
  const reply = document.createElement("span");
  reply.className = "md-comment-reply";
  const field = document.createElement("input");
  field.type = "text";
  field.placeholder = htmlContext.author ? `Reply as @${shortHandle(htmlContext.author)}` : "Reply";
  field.className = "md-comment-field";
  const mentions = attachMentions(field, () => Object.keys(htmlContext.profiles ?? {}));
  const send = document.createElement("button");
  send.type = "button";
  send.className = "md-comment-send";
  send.textContent = "Reply";
  const submit = () => {
    const text = field.value.trim();
    if (!text) return;
    replace(withReply(value, htmlContext.author, text));
  };
  send.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    submit();
  });
  field.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") close();
  });
  // The field is inside the editor's DOM; without these the keystrokes would
  // be ProseMirror's, and a click would move the caret instead of the focus.
  for (const ev of ["mousedown", "beforeinput", "paste", "cut"] as const) {
    field.addEventListener(ev, (e) => e.stopPropagation());
  }
  reply.append(field, send);
  card.appendChild(reply);

  // One card open at a time, and any click elsewhere puts it away.
  const away = (e: MouseEvent) => {
    if (!dom.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  function close() {
    dom.classList.remove("open");
    document.removeEventListener("mousedown", away, true);
    document.removeEventListener("keydown", onKey, true);
  }

  mark.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dom.classList.contains("open")) return close();
    document.querySelectorAll(".md-comment.open").forEach((el) => el.classList.remove("open"));
    dom.classList.add("open");
    document.addEventListener("mousedown", away, true);
    document.addEventListener("keydown", onKey, true);
  });
  dom.append(mark, card);
  return {
    dom,
    destroy: () => {
      mentions();
      document.removeEventListener("mousedown", away, true);
      document.removeEventListener("keydown", onKey, true);
    },
  };
}

/** The member a turn's `@handle` names, if the context knows the members. */
function profileOf(handle: string): Profile | null {
  return htmlContext.profiles?.[handle.toLowerCase()] ?? null;
}

/** `@handle`, in the colour the person's cursor wears. */
function handleDom(handle: string, color: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "md-comment-handle";
  el.style.color = color;
  el.textContent = `@${shortHandle(handle)}`;
  el.title = `@${handle}`;
  return el;
}

/**
 * A face, as `Avatar` draws one, without React: the picture the server has,
 * or the first letter of the name on the person's colour.
 */
function faceDom(who: Profile): HTMLElement {
  const name = who.name ?? who.login;
  const size = 16;
  if (who.avatar) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = who.avatar;
    img.alt = "";
    img.title = name;
    img.referrerPolicy = "no-referrer";
    img.style.width = img.style.height = `${size}px`;
    return img;
  }
  const el = document.createElement("span");
  el.className = "avatar";
  el.title = name;
  el.setAttribute("aria-hidden", "true");
  el.style.width = el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.55)}px`;
  el.style.background = colorFor(who.login);
  el.textContent = (name.trim()[0] ?? "?").toUpperCase();
  return el;
}

/**
 * These files are the reader's own, but they are also written by agents, and a
 * script tag in a plan should never run just because the plan was opened.
 */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, link, meta, style").forEach((n) =>
    n.remove(),
  );
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || (n === "href" && a.value.trim().toLowerCase().startsWith("javascript:"))) {
        el.removeAttribute(a.name);
      }
    }
  });
  return doc.body.innerHTML;
}

/**
 * Block HTML arrives as one node per line, not one per element, so a <picture>
 * block is split into "<picture>", "<source …>", "<img …>", "</picture>" —
 * each parsed on its own. A lone <source> is meaningless to the DOM parser and
 * an unclosed <picture> is empty, which is why a remote <img> renders and a
 * <picture> cover does not. Fragments that cannot stand alone are unwrapped:
 * the <source> becomes an <img> so the picture still shows something.
 */
function standalone(html: string): string {
  const t = html.trim();
  // An opening or closing wrapper on its own contributes nothing to render.
  if (/^<\/?(picture|figure|div|p|a|span)\b[^>]*>$/i.test(t)) return "";
  // A <source> outside its <picture>: promote it, so the image is not lost.
  const src = t.match(/^<source\b[^>]*\bsrcset=["']([^"']+)["'][^>]*>$/i);
  if (src) return `<img src="${src[1].split(/[ ,]/)[0]}" />`;
  return html;
}

/**
 * Point relative sources at the repository.
 *
 * Read through Rust as a data URL rather than the asset protocol: that route
 * needs scope configuration and a custom scheme, and in the dev webview the
 * request simply never resolves. These files are already ours to read.
 */
const assets = new Map<string, string>();

function resolveAssets(root: HTMLElement, repo: string, relPath: string) {
  const dir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";

  const fix = (el: Element, attr: string) => {
    const raw = el.getAttribute(attr);
    if (!raw || /^(https?:|data:|blob:|\/\/)/i.test(raw)) return;

    /**
     * Take the attribute off before the browser can act on it. A relative path
     * resolves against the dev server, fails within the same tick, and the
     * error handler below would report a miss before the real bytes arrived.
     */
    el.removeAttribute(attr);
    const rel = raw.startsWith("/") ? raw.slice(1) : dir ? `${dir}/${raw}` : raw;
    const key = `${repo}::${rel}`;

    const miss = (why: string) => {
      const note = document.createElement("span");
      note.className = "md-html-missing";
      note.textContent = `image did not load — ${rel} (${why})`;
      el.replaceWith(note);
    };

    if (!repo) return miss("no repository");

    const hit = assets.get(key);
    if (hit) return el.setAttribute(attr, hit);

    void api.readAsset(repo, rel).then(
      (url) => {
        assets.set(key, url);
        el.setAttribute(attr, url);
      },
      (e) => miss(String(e).replace(/^Error:\s*/, "")),
    );
  };

  root.querySelectorAll("img").forEach((el) => fix(el, "src"));
  root.querySelectorAll("source").forEach((el) => fix(el, "srcset"));
}

/**
 * The view needs to know which file it is in to resolve relative paths, and
 * that isn't in the node — so it is set here whenever a document is opened.
 *
 * `profiles` is the members of a workspace, by lowercased login, and is what
 * lets a comment's `@handle` be drawn with a face; a repository never sets
 * it, and its comments render as they always have. `tint` colours handles
 * without a member list — the share page, whose readers are anonymous and
 * which never carries the members — from the same hash the cursors use.
 *
 * `readOnly` is the share page again: a suggestion card there is the proposal
 * without its buttons, because there is nobody on that side of the link who
 * could accept one.
 */
export const htmlContext: {
  repo: string;
  relPath: string;
  author: string;
  profiles: Record<string, Profile> | null;
  tint: boolean;
  readOnly: boolean;
} = { repo: "", relPath: "", author: "", profiles: null, tint: false, readOnly: false };

/**
 * The bridge between rendered HTML and the app.
 *
 * A node view cannot open a React sheet, and React cannot dispatch a ProseMirror
 * transaction, so each side registers what it can do: App opens the editor,
 * Editor applies the result. Everything HTML — a picture, a div, a comment —
 * goes through the same two calls, rather than growing its own affordance.
 */
export type HtmlEdit = { from: number; to: number; value: string };

/**
 * Settling a suggestion, in one transaction.
 *
 * The block always goes — resolution leaves no trace in the file, exactly as
 * resolving a thread is deleting it; the CRDT history and, after copy-out,
 * git are the audit log. `target` is what the proposal replaces, absent for a
 * reject; an empty range is "insert here", which is what a stale card offers.
 */
export type SuggestionApply = {
  block: Span;
  target?: Span;
  /** The proposal as markdown. Empty against a range deletes it. */
  markdown?: string;
};

export const htmlBridge: {
  /** Set by App: show the raw fragment for editing. */
  request: ((edit: HtmlEdit) => void) | null;
  /** Set by Editor: write the fragment back into the document. */
  apply: ((edit: HtmlEdit) => void) | null;
  /** Set by Editor: put a new fragment in at the cursor. */
  insert: ((value: string) => void) | null;
  /** Set by Editor: put a comment in at the cursor. */
  /** Insert a comment at the cursor, or — `atTop` — under the first heading. */
  comment: ((value: string, atTop?: boolean) => void) | null;
  /**
   * Set by Editor: the text of the block the cursor is in.
   *
   * A suggestion's old side is a whole block, not whatever was selected: it
   * has to match a node exactly or it can never find its own target. So the
   * quote is read here rather than from the selection, and the person edits
   * the block as it stands into the block they want.
   */
  block: (() => string) | null;
  /**
   * Set by Editor: put a suggestion in as its own block after the cursor's.
   *
   * Its own block, not at the cursor like a comment: a proposal that shared a
   * paragraph with its target could never quote it, since the paragraph would
   * then contain the quote of itself.
   */
  suggest: ((value: string) => void) | null;
  /** Set by Editor: accept or reject a suggestion, in one transaction. */
  resolve: ((edit: SuggestionApply) => void) | null;
  /** Set by Editor: put the cursor at the end of the document and focus it. */
  focusEnd: (() => void) | null;
  /**
   * Set by Editor: deliver any edit still sitting in the typing debounce, now.
   *
   * The editor reports changes on a pause, not on every key, so for up to that
   * pause the newest keystrokes exist only inside ProseMirror. Anything about
   * to read "the buffer" — a flush ahead of quoting the file to an agent, ⌘S —
   * must ask for them first, or it saves the file as it was a moment ago and
   * calls that saved.
   */
  collect: (() => void) | null;
  /**
   * Set by App: focus the document the editor puts up next, once.
   *
   * A flag rather than a call, because App has nothing to call yet. Opening a
   * file only *requests* the state change that leads to the editor swapping its
   * document — so focusing at the point of asking lands the cursor in the file
   * you were reading before, which the swap then throws away. The request is
   * left here and honoured on the other side, once the new document has
   * settled. One-shot: the file opened after a created one must not inherit it.
   */
  focusNext: boolean;
} = {
  request: null,
  apply: null,
  insert: null,
  comment: null,
  block: null,
  suggest: null,
  resolve: null,
  focusEnd: null,
  collect: null,
  focusNext: false,
};

/** Whether a fragment is one complete comment, fences and all. */
export function isComment(value: string): boolean {
  return COMMENT.test(value);
}

/**
 * A suggestion drawn where it sits.
 *
 * `at` is read twice on purpose: once now, to decide whether the card is the
 * live one or the stale one, and again when a button is pressed, because the
 * document may well have moved on between the two — in a room it certainly
 * has. The proposal that was stale when drawn can still be accepted if its
 * paragraph came back, and one that was live can turn out not to be.
 */
function drawSuggestion(
  s: Suggestion,
  at: () => { doc: PMNode; block: Span },
): { dom: HTMLElement; destroy: () => void } {
  const now = at();
  const found = suggestionTarget(now.doc, now.block.from, s.old);
  const act = (kind: "accept" | "insert" | "reject") => () => {
    const { doc, block } = at();
    if (kind === "reject") return void htmlBridge.resolve?.({ block });
    const hit = kind === "accept" ? suggestionTarget(doc, block.from, s.old) : null;
    htmlBridge.resolve?.({
      block,
      target: hit ?? { from: block.from, to: block.from },
      markdown: s.new,
    });
  };
  return suggestionCard(s, !found, {
    accept: found ? act("accept") : null,
    insert: act("insert"),
    reject: act("reject"),
  });
}

export const htmlView = $view(htmlSchema.node, () => (node, view, getPos, decorations) => {
  const edit = () =>
    htmlBridge.request?.({
      from: getPos() ?? 0,
      to: (getPos() ?? 0) + node.nodeSize,
      value: String(node.attrs.value ?? ""),
    });
  const value = String(node.attrs.value ?? "");
  const comment = value.match(COMMENT);

  /*
   * A suggestion written by the app arrives as one node, fences and all —
   * `nodesFor` keeps a complete comment whole — so it is drawn here as well
   * as in the run gathered by the decoration plugin below.
   */
  const sugg = suggestion(value);
  if (sugg) {
    const where = () => {
      const at = getPos() ?? 0;
      const $at = view.state.doc.resolve(at);
      // Alone in its paragraph, the paragraph is the block: accepting it
      // should not leave an empty one where the card was.
      const block =
        $at.parent.isTextblock && $at.parent.childCount === 1
          ? { from: $at.before(), to: $at.after() }
          : { from: at, to: at + node.nodeSize };
      return { doc: view.state.doc, block };
    };
    const { dom, destroy } = drawSuggestion(sugg, where);
    for (const d of decorations ?? []) {
      const cls = (d as unknown as { type?: { attrs?: { class?: string } } }).type?.attrs?.class;
      if (cls) dom.classList.add(...cls.split(" "));
    }
    return { dom, ignoreMutation: () => true, stopEvent: () => true, destroy };
  }

  if (comment) {
    const { dom, destroy } = commentCard(value, (next) =>
      htmlBridge.apply?.({
        from: getPos() ?? 0,
        to: (getPos() ?? 0) + node.nodeSize,
        value: next,
      }),
    );
    for (const d of decorations ?? []) {
      const cls = (d as unknown as { type?: { attrs?: { class?: string } } }).type?.attrs?.class;
      if (cls) dom.classList.add(...cls.split(" "));
    }
    return {
      dom,
      ignoreMutation: () => true,
      stopEvent: () => true,
      destroy,
    };
  }

  const details = detailsOf(value);
  if (details) {
    const head = document.createElement("button");
    head.type = "button";
    head.className = "md-details-head";
    head.setAttribute("data-type", "html");
    head.setAttribute("data-value", value);
    head.setAttribute("aria-expanded", String(!isFolded(details)));
    const caret = document.createElement("span");
    caret.className = "md-details-caret";
    caret.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "md-details-summary";
    label.innerHTML = sanitize(details.summary);
    head.append(caret, label);
    head.title = "Fold or unfold this section. Double-click to edit the HTML";
    head.addEventListener("click", (e) => {
      e.preventDefault();
      folds.set(details.summary, !isFolded(details));
      head.setAttribute("aria-expanded", String(!isFolded(details)));
      // The blocks under it are decorations: ask the plugin to look again.
      view.dispatch(view.state.tr.setMeta(pictureKey, true));
    });
    head.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      edit();
    });
    return { dom: head, ignoreMutation: () => true, stopEvent: () => true };
  }

  const dom = document.createElement("span");
  dom.className = "md-html";
  /**
   * ProseMirror does not put inline decorations on an atom's DOM — it hands
   * them to the node view instead. Without this the classes the wrapper plugin
   * computes never land, and a hidden tag stays visible.
   */
  for (const d of decorations ?? []) {
    const cls = (d as unknown as { type?: { attrs?: { class?: string } } }).type?.attrs?.class;
    if (cls) dom.classList.add(...cls.split(" "));
  }
  dom.setAttribute("data-type", "html");
  dom.setAttribute("data-value", value);
  dom.innerHTML = sanitize(standalone(value));
  resolveAssets(dom, htmlContext.repo, htmlContext.relPath);
  dom.title = "Double-click to edit the HTML";
  dom.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    edit();
  });
  return { dom, ignoreMutation: () => true, stopEvent: () => true };
});

/* ===========================================================================
   <picture>, chosen by the app's paper rather than the system.
   ---------------------------------------------------------------------------
   Block HTML arrives as one node per line, so a picture is a run of nodes:
   the opening tag, its sources, a fallback img, the closing tag. Rendering
   them separately gives one image per source — and the media queries would be
   answered by macOS's appearance anyway, not by the paper in this app.

   So the run is collected, hidden, and replaced by a single widget holding
   whichever source matches the current theme.
   =========================================================================== */

type HtmlState = { signature: string; set: DecorationSet };

const pictureKey = new PluginKey<HtmlState>("plans-picture");

/**
 * Every html node's text, joined. Cheap next to parsing them.
 *
 * Held in the plugin's own state, never in a module variable: an editor can be
 * built twice (React remounts, StrictMode does it deliberately), and a shared
 * signature means the second instance compares against the first's work,
 * concludes nothing has changed, and renders no decorations at all.
 */
function htmlSignature(doc: PMNode): string {
  const parts: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === "html") parts.push(String(node.attrs.value ?? ""));
  });
  return parts.join("\u0000");
}

/**
 * Night is the only dark paper. Sepia is warm, not dark — it answers "light",
 * as Day does, so a README cover picks its light artwork on both.
 */
const DARK_PAPERS = new Set(["night"]);

function prefersDark(): boolean {
  return DARK_PAPERS.has(document.documentElement.dataset.theme ?? "");
}

/** The source a browser would pick, decided against the app's paper instead. */
function chooseSource(fragment: string): string | null {
  const dark = prefersDark();
  const doc = new DOMParser().parseFromString(
    fragment.includes("<picture") ? fragment : `<picture>${fragment}</picture>`,
    "text/html",
  );
  const sources = [...doc.querySelectorAll("source")];
  const matching = sources.find((el) => {
    const media = (el.getAttribute("media") ?? "").toLowerCase();
    if (!media.includes("prefers-color-scheme")) return false;
    return media.includes("dark") === dark;
  });
  const pick =
    matching?.getAttribute("srcset") ??
    // No media queries: first source wins, as a browser would do.
    sources.find((el) => !el.getAttribute("media"))?.getAttribute("srcset") ??
    doc.querySelector("img")?.getAttribute("src") ??
    null;
  return pick ? pick.split(/[ ,]/)[0] : null;
}

type Run = { from: number; to: number; html: string; blocks: [number, number][] };

/** One html node's worth of text, wherever it sits in the document. */
type Chunk = { value: string; from: number; to: number; block: [number, number] };

/**
 * Every html node in document order, with the block that holds it.
 *
 * A <picture> written across several lines may arrive as several inline nodes
 * in one paragraph, or as one node per block — remark decides, and it varies
 * with the surrounding blank lines. Collecting them flat means the run is found
 * either way; the earlier version only looked inside a single paragraph and so
 * never matched the common case.
 */
function htmlChunks(doc: PMNode): Chunk[] {
  const out: Chunk[] = [];
  doc.descendants((node, pos, parent, index) => {
    if (node.type.name !== "html") return;
    let block: [number, number] = [pos, pos + node.nodeSize];
    if (parent?.isTextblock) {
      // The enclosing block, so a line of its own can be hidden whole.
      const before = pos - 1 - (index > 0 ? 0 : 0);
      block = [before, before + parent.nodeSize];
    }
    out.push({
      value: String(node.attrs.value ?? ""),
      from: pos,
      to: pos + node.nodeSize,
      block,
    });
  });
  return out;
}

/**
 * Multi-line comments, gathered the way pictures are.
 *
 * A thread written across several lines arrives as one node per line — "<!--",
 * a turn each, "-->" — and none of them alone is a comment the node view can
 * recognise. The run is collected, its lines hidden, and one card widget stands
 * in for the whole block. Single-line comments never open a run here; the node
 * view above already renders them.
 */
function commentRuns(doc: PMNode): Run[] {
  const runs: Run[] = [];
  let open: { from: number; parts: string[]; blocks: [number, number][] } | null = null;
  for (const c of htmlChunks(doc)) {
    const v = c.value.trim();
    if (!open && /^<!--/.test(v) && !v.includes("-->")) {
      open = { from: c.from, parts: [c.value], blocks: [c.block] };
      continue;
    }
    if (open) {
      open.parts.push(c.value);
      open.blocks.push(c.block);
      if (c.value.includes("-->")) {
        runs.push({
          from: open.from,
          to: c.to,
          html: open.parts.join("\n"),
          blocks: open.blocks,
        });
        open = null;
      }
    }
  }
  return runs;
}

/** Everything a run occupies: its html nodes and the blocks holding them. */
function runSpan(run: Run): Span {
  return {
    from: Math.min(run.from, ...run.blocks.map(([f]) => f)),
    to: Math.max(run.to, ...run.blocks.map(([, t]) => t)),
  };
}

/**
 * Where a gathered run sits in the document as it is now, found by position.
 *
 * Not by its text: two suggestions can say exactly the same thing, and the
 * first match is then the wrong card's — accepting the second would resolve
 * the first and rewrite the first's paragraph. The widget's own position is
 * mapped through every transaction, so it says which run was clicked even
 * after a teammate has typed above it, and identical twins stay apart.
 */
function runAt(doc: PMNode, pos: number): Span | null {
  const hit = commentRuns(doc).find((r) => pos >= r.from && pos <= r.to);
  return hit ? runSpan(hit) : null;
}

function pictureRuns(doc: PMNode): Run[] {
  const runs: Run[] = [];
  let open: { from: number; parts: string[]; blocks: [number, number][] } | null = null;
  for (const c of htmlChunks(doc)) {
    if (/<picture\b/i.test(c.value)) {
      open = { from: c.from, parts: [c.value], blocks: [c.block] };
    } else if (open) {
      open.parts.push(c.value);
      open.blocks.push(c.block);
    }
    if (open && /<\/picture>/i.test(c.value)) {
      runs.push({
        from: open.from,
        to: c.to,
        html: open.parts.join("\n"),
        blocks: open.blocks,
      });
      open = null;
    }
  }
  return runs;
}

/**
 * Wrapper tags and the content between them.
 *
 * `<div align="center">`, `<sub>`, `<b>` and friends arrive as their own nodes,
 * separate from what they wrap — the text between is ordinary markdown. Alone
 * each tag parses to an empty element, so the wrapping is simply lost. Pairing
 * them and decorating the range restores the intent without touching the file.
 */
const INLINE_TAGS = new Set([
  "sub", "sup", "b", "strong", "i", "em", "u", "s", "small", "kbd", "mark", "cite",
]);
const BLOCK_TAGS = new Set(["div", "p", "center", "section", "figure"]);

function wrapperDecorations(doc: PMNode): Decoration[] {
  const out: Decoration[] = [];
  const stack: { tag: string; attrs: string; to: number }[] = [];

  for (const c of htmlChunks(doc)) {
    const v = c.value.trim();
    if (/^<!--/.test(v) || /<picture\b|<\/picture>/i.test(v)) continue;
    if (DETAILS_OPEN.test(v) || DETAILS_CLOSE.test(v)) continue;

    const open = v.match(/^<([a-zA-Z][\w-]*)((?:\s[^>]*)?)>$/);
    const close = v.match(/^<\/([a-zA-Z][\w-]*)>$/);
    const selfClosing = /\/>$/.test(v);

    if (open && !selfClosing && (INLINE_TAGS.has(open[1].toLowerCase()) || BLOCK_TAGS.has(open[1].toLowerCase()))) {
      stack.push({ tag: open[1].toLowerCase(), attrs: open[2] ?? "", to: c.to });
      out.push(Decoration.inline(c.from, c.to, { class: "md-hidden" }));
      continue;
    }

    if (close) {
      const tag = close[1].toLowerCase();
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i === -1) continue;
      const opened = stack[i];
      stack.length = i;
      out.push(Decoration.inline(c.from, c.to, { class: "md-hidden" }));
      if (opened.to >= c.from) continue;

      if (INLINE_TAGS.has(tag)) {
        out.push(Decoration.inline(opened.to, c.from, { class: `md-i md-i-${tag}` }));
      } else {
        // Blocks take a class of their own, since alignment is not inheritable
        // through an inline decoration.
        const centred =
          /align\s*=\s*["']?center/i.test(opened.attrs) ||
          /text-align\s*:\s*center/i.test(opened.attrs);
        if (!centred) continue;
        doc.nodesBetween(opened.to, c.from, (node, pos) => {
          if (!node.isBlock || node.isTextblock === false) return;
          if (pos < opened.to || pos + node.nodeSize > c.from) return;
          out.push(Decoration.node(pos, pos + node.nodeSize, { class: "md-center" }));
          return false;
        });
      }
    }
  }
  return out;
}

function detailsDecorations(doc: PMNode): Decoration[] {
  const out: Decoration[] = [];
  const stack: { folded: boolean; to: number }[] = [];
  for (const c of htmlChunks(doc)) {
    const d = detailsOf(c.value);
    if (d) {
      stack.push({ folded: isFolded(d), to: c.block[1] });
      continue;
    }
    if (!DETAILS_CLOSE.test(c.value.trim())) continue;
    const opened = stack.pop();
    // The closer is never drawn: the head stands for the section.
    out.push(Decoration.inline(c.from, c.to, { class: "md-hidden" }));
    if (c.block[0] !== c.from) out.push(Decoration.node(c.block[0], c.block[1], { class: "md-folded" }));
    if (!opened || !opened.folded || opened.to >= c.block[0]) continue;
    doc.nodesBetween(opened.to, c.block[0], (node, pos) => {
      if (!node.isBlock) return;
      if (pos < opened.to || pos + node.nodeSize > c.block[0]) return;
      out.push(Decoration.node(pos, pos + node.nodeSize, { class: "md-folded" }));
      return false;
    });
  }
  return out;
}

function pictureDecorations(doc: PMNode, repo: string, relPath: string): DecorationSet {
  const out: Decoration[] = [...wrapperDecorations(doc), ...detailsDecorations(doc)];
  for (const run of commentRuns(doc)) {
    const seen = new Set<string>();
    for (const [from, to] of run.blocks) {
      const key = `${from}:${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(Decoration.inline(from, to, { class: "md-hidden" }));
    }
    /*
     * A suggestion is a comment with a diff in it, so it arrives as a run the
     * same way a thread does and is drawn in place of the comment card. The
     * block it occupies — the enclosing paragraphs, already hidden above — is
     * what accepting takes away.
     */
    const sugg = suggestion(run.html);
    let card: { dom: HTMLElement; destroy: () => void } | null = null;
    out.push(
      Decoration.widget(
        run.to,
        (view, getPos) => {
          card = sugg
            ? drawSuggestion(sugg, () => {
                /*
                 * Read out of the live document, not out of the one these
                 * decorations were built from: between the two a teammate may
                 * have typed above the card, and every position here would be
                 * off by what they wrote. The widget carries its own position
                 * forward through their edits, so the run it stands over is
                 * the one asked for — never a twin that reads the same.
                 */
                const live = view.state.doc;
                const here = getPos?.();
                const block =
                  (here === undefined ? null : runAt(live, here)) ?? runSpan(run);
                return { doc: live, block };
              })
            : commentCard(run.html, (next) =>
                htmlBridge.apply?.({ from: run.from, to: run.to, value: next }),
              );
          card.dom.setAttribute("contenteditable", "false");
          return card.dom;
        },
        {
          side: 1,
          key: `comment:${run.from}:${run.html}`,
          destroy: () => card?.destroy(),
        },
      ),
    );
  }
  for (const run of pictureRuns(doc)) {
    const src = chooseSource(run.html);
    // Hide each block the run occupies, so no empty paragraphs are left behind.
    const seen = new Set<string>();
    for (const [from, to] of run.blocks) {
      const key = `${from}:${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(Decoration.inline(from, to, { class: "md-hidden" }));
    }
    if (!src) continue;
    out.push(
      Decoration.widget(
        run.to,
        () => {
          const host = document.createElement("span");
          host.className = "md-html";
          host.setAttribute("contenteditable", "false");
          const img = document.createElement("img");
          img.alt = "";
          // Which paper chose this, so a wrong pick is diagnosable on sight.
          img.title = `${prefersDark() ? "dark" : "light"} · ${src}`;
          // Set through resolveAssets, never directly: a relative src would be
          // attempted against the dev server and fail before the bytes land.
          img.setAttribute("src", src);
          host.appendChild(img);
          resolveAssets(host, repo, relPath);
          host.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            htmlBridge.request?.({ from: run.from, to: run.to, value: run.html });
          });
          return host;
        },
        { side: 1, key: `picture:${run.from}:${src}:${prefersDark()}` },
      ),
    );
  }
  return DecorationSet.create(doc, out);
}

export const pictureView = $prose(
  () =>
    new Plugin({
      key: pictureKey,
      state: {
        init: (_, state) => ({
          signature: htmlSignature(state.doc),
          set: pictureDecorations(state.doc, htmlContext.repo, htmlContext.relPath),
        }),
        /**
         * Rebuild only when the HTML in the document changed, or when the paper
         * did. Every other transaction moves the existing decorations along —
         * scanning the document and running DOMParser on each keystroke was a
         * large part of why typing dragged.
         */
        apply(tr, old) {
          if (tr.getMeta(pictureKey)) {
            return {
              signature: htmlSignature(tr.doc),
              set: pictureDecorations(tr.doc, htmlContext.repo, htmlContext.relPath),
            };
          }
          if (!tr.docChanged) return old;
          const now = htmlSignature(tr.doc);

          /**
           * Mapping is the cheap path, but it is not always enough.
           *
           * Loading or swapping a document replaces the whole doc, and mapping
           * decorations through that deletion drops all of them. The signature
           * is unchanged — same HTML, different document — so a signature check
           * alone would keep an empty set and render nothing. Counting what
           * survived catches it.
           */
          const mapped = old.set.map(tr.mapping, tr.doc);
          const intact = mapped.find().length === old.set.find().length;
          if (now === old.signature && intact) return { signature: now, set: mapped };

          return {
            signature: now,
            set: pictureDecorations(tr.doc, htmlContext.repo, htmlContext.relPath),
          };
        },
      },
      props: {
        // Through the key: `this` is not reliably the plugin once Milkdown has
        // wrapped it, and a decoration set that is never returned is invisible.
        // Through the key: `this` is not reliably the plugin once Milkdown has
        // wrapped it.
        decorations: (state) => pictureKey.getState(state)?.set,
      },
      // The choice depends on the paper, so changing it re-decides.
      view: (view: EditorView) => {
        const observer = new MutationObserver(() =>
          view.dispatch(view.state.tr.setMeta(pictureKey, true)),
        );
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
        return { destroy: () => observer.disconnect() };
      },
    }),
);
