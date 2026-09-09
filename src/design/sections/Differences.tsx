import { ALERTS, CHART, CODE, DIFFERENCES } from "../tokens";
import { Swatches } from "./Swatches";

export function Differences() {
  return (
    <section className="gallery-section" id="colour">
      <h2>Colour means a difference</h2>
      <p>
        The only chromatic values in the chrome are the git states, so colour
        always means "this differs from what is committed". Everything else
        is ink at some opacity. The one exception earned its place: approval
        is the human's sign-off, and it wears a mulberry that sits between
        ready's indigo and done's moss.
      </p>
      <Swatches tokens={DIFFERENCES} />
      <h2 style={{ marginTop: 32 }}>Code, and only code, gets hue</h2>
      <p>
        Printer's inks on warm paper: mulberry, indigo, umber, moss and
        ochre, held below full saturation so a block reads as a passage of
        text. Night lifts the same five to pastels; sepia warms and darkens
        them. Code sits on its own ground, a step off the paper.
      </p>
      <Swatches tokens={CODE} />
      <h2 style={{ marginTop: 32 }}>Alerts and charts borrow the same inks</h2>
      <p>
        Five alert kinds, five inks already on the page. Mermaid's series
        run blue, green, plum, amber, red, slate, which is the same family in
        the order it draws them.
      </p>
      <Swatches tokens={[...ALERTS, ...CHART]} />
    </section>
  );
}
