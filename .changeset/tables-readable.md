---
"looped-plans": patch
---

Tables in a document have rules, padding and a head again, in the editor and
on a shared page — the editor's table styles were never loaded, so a table was
bare cells run together. A table is sized to fit the page first, with the
text in its cells wrapping, and only one whose columns cannot shrink any
further scrolls inside its own block — never the whole page sideways, which
is what made one unreadable on a phone.
