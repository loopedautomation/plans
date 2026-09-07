---
"looped-plans": patch
---

⌘F scrolls the page to the match. ProseMirror scrolls by walking up from the
selection's DOM node, which while the find bar has focus is the bar's input,
outside the editor — so a match below the fold stayed below it. The page now
scrolls from the match's own element.
