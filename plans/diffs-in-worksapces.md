---
status: done
---
# Diffs In Workspaces

> In a workspace, an agent should be able to suggest diffs (that show in the
> inline wysiwyg editor) that we can approve / reject.
>
> Maybe we should have general suggested changes functionality that I can
> propose for others to accept as well.
>
> If these can just be written in markdown that might help a lot.

## Problem / context

The seed's third line is the design, and the other two follow from it. This
app has said the same thing three times now: everything collaborative lives
in the file and the app only renders it. Comments are HTML comments in the
markdown ([collaboration](collaboration.md)); they stayed that way in
workspaces because "Copy to repository" carries them verbatim and agents
read the file, not our database
([improve-comment-system-in-workspaces](improve-comment-system-in-workspaces.md));
review state is frontmatter and comments rather than a server table
([workspace-lifecycle](workspace-lifecycle.md)). A suggestion is one more
thing a person or an agent says *about* the document, so it goes where the
other things they say go: in the document, as markdown, rendered by the
editor into something you can act on.

What makes this worth building now is how an agent's edit reaches a
workspace document today. There is no proposal step anywhere in the path.
A repository file is written straight to disk (`client.rs:331-362`); a
workspace file goes through `from_room` (`client.rs:260-291`) to
`writeToRoom` (`App.tsx:6596-6645`), which **replaces the whole document**
through the visible editor or a headless ghost one. The only gate is the
protocol's per-tool-call permission (`client.rs:155-198`), which is coarse,
carries no content (`events.rs:18-25` extracts text only), and is the
agent's own question with the agent's own options, not the app's. So in a
room where three people are live, an agent asked to "tighten the second
section" rewrites the section under everyone's cursors, and the choice on
offer was "allow this write" before anyone could see what it would write.

A repository at least has a whole-file safety net: the stamp poll notices a
foreign write and, when the buffer is dirty, raises the conflict bar with
Keep mine / Take theirs / See the diff (`App.tsx:3462-3472`,
`App.tsx:7516-7546`). A workspace has none, because the room *is* the
truth (`workspace.ts:1-10`) and there is no "mine" to keep. That is the
gap: the workspace is exactly where a fine-grained accept/reject is most
needed and exactly where the coarse one cannot exist.

The rewrite feature deliberately declined this. Its plan says "not a
diff-review flow ... building an accept/reject overlay for rewrites would
duplicate" the Diff view ([select-text-rewrite-prompt](select-text-rewrite-prompt.md)),
and the code says the same: "Nothing splices text into the document behind
the save-and-watch machinery's back" (`App.tsx:2603-2612`). Both are right,
and neither is contradicted here. The Diff view compares HEAD to the buffer
(`DiffView.tsx:83-94`) and has no per-hunk apply; git has no hunk-level
stage or discard either (`lib.rs:1787` discards whole files). And this plan
splices nothing: the agent still just writes the file. It writes a
*proposal* into it instead of the result.

## Approach

**A suggestion is a comment with a diff in it.** The comment grammar
already carries a signed line and a body (`COMMENT`, `html-view.ts:25`;
thread turns at `html-view.ts:62`, `:87-97`). A suggestion is that block
with a body the app knows how to read: the text it wants gone, the text it
wants instead.

```markdown
The poll picks up a teammate's edits through the existing watcher.

<!-- @claude suggests:
- The poll picks up a teammate's edits through the existing watcher.
+ The stamp poll notices a teammate's write and reloads a clean buffer.
-->
```

The block sits under the paragraph it changes, like every comment does
(`htmlBridge.comment` places after the block, `Editor.tsx:465-479`), and it
quotes the old text in full. That is the rewrite plan's "quote, don't
point" rule applied to itself: a line number rots the moment anything above
it moves, but a verbatim quote self-locates, and if it no longer matches
anything the suggestion is *visibly* stale rather than silently wrong. The
target is found by walking back from the block to the nearest preceding
node whose text equals the `-` side; anchoring by proximity plus a quote is
what proximity alone was always one step short of.

Why this shape and not the two obvious alternatives:

- **`<ins>`/`<del>` tags** render as visible marks on GitHub, which sounds
  like a feature until a deletion of a markdown paragraph has to wrap
  markdown inside HTML, which GitHub does not render. In this app they are
  raw `html` atoms (`html-view.ts:1-13`), not in the paired-tag sets
  (`INLINE_TAGS`/`BLOCK_TAGS`, `html-view.ts:700-703`), so they would need
  new pairing logic *and* would make the document read as its
  pre-and-post text simultaneously to every consumer that does not
  understand them. An agent implementing the plan would read both
  versions.
- **CriticMarkup** (`{++ ++}`, `{-- --}`) is plain text to the parser.
  Nothing hides it, so every other viewer, and every agent, sees the
  markup as prose.

The comment form degrades to *invisible*: GitHub shows the current text,
the share page and any other markdown tool show the current text, an agent
reading the file sees the document as it stands plus a clearly-marked
proposal it can choose to honour. The document never lies about what it
currently says. That property is why comments won three times already, and
a suggestion needs it more than a comment does.

