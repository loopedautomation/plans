# looped-plans

## 0.14.0

### Minor Changes

- 76b0311: The workspaces now tell you what is waiting on you. A review you were asked
  for, a plan of yours that everyone has approved, a suggestion someone left on
  it: each is a row at the top of the palette under _For you_, a count on the
  workspace's heading in the tree, and a heavier name on the file. All of it is
  read from the tree's copy of each file's head, which now carries `owner:`,
  `reviewers:`, `approved:` and the count of open suggestions beside `status:`,
  kept by whoever has the file open and repaired by the server for the files
  nobody has. Nothing records what you have seen; opening the file is the read.

  When the window is not in front, a gained entry posts a system notification
  naming the file and the reason. The first look after signing in is the
  baseline and posts nothing, so a laptop opened after a weekend shows a count
  rather than a burst.

  The page head reads as one sentence now: the owner with their face, then the
  reviewers, each asked, commented or approved. A reviewer who has left an open
  thread is drawn with a speech mark until they approve. Approve sits in the
  header beside the handles for a reviewer who has not yet, the twin of Mark
  approved. Requesting a review writes `owner:` into a file that never said
  whose it was.

- cfd5c0a: The phone's shell has two corners instead of a settings tab: your face at
  the top left opens a drawer with the account and Sign out, or the way in;
  Aa at the top right opens a sheet from the bottom with the paper, the type
  and the file toggles. A swipe in from the left edge goes back, as it does
  everywhere else on the phone. Two fingers zoom a diagram, and a zoomed
  diagram pans under one; at 1:1 a finger scrolls the page as before.
- 170fa38: The phone gets its settings: the paper, the reading face with its size,
  measure and leading, the code face and its size, and the file toggles. They
  are the same keys the desktop writes, applied the same way, so each device
  keeps its own settings file and a paper chosen on the phone is the phone's.
  The shell no longer zooms: the viewport forbids scaling and every field is
  set at the size iOS stops zooming for.
- d354896: The phone works in workspaces. The iOS and Android shell has two tabs now:
  Workspaces, where you sign in, open a workspace, browse its folder and edit
  a file live in the same editor as the desk, with comments, suggestion
  cards and everyone's cursors; and Computers, the SSH reader, which is how a
  repository an agent is working in gets read from a phone. The editor lets
  go of a workspace's room before it is destroyed, which closes a gap where
  a remote edit arriving during teardown threw from inside the collab plugin.
- 4051952: Browse a saved remote root over SSH from the desktop shelf or the new mobile
  shell. Connections pin the server host key, keep passwords and imported keys
  in the OS credential store, load folders lazily over SFTP, and render documents
  read-only.
- 015e2b9: Suggested changes, written into the file as a comment with a diff in it. An
  agent asked to "Suggest a rewrite…" writes a proposal under the passage rather
  than rewriting it, and it arrives on every screen as a card with the word diff
  and Accept / Reject on it — which matters most in a workspace, where the room
  is the truth and there is no "mine" to keep. People propose the same way, from
  "Suggest…" on the page menu. A proposal whose quote no longer matches anything
  says so and offers to insert itself instead. Accepting or rejecting is an
  ordinary edit, so it merges with everyone else's typing and leaves no trace in
  the file.
- cfd5c0a: A fourth paper, System, follows the device: night when it is in dark mode,
  day otherwise, and it switches when the device does. It is a setting like
  the other three, on the phone and on the desktop, and everything that reads
  the paper still sees day, sepia or night.

### Patch Changes

- 31f5e51: The design system has a page of its own at `/design/` on the site: the
  three papers switchable, every token with its value read from the live
  stylesheet and the rule that made it, the five reading faces and the mono
  voice, the ledger's parts drawn by the app's own components, and the
  editor rendering a document with a bit of everything in it. It is built
  from the same code as the app, so it cannot describe a button the app no
  longer has.
- b3ceb7e: An entity-relationship diagram's attribute rows no longer band white across
  the paper. Mermaid lightens the box colour by 75 for its odd rows when no
  row colour is given, which is white on every theme and glaring on night; the
  rows now alternate paper and shade, as the editor's tables do.
- 10c8ab3: The iOS app builds and installs on a phone. The deployment target rises to
  iOS 15, which is the floor current Xcode accepts; the mobile entry point sits
  on `run()` rather than on the dev-icon helper it had drifted onto; the three
  desktop-only commands that open Finder, the settings file or a terminal say
  so on a phone instead of failing to compile; and the iOS configuration names
  the signing team so automatic signing works.
- 96d2dce: The iOS app no longer aborts at launch when built with a current Xcode. UIKit
  now requires an app to adopt the scene lifecycle, and tao has a scene
  delegate ready for it; the app's Info.plist declares that delegate, which is
  what was missing.
- 0f623b4: The phone feels quicker and reads as one thing. Both tabs stay mounted, so
  switching keeps every room, list and scroll position; the workspace list
  paints from what was last seen before the server answers again; every
  workspace's folder is opened in the background as soon as the list arrives;
  and a document's room stays open behind Back, so the same file again costs
  nothing. The shell sets one type scale, a title, a body, a secondary line and
  the ledger's caps, and Sign out wears the app's own button.
- b3ceb7e: A person's colour — the face beside a file, the handle on a comment, the
  cursor in a shared document — is now one of the paper's six chart inks
  rather than a hue hashed from their login. The app's rule is that nothing
  chromatic is invented, and presence was the one place it was; the same
  person is the printer's blue on day and the lifted blue on night, and the
  letter in an avatar is drawn in the paper so it reads on both.
- 96d2dce: Five small things. A permission card whose title is a long command or path
  wraps instead of running out of the card. Accepting or rejecting a
  suggestion no longer scrolls the page to wherever the caret last was. The
  reply box on a comment shows its caret. A comment's marker wears the amber
  of a modified file, carries the faces of the people in the thread, and
  one that names you is filled with it. And a
  `suggest` skill spells out the suggestion form for an agent, in the
  palette, on install, and as `/suggest` in the chat; "Suggest a rewrite…"
  sends it along with the ask.
- dc5238b: A computer can be reached over Tailscale SSH. The connection sheet has a
  third authentication choice, None, for a server that accepts you on
  identity alone: nothing is typed and nothing is stored. A server in
  Tailscale's check mode answers with a link to confirm in a browser, and the
  sheet shows that link instead of calling the connection rejected.

  The connection sheet asks for a repository rather than a "remote root": the
  path of one git repository on that computer, which the app opens the way it
  opens a local one.

## 0.13.0

### Minor Changes

- 22964ac: The palette's `*` mode grows into the global search it was already halfway to
  being. It searches every open repository at once rather than only the active
  one — a hit is labelled with the repository it came from, and a chip in the
  footer narrows it back to this one when that is what you meant. Searching all
  files is the default, because a search that quietly means "these files" is the
  one that answers "no such thing" when it meant "not here".

  Results are grouped under the file they came from, and the budget is now spent
  fairly. A search used to have one cap of sixty lines for the whole thing, so a
  single hit-dense file could take all of it and every later file went unread —
  sixty lines from one file, presented as a search of the repository. Each file
  may now take five of that quota, and its heading says how many further matches
  it is holding back. Enter on a line opens there; Enter on a heading opens the
  file at its first hit; both arrive with the find bar already seeded.

  Beside the results there is now a preview: the raw lines around the highlighted
  hit, with the match marked, following the arrow keys as the selection moves —
  so a hit can be judged without opening it. It is plain text rather than a live
  editor on purpose, and it stands down on windows too narrow to hold it without
  crushing the list.

  ⌘⇧F opens the palette straight into the mode, alongside a "Search inside every
  file" command, and the scope is also a setting on the Settings page.

- 2cff909: The whole app can be worked without a mouse. The shortcut registry already
  covered nearly every _command_; what had no keys was **navigation** — moving
  focus between the surfaces those commands act on. Two behaviours now live once,
  in `src/focus.ts`, and every gap is a call site of one of them.

  Sheets no longer leak. Every scrim dialog — new file, rename, move, frontmatter,
  share, sign-in, the palette and the ⌘/ sheet — is a real `role="dialog"` with
  `aria-modal`, Tab is contained inside it, and closing puts focus back where it
  came from instead of dropping it on `<body>`. That last half is the one that
  compounds: a sheet opened while you were writing returns you to the document,
  writing.

  **The file tree is now one Tab stop, not one per row.** Tab used to walk every
  row in the tree, which in a real repository is punishment rather than
  navigation. The tree is a `role="tree"` with a roving cursor: one Tab stop, ↑/↓
  to move, ← and → to close and open a folder (and to step in and out of one),
  Home and End for the ends, Enter to open. This is the standard pattern and the
  better one, but it is a change you will feel.

  Both tab strips honour the `role="tablist"` they already declared: ←/→ move
  along the strip and select as they go, and ⌘←/⌘→ reorders a focused tab — the
  drag, one step at a time, and the first keyboard route to reordering at all.

  Context menus exist for the keyboard. Shift+F10 or the menu key on a focused
  tree row or tab opens the same menu right-click opens, focus moves into it,
  arrows walk it, and Escape hands the row back. Rename, Move, Open to the side,
  Delete folder and Open in Terminal were mouse-only before.

  ⌘B now goes to the tree as well as opening it, and two new commands say it
  outright: ⌘K ⌘E focuses the file tree, ⌘K ⌘T the tab strip. The pane and tree
  dividers, which announced themselves as separators a screen reader could not
  move, answer to arrows. The palette and the chat panel's slash list carry
  `aria-activedescendant` and proper option roles, so arrowing through them
  announces something.

  Escape is untouched. Its five-rung ladder stays exactly where it was: the trap
  owns Tab and nothing else.

