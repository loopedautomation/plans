---
status: busy
---
# Improve the request review flow

> We already have front matter for the author and an approval from a
> reviewer. But we maybe need a way to notify people and also display who
> the author is and who's reviewing. This might also be related to the
> diffs in workspaces plan, to allow us or our agents to propose changes
> for plans written by other people. The author should also be able to
> accept / reject changes. Take inspiration from a GitHub PR review.

## Problem / context

The review flow the lifecycle plan built is complete as a *record* and
incomplete as a *flow*. Everything a review is made of is in the file:
`Request review` sets `status: review`, writes `reviewers:`, clears
`approved:` and leaves a mentioning comment at the top
(`src/App.tsx:3033-3055`); `Approve` appends the signed-in login to
`approved:` (`App.tsx:3057-3063`); the header draws each reviewer with the
face and colour their cursor wears, a check once they have approved, and
offers `status: approved` when everyone has (`src/MatterPeople.tsx:32-82`).
That was the right first cut, and nothing here reopens it. What the plan
deliberately left out was reach. Its own words: "nothing is notified
because nothing is ever notified (`mentions.ts:1-9`), and presence plus the
amber dot in the tree is the notification"
([workspace-lifecycle](workspace-lifecycle.md)), with a promise attached:
"if the app ever grows an inbox, it reads these same conventions; nothing
here needs to change first." This plan is that inbox, and it holds the app
to the promise.

The gap, concretely, is three things a GitHub PR has and we do not:

- **Nobody is told.** The amber dot means "status is review"
  (`src/FileTree.tsx:838-846`), not "you were asked". The tinted mark on
  the comment that names you (`for-you`, `src/html-view.ts:165`) only
  appears once you have opened the file, so it can confirm a request but
  never deliver one. A reviewer who is not in the room, or is in another
  workspace, finds out when they happen to open the plan. The requester
  has no way to know whether that has happened.
- **Roles are half-drawn.** The owner is rendered as bare text with no
  face (`App.tsx:7671-7678`), while reviewers get faces and colours
  (`MatterPeople.tsx:52-60`), so the page head says who is reviewing more
  loudly than who wrote the thing. And a reviewer has exactly two states,
  asked and approved (`MatterPeople.tsx:42`, `:47`); "I left comments and
  am waiting on you" is a state a PR shows and this header cannot.
- **Acting on it is a palette trip.** Approve exists only as a palette
  command (`src/Palette.tsx:434-442`); the header shows the check but
  offers no button to earn it, though it already offers a button for the
  one transition the owner makes (`MatterPeople.tsx:69-79`). The split
  pane draws the reviewers and offers nothing at all
  (`src/SplitPane.tsx:421`).

The seed's second half, proposing changes to plans written by other people
and letting the author accept or reject them, is already designed:
[diffs-in-workspaces](diffs-in-worksapces.md) makes a suggestion a comment
with a diff in it, rendered as a card with Accept and Reject, and it is
`status: ready`. This plan does not redesign that. It makes the two flows
meet: a suggestion on your plan is one more thing that *needs you*, and it
should reach you the same way a review request does.

## What "notify" can mean here, and which one to build

The tempting answer is the PR one: an email. The server knows who everyone
is through Auth0 (`server/src/auth.js:1-11`) and logins are email-shaped,
so it *could*. But the server has no outbound mail anywhere today, and
adding a provider adds a secret, a sender domain, templates, unsubscribes
and a support surface, for a team of a handful. That is a lot of product to
buy before we know whether the in-app signal is enough. So email is an
open question, not a step.

The answer that fits the app's shape is to notice that the client already
*receives* the event. While signed in, the app holds a live room for every
workspace's tree (`openTree`, `App.tsx:3842-3860`), and whoever has a file
open copies its `status:` into that tree map on every change
(`App.tsx:3998-4008`, `wsTree.setStatus` at `src/workspace.ts:574-580`).
The server keeps the copy honest for files nobody has open
(`repairStatus`, `server/src/rooms.js:172-186`). So the moment Alice
requests Bob's review, Bob's client sees the tree entry change. It just
does not know what changed, because the tree carries one field
(`TreeValue`, `workspace.ts:470`; `entriesOf`, `rooms.js:58-64`).

**Widen the copy from a status to a head.** The tree entry carries the
handful of frontmatter keys the app reads about people, alongside
`status`: `owner`, `reviewers`, `approved`. Same source, same writer, same
repair. The client observer already has the whole markdown in hand
(`meta.get("markdown")`, `App.tsx:4004`) and parses the block with
`splitFrontmatter` and `matterValue`; it writes four values instead of one.
The server's `headStatus` (`rooms.js:43-54`) becomes `head(markdown)`
returning the same four, and `repairStatus` compares the object instead of
the string. This is not a new kind of data. It is the existing cache with
three more keys, and the frontmatter is still the truth.

From that copy, **"needs you" is a pure function of the trees and your
login**, computed on the client with nothing else fetched:

- you are in `reviewers:` and not in `approved:`, and the status is
  `review` — *asked to review*;