**Rendering is the pattern that already exists.** A multi-line comment is
gathered as a run, its source lines hidden, and a widget drawn in their
place (`commentRuns`, `html-view.ts:643-666`; decorations at `:781-808`).
`<picture>`, `<details>`, mermaid and alerts all take the same road
(`html-view.ts:668-689`, `:27-52`, `mermaid-view.ts`, `alert-view.ts`). A
suggestion card is one more widget over hidden source: the signer's face
and handle as the comment card draws them (`html-view.ts:130-243`), the
change shown as a word-level diff of old against new, and two buttons.
`@pierre/diffs` is already a dependency for the Diff view
(`DiffView.tsx:2-4`), so the word diff is a call, not a component. The
target paragraph itself is left untouched above the card; the card is what
shows the delta, which is what "shows in the inline wysiwyg editor" asks
for without turning the paragraph into a battlefield of marks while
someone else is typing in it.

**Accept and reject are the primitives we have.** `htmlBridge.apply`
replaces an arbitrary range with markdown (`Editor.tsx:437-447`), and the
reply field already drives it from inside a card's DOM
(`html-view.ts:186-190`). Accept is two applies in one transaction:
replace the target node's text with the `+` side, delete the suggestion
block. Reject is the second half alone. Both go through the editor, so in
a workspace they are ordinary Yjs edits that merge with everyone else's,
and in a repository they dirty the buffer and take the normal save path.
Resolution leaves no trace in the file, exactly as resolving a thread is
deleting it: the CRDT history and, after copy-out, git are the audit log
(workspace-lifecycle, "we are not building a second one").

