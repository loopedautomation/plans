import { PAPER_AND_INK } from "../tokens";
import { Swatches } from "./Swatches";

export function PaperAndInk() {
  return (
    <section className="gallery-section" id="paper">
      <h2>Paper and ink</h2>
      <p>
        Three papers, in the manner of an e-reader's Aa menu: day, sepia and
        night. Each is eight values, and the chrome is nothing but these:
        ink at three strengths on a paper with two steps above it and two
        hairlines through it. Night's ink is deliberately off-white, because
        pure white on near-black halates. The values here are read from the
        live stylesheet as you switch paper.
      </p>
      <Swatches tokens={PAPER_AND_INK} />
    </section>
  );
}
