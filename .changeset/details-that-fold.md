---
"looped-plans": patch
---

A `<details>` section folds. The parser had been splitting the tag from what
it wrapped, so the summary stood alone and the body was always shown; the
opener is now a head that folds and unfolds the blocks up to `</details>`,
with `open` deciding the first state. The file is not changed.
