---
status: ready
---
# Improve Keyboard Access

> We should be able to use this entire app without needing to use a mouse.

## Problem / context

The instinct behind that sentence is usually "add more shortcuts", and here
that would be the wrong work. The shortcut story is in good shape:
[`improved-hotkeys.md`](improved-hotkeys.md) built the registry
(`src/keys.ts:44-93`, one table of id → keys), and
[`hotkey-chords.md`](hotkey-chords.md) added chords, the Keyboard page, and
preset packs. Nearly every *command* has a key. What has no keys is
**navigation**: moving focus between the surfaces those commands act on. Try
to use the file tree, the tab strip, or a right-click menu without a mouse
and you hit the actual wall. This plan is about focus.

The exploration turns up the same shape everywhere: the widgets are made of
real `<button>`s, so nothing is strictly unreachable, but nothing manages
focus *between* them. Reaching things means tabbing past everything else,
and several actions have no keyboard route at all.

**Modals leak.** Every sheet - NameSheet, TextPrompt, MoveSheet,
Frontmatter, ShareSheet, the palette, the shortcut sheet (mounted
`App.tsx:6664-6811`, `App.tsx:6811`, `App.tsx:6975`) - is a plain scrim div.
No `role="dialog"`, no `aria-modal`, no trap: Tab walks straight out of the
dialog into the app behind it, which still looks inert but isn't. And when a
sheet closes, focus falls to `<body>`. Only the find bar
(`App.tsx:4872-4879`, restoring the `findReturn` ref captured at open) and
`Dropdown` (`Dropdown.tsx:164-167`, close returns to the trigger) put it
back. Everything else strands the keyboard user at the top of the document
after every dialog, which quietly makes every other keyboard feature worse.

**The tree is a hundred tab stops.** File and directory rows are buttons
(`FileTree.tsx:659-683`, `:692-716`, `:1083-1097`) but there is no
`role="tree"`, no arrow-key movement, no roving tabindex: every row is its
own tab stop. Tabbing through a real repo is punishment rather than
navigation. The tab strip has the same disease in miniature: it declares
`role="tablist"` (`App.tsx:6063`, `SplitPane.tsx:341`) but arrows do
nothing, which breaks the contract that role announces to assistive tech.

**Context menus don't exist for the keyboard.** Rename, Move, Open to the
side, Delete folder, Open in Terminal - all live only behind
`onContextMenu` (`FileTree.tsx:667`, `:700`, `:1097`; the tab menu at
`App.tsx:6096`). No Shift+F10, no ContextMenu key; and the menu itself, once
open, is a div of buttons with no focus moved into it and no arrow
navigation (`FileTree.tsx:794-1060`) - only Escape works
(`FileTree.tsx:585-599`). ⌘K m and F2 cover Move and Rename from the
registry, but the rest of the menu is mouse-only, and tab reorder /
drag-to-pane is pointer-only outright (`App.tsx:6095`, `:4036-4140`).

**Announced but immovable.** The pane and tree dividers are honest
`role="separator"` with labels (`App.tsx:5984-5986`, `:6447-6449`) and no
key handlers: a screen reader is told there is a splitter it cannot move.
The palette's list is driven by the keyboard yet silent to it - no
`role="listbox"`, no `aria-activedescendant` (`Palette.tsx:1055-1069`), so
arrowing through it announces nothing; the chat panel's slash and ask lists
have the same half-finished ARIA (`ChatPanel.tsx:210`, `:1242`).

## Approach

The registry worked because it made one table the truth and everything else
a view of it. The same move applies here: the app has no focus abstraction
at all (no trap helper, no roving-tabindex helper, nothing in `src/`), and
every gap above is a site that needs one of two small behaviours. Build the
two behaviours once, in a new `src/focus.ts`:

- **`useFocusTrap(ref)`** - on mount: remember `document.activeElement`,
  move focus to the first sensible target, contain Tab/Shift+Tab; on
  unmount: restore focus to the remembered element if it still exists. The
  restore half is the part that matters most and the part nothing does
  today. The find bar's `findReturn` ref (`App.tsx:4833`, `:4884-4888`) is
  the existing proof of the pattern; this is that, made reusable, with the
  "if that place still exists" caveat kept.
- **`useRovingFocus(ref, {orientation})`** - one tab stop for the whole
  widget; arrows move an internal cursor; Home/End jump; the container
  carries the composite role. This is the standard tree/tablist/menu
  pattern, and one hook serves all three because the only differences are
  orientation and role.

Neither belongs in `keys.ts`, deliberately. The registry's documented gap
(`src/keys.ts:10-14`) is that it has no `when` clauses, and arrow keys
inside a focused widget are the most contextual keys there are. They stay as
widget-local listeners, like Dropdown already does correctly
(`Dropdown.tsx:176-215` - arrows, Home/End, type-ahead, Escape two-step,
focus return: the one widget here that already got all of this right, and
the internal model to copy).

Then apply, in order of pain: sheets first, because focus restore compounds
(every flow ends by returning you to where you were instead of to
`<body>`); then the tree, then the tablists, then a keyboard door into the
context menus. The ARIA patch-up on the palette and chat lists is
mechanical (`aria-activedescendant` pointing at the highlighted row's id,
proper `option` roles), and the separators are barely more: arrow keys
nudging the same state the pointer drag sets. Keyboard tab reorder can be
⌘-arrows on a focused tab rather than a drag emulation.