- 5157f8b: A workspace's members can be managed. The page head's Invite button is
  Members now, and opens a sheet listing everyone in the room — face, name
  and login, the owner marked, and who is in the workspace right now — with
  the invite field in its foot. Any member may invite; only the owner may
  remove someone, and a removed member is cut off at once rather than at
  their next reconnect: their open editors close, the shelf leaves their
  sidebar, and a line says why. The owner may also hand the workspace to
  another member, after which they are an ordinary member and may leave.
  Behind it, one route serves both ways out — `DELETE
/workspaces/{id}/members/{login}` is a leave for your own login and a
  removal for anyone else's — and a removed member's read tokens go with
  them; share links stay the workspace's.

### Patch Changes

- 849dd01: A shared page has an Aa button at the head's leading edge, as the app does,
  holding what a reader can want to change: the paper, the reading face, the
  size and the measure. The paper switch that stood in the head has moved in
  there. The choices are kept in that browser.
- 52417bf: The Claude agent adapter is pinned to 0.75.1, whose bundled Claude Code is
  one the current models accept. An older adapter answers every prompt with
  "Claude Code 2.1.232 does not support this model".
- 5157f8b: An agent's edit to a workspace file that never came through the app — a
  `sed -i` in its shell, a heredoc, an agent whose adapter writes straight to
  disk — used to land in the scratch folder and nowhere else: not in anyone's
  editor, and gone on the next rewrite of the folder. The folder now remembers
  what it put on disk, notices a file that no longer reads as that, and the app
  turns the change into an edit of the shared document the moment the tool call
  finishes — the same way a write through the client lands. A file the agent
  makes on disk is added to the workspace the same way. The folder itself has
  moved out of the cache directory to `~/plans/workspaces/<id>` (the same path
  under the home folder on Windows and Linux), where a person can find it and a
  disk cleaner will not empty it under a running agent.
