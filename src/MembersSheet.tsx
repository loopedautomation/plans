/**
 * Who is in a workspace, and what you may do about each of them.
 *
 * The list is the server's `profiles` — every member as a person, with the
 * face and colour their cursor wears — with the owner marked and whoever is
 * in the room right now marked too, from the same awareness the cursors
 * ride. The actions follow one rule: any member may invite, only the owner
 * may take away. So the invite field is in the foot for everyone, Remove
 * and Make owner sit on other people's rows for the owner alone, and your
 * own row offers Leave unless you own the room, in which case the way out
 * is to hand it on first. The reasoning is in
 * plans/manage-workspace-members.md.
 */
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { colorFor, type Profile } from "./workspace";

type Props = {
  /** The workspace, for the sheet's title. */
  name: string;
  /** The signed-in login: the row that is yours. */
  me: string;
  /** The owner's login. */
  owner: string;
  profiles: Profile[];
  /** Logins with a socket into the room right now. */
  here: Set<string>;
  onInvite: (login: string) => Promise<void> | void;
  onRemove: (login: string) => Promise<void> | void;
  onHandOver: (login: string) => Promise<void> | void;
  onLeave: () => Promise<void> | void;
  onClose: () => void;
};

/** The part before the `@`, which is how the comment card draws a login too. */
const short = (login: string) => (login.includes("@") ? login.slice(0, login.indexOf("@")) : login);

export function MembersSheet({ name, me, owner, profiles, here, onInvite, onRemove, onHandOver, onLeave, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [invitee, setInvitee] = useState("");
  const sheet = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const owned = me === owner;

  // Focus on the sheet, so Escape closes this and not zen (see ShareSheet).
  useEffect(() => sheet.current?.focus(), []);

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      // A confirm dialog takes the focus with it; back on the sheet, so
      // Escape still closes this rather than reaching the app.
      sheet.current?.focus();
    }
  };

  const invite = () => {
    const login = invitee.trim();
    if (!login) return;
    void run(async () => {
      await onInvite(login);
      setInvitee("");
      field.current?.focus();
    });
  };

  // Owner first, then the rest by login; the order the server sends is by
  // login alone, and the owner's row is the one everyone looks for.
  const rows = [...profiles].sort((a, b) => (a.login === owner ? -1 : b.login === owner ? 1 : a.login.localeCompare(b.login)));

  return (
    <div className="matter-scrim" onMouseDown={onClose}>
      <div
        className="matter-sheet members-sheet"
        data-testid="members-sheet"
        ref={sheet}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="matter-head">
          <span className="tag">Members of “{name}”</span>
        </div>
        <ul className="members" aria-label="Members">
          {rows.map((p) => {
            const mine = p.login === me;
            const display = p.name ?? short(p.login);
            return (
              <li key={p.login} className={`member${here.has(p.login) ? " here" : ""}`} data-login={p.login}>
                <Avatar who={{ name: display, color: colorFor(p.login), avatar: p.avatar }} size={22} />
                <span className="member-who">
                  <span className="member-name">
                    {display}
                    {mine && <span className="member-note">you</span>}
                    {p.login === owner && <span className="member-note">owner</span>}
                    {here.has(p.login) && !mine && (
                      <span className="member-note on" title="In the workspace right now">
                        here
                      </span>
                    )}
                  </span>
                  <span className="member-login">{p.login}</span>
                </span>
                <span className="member-acts">
                  {mine && !owned && (
                    <button className="rail-btn" onClick={() => void run(onLeave)} disabled={busy}>
                      Leave…
                    </button>
                  )}
                  {owned && !mine && (
                    <>
                      <button
                        className="rail-btn"
                        onClick={() => void run(() => onHandOver(p.login))}
                        disabled={busy}
                        title="They own the workspace; you stay in it as a member"
                      >
                        Make owner…
                      </button>
                      <button
                        className="rail-btn warn"
                        onClick={() => void run(() => onRemove(p.login))}
                        disabled={busy}
                        title="Out of the workspace now; they can be invited back"
                      >
                        Remove…
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="name-path">
          {owned
            ? "Anyone here can invite. Only you can remove someone, or make them the owner — hand it on before you leave."
            : "Anyone here can invite. Only the owner can remove someone."}
        </p>
        <input
          ref={field}
          className="name-field member-invite"
          placeholder="Invite by email address"
          value={invitee}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setInvitee(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              invite();
            }
          }}
        />
        <div className="matter-foot">
          <span>esc close · they see it the next time they sign in</span>
          <button className="act" onClick={invite} disabled={busy || !invitee.trim()}>
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