When the `-` side matches no preceding node, the card says so, shows the
proposed text anyway, and offers only Reject and "Insert here" (apply the
`+` side at the block's own position). Stale is a state the card renders,
not an error the user has to diagnose in source.

**The agent produces one by writing the file, which it already does.**
No protocol change, no tool, no new event. `REWRITE_PROMPT`
(`agent.ts:59-64`) gets a sibling, `SUGGEST_PROMPT`, that tells the agent
to write the block under the passage instead of rewriting the passage, and
a "Suggest a rewrite…" item joins "Rewrite…" on the page menu
(`App.tsx:7939-7955`), with the same selection, flush and quote machinery
(`rewriteSelection`, `App.tsx:2619-2667`). An agent that wants to propose
unprompted can, because the format is documented text: the prompt templates
are visible in Settings precisely so the human can read what the agent is
told. The write lands through the same path it always did, and the watcher
or the room delivers it to every screen, where it renders as a card. In a
workspace the default for an agent's edits could even *be* suggestions;
that is an open question below, not a decision here.

**People propose the same way, for free.** Select a passage, right-click
"Suggest…", type the replacement into the `TextPrompt` the rename and
comment paths already use (`App.tsx:332-341` in the rewrite plan's account
of it), and the app writes the block signed with the workspace login or the
git name by the comment system's rule. Nothing about the format knows
whether an agent or a person wrote it. The seed's second line is not a
second feature.

**No roles, no owner-only accept.** Anyone in the room can accept or
reject, the way anyone can delete a thread. The lifecycle plan removed the
review gate on purpose because agents and copied-out files cannot see a
gate (`App.tsx:7216-7220`), and an accept gate would be the same mistake
one level down.

## Open questions

- **The exact grammar.** `- old` / `+ new` line prefixes read as a diff and
  survive multi-line text if every line is prefixed, but a paragraph that
  itself begins with `- ` (a list item) needs escaping or a different
  fence. Alternatives: `<<<` / `===` / `>>>` markers, or a two-part body
  split on a lone `---`. Whichever it is, it must be unambiguous against
  the thread grammar (`html-view.ts:62`) so an ordinary multi-turn comment
  never parses as a suggestion.
- **How exact is the match?** Whitespace and serialisation drift between
  the ProseMirror document and the markdown mean a byte-exact quote will
  sometimes miss its own paragraph. Normalise whitespace before comparing,
  probably; anything looser starts guessing.
- **One block or several?** A suggestion that spans three paragraphs is
  three targets. Simplest honest rule: one suggestion, one block; an agent
  that wants more writes more suggestions. Multi-block suggestions can come
  when someone asks for them.
- **Should an agent's workspace edits default to suggestions?** The
  whole-document `replaceAll` (`agents-in-workspaces`, "What landed") is
  the thing this plan is really answering. A per-workspace setting,
  "agents propose rather than edit", would route every agent write through
  suggestions. It is a large behaviour change and depends on the
  whole-document write learning to apply only the delta (that plan's own
  open question), otherwise adding one comment block still rewrites every
  paragraph under everyone's cursor.
- **Source view and share page.** In Source the block is raw text and that
  is fine. The share page uses the same editor pipeline
  (`share/Page.tsx:4-6`) and could render the card read-only with no
  buttons, or hide it like an unrendered comment. Leaning card-without-
  buttons: the proposal is part of the conversation the page exists to
  show.
- **Does the Diff view learn anything?** It could list open suggestions as
  hunks. It should not; it compares HEAD to the buffer and this is a
  different axis. A "suggestions in this document" jump list, the same
  shape the lifecycle plan wants for threads, is the scannability answer.

## Next

- [x] Decide the grammar (prefix lines vs. markers) and write it down in
      `html-view.ts` beside `COMMENT`, with a `suggestion(value)` parser
      that returns `{ who, old, new }` or null and never matches a plain
      thread
- [x] Target resolution: nearest preceding node whose normalised text
      equals `old`; a null target is the stale state
- [x] The suggestion card as a widget over the hidden run
      (`commentRuns` pattern, `html-view.ts:643-666`, `:781-808`): signer
      with face and colour, word diff via `@pierre/diffs`, Accept / Reject,
      and the stale variant with Insert here / Reject
- [x] Accept and reject through `htmlBridge.apply` (`Editor.tsx:437-447`)
      as one transaction; verify it merges cleanly in a room with a second
      client mid-edit
- [x] `SUGGEST_PROMPT` in `agent.ts` beside `REWRITE_PROMPT`, its setting
      and Settings textarea; "Suggest a rewrite…" on the page menu reusing
      `rewriteSelection`'s flush-and-quote path
- [x] "Suggest…" for people: selection → `TextPrompt` → block written after
      the selection's node, signed by the comment system's identity rule
- [x] Share page: render the card read-only, or decide to hide it
- [x] Tests: e2e in `e2e/workspace.spec.ts` where an agent's write lands as
      a card in the other client's editor and Accept replaces the paragraph
      there too; a repository e2e over the human "Suggest…" path and a stale
      suggestion; parser unit tests for the grammar against real threads.
      Run with the batched suite at the end

## What landed

The grammar is the marker form, not the `- `/`+ ` prefixes the seed sketched.
A signed head, the old side, a lone `---`, the new side, all inside one HTML
comment (`html-view.ts`, beside `COMMENT`). Prefixes lost on the open
question they raised themselves: the old side is the address, and a paragraph
that opens with `- ` cannot be prefixed without escaping — escape it and the
quote no longer matches the block it came from. The head is `@name suggests:`,
which `TURN` cannot read because it wants the colon against the handle, so a
thread never parses as a proposal and a proposal never parses as a thread.
`suggestion(value)` is strict in both directions: no head, no separator, two
separators, or an empty old side and it is the comment it always was.

- `suggestion` / `suggestionBlock` / `suggestionTarget` in `html-view.ts`.
  The target is the nearest block *before* the proposal whose whitespace-
  normalised text is the quote; blocks that contain the proposal are skipped,
  since a paragraph cannot be about itself and replacing that range would take
  the proposal with it.
- The card is drawn from both places a comment can arrive — the node view, for
  a block the app wrote as one node, and the widget over the gathered run, for
  one that came back from the file a line at a time. Signer with face and
  colour as the comment card draws them; word diff; Accept and Reject, or
  Insert here and Reject when the quote matches nothing. `htmlContext.readOnly`
  is new, and is what leaves the share page the card without its buttons.
- Accept and reject go through a new `htmlBridge.resolve`, not `apply`: the
  proposal's new side is markdown prose, and `apply` writes html nodes. It
  deletes the block and maps the target through that deletion, in one
  transaction. A one-textblock proposal replaces the target's inline content
  rather than the node, so a heading stays a heading.
- Positions are re-read at the moment a button is pressed, and the run finds
  itself in the live document by the widget's own position, which ProseMirror
  maps through every transaction. Not by its text: two proposals can say
  exactly the same thing, and matching on text would resolve the first
  wherever the second was pressed. Decorations are only rebuilt when the html
  in the document changes, so in a room a teammate typing above the card would
  otherwise have moved every position under it.
- `SUGGEST_PROMPT` beside `REWRITE_PROMPT`, `suggestPrompt` in settings and
  its textarea in Settings. `rewriteSelection` became `askAboutSelection`,
  which takes the kind: the flush, the quote and the line hint are one path
  because a suggestion is the same handoff asking for a proposal.
- "Suggest…" for people is on the page menu whenever there is a selection —
  no agent needed, and it works in memory. The quote is read from the editor
  (`htmlBridge.block`) rather than from the selection, because it has to match
  a whole node; so the box is prefilled with the paragraph as it stands and
  what you type is the new side. `htmlBridge.suggest` puts the block in *after*
  the enclosing block rather than at the cursor, so it never ends up inside the
  paragraph it quotes.

Two divergences worth naming. The word diff is `diffWords` from `diff`, an
existing dependency, rather than `@pierre/diffs`: that package renders file
diffs from two texts and has no word-level call to borrow, and a component
built for the Diff view's surface is not what a card inside the prose wants.
And the grammar tests are e2e rather than unit — the repository has no unit
runner, so `e2e/suggestion.spec.ts` puts a thread, a two-separator body, a
live proposal and a stale one in one document and asserts which of them draws
as what, which is the same question asked where it can be answered. A sixth
case puts two proposals that read the same, word for word, over two paragraphs
that also read the same, and presses the second: only the second paragraph may
move.

The open questions the plan left open stay open, unchanged: agents' workspace
edits do not default to suggestions, a suggestion is one block, and the Diff
view learned nothing.