- 52417bf: GitHub-flavoured alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`,
  `[!CAUTION]`) now render as coloured callouts with the label worn as a badge,
  in the editor and on a shared page. The markdown is untouched: the label
  stays in the file, so anywhere else still reads it as a quote.
- 52417bf: Workspaces in the sidebar can be arranged: drag a heading among the other
  workspaces, or use Move up and Move down on its menu, and the order is kept
  in `settings.json` as `workspaceOrder`. A workspace you have not placed goes
  after the ones you have. The heading's menu also opens the workspace's
  members, which used to be reachable only from a file open in it.
- 52417bf: Mermaid charts take their series colours from the paper: an xy chart's bars
  and lines and a pie's slices use the same blue, green, plum, amber, red and
  slate as the rest of the app, in each theme, in place of mermaid's pale
  orange and rainbow. Axis lines and labels follow the paper's ink and rules.
- 52417bf: The conversation list opens from the end of its button rather than its
  start, so it no longer runs off the right edge of the window.
- 5157f8b: In the chat, a run of tool calls and thoughts is drawn as one line that keeps
  updating — the step happening now and how many so far — and opens to the list;
  it is closed by default. A message typed while the agent is still working is
  shown in the transcript where it will go, marked as queued, and becomes the
  sent message when the turn ends, rather than a note saying something was
  queued somewhere.
- 52417bf: An agent in a workspace now has the conventions. Its scratch folder had none
  — a repository gets them from a button in Settings, and a workspace's folder
  is nobody's to press a button for — so every document it wrote there was
  written as if there were no rules. The folder gets the skills the first time
  it is made, and the sweep that keeps it honest leaves them alone. For Claude
  Code the install also writes a short section into `CLAUDE.md`, which it reads
  on every turn, saying which skill to open before which kind of work: a skill
  under `.claude/skills/` is offered, not applied, and the writing rules were
  being offered to a model that did not think to take them. A repository that
  already has the conventions will show an update in Settings for this.
- 0d73195: "Copy to a repo" moved from the page head to the workspace file's right-click
  menu in the tree, beside Move to…, since it acts on the file rather than the
  page.
- 5157f8b: The palette's "Copy the agent command" is "Copy the agent planning prompt",
  which is what it copies: the shell line that starts an agent on this plan.
- 52417bf: A `<details>` section folds. The parser had been splitting the tag from what
  it wrapped, so the summary stood alone and the body was always shown; the
  opener is now a head that folds and unfolds the blocks up to `</details>`,
  with `open` deciding the first state. The file is not changed.
- A diagram's source folds again after editing it. The caret was still in the
  fence, and the rule that keeps a fence being typed from vanishing was
  refusing the fold; the button now moves the caret out first.
- 52417bf: A mermaid fence is folded under its diagram. The picture is what a reader
  wants; the source unfolds while the caret is in it, or from the figure's
  `</>` button, and folds again when the caret leaves.
- 52417bf: A `diff` fence in an agent's answer is drawn as a diff: added and removed
  rows tinted and signed in a gutter, hunk headers set apart, rather than a
  plain block of code with `+` and `-` in the text.
- 1b53c43: A document can be moved from one workspace to another, from Move… on its
  row — where the other workspaces and their folders are now in the list —
  or by dragging it onto another workspace's heading or folder. A room
  belongs to the workspace whose tree names it, so what travels is the text:
  the file is made anew in the other workspace with the same markdown, the
  old tree stops naming it, and an open tab follows.
- 5157f8b: A comment signed with an email renders as a comment again. A workspace login
  is an email, and the card's `@handle:` grammar stopped at the second `@`, so
  `<!-- @ratul@example.com: … -->` was not read as a turn at all: the raw line
  showed, unsigned, and no member was looked up for a face. Handles may now be
  emails, the card draws the part before the `@` with the full login on hover,
  and typing `@` completes to an email too. A new setting, "Workspace comments
  sign as", signs a workspace comment with git's name instead of the account
  for anyone who wants a room's comments to read like a repository's.
- ⌘F scrolls the page to the match. ProseMirror scrolls by walking up from the
  selection's DOM node, which while the find bar has focus is the bar's input,
  outside the editor — so a match below the fold stayed below it. The page now
  scrolls from the match's own element.
- Which folders are open in the tree is remembered across launches, for
  repositories and workspaces alike.
- 52417bf: A footnote's definition is one line at the foot of the page, number beside
  text, rather than the number on a line of its own. An open collapsible
  section no longer has a blank line between its head and its body.
- 5157f8b: "Hand off to agent" starts a chat of its own. The seeded instruction used to
  land in whichever conversation was on screen — on top of a discussion about
  something else, or into a turn still running — so a handoff now opens a new
  conversation, unless the current one has nothing in it yet, in which case it
  is used as it is.
- 3d45d8d: New workspace, document and page ids are lowercase letters and digits with
  the look-alikes taken out — no `0`/`o`, `1`/`l`, `-` or `_` — so an address
  can be read aloud or pasted into a chat whole. Older ids keep working. The
  share sheet now also gives the page's markdown address, `…/{id}.md`, and a
  "Copy for an agent" button: the same plan as a file, for something that
  reads files rather than pages.
- 5157f8b: Signing in to workspaces no longer fails with "Platform secure storage
  failure: User interaction is not allowed" on a Mac whose login keychain is
  locked or on an old password. A keychain that refuses to answer is treated
  the way a missing one is on Linux: the token goes to a 0600 file under the
  app's config directory instead, and the log says so once.
- 52417bf: A streamed answer no longer arrives with every chunk repeated. Tauri's
  unlisten throws when it runs before the webview has recorded the listener,
  leaving the Rust half registered, so a panel that re-subscribed soon after
  mounting — a workspace chat, whose folder arrives a beat later — heard every
  event once per leaked subscription. A removed listener now drops whatever
  still reaches it, and the unlisten is retried.
- 52417bf: A `$$` maths block opens as its rendered preview, the way a mermaid fence
  opens as its diagram, with the source behind the block's Edit button. KaTeX's
  stylesheet is now loaded, so the maths no longer shows twice as raw text.
- 52417bf: A workspace file's frontmatter now sits behind the Frontmatter button, as a
  repository file's does: the block is hidden from the page, the status, owner
  and due chips read from it, and an edit in the sheet or the status picker
  goes into the shared document for everyone. The Members button has left the
  file header; Members is on the workspace's heading in the tree.
- 69c3f54: A shared plan's link unfurls. The reader's shell now carries the page's
  title, opening line, status and owner as Open Graph tags, and a card drawn
  from the same facts at `/api/pages/{id}/og.png` — satori and resvg, no
  browser on the server. A folder page unfurls as its landing file; a dead id
  serves the same bare shell as before, so nothing is learned by probing.
- 5e52134: A mermaid diagram that fails to parse says so in its own figure only.
  Mermaid had also been appending a full-size "Syntax error in text" picture
  to the page, which landed under the status bar.
- 64acf06: A workspace plan's review lives in its frontmatter. _Request review_ in the
  palette sets `status: review`, names the reviewers in `reviewers:` and
  leaves a comment at the top asking them; _Approve_ adds you to `approved:`,
  and when everyone asked has, the header offers `status: approved`. Reviewers
  are drawn in the header with their faces; a comment thread whose latest turn
  names you wears an amber mark; the palette lists the document's threads to
  jump to. The tree's status dot is now verified against the file by the
  server, so a status an agent wrote is seen without anyone opening the file.
- 2f416fc: A workspace folder — or the whole workspace — can be shared as one page.
  "Share this folder…" on a folder's menu and "Share this workspace…" on the
  workspace's heading publish everything under it at one address, with the
  files listed beside the text and a relative link between two of them a link
  that works. One address, one Stop; a file added to the folder later is on
  the page at the reader's next look. A file inside a shared folder is offered
  the folder's address rather than a second id.
- 5157f8b: Tables in a document have rules, padding and a head again, in the editor and
  on a shared page — the editor's table styles were never loaded, so a table was
  bare cells run together. A table is sized to fit the page first, with the
  text in its cells wrapping, and only one whose columns cannot shrink any
  further scrolls inside its own block — never the whole page sideways, which
  is what made one unreadable on a phone.
- 620bd64: The repository picker in the status bar names the workspace you are in,
  lists workspaces beside repositories, and carries the workspace's Members
  and Share actions; it used to show "—" for a workspace document.

## 0.12.0

### Minor Changes

- The Linux AppImage works on rolling distributions. It carried the build
  host's `libwayland`, which an up-to-date Mesa will not accept: the window
  opened and the webview never painted, with
  `Could not create default EGL display: EGL_BAD_PARAMETER` on stderr, and none
  of the documented WebKitGTK variables made any difference because the fault
  was the bundled library rather than the renderer. The release now strips it
  and signs the result, so the app links the system's own — which is what every
  other GTK application on the machine already does. The Arch package template
  installs the `.deb` payload for the same reason.

- 5968dc9: Linux and Windows lose the desktop's titlebar. macOS has drawn its own chrome
  from the start — `titleBarStyle: "Overlay"` hides the bar and leaves the traffic
  lights sitting over the rail — while GTK and Win32 each stacked a second
  titlebar above it, in the desktop's colours rather than the app's. The frame is
  now off on all three: minimise, maximise and close are drawn at the right end of
  the rail, where those two desktops put them, and the rail still drags the window
  by its own chrome. The rail's left inset went with it — the 82px existed only to
  clear the traffic lights, so the Files button now starts flush with the window
  edge everywhere but a Mac.

  The app also survives being tiled. Its stated `minWidth` is 900, but a tiling
  window manager does not ask: it hands the window half a screen and the app has
  to cope. It did not — the grid's implicit column sized itself to the rail's
  min-content, about 700px, so every narrower window had the whole app hanging off
  the right edge with the document clipped mid-word and the centred wordmark
  printing straight through the view switch. The column is stated now, the rail's
  parts give way in order, and the wordmark stands down before it can collide.
  Down to a half-screen the layout holds; the window buttons are the one thing
  that never yields.

  On Linux the window's minimum size is dropped once the window exists. A
  minimum is a hint a tiling window manager is free to ignore — and when it does,
  GTK holds the surface at that minimum anyway, so the page was laid out 900px
  wide and the compositor squeezed the result into the width it had actually been
  given. Half a screen came out horizontally compressed, which is what the
  squashed text on a tiled desktop was. The layout narrows honestly now.

  Fixed with it: the file tree stopped overlaying at narrow widths, because a
  bare `.files { position: relative }` sat after the media query that makes it
  overlay — same specificity, later in the file, so it won. The tree was
  stacking above the page instead of floating over it.

  Shortcuts are spelled in the local idiom everywhere, not only in the shortcut
  sheet. The empty page, the status bar, the settings hints, the palette and the
  tooltips all had ⌘ written into them by hand, so Linux and Windows were told to
  press a key their keyboards do not have. They render through the keymap now, and
  `Enter` has a glyph so ⌘⏎ still reads as ⌘⏎ on a Mac.

  Minimise and maximise are only drawn where they do something. A tiling
  compositor places windows itself — Hyprland has no concept of a minimised
  window, and answers a maximise request by ignoring it — so both buttons
  succeeded and nothing happened. The shell is asked which desktop this is, and
  where the answer is a tiling one the rail draws close alone. Floating desktops
  keep all three, which matters more now that there is no system titlebar to fall
  back on.

  And a window dragged too small says so rather than drawing a broken page. The
  rail is the narrowest thing in the app that cannot wrap and it gives out around
  520px; below that, or below a height with too little page left to read, a panel
  covers the app with the two numbers and what they need to be. It covers rather
  than replaces, so nothing unmounts and no edit is lost on the way past the
  threshold, and it keeps the drag region and the close button — on a frameless
  window, a too-small screen without them is a trap.

  The app stops asking for updates it cannot take. Tauri's updater on Linux
  knows how to replace an AppImage and nothing else, and it finds the file
  through `APPIMAGE`, which only the AppImage runtime sets — so a copy installed
  from the `.deb` or the AUR package was checking a feed it could never act on,
  and would have failed against a root-owned `/usr/bin/plans` if it had tried.
  Those installs skip the check, and say why when the reader presses the button
  rather than going quiet.

## 0.11.0

### Minor Changes

- 96ab088: The agent chat is back in a workspace. Each workspace gets a scratch folder
  under the app's cache directory, written from the shared documents and kept
  current as people type, and the agent is started there. Its reads and writes
  under that folder are answered by the app from the shared document rather
  than the disk: a read is what was typed a moment ago, and a write lands in
  everyone's editor - through the one on screen, or through an editor nobody
  sees for a file nobody has open. A file the agent writes that the workspace
  does not have yet is created in the tree, folders and all.
- 8006793: Looped Plans builds for Linux. The release carries an x86_64 AppImage and a
  `.deb` beside the macOS and Windows bundles, from the same tag and with the
  same update feed, so an installed AppImage updates itself the way a Mac copy
  does. It was aimed at Arch under Hyprland: on Wayland with the NVIDIA driver
  the app turns WebKitGTK's DMA-BUF renderer off before the window opens
  (`PLANS_WEBKIT_SAFE=1` forces it), the workspace sign-in falls back to a
  0600 file when there is no keyring daemon to hold it, "Open in terminal"
  honours `$TERMINAL` and knows ghostty, alacritty, kitty, foot and wezterm,
  the `plans` command installs to `~/.local/bin`, and the monospace stacks
  carry JetBrains Mono and DejaVu Sans Mono. An AUR `PKGBUILD` template lives
  under `packaging/aur/`. Flatpak, Snap and ARM are not in this release.
- 631f649: Looped Plans builds for Windows. The release carries an x64 installer beside
  the macOS one, from the same tag and with the same update feed, so a Windows
  copy updates the way a Mac one does. On Windows the agents resolve through
  PATHEXT the way the shell would, git and npm run without a console window
  flashing, "Open in terminal" opens Windows Terminal where it is installed,
  and shortcuts are spelled Ctrl+Shift+O rather than ⌘⇧O. The `plans` command
  line and tmux sessions stay macOS-only for now, and the installer is not yet
  code-signed, so SmartScreen asks once. Repositories under WSL (`\\wsl$\...`)
  are not supported in this release.

### Patch Changes

- 118e80d: A round of fixes: the repositories you open are kept in `settings.json`, so
  the installed app and one run from source show the same list; Source edits a
  workspace file, through the shared document; a repository file dropped on a
  workspace becomes a shared copy of it; the Git button and panel stay out of
  a workspace; a diff no longer adds a third button to the view switch; the
  faces sit beside the file's name; and the agent adapter is pinned to a
  version that knows this month's models.
- 3452689: The model picker says which model an alias means today — "Fable 5.1", not
  "Fable" — so the day an alias moves to a new model, it shows. The agent
  accepts only the aliases it lists, so exact ids are not a choice the app can
  send; naming the resolution is the honest version of pinning.
- 64ca83f: A new chat shows the model and effort pickers before it has said anything,
  drawn from what the agent advertised last time, and a choice made there is
  the one its session starts with — the first message goes to the model you
  picked, not to the default and then to yours.
- d4a5563: A comment in a workspace is signed with your account's login, the handle
  the server knows you by, and the card draws each turn with the face and
  colour that person's cursor wears. Typing `@` in the comment or reply field
  completes to a member. A repository file keeps signing with git's name, and
  the new-comment prompt says which of the two will sign. On a shared page the
  handles keep their colours and there are no faces, since the page never
  carries the member list.

## 0.10.0

### Minor Changes

- c24c3fd: Share any plan as a public page. "Share…" is now in every file's page head,
  not just a workspace's: it publishes the plan to `plans.looped.sh/{id}` and
  puts the address on the clipboard. A file in a repository republishes on
  every save while sharing is on, so the page follows its author; a workspace
  document's page reads the room, so it follows the argument. A shared plan
  shows "Shared" in the page head, and the way to stop is behind it — stopping
  kills that address for good. The id is the whole of the secret: no session,
  no fragment, no token, and the page is not indexed.

  The page is the app's own renderer, built as a second Vite entry
  (`pnpm build:share`) and served by the workspace server, so mermaid, tables,
  code, the frontmatter chip and the theme are the same ones the editor draws —
  there is no second renderer to drift. Links minted before this land on their
  document's page instead of the old viewer, which is gone. Everything the app
  asks the server for moved under `/api` to leave the root to the reader; the
  old addresses still answer, so a build already on your machine keeps working.

- 0d3f4eb: A workspace is a folder of files, not one document. It joins the file tree as
  a heading of its own, with its folders and files under it, and takes the same
  gestures a repository does: new file, new folder, rename, move, delete —
  each one a transaction on a shared tree, so everyone in the workspace sees it
  land at once and two people acting together merge rather than fight. A rename
  carries the document with it, so whoever is mid-sentence in a file stays
  mid-sentence in it. What is disk-only goes dark for a workspace: no git marks,
  no Reveal in Finder, no terminal, no path to copy.

  The read endpoint and share links reach files rather than workspaces:
  `GET /w/{id}/` lists the folder, `GET /w/{id}/{path}` answers with one file,
  and a share link names the file it opens — the viewer draws mermaid fences as
  diagrams now, too. `plan.md` keeps answering everywhere it used to, and a
  workspace made before this keeps its document under that name.

  The review gate is retired. `status:` in the file's own frontmatter and
  `approved` as a human's word say what the gate said, and they travel with the
  file into the repository instead of staying behind on a server; the page head
  shows the file's status badge, as it does for any other file. Copying a plan
  out to a repository revokes the workspace's share links, since the document
  they point at is a file with a repository's own rules now.

### Patch Changes

- 932b6c7: Faces: your picture beside your name when signed in, and everyone else's
  beside the workspace files they have open and at the top of the one you are
  in, drawn from the same presence that draws their cursors. A workspace file
  gains a read-only Source view. The public page gets the app's three papers
  as a switch, kept in the reader's browser.
- 4d4368d: A workspace can be left, or deleted by whoever made it, from its heading's
  menu in the tree. Deleting closes it for everyone in it and kills its pages.
  Your profile now sits at the foot of the sidebar, with sign-out beside it,
  rather than in the rail.

## 0.9.0

### Minor Changes

- cbbd7bf: The agent in the chat can change any setting. A new bundled skill tells it
  where `settings.json` lives on each platform, to read the generated schema
  before writing rather than guessing keys, and the etiquette of writing the
  file back: one write, keep `$schema`, keep the keys this build does not know,
  leave the app-managed ones alone. It installs with the other skills. The
  settings poll no longer shares `watchSeconds` with the document watcher, so
  someone who has turned repository watching off still sees the change land -
  that knob was the one way the settings file could wedge itself shut.
- 6ae296c: Workspaces: a room where a plan gets argued before it is a file. Sign in
  from the rail, make a workspace, invite people by email, and edit one
  markdown document together with everyone's cursor in it. Request a review
  when it settles; someone other than you approves it, which the server
  enforces. "Copy to repository…" then writes the document into a repository
  as an ordinary file, stamped `status: ready` and `approved-by:` when it was
  approved, and everything downstream — agents, the factory, git — works as it
  always has. The workspace server ships in this repository under `server/`:
  one Node process on Postgres, as a container with its secrets from Infisical;
  the app keeps its session in the OS keychain, never in `settings.json`.
- e38e198: The app is called Looped Plans. The wordmark in the rail, the window title and
  the bundle's product name, the update banner and the "you are on the latest
  version" notice, the settings hints, the dialog titles, the release-notes
  heading, the README and the site all say the new name; the generated settings
  schema says it too. The package is now `looped-plans`, so a changeset names it
  that from here on.

  What deliberately did not move: the bundle identifier and the updater endpoint,
  which are how an installed copy finds its own updates, and the `plans` command
  on your PATH. The macOS bundle is now `Looped Plans.app` — the installed shim
  carries the app's name in its comment, so an existing one reads as stale and
  Settings offers "Update" rather than claiming nothing is installed.

- bf7dcb9: Share a workspace document with a link. "Share…" in a workspace's page head —
  or "Copy share link" in the palette — mints a link anyone can open in a
  browser with no account, no app and no clone: the document at reading width,
  read-only and live, with the workspace name and its status and review chips,
  and a print stylesheet so ⌘P is the export button. The secret rides in the
  URL's fragment, which browsers never send, so the server's log and any link
  unfurler see an empty `/share` page and nothing of the document, and the page
  carries the review state but never the member list. Each link is its own
  token: the same sheet lists the live ones and revokes them one at a time, and
  revoking one breaks neither the others nor the read token the factory holds. A
  link also expires thirty days after minting — revocation answers the leaked
  link, expiry answers the forgotten one — and expired, revoked and never-minted
  all read alike. The app also now points at the workspace server's `looped.sh`
  address by default, so links are minted from the right place.

### Patch Changes

- e1c76de: `pnpm dev` is the app; `pnpm web` is the web half alone, for a browser. A
  committed `.env` gives local builds the workspace server's address, so the
  app run from source has workspaces too.
- 5d7648a: More of the ⌘K family, for what the palette had and the keyboard did not:
  ⌘K P finished plans, ⌘K I gitignored files, ⌘K F frontmatter, ⌘K M move
  this file, ⌘K R reload from disk, ⌘K N new chat, ⌘K S swap the panes; and
  ⌘⇧N for a new folder.
- 66978c5: The "All files" setting is "Show all files", which is also what you type to
  find it, and ⌘K A toggles it.

## 0.8.0

### Minor Changes

- 97468fd: Questions the agent asks are now clickable. The app tells the agent it can
  render forms, so Claude's AskUserQuestion arrives as a question card in the
  transcript: the suggested answers stack one under the other as little bubbles,
  descriptions and all (with a single choice, the click is the answer), every
  question carries the tool's own "type your own answer" box, and
  Skip tells the model you moved past it rather than killing the turn. Without
  this the adapter disallowed the tool entirely and the model could only ask in
  prose you had to answer by hand.
- 74d5342: A new file is whatever you say it is. There used to be exactly one shape — a
  title, `status:` frontmatter, a heading — and it was built in Rust, so adding
  a daily note meant changing the backend.

  The shape now comes from a template, and a template is a markdown file: its
  frontmatter is its configuration, its body is the body of the file it stamps
  out. They live in `~/.plans/templates/`, beside the skills, with the ownership
  the other way round — the skills are the app's and are rewritten on every
  launch; the templates are yours, seeded once and only read after that, so
  editing or deleting one sticks.

  Two ship: `plan.md`, which writes exactly what ⌘N always wrote, and
  `daily-note.md`, a blank file named for today. A template says what it is
  called (`name`), what its file is called (`fileName`, with `{slug}`,
  `{title}` and `{date:yyyy-MM-dd}` in it), and what frontmatter the new file
  starts with (`frontmatter:`, where `{firstStatus}` is the first word of your
  status vocabulary). A pattern that never mentions the title needs no title, so
  "New: Daily Note" is one keystroke and no sheet — and asking for today's note
  when today's note is already there opens it rather than refusing.

  The palette carries one "New: …" command per template, ⌘N stays bound to the
  first, and the tree's "New file here" opens into the list when there is more
  than one. Settings names the folder and opens it; the configuration is in the
  files, not in `settings.json`.

  Underneath, `create_plan` is now `create_file`: it refuses to overwrite and
  writes the bytes it is handed, and knows nothing about what a plan looks like.

### Patch Changes

- ba70109: "Show all files" shows all folders too. The tree is built from the files a
  walk returns, so a folder with nothing in it never appeared; in all-files
  mode the app now asks the disk for the folders as well, on the same walk and
  skip rules, and merges them in. Markdown mode keeps the tree to what has
  files, as before.
- ba70109: `approved` is a recognised plan status. It gets a colour of its own in the
  tree and the frontmatter panel, sits between `ready` and `busy` in the
  default status vocabulary (an edited list is left alone), and the plans skill
  tells agents the word belongs to the human: it is their sign-off, and an
  agent treats an approved plan the way it treats a ready one.
- ba70109: The chat title truncates instead of running under the Rename button. The
  conversation picker's trigger had a fixed 220px cap, wider than a narrow
  panel's header could give it; it is now also capped by the room that is
  actually there. This pass also repaired a duplicated block in the stylesheet
  that had swallowed the rule dimming file locations on tool lines.
- ba70109: The up arrow in an empty composer walks back through the messages you sent in
  this conversation, the way a shell does; down walks forward and lands on
  whatever you had typed before you started browsing. The arrows only enter
  history from the edges of the text, so they still move the caret in a
  multi-line message being written.
- ba70109: "Copy path" in the tree's right-click menu copies the absolute path. The
  repo-relative path it used to copy could not be pasted into a terminal,
  another app, or an agent prompt without first working out where the
  repository lives.
- ba70109: Dropdown menus are no longer cut off inside sheets. The menu used to render
  inside the sheet, whose `overflow: hidden` clipped it at the edge; it now
  renders in a portal at the trigger's measured position, so the folder picker
  in the new-file sheet opens whole. It follows the trigger on scroll and
  resize, and still flips above the trigger when there is no room below.
- 97468fd: A flush now collects the keystrokes still inside the editor's typing
  debounce. Changes were reported on a pause (~180ms), so a save that ran
  sooner — ⌘S right after typing, or the rewrite seed flushing before it
  quotes the file to the agent — saw an empty buffer, called the file saved,
  and the rewrite went out quoting text that was not on disk yet.
- ba70109: The "complete this plan" handoff prompt follows the plans skill instead of
  carrying style rules of its own. The two had drifted into contradiction: the
  prompt asked for a closing "Next checklist", which the skill forbids, and
  argued against the step list the skill is built around, so an agent obeying
  the prompt wrote a plan the skill said was wrong. The prompt now names the
  move (flesh the plan out, set it ready, touch nothing else) and leaves the
  shape to the skill. A saved copy of the old default prompt moves to the new
  one; an edited prompt is left alone.
- ba70109: A message sent while the agent is mid-turn is queued and sent when the turn
  finishes, in order. It used to be dropped silently: the composer had already
  cleared the box by the time the busy guard fired, so what you typed was gone.
  The transcript says "queued" when this happens, and if the session dies before
  the queue drains, it says the queued messages went with it.
- 97468fd: A message queued mid-turn is sent into the conversation it was typed in, not
  whichever one is on screen when the turn ends — switching chats while a
  message waited could send it to the wrong conversation, or lose it to a queue
  that never drained. The in-flight guard is per conversation too, so a send in
  one chat can no longer queue a message in another.
- ba70109: The new-file sheet remembers where the last plan in each repository was
  created and opens on that folder, as long as it still exists. With nothing
  remembered it falls back to the folder of whatever is open, as before.
- 97468fd: A new file's name keeps the case you typed: "Meeting Notes" becomes
  `Meeting-Notes.md`, not `meeting-notes.md`. The `{slug}` token lowercased the
  title, so the filename silently disagreed with what was in the sheet.
- 97468fd: Stop now sits inside the composer, at the end of the options row under the
  box you type in, instead of floating above it over the transcript.

## 0.7.0

### Minor Changes

- bdd02de: A fourth bundled skill, `factory`: how an agent sets the Factory GitHub
  Action up in a repository — install the gate script and push wrapper
  verbatim, adapt the workflow's verify commands and runner to the target
  repo's own CI, keep the two load-bearing lines (the gate's skip and the
  recursion-guarded `GITHUB_TOKEN`), point the owner at `claude setup-token`
  for the subscription secret, and prove the install with a push that
  dispatches nothing. Installs with the others, opens from the palette like
  the others.
- 07f6f6d: Select a passage in the write surface, right-click → "Rewrite…", and say in a
  sentence what you want changed. The agent gets a turn that names the file,
  quotes the passage — with a line-range hint only when the quote is unique in
  the file — and carries your instruction; it edits the file, and the poll
  reloads the buffer, the same way every other handoff already works. The prompt
  is yours to argue with in Settings → Agents.
- 281eef1: A plan's `model:` and `effort:` frontmatter keys — the ones that route a
  dispatched implementation run — can be set from the palette, offering exactly
  what the live agent session advertises (ACP `model` and `thought_level`
  options) and nothing when no session is advertising: the vocabulary is the
  agent's, never the app's. The plans skill documents the keys, and the bundled
  dispatchers treat a value they don't recognise as absent — warn and fall back
  to the default — rather than failing the run over a typo.
- b264d05: Long dropdowns can be searched. Past ten choices a menu gains a filter row
  scored by the palette's own subsequence matcher, so `settings` finds
  `plans/settings-json` in a list where every name begins `plans/` — the prefix
  type-ahead a select taught everyone stays the right thing below that. No call
  site opts in: the branch picker, the folder pickers, the chat list and an
  agent's model list all inherit it from `Dropdown` itself.

  The branch list behind it grew up to match: branches that exist only on a
  remote are offered too, set apart under a rule, with checking one out creating
  the tracking branch; the list is ordered by recency rather than alphabetically;
  and the menu shows the branches it already had, saying it is refreshing, rather
  than an empty box while git takes its three seconds.

- f307ad4: Settings live in a file. `settings.json` in the platform's config directory is
  now where every setting on the Settings page actually lives, with a
  `settings.schema.json` generated from the app's own `Settings` type written
  beside it — so an editor completes this build's keys and shows the same prose
  the settings page argues in. localStorage stays on as a warm start, so the
  theme is still right on the first frame; the file wins any disagreement, and
  first launch migrates whatever was already stored. Edits made outside are
  picked up on the same interval as everything else read from disk, which is also
  how the agent in the chat panel can change your settings with no new tool
  surface at all — it edits a file. A file that does not parse keeps the last
  good settings and says so rather than resetting anything. "Open settings file
  (JSON)" is on the Settings page, next to the path, and in the palette.
- 241d7e8: The software factory's first working set. A third bundled skill, `pr`, joins
  `plans` and `review` (it slipped into 0.6.0 without a changelog line): how an
  agent turns a `ready` plan into a pull request — one unit per run, a pushed
  `busy` flip as the claim and lock between workers, a worktree from the default
  branch's tip, and fail-loudly back to `ready` as the only exit besides a PR.
  Around it, the dispatchers: `scripts/worker.mjs`, a local daemon that watches
  configured repos and spawns headless runs — fleshing out `draft` plans and
  implementing `ready` ones, so committing a draft is the whole human gesture —
  and a Factory GitHub Action that runs one matrix job per unit whose status
  _became_ `ready` in a push, billed to the Claude subscription. Both route by
  the plan's `model`/`effort` frontmatter, both confine pushes to
  `scripts/git-push.sh` (origin only, no flags, and the default branch accepts
  nothing outside `plans/`), and neither ever bypasses permissions — a scoped
  allowlist plus `acceptEdits`, the configuration `claude-code-action` already
  battle-tested in public.
- 281eef1: The handoff splits in two, named for what each asks of the agent. "Hand off to
  agent: complete this plan" is the old handoff under an honest name — flesh the
  plan out towards `ready`. "Hand off to agent: implement this plan" is new: the
  agent claims the plan as `busy`, builds what it describes, and marks it `done`.
  Both live in the palette and the tree's right-click menu, and each has its own
  editable prompt in Settings → Agents.

### Patch Changes

- 281eef1: Six open bugs closed in one pass. Stop actually stops: the session now keeps
  listening while a turn runs and sends the agent a real `session/cancel`, where
  before the press sat unread until the answer finished on its own. A maximised
  mermaid diagram opens fitted whole — no more cropped top — and a plain scroll
  wheel zooms it, so panning is reachable without knowing the ⌘-wheel gesture.
  "Open the … skill" in the palette resolves where the skill is actually
  installed (per-skill file or fenced `AGENTS.md` section) instead of assuming
  Claude Code's path. Scroll position now carries across Write and Source for
  the same file, mapped proportionally between the two layouts. `h3` steps up to
  1.13em and `h4` — which had no rule at all — gets one of its own. And a
  repository heading can be renamed from its right-click menu: an alias kept by
  the app, for worktrees and the third repo called `mono`.

## 0.6.0

### Minor Changes

- 4ead37e: ⌘K chords (⌘K W closes all, ⌘K ⌘1/⌘2 override a pane's view), a Settings → Keyboard page for rebinding everything, and opt-in VS Code and Vim keybinding packs. The palette now lives on ⌘P/⌘⇧P alone.
- 4ead37e: ⌘F finds inside the open file — one bar over the focused pane, working in both Write and Source, and a palette `*` hit now opens the file with the find seeded at the match.
- 4ead37e: An "All files" toggle shows every text file in the tree, not only markdown; non-markdown files open in Source only and can never be rewritten by the writing surface.

### Patch Changes

- d52b1b7: The file tree can now be toggled from the rail. A Files button sits with Git
  and Chat, lit while the sidebar is open — the same switch ⌘B has always been,
  now visible and clickable.
- c8d1a60: Search follows the "all files" switch, and the git panel stops filtering.
  The palette's footer carries the search scope — markdown by default, one
  click for every file — and both searches obey it: file names and the `*`
  search inside files. The git panel now always reports the whole repository:
  every changed file is listed, stageable, and openable in the diff view,
  whatever the tree shows. The source of any file is editable as typed: the
  frontmatter splitter no longer peels a `---` header off a non-markdown file
  mid-edit. Settings commands in the palette keep fixed names — "All files",
  "Finished plans", "Chat position" — with the current state in the value
  chip, instead of labels that flip between show and hide. And the diff view
  got faster where it counts: the heavy backend commands moved off the main
  IPC thread so "Reading the committed version" no longer waits behind a
  repository walk, and a git action refreshes the diff in place instead of
  blanking it while the committed side is re-read. Clicking through the git
  panel is instant now, twice over: the file opens straight into Diff instead
  of mounting the writing surface first and tearing it down, and the committed
  side of every changed file is prefetched as soon as the panel's list is
  known, so the diff paints from cache and revalidates behind it. That work
  also surfaced a real bug: switching between changed files could pair one
  file's committed side with another's working copy under a stale highlight
  cache key, leaving the diff showing the previous file — or nothing. The diff
  view is now keyed per document and its cache keys carry a content
  fingerprint, and a regression test clicks down a panel of changed files
  asserting each diff is its own and paints within budget.
- 917c684: Two chat fixes. The transcript keeps the order things happened in: streamed
  text grows its bubble only while that bubble is still the last message, so
  an answer written after tool calls lands _below_ them instead of being glued
  onto earlier prose above — the closing answer is now always the last thing
  on screen. And Stop moved out of the header, where long chat titles ran into
  it, to float just above the composer: the answer is stopped where the next
  message is typed, which Esc already did.
- d52b1b7: Diff is no longer a mode you switch an editor into. The Diff button, ⌘3 and
  the palette entry are gone; the view switch is Write and Source. The diff
  still exists where it means something — click a changed file in the git panel
  and it opens as that file's diff, and a conflict's "See the diff" still shows
  yours against the last commit. While a buffer is showing a diff, a lit Diff
  segment appears on the switch so there is a way to read the state and a way
  back out.

  Comments also now land at the cursor — in whichever paragraph it sits, right
  where you pointed — rather than being appended after the paragraph's end.

## 0.5.0

### Minor Changes

- 3c9385b: The app now ships a second skill: a review skill that teaches any agent how to
  turn a branch or PR into review materials a human can actually digest — a
  small numbered set of documents split by what the reader does, mermaid where
  prose loses, code blocks as quotations with `file:line`, and statuses that
  make the tree a reading checklist.

  Install conventions installs every bundled skill everywhere the agents on
  this machine look: Claude Code gets a file per skill under `.claude/skills/`,
  and the agents that read `AGENTS.md` or `GEMINI.md` get a fenced section per
  skill — the existing plans fence keeps its bare spelling, so nothing already
  installed stops matching. The palette gains an "Open the … skill" command per
  installed skill, with the honest caveat that these copies are rewritten on
  update.

- 3c9385b: Drag a markdown file from Finder onto the window and it opens, editable, and
  saves back to where it came from. A file that lives inside an open repository
  opens as that repository's file, diff and all; one from anywhere else opens
  with its folder as its root — the watcher, autosave and the conflict check
  all work, because they only ever needed a directory and a name. Its view
  switch offers Write and Source and no Diff, since there is no commit to
  compare against. A dropped folder is the add-a-repository gesture by other
  means; anything that isn't markdown is declined by name.

  This turns Tauri's own drag-drop handling on, which is what makes real
  filesystem paths — and therefore editing in place — possible at all.

- 3c9385b: Shortcuts now live in one registry instead of twice — once as a hand-written
  `else if` chain and once as strings in the palette that agreed only because
  someone kept them agreeing. The unconditional bindings moved into a keymap
  table; the keydown handler is a lookup over it, and the palette renders its
  key hints from it, so a hint can no longer lie about a key you have rebound.

  ⌘/ opens the new shortcut sheet: every binding, grouped, drawn from the
  registry. Click one and press the new keys to rebind it — overrides merge
  over the defaults in settings the way settings already merge, ⌫ unbinds, and
  a conflict with another binding is refused by name rather than silently
  letting one command win. Contextual keys — Escape, ⌘B while writing, ⌘+/− by
  focus — stay hand-written, and the sheet says so instead of pretending.

- bff9d19: The view switch is one global state: Write, Source and Diff set both panes
  at once — and ⌥-click (or the palette's "This pane" commands) pins only the
  focused pane, so the same file can sit rich on one side and raw on the
  other. When both panes hold one file they mirror instantly: the pane being
  typed in owns the buffer and the save, the raw views follow per keystroke,
  the built page follows on a short trailing debounce, and the other pane's
  autosave is adopted quietly instead of rebuilding the reader's view.

  The pointing routes filled in: right-click a file in the tree for "Open to
  the side", right-click a tab in either strip to move it across or close it.
  The drop zone stays away once a split exists (the pane itself is the target
  — nothing promises a third pane), a drag from the split outlines the main
  pane as its target the way the split is outlined for drags the other way,
  and the bright active-tab indicator follows the pane the keystrokes actually
  go to.

- d6cb936: Two agents can work at the same time, and moving between conversations no
  longer kills one.

  A session was keyed by repository, so there was one by construction. Changing
  chat meant changing which conversation that single session was having — which it
  cannot — so it was ended instead. Setting an agent going on a long job and
  reading another conversation while it worked was not something you could do.

  A session is now keyed by the conversation it is having. What ends one is
  deleting the chat, clearing it, or quitting; navigating does not. Every event
  the agent produces names its conversation, so an answer arriving for a chat you
  are not looking at lands in that chat's transcript rather than being dropped —
  which is what used to happen, permanently, including after switching back.

  Everything that was one-per-repository followed:

  - The turn in flight is per conversation, so a long job in one does not disable
    the composer in another, and Stop belongs to the chat it is in.
  - Permission requests are asked and answered per conversation. Their ids now
    carry the chat, because a tool call id is only unique within its own session
    and two sessions in one repository could mint the same one — answering in one
    chat could have resolved the other's question.
  - Context and cost are read per conversation. Two sessions were overwriting each
    other's reading, so the status bar showed whichever spoke last under a label
    saying it was the repository's.
  - The conversation picker puts running chats first, under their own rule, and
    the rail carries a count of how many agents are working — across every
    repository, since what that number is about is processes on the machine.

- 3c9385b: The bundled skills work without being installed anywhere. Type `/plans` or
  `/review` in the agent chat and the skill's text travels with your message —
  the transcript keeps what you typed, the agent gets the conventions, and no
  repository grows a file for it. The app also keeps fresh copies in
  `~/.plans/skills/` on every launch, one folder per skill, for pointing other
  tools at. Installing into a repository stays what it was: a button you can
  press, never something that happens to you.
- 3c9385b: Two documents, side by side. Drag a file — from the tree or from the tab
  strip — onto the dashed "Open beside" zone along the page's far edge and it
  opens beside the one you are reading. Once a split is open the zone stays
  away — the pane itself is the target, outlined under the drag, so nothing
  ever promises a third pane; a drop there retargets it. The tab row itself splits: each pane carries its
  own strip and its own header — path, status badge, owner, due — sized to its
  pane. Tabs move rather than copy: dragging the open document to the side
  lets the next tab fill its place (or the blank state show), a split tab
  dropped on the main pane comes back, and tabs reorder live under the pointer
  within a strip. ⌃Tab cycles the focused pane's own strip.

  The split's header carries a Frontmatter button, like the main one — no
  close button: the pane closes from the palette ("Close the split") or when
  its last tab does. "Swap the panes" trades the two tab sets wholesale, and
  "Open this document in both panes" puts two live views on one file — a save
  in one is the other's outside edit, taken silently when clean and raised as
  the conflict bar when both have typed. There is one view switch, in the chrome, and it acts on whichever pane
  has focus; the split offers Write and Source, and no Diff. ⌘\ does the same from the keyboard, opening the
  most recent other buffer in a second pane — its own view, its own scroll, its own save machinery against
  its own stamp, so a save in one pane can never use the other's. ⌘⌥\ turns
  the split the other way, ⌘⌥1/⌘⌥2 move focus between panes (the bare digits
  stay the view switch), and ⌘W closes the focused split before it closes
  buffers. The divider drags, double-click evens it out, and the split — which
  way it runs, where the divider sits, what it shows — survives a restart.

  Opening a file while the split has focus loads it there; a file already open
  in the other pane moves focus instead of opening a second copy, because two
  editors saving one file against two stamps is the conflict machinery firing
  on the app's own edits. Zen collapses to one pane and restores the split on
  the way out. Two panes and no more, deliberately.

### Patch Changes

- d6cb936: Fixes a running agent going silent after another session was stopped.

  `agent-down` is emitted twice for one stop, and has to be: the session is told
  to go and says so at once, so the panel is not left waiting on a process that is
  already unreachable, and the session's own task says so again when it has
  actually finished — which is arbitrarily later, because telling a session to
  stop only queues the message.

  With nothing to tell the two apart, that second farewell was indistinguishable
  from news about whatever was running by then. Stop a session, start another, and
  the first one's goodbye cleared the second one's turn — after which the live
  agent's answer went nowhere, which looks exactly like an agent that has nothing
  to say. Every session now carries a number, and a message about a session older
  than the one in hand is a message about something already over.

  Found while specifying `plans/several-agents-at-once.md`: the refactor needs
  events to say which session they belong to, and asking that question turned up a
  case where the answer already mattered.

- d6cb936: Naming a new file now leaves the cursor in it, in the empty line under the
  heading. Creating a file used to leave you looking at it rather than writing in
  it, so the first thing you did after making one was click into it.

  The cursor is asked for, not placed. Opening a file only requests the state
  change that leads to the editor swapping its document, so focusing at the point
  of asking lands in the file you were reading before — which the swap then throws
  away. The request is left for the editor and honoured once the new document has
  settled, including on the path where the file is the first one opened and the
  editor is being built for it rather than swapping.

  Only creating a file does this. Clicking through the tree to read something
  still leaves the cursor where it was.

- d6cb936: A new plan is created with `status:` frontmatter already in it, using the first
  word of your configured status vocabulary.

  Until a plan has a status it is invisible to everything that reads one — the
  tinted dot in the tree, the status filter, and now the ordering — so a file made
  in the app did not look like a plan to the app until somebody remembered to say
  so. Writing it at creation means it is a plan from its first save.

  The word comes from settings rather than being baked in, because the vocabulary
  is a convention the repository keeps rather than one the app owns.

- d6cb936: A file can be dragged from one repository into another. The tree refused it
  before, on the grounds that it would be a copy rather than a move — which was
  true, and is the answer rather than the objection: git has no rename spanning
  two repositories, so the destination gets an addition and the original stays
  exactly where it was. The cursor says which of the two a drag is while you are
  doing it.

  The buffer is written out first. The file being dragged may be the one you are
  typing into, and the copy happens on disk — without that, what arrives in the
  other repository is quietly a few seconds old.

  This is the half of "copying files between repos, and dropping files in from
  Finder" that costs nothing. The Finder half is a different change: it needs
  Tauri's own file-drop handling turned on, which takes away the HTML5 drag
  events this feature and the tree's drag-to-move are both built on.

- d6cb936: The file tree can be ordered by `status:` rather than by name — "Order files
  by" in Settings, or from the palette. Within each folder, since a sequence
  across unrelated folders means nothing.

  This is the cheap answer to wanting a plans folder in some order other than the
  alphabet, and it was worth trying before adding a field for it: the status is
  already read from every file during the walk, so it costs a comparison rather
  than a number to keep in step by hand — and unlike a number, it cannot drift out
  of step with itself when you insert a plan in the middle.

  The vocabulary is the one already in Settings, so "first" means first in your
  list. A file with an unrecognised status, or none at all, comes last, which
  means adopting this can be partial — most repositories hold files that are not
  plans.

- d6cb936: The palette can now put a zoomed page or sidebar back to its default size.

  Nudging was the only way these values moved, so having zoomed you could only
  return by counting your way back — to a number that is written down nowhere you
  can see while the palette is open. The Settings page has had the answer all
  along: every slider there carries a revert. The palette now offers the same for
  any nudged value — the page, the tree, line length, line height, code size —
  showing what it would move from and to.

  "Zoom" also finds the size commands now, which is the word people reach for and
  the one that used to find nothing at all.

- d6cb936: Fixes a file growing a second, empty frontmatter block in front of its real
  one — `---`, blank, `---`, then the actual metadata. Only the first block
  parses as frontmatter, so the plan's status became invisible to the app while
  the file still looked almost right on disk.

  Emptying the frontmatter sheet's textarea hands back an empty string, and an
  empty string is not the same thing as no frontmatter: `null` means the file has
  no block, `""` means the block is there and holds nothing. The join treated
  only the first as "write nothing", so the second wrote a bare pair of fences.
  A block holding nothing is now no block at all, checked before the
  write-it-back-verbatim path so that a file already carrying an empty block is
  repaired by saving it rather than having it preserved.

- d6cb936: `#` in the palette can now reach every open repository's conversations, not only
  the one you are in. It is a setting rather than a change: the list following the
  focused repository is the list being right for most work, so that stays the
  default, and "every repository" is there for the other habit — one train of
  thought that outlives which window happens to be focused.

  A foreign chat is labelled with the repository it belongs to, since chat titles
  come from what was said and two repositories can easily hold one called the same
  thing. Opening it goes there: a transcript is keyed by its repository, the agent
  runs in it, and the plans it is about are there, so the window follows.

  Reading the list leaves nothing behind. The index-loading the panel does invents
  and writes an empty conversation when a repository has none, which is right for
  the repository being worked in and would otherwise seed a stray "New chat" in
  every repository you have ever opened.

