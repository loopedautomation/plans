/**
 * Every element of the design system on one page, drawn by the app's own
 * components, in whichever paper the reader picks.
 *
 * Six sections, each a heading, the rule in prose and the elements live
 * under it. The order is the argument: the thesis, then paper and ink, then
 * what colour is allowed to mean, then type, then the ledger's parts, then
 * the page's. See plans/distill-this-design.md.
 */
import { useEffect, useState } from "react";
import { applyTheme, DEFAULT_THEME, THEMES, type ThemeId } from "../theme";
import { Thesis } from "./sections/Thesis";
import { PaperAndInk } from "./sections/PaperAndInk";
import { Differences } from "./sections/Differences";
import { Type } from "./sections/Type";
import { Ledger } from "./sections/Ledger";
import { Page } from "./sections/Page";

export function Gallery() {
  const [paper, setPaper] = useState<ThemeId>(DEFAULT_THEME);
  useEffect(() => applyTheme(paper), [paper]);
  return (
    <main className="gallery">
      <header className="gallery-head">
        <div>
          <h1>Looped Plans, the design</h1>
          <span className="gallery-cap">the ledger and the page</span>
        </div>
        <span className="papers" role="group" aria-label="Paper">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rail-btn ${t.id === paper ? "on" : ""}`}
              onClick={() => setPaper(t.id)}
              data-testid={`paper-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </span>
      </header>
      <Thesis />
      {/* Keyed on the paper so every swatch re-reads its value. */}
      <PaperAndInk key={`paper-${paper}`} />
      <Differences key={`diff-${paper}`} />
      <Type />
      <Ledger />
      <Page />
    </main>
  );
}
