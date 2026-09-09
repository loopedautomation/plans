import { FONTS, MONO_FONTS } from "../../fonts";

const SAMPLE =
  "The plan is the unit of work. It is written once, read many times, and the app exists so that reading it is a pleasure rather than a chore.";

export function Type() {
  return (
    <section className="gallery-section" id="type">
      <h2>Type first</h2>
      <p>
        The reader chooses the reading face, its size and its measure, and
        the page is set from those three numbers and nothing else. Each face
        carries an optical correction so that switching between them keeps
        the same apparent size. The chrome never changes with them: the
        ledger is Space Mono at 10 to 12 pixels, uppercase, tracked out,
        whatever the page is wearing.
      </p>
      {FONTS.map((f) => (
        <div className="specimen" key={f.id} data-testid="face" data-font={f.id}>
          <span className="gallery-cap">
            {f.label} · {f.designer} · {f.note}
          </span>
          <p style={{ fontFamily: f.stack, fontSize: `calc(var(--doc-size) * ${f.scale})` }}>{SAMPLE}</p>
        </div>
      ))}
      <h2 style={{ marginTop: 32 }}>The mono voice</h2>
      <p>
        Uppercase, tracked, small. A path, a branch, a status, a hint under a
        field, a row in the tree: anything the machine is saying rather than
        the person. Code blocks and the source view use the reader's own
        monospace instead, which defaults to the system's.
      </p>
      <div className="gallery-row">
        <span className="gallery-cap">plans/settings-json.md</span>
        <span className="gallery-cap">main</span>
        <span className="gallery-cap">written into the frontmatter</span>
      </div>
      <div className="gallery-row">
        {MONO_FONTS.map((m) => (
          <span key={m.id} style={{ fontFamily: m.stack, fontSize: 13 }} title={m.note}>
            {m.label}
          </span>
        ))}
      </div>
    </section>
  );
}