- d6cb936: "Install skill" wrote `.claude/skills/plans/SKILL.md` — Claude Code's location
  and nobody else's. The chat starts Codex, Gemini and OpenCode just as readily,
  and none of them will ever read that file, so for three of the four agents the
  button was a no-op with a reassuring label.

  The conventions now go wherever the agents on this machine actually look:
  Codex and OpenCode read `AGENTS.md`, Gemini reads `GEMINI.md`, Claude Code
  reads its skills directory. One text, a table of addresses — the conventions
  are the same conventions whoever is reading them. Only for agents this machine
  has, since a `GEMINI.md` arriving in the git status of someone who has never run
  Gemini is litter.

  A repository that already has an `AGENTS.md` does not lose what was in it. A
  file under a tool's own dotted directory exists because the tool does, so the
  app owns it and replaces it; a file at the root of the repository belongs to the
  repository, and only the app's own fenced section is rewritten.

  The settings row names the agents rather than a path, which is the part of this
  the reader can actually act on.

- d6cb936: ⌃Tab steps to the next open buffer and ⌃⇧Tab to the previous one, wrapping at
  both ends — the binding every tabbed application has. Both are in the palette
  too, since a binding nobody can find is a binding nobody uses.

  ⌘⌥←/→ did this already and now shares the same code, which fixed something the
  two had quietly disagreed about: cycling onto a memory buffer — the release
  notes, say — tried to read a file that was never on disk.

