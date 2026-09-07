---
status: done
---
# Manage the members of a workspace

## What shipped

The design went through as written, plus one rule decided on the way:
any member may invite, and only the owner may remove or hand on. Two
things surfaced in the doing. `PATCH` was not in the server's CORS
allow-list, so the handover failed silently from the app while the
server test passed. And forgetting a workspace destroyed its Yjs
documents under an editor still tearing down — reachable through Leave
all along, first noticed when removal made it happen on someone else's
screen; the rooms now close after the editor has let go.

A workspace's membership can grow and nothing else. `POST /workspaces/{id}/members`
adds a login (`server/src/index.js:218-224`), `DELETE …/members/me` lets a
member walk out (`index.js:212-217`), and that is the whole API. Nobody can
remove anyone but themselves; the creator cannot even leave
(`index.js:214`), on the reasoning that a room with no one to delete it
lives forever (`server/src/db.js:188-189`). On the app's side the member
list is a tooltip: the Invite button's `title` joins the logins with commas
(`src/App.tsx:6254`), which is the only place a member is ever seen, and
the only thing you can do about a member is invite another one
(`App.tsx:3563-3575`, the `wsInviting` sheet at `App.tsx:6797`).

So the ordinary situations have no answer. Someone invited by a typo — the
server lowercases and accepts anything email-shaped (`index.js:221-222`) —
is a member until the workspace is deleted. Someone who has left the team
keeps reading the room. The person who made the workspace, moving on,
cannot hand it to anyone. And a member who wants to know who else can see
the document has to hover a button.

## The shape of it

Membership is one table, `members (workspace_id, login)`
(`server/src/schema.js:37-41`), with the creator as the one privileged
login, held on the workspace row as `createdBy` and compared by string
(`index.js:207`). That is enough structure for what is needed, and adding
a roles column is not worth it yet: the app has exactly two kinds of
person, the one who made the room and everyone else, and every question
below is answered by that distinction.

**Who may remove a member.** The creator, for anyone but themselves; and
any member, for themselves, which is `leave` under a different address.
A rule where any member can remove any other is the wrong one for a room
whose whole access model is "the creator invites": anyone invited could
then evict the person who invited them. One route serves both:

    DELETE /workspaces/{id}/members/{login}

`mine` (`index.js:81-86`) answers who is asking and whether they belong;
then `login === caller` is a leave, `w.createdBy === caller` is a removal,
and anything else is a 403. The `…/members/me` route becomes an alias so
older builds keep working — the reader page kept `/ws/{id}` without its
prefix for the same reason (`index.js:399-401`). Removing the creator
stays refused on either path.

**What removal does to a live session.** `isMember` is checked when the
socket is opened (`index.js:404-412`) and never again, so a removed member
who already has the room open keeps it until they reconnect — and keeps
writing into it, since the CRDT does not know. `rooms.evict` closes every
connection of a workspace with `4001, "workspace gone"`
(`server/src/rooms.js:267-272`); removal needs the per-login version of
it. A connection does not currently remember its login: `rooms.join` takes
the socket and the room (`index.js:414`). It has to carry the login in,
so that `rooms.kick(workspaceId, login)` can close that person's sockets
with a code of their own, `4003`, and the app on the other end can tell
"you were removed" from "the room is gone" — the client's close handling
is in `openRoom` (`src/workspace.ts:300-335`) and it already reads the
code for the deleted case. On the removed person's screen the workspace
leaves the sidebar the way `forgetWorkspace` does after a leave
(`App.tsx:3391`), with a toast saying so rather than a silent
disappearance.

**Handing the workspace on.** The creator cannot leave because deletion
needs an owner. The fix is to let ownership move, not to let the owner
leave: `PATCH /workspaces/{id}` with `{ createdBy: login }`, creator only,
target must already be a member. After it the old creator is an ordinary
member and can leave like one. Renaming `createdBy` to `owner` would be
the honest name, but it is in the schema, the client type
(`src/workspace.ts:51-58`) and the tests; keep the column, name the route's
field `owner`, and let the shape function map it.

**Inviting** stays open to every member, as it is now: the route asks only
that the caller belongs (`index.js:219`), not that they made the room.
Decided, not inherited: the person who knows a colleague belongs in the
argument is rarely the person who made the workspace, and owner-only
inviting makes the owner a bottleneck for the cheap action. It is cheap
because the removal above exists — a wrong invite is one click for the
owner to undo — so the two rules are asymmetric on purpose: anyone may
add, only the owner may take away. The one change to the sheet is that
it should say an invite names an email, since that is what the server
insists on (`index.js:221`) and what a handle turned out to be (see the
comments work in `BUGS.md`, "A workspace comment showed its raw line").

## The members sheet

