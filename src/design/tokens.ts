/**
 * The tokens the gallery lists, each with the rule that made it.
 *
 * Names only: the values are read from the live stylesheet when a swatch is
 * drawn (`getComputedStyle`), so this file can never disagree with App.css
 * about a colour. A token renamed there goes blank here, which is the drift
 * we want to see.
 */
export type Token = { name: string; rule: string };

export const PAPER_AND_INK: Token[] = [
  { name: "--paper", rule: "The page. Everything sits on it." },
  { name: "--raised", rule: "A sheet or a menu, a step above the paper." },
  { name: "--shade", rule: "A hover, a selection, code's own ground." },
  { name: "--ink", rule: "Prose, and anything that must be read." },
  { name: "--ink-2", rule: "The ledger's second voice: a branch name, a hint." },
  { name: "--ink-3", rule: "The quietest ink: a placeholder, a date, a due." },
  { name: "--rule", rule: "A hairline between regions." },
  { name: "--rule-strong", rule: "A hairline that has to be found: a focused field." },
];

export const DIFFERENCES: Token[] = [
  { name: "--git-new", rule: "A file git has never seen. Moss." },
  { name: "--git-mod", rule: "A file that differs from its commit. Ochre." },
  { name: "--git-staged", rule: "A change waiting in the index. Indigo." },
  { name: "--status-approved", rule: "The human's sign-off. Mulberry, between ready's indigo and done's moss." },
  { name: "--diff-add", rule: "The added side of a diff, moss at printing strength." },
  { name: "--diff-del", rule: "The removed side, oxblood." },
];

export const CODE: Token[] = [
  { name: "--code-keyword", rule: "Keywords. The same mulberry as approval." },
  { name: "--code-fn", rule: "Function names. Indigo, lightened." },
  { name: "--code-type", rule: "Types. Umber." },
  { name: "--code-string", rule: "Strings. Moss." },
  { name: "--code-number", rule: "Numbers. Ochre." },
  { name: "--code-name", rule: "Everything else with a name." },
  { name: "--code-punct", rule: "Punctuation, held back." },
  { name: "--code-comment", rule: "Comments, held back further." },
  { name: "--code-bg", rule: "Code's ground, a step off the paper." },
];

export const ALERTS: Token[] = [
  { name: "--alert-note", rule: "[!NOTE]" },
  { name: "--alert-tip", rule: "[!TIP]" },
  { name: "--alert-important", rule: "[!IMPORTANT]" },
  { name: "--alert-warning", rule: "[!WARNING]" },
  { name: "--alert-caution", rule: "[!CAUTION]" },
];

export const CHART: Token[] = [
  { name: "--chart-1", rule: "First series. Blue." },
  { name: "--chart-2", rule: "Second. Green." },
  { name: "--chart-3", rule: "Third. Plum." },
  { name: "--chart-4", rule: "Fourth. Amber." },
  { name: "--chart-5", rule: "Fifth. Red." },
  { name: "--chart-6", rule: "Sixth. Slate." },
];

/** The value a token has right now, on this paper. */
export function tokenValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