- d6cb936: Mermaid diagrams zoom and pan. ⌘- or ctrl-scroll — which is also what a trackpad
  pinch arrives as — zooms about the pointer, dragging moves the picture once
  there is somewhere to move it, and double-clicking or the `1:1` chip in the
  corner puts it back. A plain scroll still scrolls the document, since the
  pointer is over a diagram for much of a long plan.

  The zoom is remembered outside the widget rather than on it. ProseMirror keys
  the diagram's widget by position, so typing a paragraph anywhere above one
  rebuilds it — anything held on the node would be thrown away by an edit
  elsewhere in the file.

  The figure now clips at its frame. At 1:1 that changes nothing, because the
  diagram is scaled to the width; zoomed, being cut off at the frame is the point.

  A diagram can also be maximised, from the ⤢ in its corner — the same picture
  with the room to read it, since zooming inside a frame the size of a paragraph
  is the wrong size for the diagrams that most need looking at. Escape or the
  backdrop closes it. The maximised view is built outside the editor entirely,
  because the figure clips its overflow and anything inside the editor's DOM is
  something ProseMirror believes it owns.

  The `1:1` and maximise controls read as buttons in the document, not only in
  the maximised view. Milkdown's own stylesheet strips the border and background
  off any button inside the editor, and it does so with a selector that outranks
  a plain class — so the same control looked like a button in one place and like
  bare text in the other.

