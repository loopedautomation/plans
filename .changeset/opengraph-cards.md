---
"looped-plans": patch
---

A shared plan's link unfurls. The reader's shell now carries the page's
title, opening line, status and owner as Open Graph tags, and a card drawn
from the same facts at `/api/pages/{id}/og.png` — satori and resvg, no
browser on the server. A folder page unfurls as its landing file; a dead id
serves the same bare shell as before, so nothing is learned by probing.
