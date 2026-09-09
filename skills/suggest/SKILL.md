---
name: suggest
description: How to propose a change to a markdown file without making it - the exact HTML comment form the Looped Plans app renders as a suggestion card with Accept and Reject on it. Use when asked to suggest, propose, or recommend a rewrite of a passage in a plans/ folder or a workspace file, or whenever a change should be reviewed before it lands.
---
# Suggesting a change instead of making it

A suggestion is something you say *about* the document, so it goes into the
file the same way a comment does: as an HTML comment, under the block it is
about. The passage itself is left exactly as it was. The Looped Plans app
draws the comment as a card with the word diff and two buttons, and the
person decides. Every other markdown tool sees a comment and shows nothing.

## The form

```markdown
The paragraph exactly as it reads now, left untouched.

<!--
@claude suggests:
The paragraph exactly as it reads now, left untouched.
---
The paragraph as you think it should read.
-->
```

Four parts, in this order, and nothing else inside the comment:

1. **The head**: `@handle suggests:` on its own line. Sign with your own
   handle. `suggests:` alone is allowed when you have no handle.
2. **The old side**: the whole block, character for character, as it reads
   in the file now. This is the address. The app finds the block by
   matching this text, so a paraphrase, a partial quote, or a trimmed line
   finds nothing and the card says the text it changes is gone.
3. **A line holding only `---`**.
4. **The new side**: the block as it should read. Leave it empty to propose
   deleting the block.

## Rules the app relies on

- One block per suggestion. A block is one paragraph, one heading, one list
  item, one code fence. To change three paragraphs, write three comments.
- No blank line anywhere inside the comment. A blank line ends the block in
  markdown and the two halves stop being one suggestion.
- Exactly one `---` line inside the comment. If the old or new text itself
  contains a line that is only `---`, it cannot be suggested this way; say
  so in chat instead.
- Put the comment directly under the block it quotes, with one blank line
  between them. Proximity is how the app ranks two blocks that read the
  same.
- Do not change the passage, and do not touch anything else in the file. The
  file is the person's; the comment is yours.
- Write the suggestion with an ordinary file edit. There is no tool or
  command for it. The app watches the file and draws the card when the
  write lands.

## Worked example

Asked to make this heading shorter:

```markdown
## What we learned about the deployment pipeline this quarter
```

Write:

```markdown
## What we learned about the deployment pipeline this quarter

<!--
@claude suggests:
## What we learned about the deployment pipeline this quarter
---
## Deployment lessons this quarter
-->
```

The heading stays. The card shows the old line struck through and the new
one beside it. Accept replaces the heading and removes the comment. Reject
removes the comment only.

## When not to suggest

If the person asked you to *rewrite* or *edit*, make the change. A
suggestion is for when they asked for a proposal, or when the file is shared
and a change under someone else's cursor would be rude.