- 3c9385b: Six from the open bug list:

  - Long paths in the git panel no longer push the filename out of view — the
    name never gives way; the folder path is what truncates, from the front, so
    the nearest folder survives.
  - "Refresh branches" in the git commands re-reads the branch list on demand.
  - Right-click a repository in the tree → "Open in Terminal".
  - Links between markdown documents work: ⌘-click a relative link and the
    other file opens in the app; anything with a scheme opens in the browser.
    A plain click stays an editing click, and the webview never navigates away.
  - Escape stops the agent mid-answer, matching the Stop button.
  - Long documents show a thin scrollbar in the paper's own colours, and the
    scroll position is remembered per buffer — jumping between two documents no
    longer resets both to the top.

- d6cb936: A file open in another tab that changes on disk now says so, with a dot beside
  its name in the tab row.

  Only the active file was ever checked for outside edits, so a plan rewritten by
  an agent or by a `git checkout` sat there unremarked until you happened to click
  back to it — which is the worst moment to be told, since the change is old by
  then. A background tab holds no text and re-reads from disk when you open it, so
  there was never anything to reload; what was missing was only the telling.

  The check runs on the slow tick rather than the watch interval, for the same
  reason the tree walk is staggered: a `stat` per open tab is cheap but not free,
  and none of this is urgent.

