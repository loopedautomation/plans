import { useState } from "react";
import { Avatar, Faces } from "../../Avatar";
import { Dropdown } from "../../Dropdown";
import { MatterPeople } from "../../MatterPeople";
import { TextPrompt } from "../../TextPrompt";
import { statusTone } from "../../matter";
import { colorFor, type Profile } from "../../workspace";

const STATUSES = ["draft", "ready", "review", "approved", "busy", "done", "parked"];
const MARKS: [string, string][] = [
  ["clean", "as committed"],
  ["new", "git has never seen it"],
  ["mod", "differs from the commit"],
  ["staged", "waiting in the index"],
];

const PROFILES: Record<string, Profile> = {
  alice: { login: "alice", name: "Alice", avatar: null },
  bob: { login: "bob", name: "Bob", avatar: null },
  sam: { login: "sam", name: "Sam", avatar: null },
};

const MATTER = "status: review\nowner: alice\nreviewers: bob, sam\napproved: sam";

export function Ledger() {
  const [branch, setBranch] = useState("main");
  const [asking, setAsking] = useState(false);
  const faces = Object.values(PROFILES).map((p) => ({ name: p.name ?? p.login, color: colorFor(p.login) }));
  return (
    <section className="gallery-section" id="ledger">
      <h2>The ledger's parts</h2>
      <p>
        Small, monospaced and mostly ink. A button is a word with a hairline
        around it that only appears on hover. A row is a name with a mark in
        the margin. A badge is a word in the ink of its state.
      </p>

      <span className="gallery-cap">buttons</span>
      <div className="gallery-row">
        <button type="button" className="rail-btn">Frontmatter</button>
        <button type="button" className="rail-btn on">Write</button>
        <button type="button" className="rail-btn">Source</button>
        <button type="button" className="rail-btn matter-offer">Mark approved</button>
      </div>

      <span className="gallery-cap">status badges, one ink per state</span>
      <div className="gallery-row">
        {STATUSES.map((s) => (
          <span key={s} className={`status-badge tone-${statusTone(s)}`} data-testid="badge">
            {s}
          </span>
        ))}
      </div>

      <span className="gallery-cap">the tree: a mark in the margin, a dot for the status</span>
      <div className="gallery-frame">
        <div className="files" role="tree">
          <div className="tree-repo ws-block">
            <button type="button" className="row repo ws current" role="treeitem" aria-expanded>
              <span className="repo-id">
                <span className="repo-name">Roadmap</span>
                <span className="repo-branch">workspace</span>
              </span>
              <span className="repo-count" title="2 files differ from the last commit">2</span>
              <span className="repo-count needs" title="1 file waiting on you">1</span>
            </button>
            <div role="group">
              {MARKS.map(([mark, why], i) => (
                <button
                  key={mark}
                  type="button"
                  className={`row file ${mark} ${i === 1 ? "active" : ""}`}
                  role="treeitem"
                  title={why}
                  data-needs-you={i === 2 ? "1" : undefined}
                  style={{ paddingLeft: 22 }}
                >
                  <span className="row-name">{mark === "clean" ? "settings-json" : `${mark}-file`}</span>
                  {i === 2 && <Faces who={faces.slice(0, 2)} size={14} />}
                  <span className={`status-dot tone-${statusTone(STATUSES[i])}`} title={STATUSES[i]} aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <span className="gallery-cap">the page head: who wrote it, who was asked, who has signed</span>
      <div className="gallery-frame">
        <div className="page-head">
          <span className="page-path">plans/rollout.md</span>
          <span className="page-actions">
            <span className="status-badge tone-review">review</span>
            <MatterPeople matter={MATTER} profiles={PROFILES} commented={["bob"]} me="bob" onApprove={() => {}} onSetStatus={() => {}} />
            <span className="matter-due">due 2026-10-01</span>
          </span>
        </div>
      </div>

      <span className="gallery-cap">faces: a picture, or the first letter on the cursor's colour</span>
      <div className="gallery-row">
        <Avatar who={faces[0]} />
        <Avatar who={faces[1]} size={14} />
        <Faces who={faces} />
      </div>

      <span className="gallery-cap">a dropdown, and a one-line question</span>
      <div className="gallery-row">
        <Dropdown
          value={branch}
          choices={[
            { value: "main", label: "main" },
            { value: "plans/rollout", label: "plans/rollout" },
            { value: "release/0.13", label: "release/0.13" },
          ]}
          onChange={setBranch}
          ariaLabel="Branch"
        />
        <button type="button" className="rail-btn" onClick={() => setAsking(true)} data-testid="ask">
          Request review…
        </button>
      </div>
      {asking && (
        <TextPrompt
          title="Request review"
          placeholder="@mira @sam"
          note="Sets status: review, names them in reviewers:, and leaves a comment at the top asking."
          confirm="Request"
          mentions={Object.keys(PROFILES)}
          onCancel={() => setAsking(false)}
          onSubmit={() => setAsking(false)}
        />
      )}
    </section>
  );
}