One sheet, opened from the page head where Invite is now
(`App.tsx:6251-6257`), replacing that button with **Members** and moving
the invite field into the sheet's foot. It draws the list the server
already sends — `profiles` carries login, name and face for every member
(`db.js:124-132`, `workspace.ts:47-49`) — one row each, as `Avatar` draws
a person everywhere else, with the login under the name and an "owner"
mark on the creator's row. Beside each row, what you may do to it:
nothing on your own row but "Leave" (the existing confirm at
`App.tsx:3388`); "Remove…" on every other row if you are the creator;
"Make owner…" likewise. Each is a `confirmed` dialog, since all three are
hard to take back. Presence can mark who is in the room right now — the
tree room's awareness already lists everyone connected
(`presentIn`, `workspace.ts:258-275`) — which turns the sheet from a list
of logins into a picture of who is here, and that is most of the reason to
open it.

The sheet is `ShareSheet`'s pattern (`src/ShareSheet.tsx:30-60`): a
`.matter-sheet` over the page, its own file, props for the actions,
nothing about the server in it. Leave and Delete stay on the sidebar's
right-click menu too (`src/FileTree.tsx:1030-1037`); the sheet is where
you see everyone, the menu is where you act on the room as a whole.

## What deliberately does not change

- **No roles.** Owner and member are the two kinds of person; a third
  ("can read, cannot write") is a share link (`plans/sharable-links.md`),
  which already exists and already answers the read-only case.
- **No invitations to accept.** An invite adds the login at once, and the
  invited person finds the workspace in their sidebar on next sign-in.
  Pending invites would need a state and an inbox; a wrong invite is
  undone by removing the member, which this plan provides.
- **No notification to the removed.** Their socket closes with a code
  that the app explains; there is nothing else to tell them.

## Open questions

- ~~**Should any member be able to remove someone they invited?**~~
  Decided: no. Removal is the owner's alone, and the server keeps not
  recording who invited whom. Any member may invite; that is what makes
  owner-only removal workable rather than a bottleneck.
- ~~**Does removal revoke the member's read token?**~~ Decided as
  guessed: the read tokens minted in the removed member's name are
  deleted with them; share links are the workspace's and stay. `POST …/token` mints a
  read token in the caller's name (`index.js:239-242`), for an outside
  agent. `db.createReadToken(w.id, login)` records the login, so removal
  can delete that person's tokens too. It should; the question is only
  whether the `share_tokens` a removed member minted should also die, or
  whether a share is the workspace's and outlives whoever pressed the
  button. The share plan's answer was "the token is the workspace's"
  (`index.js:246-249`), so probably: the read tokens go, the shares stay.
- ~~**Where does the sheet open from on a file that is not the first?**~~
  The page head draws the workspace chrome for whichever file of the
  workspace is open (`App.tsx`, the `wsIdOf(activePath)` block), so
  Members is there on every file.
- **Ownership does not push.** A handover reaches the new owner's sidebar
  on their next look at the list — the focus refresh, the same as an
  invite. Removal pushes, because it has to; ownership can wait.

## Next

- [x] Server: `DELETE /workspaces/{id}/members/{login}` — self is leave,
      creator removes anyone else, creator cannot be removed; keep
      `…/members/me` as an alias (`server/src/index.js:212-217`)
- [x] Server: connections remember their login; `rooms.kick(workspaceId,
      login)` closes that person's sockets with `4003` (`server/src/rooms.js`,
      around `evict` at `:267`), called after a removal
- [x] Server: `PATCH /workspaces/{id}` with `{ owner }`, creator only,
      target must be a member; delete the removed member's read tokens
- [x] Server tests: remove as owner, refused as member, refused on the
      owner, alias still works, the kicked socket closes with `4003`, owner
      handover then the old owner leaves (`server/test/server.test.js`,
      beside the members tests at `:131-165`)
- [x] Client: `workspace.remove(id, login)`, `workspace.handOver(id,
      login)` in `src/workspace.ts` beside `invite` and `leave`
      (`:203-205`); `openRoom` reads `4003` and reports "You were removed
      from {name}" before forgetting the workspace
- [x] App: `MembersSheet.tsx` on `ShareSheet`'s pattern — the profiles as
      rows with faces, owner marked, who is present now, Leave / Remove… /
      Make owner… as confirmed actions, the invite field in its foot; the
      page head's Invite button becomes Members (`src/App.tsx:6251-6257`)
- [x] The invite sheet's note says an email is what it takes; inviting
      stays open to every member, and a server test says so
- [x] e2e: owner removes bob, bob's editor closes with the message and the
      heading leaves his sidebar; bob cannot remove alice; alice hands the
      workspace to bob and leaves (`e2e/workspace.spec.ts`)
- [x] A changeset, and the workspace section of `README.md` says members
      can be removed and ownership handed on
