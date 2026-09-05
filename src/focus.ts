/**
 * Focus, as two behaviours.
 *
 * The keymap made one table the truth and every shortcut a view of it. This is
 * the same move for the other half of the keyboard: the app had no focus
 * abstraction at all, so every sheet leaked Tab into the page behind it and
 * every tree row was its own tab stop. Rather than fix each site by hand, the
 * two behaviours every one of them needs live here once.
 *
 * `useFocusTrap` is for anything modal: remember where focus was, move it in,
 * keep Tab inside, and — the half that matters most and that nothing did
 * before — put it back on the way out.
 *
 * `useRovingFocus` is for anything composite: a tree, a tablist, a menu. One
 * tab stop for the whole widget, arrows to move within it, Home and End to the
 * ends. The three differ only in orientation and in the role the container
 * carries, so one hook serves all of them.
 *
 * Neither touches Escape. Escape already has a careful five-rung meaning in
 * App (blur the editor → focus the tab → leave zen → the keyboard page →
 * settings) and several sheets answer it themselves in the capture phase.
 * The trap owns Tab and nothing else; that split is the contract, so nobody
 * later centralises a ladder that was deliberately built rung by rung.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * What Tab can land on. Deliberately a list of elements rather than a
 * computed check: `:focus-visible`-style heuristics belong to the browser,
 * and everything the app puts in a sheet is on this list.
 */
const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** The tabbable descendants of `root`, in document order, skipping hidden ones. */
function tabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * `ref.current` as something an effect can depend on.
 *
 * A ref is filled in after the render that mounts the element and re-runs
 * nothing, so an effect that reads it once and finds `null` gives up for good.
 * That is not a rare case here: the main tab strip renders only once a buffer
 * is open, and the tree is an empty-state paragraph until the repositories
 * load. Both widgets would have mounted with no arrows at all.
 *
 * The effect has no dependency list on purpose — it runs after every render,
 * compares, and only sets state when the element actually arrives or goes, so
 * the common case is one identity check and no extra render.
 */
function useNode(ref: RefObject<HTMLElement | null>) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNode((prev) => (prev === ref.current ? prev : ref.current));
  });
  return node;
}

/**
 * Contain Tab inside `ref`, and restore focus when it goes away.
 *
 * On mount: `document.activeElement` is remembered, and focus moves to the
 * first tabbable thing inside — unless the widget has already placed it,
 * which most sheets do (a name field, a filter box) and which is always the
 * better answer. On unmount focus goes back where it came from, if that place
 * still exists: a sheet opened while the caret was in the document therefore
 * returns you to the document, writing, which is what you were doing.
 *
 * `active` exists for the widgets that stay mounted and merely hide — the
 * palette is one — since a hook cannot be called conditionally.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const box = ref.current;
    if (!box) return;
    const from = document.activeElement as HTMLElement | null;
    if (!box.contains(document.activeElement)) (tabbable(box)[0] ?? box).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = tabbable(box);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const at = document.activeElement as HTMLElement | null;
      const inside = !!at && box.contains(at);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey ? at === first || !inside : at === last || !inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    // Capture, so a surface with its own Tab handling — an editor behind the
    // scrim, a textarea inside it — cannot take the key first.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Only if that place still exists, and only if nothing has already
      // claimed focus on the way out — a sheet that closes by opening the
      // next thing should not be dragged back to where the last one started.
      const now = document.activeElement;
      const loose = !now || now === document.body || box.contains(now);
      if (loose && from?.isConnected) from.focus();
    };
  }, [ref, active]);
}

type RovingOptions = {
  /** Which arrows move the cursor. Vertical is ↑/↓, horizontal is ←/→. */
  orientation?: "vertical" | "horizontal";
  /**
   * What counts as an item. The default wants a `data-rove` attribute whose
   * value is a stable identity — a tree row's key, a tab's path — so the
   * cursor survives the list being rebuilt underneath it. A plain CSS
   * selector works too, and then position is the identity.
   */
  selector?: string;
  /** For widgets that stay mounted while hidden. */
  active?: boolean;
  /**
   * Called with the item an arrow just moved to. A tablist selects on move —
   * that is what the role promises — where a tree only moves focus.
   */
  onMove?: (item: HTMLElement) => void;
};

/**
 * One tab stop for a composite widget, arrows to move inside it.
 *
 * The container keeps the composite role; this keeps exactly one item at
 * `tabindex=0` and every other at `-1`, follows the cursor when focus arrives
 * some other way (a click, a programmatic focus), and re-syncs when the list
 * changes underneath — a folder opening, a tab closing. Movement clamps at the
 * ends rather than wrapping: a tree and a tablist both read as having a top
 * and a bottom, and wrapping past them loses your place.
 */
export function useRovingFocus(ref: RefObject<HTMLElement | null>, opts: RovingOptions = {}) {
  const { orientation = "vertical", selector = "[data-rove]", active = true } = opts;
  /** The identity of the item holding the widget's tab stop. */
  const at = useRef<string | null>(null);
  // Through a ref so a call site can pass an inline callback without the
  // listeners being torn down and rebound on every render.
  const onMove = useRef(opts.onMove);
  onMove.current = opts.onMove;
  // Through `useNode` rather than `ref.current`, so a widget that mounts after
  // its first render — the tab strip once a buffer opens, the tree once the
  // repositories load — gets its handlers when it appears.
  const box = useNode(ref);

  useEffect(() => {
    if (!active || !box) return;

    const items = () => Array.from(box.querySelectorAll<HTMLElement>(selector));
    const idOf = (el: HTMLElement, i: number) => el.dataset.rove ?? String(i);
    const mark = (list: HTMLElement[], k: number) => {
      at.current = idOf(list[k], k);
      list.forEach((el, i) => {
        el.tabIndex = i === k ? 0 : -1;
      });
    };
    const sync = () => {
      const list = items();
      if (!list.length) return;
      const k = list.findIndex((el, i) => idOf(el, i) === at.current);
      mark(list, k === -1 ? 0 : k);
    };
    sync();

    // The list is data, and the data changes: a folder opens, a repository is
    // filtered away. Watching the subtree keeps the tab stop on something that
    // still exists without the call site having to say when.
    const seen = new MutationObserver(sync);
    seen.observe(box, { childList: true, subtree: true });

    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(selector);
      if (!el) return;
      const list = items();
      const i = list.indexOf(el);
      if (i !== -1) mark(list, i);
    };

    const go = (list: HTMLElement[], to: number) => {
      const i = Math.max(0, Math.min(to, list.length - 1));
      list[i].focus();
      onMove.current?.(list[i]);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(selector);
      if (!el) return;
      const list = items();
      const cur = list.indexOf(el);
      if (cur === -1) return;
      const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const prev = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      if (e.key === next) go(list, cur + 1);
      else if (e.key === prev) go(list, cur - 1);
      else if (e.key === "Home") go(list, 0);
      else if (e.key === "End") go(list, list.length - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };

    box.addEventListener("focusin", onFocusIn);
    box.addEventListener("keydown", onKey);
    return () => {
      seen.disconnect();
      box.removeEventListener("focusin", onFocusIn);
      box.removeEventListener("keydown", onKey);
    };
  }, [box, selector, orientation, active]);
}