## 0.4.1

### Patch Changes

- f9bb39b: A long chat name is truncated rather than wrapped — the title is the first
  thing you said, so it is a sentence, and a sentence in a fixed-height bar wraps
  out of it and over the row below.

  The chat panel has a wider floor: it cannot be dragged narrower than the
  pickers, the title and the composer need to sit beside each other.

  The chat opens beside the page rather than under it. A conversation is read
  down, so height is what it wants — and the plan stays fully visible next to it.

- 32749a9: Fixes the agent failing with "env: node: No such file or directory" when the
  app is launched from Finder. Resolving `npx` to an absolute path was only half
  the job — `npx` is a script whose shebang runs `env node`, and `env` searches
  the _child's_ PATH, which was launchd's. The agent is now started with the PATH
  your shell would give it.

  A launch failure no longer suggests signing in. An agent that never started and
  one that is signed out look nothing alike and need opposite advice.

## 0.4.0

### Minor Changes

- Chats can be renamed and deleted, from the panel header and the palette.
  Deleting asks only when there is something to lose, and deleting the only one
  leaves a fresh conversation rather than an empty panel.

  Settings lists every supported agent — Claude Code, Codex, Gemini, OpenCode —
  with where you stand on each: chosen, installed, run via npx, or not here at
  all, with a button rather than a command to copy out. Each says how to sign in
  before it needs to, and an agent that starts but will not answer repeats that
  in the chat: "API key is missing" is true and useless on its own, because the
  fix happens in a terminal.

  Quitting now waits for agents to actually stop before the app goes, rather than
  asking them to and exiting first — which could leave one running.

  ⌘D no longer opens the diff; ⌘3 does. There is a new "Close all editors"
  command, and panel commands in the palette say show and hide rather than turn
  on and off.

- be44131: A repository can have more than one conversation. The chat's header names the
  current one — after the first thing you said in it — and picks between them;
  **New** starts a fresh one and ends the agent's session with it, because a new
  conversation the agent still remembers the last one from is new in name only.

  `/clear` now does what it looks like it does. Sent on to the agent it cleared
  the agent's context and left the transcript on screen, which was
  indistinguishable from nothing happening; it is the same intent as New, so it
  is the same action.

  Both live in the command palette too: "New chat", and every other conversation
  by the name it gave itself.

- 690e226: Release notes open as an ordinary markdown buffer rather than a pop-up sheet —
  a tab you can read at your own pace, scroll, and close, rendered by the same
  editor as everything else. They also cover every version since the one you
  last read, so skipping a release no longer means skipping its news.

  The buffer lives in memory: nothing is written to disk, and it is not restored
  on the next launch.

- ab627e1: Searching inside files is now `*` rather than `?` — a wildcard is what people
  already type for "anything containing this", where a question mark read like a
  question.

  `#` lists the repository's conversations and takes you to one, marking the one
  you are already in — written the way a channel is, and leaving `@` free for
  mentioning a file in a prompt, which is what ACP agents already use it for.

- 3865308: The chat has a model picker, a reasoning-effort dropdown and slash commands —
  none of which this app knows anything about. The agent advertises what it has
  when the session opens, and the panel draws a dropdown per option in whatever
  order they arrive; choosing one asks the agent and redraws from its reply,
  because a choice can change what else is on offer.

  Typing "/" completes from the commands the agent advertised, with arrows and
  Tab. Completing is not sending — the agent parses the slash itself — and a
  slash you meant literally still goes through.

  Context used and what the turn cost appear in the status bar once the agent
  reports them.

- When an agent asks permission before it acts, the question appears in the
  transcript with the agent's own choices as buttons, and the turn waits for your
  answer. Answering freezes it into a statement rather than leaving it pressable,
  and a question left unanswered when the window closed comes back inert — the
  process that asked it is gone.

  How often you are asked is the agent's own permission mode, chosen from the
  pickers in the composer: Auto classifies without asking, Manual asks about
  everything, Plan Mode runs nothing at all.

