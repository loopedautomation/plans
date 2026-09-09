/**
 * The people a plan's frontmatter names: `owner:`, `reviewers:` and, once
 * anyone has signed off, `approved:`. Read left to right it is one sentence:
 * who wrote it, who was asked, who has signed.
 *
 * All three are flat comma lists, read by the same line parser as `status:` —
 * conventions the app renders, not a schema. In a workspace each handle is
 * looked up against the member list and drawn with the face and colour their
 * cursor wears; in a repository, or for a handle nobody has, it is text.
 *
 * A reviewer has three states. Asked and approved are in the head; commented
 * is derived — a reviewer with an open thread signed by them who has not
 * approved — and drawn as a small speech mark, the way GitHub draws the
 * bubble beside a reviewer who requested changes. No key holds it: a
 * reviewer who wants to block says so in a thread, and deleting the thread
 * is resolving it.
 *
 * The header offers the two transitions to the people they are for — Approve
 * to a reviewer who has not, `approved` to whoever is looking once everyone
 * has — and never refuses them to anyone else: a plan's readers include
 * agents and copied-out files that cannot see a gate.
 */
import { Avatar } from "./Avatar";
import { handleList, matterValue } from "./matter";
import { colorFor, type Profile } from "./workspace";

type Props = {
  matter: string;
  /** Members by lowercased login; absent for a repository file. */
  profiles?: Record<string, Profile>;
  /** Lowercased logins with an open thread in the document. */
  commented?: string[];
  /** The signed-in login, so the header knows whose Approve to offer. */
  me?: string | null;
  /** Offer the transition, when there is someone to make it. */
  onSetStatus?: (value: string) => void;
  /** Add the signed-in login to `approved:`. */
  onApprove?: () => void;
};

/** `alice@example.com` is drawn as `alice`, and kept whole on hover. */
function short(handle: string): string {
  const at = handle.indexOf("@");
  return at > 0 ? handle.slice(0, at) : handle;
}

type PersonProps = {
  handle: string;
  who: Profile | null;
  className?: string;
  title: string;
  testid: string;
  data?: Record<string, string>;
  children?: React.ReactNode;
};

function Person({ handle, who, className = "", title, testid, data, children }: PersonProps) {
  return (
    <span
      className={`matter-person ${className}`}
      title={title}
      data-testid={testid}
      data-handle={handle}
      {...data}
    >
      {who && (
        <Avatar
          who={{ name: who.name ?? who.login, color: colorFor(who.login), avatar: who.avatar }}
          size={14}
        />
      )}
      <span className="matter-handle" style={who ? { color: colorFor(who.login) } : undefined}>
        @{short(handle)}
      </span>
      {children}
    </span>
  );
}

export function MatterPeople({ matter, profiles, commented, me, onSetStatus, onApprove }: Props) {
  const owners = handleList(matterValue(matter, "owner") ?? matterValue(matter, "assignee"));
  const reviewers = handleList(matterValue(matter, "reviewers"));
  if (owners.length === 0 && reviewers.length === 0) return null;
  const approved = new Set(handleList(matterValue(matter, "approved")).map((h) => h.toLowerCase()));
  const spoke = new Set((commented ?? []).map((h) => h.toLowerCase()));
  const status = (matterValue(matter, "status") ?? "").toLowerCase();
  const covered = reviewers.length > 0 && reviewers.every((r) => approved.has(r.toLowerCase()));
  const mine = me ? me.toLowerCase() : null;
  const asked = !!mine && reviewers.some((r) => r.toLowerCase() === mine) && !approved.has(mine);
  const lookup = (h: string) => profiles?.[h.toLowerCase()] ?? null;
  return (
    <span className="matter-people" title="owner, reviewers, approved: from this file's frontmatter">
      {owners.map((h) => (
        <Person
          key={`owner:${h}`}
          handle={h}
          who={lookup(h)}
          className="owner"
          title={`@${h} wrote this`}
          testid="owner"
        />
      ))}
      {owners.length > 0 && reviewers.length > 0 && (
        <span className="matter-sep" aria-hidden>
          ·
        </span>
      )}
      {reviewers.map((h) => {
        const done = approved.has(h.toLowerCase());
        const said = !done && spoke.has(h.toLowerCase());
        return (
          <Person
            key={h}
            handle={h}
            who={lookup(h)}
            className={done ? "approved" : said ? "commented" : ""}
            title={
              done ? `@${h} approved` : said ? `@${h} left comments` : `@${h}, asked to review`
            }
            testid="reviewer"
            data={{ "data-approved": done ? "1" : "0", "data-commented": said ? "1" : "0" }}
          >
            {done && (
              <span className="matter-check" aria-label="approved">
                ✓
              </span>
            )}
            {said && (
              <span className="matter-said" aria-label="left comments">
                ❝
              </span>
            )}
          </Person>
        );
      })}
      {asked && onApprove && (
        <button
          type="button"
          className="rail-btn matter-offer"
          onClick={onApprove}
          title="You were asked to review. Add yourself to approved:?"
          data-testid="offer-approve"
        >
          Approve
        </button>
      )}
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
