---
"looped-plans": patch
---

A workspace plan's review lives in its frontmatter. *Request review* in the
palette sets `status: review`, names the reviewers in `reviewers:` and
leaves a comment at the top asking them; *Approve* adds you to `approved:`,
and when everyone asked has, the header offers `status: approved`. Reviewers
are drawn in the header with their faces; a comment thread whose latest turn
names you wears an amber mark; the palette lists the document's threads to
jump to. The tree's status dot is now verified against the file by the
server, so a status an agent wrote is seen without anyone opening the file.