- you are `owner:` and every reviewer is in `approved:` and the status is
  still `review` — *ready to mark approved*, the offer the header already
  makes (`MatterPeople.tsx:69-79`), now visible before you open the file;
- you are `owner:` and the file holds an open suggestion — *a change
  awaits your decision*. This one needs the body, not the head; see below.

Reads use the same case-insensitive handle rules the header does
(`handleList`, `src/matter.ts:143-151`), so `@Bob`, `bob` and
`bob@example.com` resolve the way they do everywhere else.

**Then two surfaces read that function.** First, an in-app one that is
always there: a *For you* group at the top of the palette, one row per file
with the reason ("asked to review", "everyone approved", "1 suggestion"),
jumping to the file the way the thread list jumps to a card
(`Palette.tsx:448-457`). Second, a quiet count on the workspace's heading
in the tree, drawn only when it is non-zero, and a heavier row name for the
files inside it. Not a new pane, not an inbox panel: the tree is the board,
and this is one more thing it says. The palette row is what makes it fast
from anywhere; the count is what makes it visible without asking.

**And one that reaches you when the window is not in front.** The app is a
desktop program, and the platform has a notification centre. The tree diff
gives us the event: when a recomputation of *needs you* gains an entry that
the previous one lacked, post an OS notification naming the file and the
reason ("@alice asked you to review Rollout plan"). The first computation
after sign-in is the baseline and posts nothing, so a laptop opened after a
weekend shows a count, not a burst. Post only when the window is not
focused; in front of the app, the count and the tinted mark are enough and
a banner would be noise. None of the tauri plugins in the bundle do this
today (`src-tauri/Cargo.toml:17-18`, `:51-53`); `tauri-plugin-notification`
is the one to add, and it is the whole of the native change.

Why this and not a server-side push: the server would have to know who is
signed in where and keep a per-user cursor of what they have seen, which is
the "per-document workflow beside the document" the lifecycle plan refused
(its §"Everything is frontmatter and comments, still"). The client-side
diff needs no table, no read receipts and no new API, and it is correct by
construction: it fires when the file changes in a way that concerns you,
because the file is what it watches. Its one weakness is honest: nobody is
told while the app is closed. The count covers that on launch, and email is
the question below if the count proves not to be enough.

## The roles, drawn like a PR draws them

**The owner gets a face.** `owner:` is a login in a workspace, by the same
argument that made comment signatures logins
([improve-comment-system-in-workspaces](improve-comment-system-in-workspaces.md)),
and the scaffold writes it that way (`App.tsx:3014-3018`). So it resolves
against `profiles` exactly as a reviewer does (`MatterPeople.tsx:41`), and
should be drawn the same way: face, handle in their colour, and a title
that says "owner". Fold the owner into `MatterPeople` rather than leaving
it as the separate span at `App.tsx:7671-7678`, so the page head reads as
one sentence: who wrote it, who was asked, who has signed. The share page
keeps its bare `@owner` (`src/share/Page.tsx:269`); it has no member list
to resolve against, the unsigned-comment rule again.

**A reviewer has three states, and the third is derived.** Asked, and
approved, are in the head. *Commented* is a reviewer who has an open thread
in the document signed by them and has not approved. That is the lifecycle
contract read literally, "a reviewer's open thread is an unresolved point",
and it costs no new key: the threads are enumerable (`COMMENT`,
`html-view.ts:25`; `commentTurns`, `html-view.ts:98-110`) and the header
already has the document. Draw it as a small speech mark beside the handle,
the way GitHub draws the comment bubble beside a reviewer who requested
changes. We do not add a `changes-requested:` key, because a reviewer who
wants to block says so in a thread, and deleting the thread is resolving
it. A key would be a second place the same fact lives.

**Approve moves into the header.** When the signed-in login is in
`reviewers:` and not in `approved:`, the header shows *Approve* beside the
handles, the twin of *Mark approved* (`MatterPeople.tsx:69-79`) and wired
to the same `approve` callback the palette uses (`App.tsx:3057-3063`). The
split pane gets the same button, which means threading `onApprove` through
`SplitPane` the way `onSetStatus` is not yet threaded (`SplitPane.tsx:421`
passes only `matter`). The palette command stays; the header is where the
reviewer's eyes already are when they finish reading.

**Re-request is the owner's only reset.** Unchanged from the lifecycle
plan: an edit after approval does not stale approvals, and *Request review*
clears them (`App.tsx:3049`). A suggestion being accepted is an edit like
any other. If the owner wants a second look after taking a large
suggestion, they ask for one, and the asking is the notification.

## Suggestions on someone else's plan

The diffs plan settles how a change is proposed, by a person or an agent,
and how it is accepted: a `suggests:` block under the paragraph, a card
with a word diff, Accept and Reject through `htmlBridge.apply`
(diffs-in-worksapces §"Approach"). It also decides "no roles, no
owner-only accept": anyone in the room may accept or reject, as anyone may
delete a thread, because a gate is invisible to agents and copied-out
files. This plan agrees and does not add a gate.

What the seed is asking for is not a gate but a *route*: the author should
be the one who sees the suggestion and decides. That is an inbox concern,
and it is why suggestions belong in *needs you* for the owner. The head
copy cannot carry it, since a suggestion lives in the body. Two ways to
count them:

