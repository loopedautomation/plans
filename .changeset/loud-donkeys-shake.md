---
"looped-plans": minor
---

The whole app can be worked without a mouse. The shortcut registry already
covered nearly every *command*; what had no keys was **navigation** — moving
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
