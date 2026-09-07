---
"looped-plans": patch
---

A diagram's source folds again after editing it. The caret was still in the
fence, and the rule that keeps a fence being typed from vanishing was
refusing the fold; the button now moves the caret out first.
