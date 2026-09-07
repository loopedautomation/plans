/**
 * A published plan, in a browser with no account.
 *
 * The renderer is the app's: the same Editor, the same markdown pipeline, the
 * same mermaid and the same theme, with the caret taken away. That is the
 * whole design — a second renderer would always lag the one people write in,
 * and this page and the editor can never disagree about a table.
 *
 * See plans/public-plan-pages.md.
 */
import { useEffect, useRef, useState } from "react";
import { Editor } from "../Editor";
import { applyTheme, THEMES, type ThemeId } from "../theme";
import {
  applyType,
  DEFAULT_TYPE,
  FONTS,
  MEASURE_RANGE,
  SIZE_RANGE,
  type TypeSettings,
} from "../fonts";
import { splitFrontmatter, matterValue, statusTone } from "../matter";
import { fetchPage, pageId, type Page as Plan } from "./pages";
import "./page.css";

/** How often the page asks whether the plan has moved on. */
const POLL_MS = 5_000;

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "unreachable"; why: string }
  /** `version` counts accepted changes: it is what re-swaps the document. */
  | { kind: "plan"; plan: Plan; version: number };

export function Page() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const id = pageId();

  /**
   * Ask, and keep asking.
   *
   * A page follows its source: a workspace document as the room changes it, a
   * repository file as its author saves. Polling rather than a socket —
   * cheap, no session, and a reader is not a collaborator. Once the plan is
   * gone the asking stops: sharing was stopped, and that is a final answer.
   */
  useEffect(() => {
    if (!id) {
      setState({ kind: "missing" });
      return;
    }
    let alive = true;
    let timer: number | null = null;
    const ask = async () => {
      try {
        const plan = await fetchPage(id);
        if (!alive) return;
        if (!plan) {
          setState({ kind: "missing" });
          return;
        }
        // Replace only when something changed, so an unchanged poll does not
        // rebuild the document under someone who is reading it.
        setState((prev) =>
          prev.kind === "plan" && prev.plan.markdown === plan.markdown && prev.plan.name === plan.name
            ? prev
            : { kind: "plan", plan, version: (prev.kind === "plan" ? prev.version : 0) + 1 },
        );
        timer = window.setTimeout(() => void ask(), POLL_MS);
      } catch (e) {
        if (!alive) return;
        // The server, not the plan: say so, and try again rather than
        // claiming the plan is not shared.
        setState((prev) =>
          prev.kind === "plan" ? prev : { kind: "unreachable", why: e instanceof Error ? e.message : String(e) },
        );
        timer = window.setTimeout(() => void ask(), POLL_MS);
      }
    };
    void ask();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  useEffect(() => {
    document.title = state.kind === "plan" ? state.plan.name : "Plan";
  }, [state]);

  if (state.kind === "loading") return <div className="share-wait">Opening…</div>;
  if (state.kind === "unreachable") {
    return (
      <div className="share-gone">
        <h1>Not right now</h1>
        <p>{state.why}. This page will keep trying.</p>
      </div>
    );
  }
  if (state.kind === "missing") {
    // Never an error: the commonest reason to be here is that someone stopped
    // sharing, which is not a fault of the person reading.
    return (
      <div className="share-gone">
        <h1>This plan is not shared</h1>
        <p>
          Whoever shared it has stopped, or the link was mistyped. Ask them for a new link — a shared
          plan lives at an address of its own, and that address is the whole of it.
        </p>
      </div>
    );
  }

  const { plan, version } = state;
  const { matter, body } = splitFrontmatter(plan.markdown);
  const status = matter ? matterValue(matter, "status") : null;
  const owner = matter ? (matterValue(matter, "owner") ?? matterValue(matter, "assignee")) : null;

  return (
    <div className="share-page">
      <div className="page-head">
        <Look />
        <span className="page-path">{plan.name}</span>
        <span className="page-actions">
          {status && (
            <span className={`status-badge tone-${statusTone(status)}`} title="status: from this plan's frontmatter">
              {status}
            </span>
          )}
          {owner && <span className="matter-owner">@{owner}</span>}
          {/* How fresh this is. A live page is whatever the room says right
              now, so only a file's page has a "then" to report. */}
          {!plan.live && <span className="share-when">published {ago(plan.publishedAt)}</span>}
        </span>
      </div>
      <Editor
        docKey={`${plan.id}:${version}`}
        // No repository to resolve relative images against, and none to
        // invent: an image the plan points at on someone's disk says so
        // rather than showing a broken frame.
        repo=""
        relPath={plan.name}
        initialValue={body}
        spellcheck={false}
        imageFolder=""
        author=""
        // Handles keep their colours here, and faces stay off the page: a
        // reader is anonymous, and this page never carries the member list.
        // See plans/improve-comment-system-in-workspaces.md.
        tintHandles
        readOnly
        onChange={() => {}}
        onOpenLink={openLink}
      />
    </div>
  );
}

/**
 * A link on a public page.
 *
 * Anything with a scheme opens in a new tab. A relative link is a plan
 * pointing at a plan beside it on someone's disk — there is nothing here to
 * open, and following it would land the reader on a 404 dressed as a plan, so
 * it does nothing at all.
 */
function openLink(href: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
}

/** "today", "3 days ago" — the same voice the app's share sheet uses. */
export function ago(at: number, now = Date.now()): string {
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const THEME_KEY = "plans.share.theme";
const LOOK_KEY = "plans.share.look";

type Look = TypeSettings & { theme: ThemeId };

/** What the reader's browser prefers, unless they have chosen here before. */
function startingTheme(): ThemeId {
  try {
    const kept = localStorage.getItem(THEME_KEY);
    if (kept && THEMES.some((t) => t.id === kept)) return kept as ThemeId;
  } catch {
    // no storage: the preference below
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

/**
 * How the page looks to this reader: the paper, and the type. Kept in this
 * browser only — a public page has nobody to save it for — with the paper
 * still read from the key it had before the type joined it.
 */
function startingLook(): Look {
  const base: Look = { ...DEFAULT_TYPE, theme: startingTheme() };
  try {
    const kept = localStorage.getItem(LOOK_KEY);
    if (!kept) return base;
    const got = JSON.parse(kept) as Partial<Look>;
    return {
      theme: got.theme && THEMES.some((t) => t.id === got.theme) ? got.theme : base.theme,
      fontId: got.fontId && FONTS.some((f) => f.id === got.fontId) ? got.fontId : base.fontId,
      size: clamp(got.size, SIZE_RANGE, base.size),
      measure: clamp(got.measure, MEASURE_RANGE, base.measure),
    };
  } catch {
    return base;
  }
}

function clamp(v: unknown, r: { min: number; max: number }, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : fallback;
}

/**
 * The Aa control: the app's appearance settings, cut down to what a reader
 * with no settings page can want — paper, face, size, measure — behind one
 * button at the head's leading edge, where the app keeps its own.
 */
function Look() {
  const [look, setLook] = useState<Look>(startingLook);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(look.theme);
    applyType(look);
    try {
      localStorage.setItem(LOOK_KEY, JSON.stringify(look));
      localStorage.setItem(THEME_KEY, look.theme);
    } catch {
      // fine: it lasts the visit
    }
  }, [look]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const step = (key: "size" | "measure", by: number, r: { min: number; max: number; step: number }) =>
    setLook((l) => ({ ...l, [key]: Math.min(r.max, Math.max(r.min, l[key] + by * r.step)) }));

  return (
    <div className="share-look" ref={box}>
      <button
        className={`rail-btn ${open ? "on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Paper and type"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="look"
      >
        <span className="aa">Aa</span>
      </button>
      {open && (
        <div className="share-look-sheet" role="dialog" aria-label="Paper and type" data-testid="look-sheet">
          <div className="look-row">
            <span className="look-name">Paper</span>
            <span className="segmented small" role="group" aria-label="Paper">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={look.theme === t.id ? "on" : ""}
                  onClick={() => setLook((l) => ({ ...l, theme: t.id }))}
                  title={t.label}
                  data-testid={`theme-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </span>
          </div>
          <div className="look-row">
            <span className="look-name">Face</span>
            <span className="look-faces">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  className={`look-face ${look.fontId === f.id ? "on" : ""}`}
                  style={{ fontFamily: f.stack }}
                  onClick={() => setLook((l) => ({ ...l, fontId: f.id }))}
                  aria-pressed={look.fontId === f.id}
                  title={`${f.note} · ${f.designer}`}
                >
                  {f.label}
                </button>
              ))}
            </span>
          </div>
          <div className="look-row">
            <span className="look-name">Size</span>
            <span className="segmented small" role="group" aria-label="Size">
              <button onClick={() => step("size", -1, SIZE_RANGE)} aria-label="Smaller" data-testid="size-down">
                −
              </button>
              <span className="look-value" data-testid="size-value">{look.size}</span>
              <button onClick={() => step("size", 1, SIZE_RANGE)} aria-label="Larger" data-testid="size-up">
                +
              </button>
            </span>
          </div>
          <div className="look-row">
            <span className="look-name">Measure</span>
            <span className="segmented small" role="group" aria-label="Measure">
              <button onClick={() => step("measure", -1, MEASURE_RANGE)} aria-label="Narrower">
                −
              </button>
              <span className="look-value">{look.measure}ch</span>
              <button onClick={() => step("measure", 1, MEASURE_RANGE)} aria-label="Wider">
                +
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
