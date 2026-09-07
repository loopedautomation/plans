---
status: draft
---
# Workspace plan lifecycle

The ask is that plans in a workspace have lifecycles like plans in a repo —
frontmatter sets a status, the app renders it — and then a layer on top:
request reviews on parts of a document, name owners and reviewers, track who
is reviewing and where the review stands, maybe richer comments that stand
out in the margin.

The first half of that is already true, and it is worth saying precisely,
because the design of the second half falls out of *how* it is true. A
workspace document's `status:` travels in its frontmatter like any plan's;
the header badge reads it from the tree entry (`App.tsx:7232-7256`), the
tree draws the same tinted dot it draws for repo files because workspace
entries are shaped into the same `PlanFile` with `status` on board
(`App.tsx:6099-6112`, `FileTree.tsx:833-839`), and a `meta` observer on each
open room copies the frontmatter value into the shared tree map
(`App.tsx:3764-3782`, `wsTree.setStatus` at `workspace.ts:552-558`) so fifty
dots can be drawn without opening fifty rooms (`workspace.ts:65-68`). There
even *was* a review gate once, and it was removed on purpose: the app now
says in its own chrome that "`status:` in the file is what it used to say,
and it travels with the file wherever the file goes" (`App.tsx:7216-7220`).

So this plan is not "add lifecycle to workspaces". It is: extend the
file-is-the-product contract — the one [collaboration](collaboration.md)
established and [improve-comment-system-in-workspaces](improve-comment-system-in-workspaces.md)
defended — to cover *review*, without rebuilding the gate we deleted or
growing a server-side workflow database beside the document.

## Everything is frontmatter and comments, still