- 9690bc5: The chat speaks the Agent Client Protocol.

  Instead of building one CLI's flags and parsing one CLI's output, the app is
  now an ACP client: it starts an agent that speaks the protocol and draws what
  that agent says. Which models exist, which reasoning levels, which slash
  commands, whether a tool needs asking about — none of it is knowledge the app
  holds any more. A second agent is a row in a table rather than a second parser.

  Tool lines now carry the title the agent wrote for them, and finish: a call
  goes from running to done in place instead of appending a second line.

  The chat starts fresh. Earlier transcripts are left on disk but not shown: a
  Claude CLI session id means nothing to an ACP agent, so a conversation carried
  across would be a conversation only on one side.

- 51f02d3: The agent's task list appears above the transcript while it works, amended in
  place as it goes. A session survives the process: if the agent dies between
  turns, the next thing you say asks it to pick the conversation back up rather
  than starting over.

  Answers render as markdown — bold, code, fences and lists — by building
  elements rather than injecting markup, so an agent quoting HTML from a file
  shows you the HTML instead of running it. What you typed is still shown exactly
  as you typed it.

  Codex, Gemini and OpenCode are in the agent list alongside Claude Code. They
  were never a second integration; they are rows in a table.

### Patch Changes

- c69e1af: The message box starts three lines tall and grows as you type, up to a ceiling
  past which it scrolls.

  The agent's pickers no longer clip or scroll: a menu shows every option at
  once, with descriptions whole, because a picker you have to scroll is a picker
  you have to search.

  Choosing a different agent now actually changes which one answers. The running
  session ends at the next thing you say, the transcript stays, and the new agent
  starts without it — a session id belongs to the agent that opened it.

- 4c4a307: Marking a plan done now updates the tree immediately — hiding it when finished
  plans are hidden, and changing its badge otherwise — instead of waiting for the
  next background refresh to read the file back.
- d66c658: An installed agent is preferred over fetching it with npx on every launch, and
  Settings → Agents will install it for you. The row says which of the two it
  will actually do, because the difference is a second or two on the first prompt
  of every session.
- cd96eac: Deleting a file, discarding changes, forgetting a repository and removing a
  frontmatter block all ask again — properly. They used `window.confirm`, which a
  WKWebView swallows without showing anything, so "ask, then delete" had quietly
  become "delete". They now put up a real native sheet whose button names the act:
  Delete, Discard, Forget, Remove.
- 70c3095: The tree's right-click menu stays on screen: near the bottom or right edge it
  flips and clamps instead of running off the window.

  ⌘⌫ deletes the selected file, after asking, and only while the tree has focus —
  everywhere else the chord already means something. F2 renames the open file.

  The finished-plans setting says what it does: "Show finished plans", shown or
  hidden, rather than a switch whose "off" read as though it turned the plans off.

- bf29a12: The agent's model, effort and mode pickers moved into the composer, under what
  you are typing — they set what happens next, so they belong with the message
  rather than reading as a status bar above the conversation.

  They can no longer stretch the window: an option with a long name, or an agent
  persona whose description runs to paragraphs, used to push the whole app
  sideways. Menus now hang from the button's right edge and grow back into the
  space that is there.

  Effort is ordered as the scale it is, lowest nearest the button.

- e534c71: The chat could produce nothing but your own message when the app was started
  from Finder rather than a terminal: a GUI app inherits launchd's PATH, which
  holds none of the places an agent CLI is actually installed. The binary is now
  resolved through your login shell's PATH, so the app finds what your terminal
  finds.

  The narration reads like the terminal too. A tool call shows what it touched —
  "Read plan.md", "Bash pnpm test" — rather than a bare tool name, and a turn
  that fails says so in the transcript instead of only in a toast that is gone
  by the time you look back.

  The update banner's two actions are spaced apart, and its labels no longer
  break across lines.

## 0.3.0

### Minor Changes

- a3f0dc0: Plans can talk to a coding agent about the work in front of you.

  ⌘J opens a conversation beside or below the document — one per repository, so
  clicking another plan carries it rather than resetting it; which plan you are
  looking at rides the next turn as context. Ask for anything: the answer
  streams in, and edits the agent makes land in the files where the watcher, the
  tree marks, and git already show them.

  "Hand off to agent" starts that conversation on a particular plan, from its
  right-click menu in the tree or from the palette. What the agent is told is
  yours to edit, in Settings → Agents, alongside the agent itself — picked from
  the ones found on your machine rather than typed. The app runs it headlessly
  one turn at a time, never in the background, and never commits.

  Machines without an agent CLI see none of it rather than a chat that fails.

- 310455d: The git panel gets the same header bar as the chat and the tabs, with pull and
  push in it as “Pull ↓” and “Push ↑” carrying their counts. The branch picker
  moved up to the rail beside the repository, the commit box moved to the top of
  the panel, and the repository's name is no longer repeated inside it.

  Pull no longer refuses when you have unsaved work: it stashes it, pulls, and
  puts it back, rebasing unless the repository says otherwise.

  The panel buttons leave Settings when pressed, instead of toggling something
  you cannot see from there.

- bce1cc0: Collaboration, without accounts. Comments are markdown-native HTML comments:
  right-click or ⌘⇧M writes one after the paragraph, signed with whatever
  `git config user.name` says. A comment with several `@name:` lines renders as
  a thread, and the card grows a reply field that appends one more line to the
  file. The frontmatter gets read as well as edited: `status:` shows as a badge
  in the header and a tinted dot on the tree row, `owner:` and `due:` in the
  header — read-only, from a few conventional keys the app recognises but does
  not own.
- 711dd62: The sidebar's right-click menu grows two things. Reveal in Finder, on files,
  folders and repositories alike. And Delete folder — which counts what the
  folder holds before asking: the tree only shows markdown, so the confirmation
  says how many files are inside and how many of them you have never seen.
- cab1043: Settings → Files gains "Finished plans", which hides everything marked done
  and everything inside a `completed/`-style folder. It is a view of the tree:
  nothing moves on disk, git still sees every file, and a finished plan you
  already have open stays open.
- 5367ebf: `plans .` in a terminal now opens that repository in the app. Settings →
  Repositories has an Install button that puts a small `plans` script on your
  PATH (Homebrew's bin, or /usr/local/bin); the script launches the app with the
  path and gives the terminal its prompt back.

  If Plans is already running, a second `plans <path>` doesn't open a second
  copy — the running window is focused and the repository is added there, by way
  of the new single-instance plugin.

- 777e7f4: The frontmatter got faster to write. The palette now sets `status:` directly —
  one command per status, plus a clear — and _Scaffold frontmatter_ lays down
  title, status, owner and due in one stroke, filling in the filename, the first
  configured status and the git identity, then opens the sheet for the blanks.
  The status vocabulary itself is a setting, comma-separated, under Files.
- 117c5dc: Write, source, and diff are now remembered per buffer rather than being one
  app-wide switch: flip a file to source, click another tab, and each keeps its
  own mode — across restarts too. The three buttons moved up into the rail,
  and opening a file from the git panel lands in its diff without disturbing
  any other buffer's mode. Settings is no
  longer a view of a buffer, so opening and closing it touches nothing.
- 117c5dc: Each repository row in settings gains an "Install skill" action, which writes
  the plan-writing conventions — frontmatter rules and the draft/ready/busy/done
  lifecycle — to `.claude/skills/plans/SKILL.md`, where coding agents discover
  them. The text is bundled from the canonical `skills/plans/SKILL.md` at build
  time; installing over an edited copy overwrites it, leaving the change as a
  reviewable git diff.

### Patch Changes

- cab1043: Fixes three ways the window could go blank. The first status poll of a
  repository compared the new status against one that did not exist yet and
  threw; a file opened from a path that was never added to the list took the
  diff view down with it; and an unfinished merge or rebase is now said out
  loud in the git panel — conflicted files get their own mark in the tree and
  their own list, with pull and push held back until the merge is finished.

- b294606: The status vocabulary is now the lifecycle the files actually live: `draft`
  (a human wrote a seed, an agent should flesh it out), `ready` (fleshed out,
  implementation can start), `busy` (a session is on it now), `done`. An
  uncustomised saved status list migrates to the new default; edited lists are
  untouched. The conventions ship in the repo as `skills/plans/SKILL.md` so
  agents can read them.
- 711dd62: Buttons, tabs, the header rail and the status bar no longer highlight as text
  when dragged across. Chrome is furniture; only the document and the inputs
  hold selectable text.
- 117c5dc: Esc while typing hands focus back to the app, so ⌘B and the other chrome
  shortcuts work without reaching for the mouse. The active tab's top rule now
  reads as a cursor for the tab row — bright while keystrokes go to the
  document, dim while they go to the app. In zen, Esc blurs first and a second
  Esc leaves zen.
- cab1043: Settings stops offering what it has already done: the command-line and skill
  buttons read the state first and say "Installed", or offer "Update" when the
  copy on disk is from an older build.
- 711dd62: Empty folders deleted outside the app no longer haunt the sidebar. They live
  only in the app's own memory, and that memory now checks the disk on every
  refresh instead of assuming a folder it once made is a folder that still
  exists.

## 0.2.0

### Minor Changes

- Anonymous usage counts, so the app can be improved by something other than
  guesswork — which views get used, which settings get changed, how often files
  get saved. Nobody is identified, and no file name, path, or word of your
  writing ever leaves the machine. Settings → Privacy turns it off.

## 0.1.0

### Minor Changes

- First release. A WYSIWYG editor for the plans folders across your local git
  repositories: a file tree over every repo you open, three views of the same
  buffer — write, source and diff — frontmatter held apart from the prose,
  folders and drag-and-drop, a command palette, and a git panel that stages,
  commits and pushes without leaving the app. It updates itself, and shows you
  what changed when it does.