- **The client observer counts.** It already holds the markdown on every
  change (`App.tsx:4004`); counting `suggests:` blocks is one more regex
  over it, written into the tree entry as `asks: n`. Cheap, and correct
  whenever anyone has the file open.
- **The server repairs the count too**, for the file nobody has open after
  an agent wrote to it. That is exactly the case the diffs plan is built
  for, an agent proposing while the humans are away, so the server must do
  it or the count lies in the one case that matters. `rooms.js` already
  mirrors `matter.ts` for the head (`rooms.js:38-41`); it would mirror the
  suggestion grammar for the body. The grammar is the diffs plan's first
  open question, so this lands after that decision, not before.

So the dependency runs one way: the diffs plan decides the grammar and
ships the card; this plan makes the card's existence reach the owner. The
owner accepting is the card's Accept, nothing new.

## What deliberately does not change

- **No review object, no read receipts, no server inbox.** *Needs you* is
  computed from the tree copy on the client; what you have seen is not
  recorded anywhere. Opening the file is the only "read".
- **No gate.** A non-reviewer may still approve, a non-owner may still
  mark approved or accept a suggestion. The header *offers* the actions to
  the people they are for; it never refuses them to anyone else.
- **No new frontmatter keys.** `owner`, `reviewers`, `approved` already
  exist; the tree copy learns to carry them. `asks` is a count on the tree
  entry, never written into the file.
- **Repositories are unchanged.** There is no tree room and no member list
  for a repo file; the header keeps drawing handles as text there, as the
  e2e already asserts (`e2e/workspace.spec.ts:1019-1021`).

## Open questions

- ~~Email, eventually?~~ Decided: not in this cut. The client-side signal
  ships first; if reviews stall for people who are away from the app for
  days, an email on the `reviewers:` transition is the follow-up, with a
  provider and a per-login opt-out to go with it.
- ~~Mentions in the inbox.~~ Decided: out of the first cut. A comment
  that names you is the same body scan as a suggestion, but it needs the
  server to mirror the thread grammar as well, and the tinted mark already
  finds you once you open the file. Reviews and suggestions are the two
  reasons this cut counts.
- ~~Agents as reviewers.~~ Decided: nothing here. `reviewers: claude` draws
  as a plain handle with no face, the same as any login the member list
  cannot resolve, and whether a request should start the agent belongs
  with the factory.
- ~~Several owners.~~ Decided: allowed, by doing nothing. `handleList`
  reads `owner:` as a list, the head draws every handle it names, and every
  one of them gets the owner's reasons in *For you*.
- ~~Declining a review.~~ Decided: not worth the vocabulary yet. Editing
  `reviewers:` in the sheet is the decline; a *Decline* command can come
  when someone misses it.
- ~~Where the count lives.~~ Decided: the workspace heading in the tree,
  beside where the changed-file count already sits (`repo-count`,
  `src/FileTree.tsx`). The status bar is a second home if the tree is
  hidden often enough to want one.

## Next

- [ ] Widen the tree copy: `TreeValue` and `WorkspaceEntry` carry `owner`,
      `reviewers`, `approved` beside `status` (`src/workspace.ts:70-75`,
      `:470`); `wsTree.setStatus` becomes `setHead` (`workspace.ts:574-580`);
      the room observer writes all four (`src/App.tsx:3998-4008`)
- [ ] Server: `headStatus` becomes `head(markdown)` and `repairStatus`
      compares the object (`server/src/rooms.js:43-54`, `:172-186`);
      `entriesOf` passes the new fields through (`rooms.js:58-64`)
- [ ] `needsMe(trees, login)` as a pure function in `src/matter.ts` or a
      sibling, with unit tests over the three reasons and the handle
      spellings `handleList` accepts (`matter.ts:143-151`)
- [ ] Palette *For you* group, one row per file with its reason, jumping to
      the file (`src/Palette.tsx:448-457` is the pattern); a count on the
      workspace heading in the tree and a heavier row for the files
- [ ] OS notification on a gained *needs you* entry, baseline on sign-in,
      only while the window is unfocused: add `tauri-plugin-notification`
      to `src-tauri/Cargo.toml` and its capability
- [ ] Fold the owner into `MatterPeople` with a face and colour
      (`src/MatterPeople.tsx:32-82`, replacing `App.tsx:7671-7678`);
      derive the *commented* state from signed open threads
      (`html-view.ts:98-110`)
- [ ] *Approve* in the header for a reviewer who has not, wired to the
      existing callback (`App.tsx:3057-3063`); thread it into
      `SplitPane` (`src/SplitPane.tsx:421`)
- [ ] After the diffs plan lands its grammar: count open suggestions into
      the tree entry as `asks` from the client observer and the server
      repair, and add the owner's third reason to `needsMe`
- [ ] Tests: extend the review e2e (`e2e/workspace.spec.ts:963-1021`) so
      Bob's palette lists the plan under *For you* before he opens it and
      the workspace heading shows the count; a server test that
      `repairStatus` fills `reviewers` for a doc nobody has open; run with
      the batched suite at the end