The cost worth naming: the tree's roving focus changes today's Tab
behaviour. Tab currently stops on every row; afterwards the tree is one Tab
stop and arrows move within it. That is the standard pattern and the better
one, but it is a change users will feel, and the changelog should say so.

## Implementation guide

- [ ] `src/focus.ts` - new file: `useFocusTrap` (remember/trap/restore, Tab
      only, Escape untouched) and `useRovingFocus` (arrows/Home/End,
      orientation option, one tab stop)
- [ ] Sheets - trap + `role="dialog"` + `aria-modal` + restore on every
      scrim sheet (NameSheet, TextPrompt, MoveSheet, Frontmatter,
      ShareSheet, SignInSheet), the palette and the shortcut sheet; decide
      the `editing`-restore question in the diff
- [ ] `src/FileTree.tsx` - `role="tree"`/`treeitem` with the existing
      `aria-expanded` kept (`:678`), roving focus, ←/→ collapse and expand,
      ↑/↓ move, Enter opens
- [ ] Tablists honour their role - ←/→ move selection in both strips
      (`App.tsx:6060-6122`, `SplitPane.tsx:341-370`); ⌘-arrows reorder a
      focused tab. This overlaps ⌃Tab (`keys.ts:59-60`) and that is fine:
      ⌃Tab is "next buffer" as a command, arrows are how a tablist behaves
      once you are standing in it
- [ ] Context menus - ContextMenu key / Shift+F10 on a focused row opens
      the same menu `onContextMenu` opens (`FileTree.tsx:667`, `:700`,
      `:1097`; tab menu `App.tsx:6096`); focus moves into it;
      `role="menu"` + the roving hook; Escape returns focus to the row
- [ ] ARIA patch-up - `aria-activedescendant` + option roles on the
      palette (`Palette.tsx:1055-1069`), slash and ask listboxes
      (`ChatPanel.tsx:210`, `:1242`); arrow keys move the separators
      (`App.tsx:5984-5986`, `:6447-6449`)
- [ ] A route *to* the widgets - decide between ⌘B-focuses-the-tree and
      registry focus-cycle commands (see open questions), then bind it
- [ ] `e2e/focus.spec.ts` - new spec: trap containment, restore-on-close,
      tree arrow walk, tablist arrows, menu-key entry. No test today
      asserts Tab order, trapping or restore; a dedicated spec keeps the
      discipline visible. Run with the rest of the suite at the end
- [ ] `CHANGELOG.md` - note the tree's new one-Tab-stop behaviour

## Out of scope

- **A native menu bar.** There is no Tauri menu, no accelerator, nothing
  (grep across `src-tauri/` finds none); every key lives in the web
  layer's one keydown listener (`App.tsx:5169-5196`). On macOS that means
  no menu bar to browse, and browsing the menu bar is a keyboard-discovery
  mechanism the OS gives away for free. But a native menu duplicating the
  registry is exactly the two-lists-that-drift problem
  `improved-hotkeys.md` killed; doing it right means generating the menu
  from `DEFAULT_KEYS` + overrides and rebuilding it when bindings change.
  Real work, platform-specific, and partly redundant with the palette and
  ⌘/ sheet. It should be its own plan if it happens. One note for whoever
  writes it: the confirm dialogs are already native (`confirm.ts:26`), so
  part of the app already lives outside the web focus model.
- Screen-reader completeness beyond the roles added above (live regions in
  the chat transcript, full tree ARIA state). Worth its own pass once
  focus works.

## Open questions

- Does the trap fight the Escape ladder? Escape already has a careful
  five-rung meaning (`App.tsx:5223-5236`: blur editor → focus tab → leave
  zen → keyboard page → settings), and several sheets handle their own
  Escape in capture phase (`ShortcutSheet.tsx:73-82`,
  `MoveSheet.tsx:26-41`). Leaning: the trap owns Tab only and leaves
  Escape where it is, and that split is stated in the hook's contract so
  nobody "helpfully" centralises it.
  - Answer:
- Focus restore vs. `editing`. If a sheet was opened while the caret was
  in the document, restoring focus re-enters the editor and flips the
  `editing` guard (`App.tsx:5157-5167`), muting app shortcuts again.
  Leaning yes, that is correct - you were writing, you resume writing -
  but it is a behaviour change worth deciding on purpose, and it interacts
  with [`esc-unfocuses-the-editor.md`](esc-unfocuses-the-editor.md).
  - Answer:
- Is the tree's roving focus one composite including repo headers and
  workspace rows, or per-repo? Repo rows (`FileTree.tsx:1083-1097`) are
  peers of the dirs beneath them in the DOM; the tree pattern says one
  widget, but the workspace affordances hanging off repos may want to stay
  ordinary tab stops. Leaning one widget, with the workspace buttons left
  outside it.
  - Answer:
- Where does "focus the tree" / "focus the tabs" live? Roving focus helps
  once you are *in* a widget; getting there still needs a route. ⌘B opens
  the tree but does not focus it (`App.tsx:5195-5205`). Leaning: ⌘B also
  moves focus when the tree is already open, plus explicit focus-cycle
  commands in the registry (they are unconditional, so they are registry
  material, unlike the arrows). Not blocking - the guide's "route to the
  widgets" step picks one in the diff.
  - Answer:
