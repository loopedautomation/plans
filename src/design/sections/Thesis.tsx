export function Thesis() {
  return (
    <section className="gallery-section" id="thesis">
      <h2>Two registers, held in tension</h2>
      <blockquote>
        The page is the document: warm, generous, set in a reading face at a
        reading size. The ledger is everything around it, repos, index, git,
        set small in Space Mono, uppercase, tracked out. Machine voice around
        human prose.
      </blockquote>
      <p>
        That is the first comment in App.css, and everything below is a
        consequence of it. The page gets a serif and a measure; the ledger
        gets a monospace and a letter-spacing. When you cannot tell which
        register something belongs to, it is probably in the wrong one.
      </p>
      <div className="gallery-pair">
        <div>
          <span className="gallery-cap">the page</span>
          <p style={{ fontFamily: "var(--doc-font)", fontSize: "var(--doc-size)" }}>
            A plan is read more often than it is written, and by more people
            than wrote it. So the reading face comes first, and the chrome
            steps back to let it.
          </p>
        </div>
        <div>
          <span className="gallery-cap">the ledger</span>
          <div className="gallery-frame">
            <div className="gallery-row">
              <button type="button" className="rail-btn">Files</button>
              <button type="button" className="rail-btn on">Git</button>
              <span className="gallery-cap">main · 3 changed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
