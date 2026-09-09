/**
 * Three papers, in the manner of an e-reader's Aa menu.
 *
 * The rule for all three: the only chromatic colour anywhere in the app is a
 * git state. Everything else is ink at some opacity. If it has colour, it means
 * the file differs from what's committed.
 */
export type ThemeId = "day" | "sepia" | "night" | "system";

/** The papers a page can actually be drawn on; `system` resolves to one of these. */
export type Paper = Exclude<ThemeId, "system">;

export type Theme = {
  id: ThemeId;
  label: string;
  /** Shown as the swatch in the Aa menu. */
  swatch: { paper: string; ink: string };
};

export const THEMES: Theme[] = [
  { id: "day", label: "Day", swatch: { paper: "#FBFBF9", ink: "#17181B" } },
  { id: "sepia", label: "Sepia", swatch: { paper: "#E9DFCB", ink: "#33291F" } },
  { id: "night", label: "Night", swatch: { paper: "#121316", ink: "#C8C5BE" } },
  // Day's paper with night's ink: neither, until the device says which.
  { id: "system", label: "System", swatch: { paper: "#FBFBF9", ink: "#121316" } },
];

export const DEFAULT_THEME: ThemeId = "day";

const DARK = "(prefers-color-scheme: dark)";

/**
 * The paper `id` means right now. `system` follows the device: night when it
 * is in dark mode, day otherwise. Everything that reads `data-theme` — the
 * stylesheet, mermaid, the picture chooser — sees a paper, never `system`.
 */
export function resolveTheme(id: ThemeId): Paper {
  if (id !== "system") return id;
  return typeof matchMedia === "function" && matchMedia(DARK).matches ? "night" : "day";
}

let following: (() => void) | null = null;

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = resolveTheme(id);
  // Follow the device only while asked to; a chosen paper stops listening.
  following?.();
  following = null;
  if (id === "system" && typeof matchMedia === "function") {
    const query = matchMedia(DARK);
    const follow = () => {
      document.documentElement.dataset.theme = resolveTheme("system");
    };
    query.addEventListener("change", follow);
    following = () => query.removeEventListener("change", follow);
  }
}
