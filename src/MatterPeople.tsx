/**
 * The people a plan's frontmatter names for review: `reviewers:` and, once
 * anyone has signed off, `approved:`.
 *
 * Both are flat comma lists, read by the same line parser as `status:` and
 * `owner:` — conventions the app renders, not a schema. In a workspace each
 * handle is looked up against the member list and drawn with the face and
 * colour their cursor wears; in a repository, or for a handle nobody has,
 * it is text. An approved handle carries a check. When every reviewer has
 * approved, the header offers `status: approved` — offers, never applies:
 * someone may still be mid-edit, and a plan's readers include agents that
 * cannot see a gate.
 */
import { Avatar } from "./Avatar";
import { handleList, matterValue } from "./matter";
import { colorFor, type Profile } from "./workspace";

type Props = {
  matter: string;
  /** Members by lowercased login; absent for a repository file. */
  profiles?: Record<string, Profile>;
  /** Offer the transition, when there is someone to make it. */
  onSetStatus?: (value: string) => void;
};

/** `alice@example.com` is drawn as `alice`, and kept whole on hover. */
function short(handle: string): string {
  const at = handle.indexOf("@");
  return at > 0 ? handle.slice(0, at) : handle;
}

export function MatterPeople({ matter, profiles, onSetStatus }: Props) {
  const reviewers = handleList(matterValue(matter, "reviewers"));
  if (reviewers.length === 0) return null;
  const approved = new Set(handleList(matterValue(matter, "approved")).map((h) => h.toLowerCase()));
  const status = (matterValue(matter, "status") ?? "").toLowerCase();
  const covered = reviewers.every((r) => approved.has(r.toLowerCase()));
  return (
    <span className="matter-people" title="reviewers: from this file's frontmatter">
      {reviewers.map((h) => {
        const who = profiles?.[h.toLowerCase()] ?? null;
        const done = approved.has(h.toLowerCase());
        return (
          <span
            key={h}
            className={`matter-person ${done ? "approved" : ""}`}
            title={done ? `@${h} approved` : `@${h}, asked to review`}
            data-testid="reviewer"
            data-handle={h}
            data-approved={done ? "1" : "0"}
          >
            {who && (
              <Avatar
                who={{ name: who.name ?? who.login, color: colorFor(who.login), avatar: who.avatar }}
                size={14}
              />
            )}
            <span className="matter-handle" style={who ? { color: colorFor(who.login) } : undefined}>
              @{short(h)}
            </span>
            {done && (
              <span className="matter-check" aria-label="approved">
                ✓
              </span>
            )}
          </span>
        );
      })}
      {covered && status !== "approved" && onSetStatus && (
        <button
          type="button"
          className="rail-btn matter-offer"
          onClick={() => onSetStatus("approved")}
          title="Everyone asked has approved. Mark the plan approved?"
          data-testid="offer-approved"
        >
          Mark approved
        </button>
      )}
    </span>
  );
}