The temptation is a review object: a server table of requests, states,
approvers. We have been here twice and said no twice. Membership stayed one
table with no roles because "the app has exactly two kinds of person"
(manage-workspace-members.md); comments stayed lines in the markdown because
"Copy to repository" carries them verbatim and agents read the file, not our
database (`App.tsx:3979-3990`, and the whole argument in
improve-comment-system-in-workspaces.md §"What deliberately does not
change"). The `docs` table holds nothing but opaque Yjs state
(`server/src/schema.js:50-60`) — there is deliberately nowhere server-side
to hang per-document workflow, and adding somewhere would fork the plan into
"the text" and "the process around the text", where the second half is
invisible to every consumer that matters: the agent implementing the plan,
the copied-out repo file, the share page.

So the whole lifecycle is two conventional frontmatter keys plus the comment
format we already have:

```yaml
---
status: review
owner: ratulmaharaj
reviewers: mira, sam
---
```

- **`owner:`** already renders in the header, read-only, in both panes
  (`App.tsx:7319-7320`, `SplitPane.tsx:342`) and on the share page
  (`share/Page.tsx:110`). In a workspace it should be a *login*, for the
  same three reasons comment signatures became logins: it is the identity
  the server enforces, it is stable, and it fits the `@handle` shape. The
  scaffold already writes `owner` from git's author (`App.tsx:2857-2872`);
  in a workspace it should write `account.login` instead — the same
  derivation switch the comment author got.
- **`reviewers:`** is new, but only as vocabulary. `matterValue` parses any
  flat `key: value` line (`matter.ts:84-86`), and a comma list keeps us
  inside the no-YAML-library contract — no nesting, no sequences
  (`matter.ts:81`). Render it in the header beside the owner: each handle
  looked up against `profiles` (`workspace.ts:51-58`), drawn with the face
  and presence colour the comment cards already use
  (`html-view.ts:353-365`). A handle that isn't a member renders as text,
  the rule mentions already follow.
- **`status: review`** is just a word, and that is the point. `statusTone`
  gives tones to draft/ready/approved/busy/done (`matter.ts:121-128`) and
  the vocabulary is a setting (`settings.ts:260`); "review" slots in as a
  recognized tone — amber, say — and the palette grows one more
  `status.review` command for free, because commands are generated from the
  configured list (`Palette.tsx:399-403`).

**Requesting a review is then a gesture, not an object.** Set
`status: review`, put the reviewers in `reviewers:`, and — this is the part
that makes it a request rather than a label — the palette command *Request
review* does both and writes a comment at the top mentioning them:
`<!-- @ratulmaharaj: @mira @sam — ready for your eyes -->`. Mentions
autocomplete from the member list already (`mentions.ts:26`); nothing is
notified because nothing is ever notified (`mentions.ts:1-9`), and presence
plus the amber dot in the tree is the notification. Reviewing *a part* of
the document is what comments have always been: a `⌘⇧M` comment under the
paragraph in question, signed with your login. We do not need a new
"review comment"; we need review comments to be findable, which is the next
section.

**Tracking the review** is reading the file. Who was asked: `reviewers:`.
Where it stands: the comment threads — a reviewer's open thread is an
unresolved point, a deleted thread is a resolved one, exactly the contract
collaboration.md set ("resolving a thread is deleting the comment"). Signing
off is the one thing that deserves a line of its own: a reviewer runs
*Approve* in the palette, which appends their login to an `approved:` list
in the frontmatter — flat, comma-separated, same parser. When `approved:`
covers `reviewers:`, the header can quietly say so; whether the app then
*offers* `status: approved` (never applies it) is an open question below.
The audit log is the CRDT history and, after copy-out, git — we are not
building a second one.

## The margin, and orange

The draft asks whether review comments should be richer — orange instead of
grey, in the margin instead of inline. Split the two.

**Colour: yes, cheaply.** A comment card whose latest turn mentions *you*
(your login, `account.login`) is a card asking for your attention; tint its
mark. That is a render-side rule in `commentCard`
(`html-view.ts:103-160`) using context the card already has — `author` and
`profiles` are both on `htmlContext`. No format change, so the copied-out
file and the share page degrade to exactly today's rendering.

**The margin: not yet, maybe not ever.** Margin placement implies
range-anchoring — a comment *beside* line N has to know it belongs to line
N through everyone else's concurrent edits — and the previous plan already
weighed Yjs relative positions and concluded the anchor would have to live
outside the markdown, reopening the fork we keep closing
(improve-comment-system-in-workspaces.md §"Anchoring"). A comment that sits
as a line under its paragraph survives copy, publish, agent edits and
`git diff`. What the margin instinct is really asking for is *scannability*
— see all the open threads at once — and that is a cheaper feature: a
palette command or a small rail that lists the document's comment threads
(they are trivially enumerable, `COMMENT` at `html-view.ts:25`) and jumps to
each. An outline of the argument, not a redesign of where arguments live.

## One real gap: the dot can lie

The tree status is a copy maintained by whichever client has the file open
(`App.tsx:3764-3782`). Set `status: review` and close the app, and the copy
is fine — but a doc whose frontmatter is edited by an agent through the
scratch mirror (`workspace.ts:594`), or seeded before anyone opens it, shows
a stale dot until someone opens the room. For a lifecycle feature whose
whole signal is "the amber dots are what needs me", that staleness is not
cosmetic. The server can close it: it already knows how to read a doc's
markdown without a client (`rooms.js:148`, `markdownAt` at `rooms.js:161`),
so `tree(workspaceId)` (`rooms.js:128`) can verify-and-repair the status
copy for entries whose doc it has, the same head-only, cheap parse the Rust
side does for repos (`frontmatter_status`, `lib.rs:246`). The tree map stays
the cache; the frontmatter stays the truth.

## What deliberately does not change

- **No roles, no gate.** A reviewer is anyone named in `reviewers:`; the
  app never blocks an edit or a status change on approval state. We removed
  that gate (`App.tsx:7216-7220`) because a plan's readers include agents
  and repos that cannot see a gate — the file has to carry its own state.
- **No notifications.** Mentions still don't have an inbox
  (`mentions.ts:1-9`). If the app ever grows one, it reads these same
  conventions; nothing here needs to change first.
- **No schema.** `reviewers:` and `approved:` are conventions the app
  renders, like `status:` and `owner:` before them (`matter.ts:81`). A file
  without them is not broken; a file with extra keys is not wrong.

## Open questions

- **Does `approved:` auto-suggest `status: approved`?** When every reviewer
  has approved, the header could offer the transition one click away —
  offer, never apply, since an agent or a person may still be mid-edit.
  Leaning yes to the offer.
- **What resets `approved:`?** An edit after approval arguably stales the
  approvals, but detecting "meaningful edit" is a judgment call the app
  shouldn't make. Leaning: never auto-reset; *Request review* clears it,
  because re-requesting is the human saying "look again".
- **Comma list vs. repeated mentions.** `reviewers: mira, sam` parses with
  today's `matterValue`; `reviewers: @mira @sam` reads better and matches
  the comment format. Either way the parse is one split — pick one and
  render the other tolerantly?
- **Do repo plans get `reviewers:` rendering too?** The parser is shared,
  but a repo has no member list to resolve handles against — probably
  render as plain text there, the unsigned-comment rule again.
- **Does the share page show the review state?** It shows status and owner
  today (`share/Page.tsx:118-123`); adding reviewers is one more span, but
  a public page advertising who hasn't approved yet might be more social
  pressure than we want. Leaning owner-only until asked.

## Next

- [ ] Recognize `review` in `statusTone` (`matter.ts:121-128`) with its own
      tone, and add it to the default vocabulary (`settings.ts:260`)
- [ ] Workspace scaffold and `owner:` writing use `account.login` instead of
      git's author when the active buffer is a workspace doc
      (`App.tsx:2857-2872`)
- [ ] Parse and render `reviewers:` (and `approved:`) in both pane headers,
      resolving handles against `profiles` for face and colour
      (`App.tsx:7317-7331`, `SplitPane.tsx:340-343`)
- [ ] *Request review* palette command: set status, write `reviewers:`,
      insert the mentioning comment; *Approve* appends to `approved:`
- [ ] Tint the comment mark when the latest turn mentions the signed-in
      login (`html-view.ts:103-160`)
- [ ] A "threads in this document" jump list (palette first; a rail only if
      the list earns it)
- [ ] Server-side verify-and-repair of tree `status` in `tree(workspaceId)`
      (`rooms.js:128`, using `markdownAt` at `rooms.js:161`)
- [ ] Tests: an e2e where one account requests review, another approves, and
      the copied-to-repository file carries `reviewers:`/`approved:` and the
      threads verbatim (`e2e/workspace.spec.ts`); a server test for the tree
      status repair (`server/test/server.test.js`)
