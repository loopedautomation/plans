---
"looped-plans": minor
---

Linux and Windows lose the desktop's titlebar. macOS has drawn its own chrome
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
