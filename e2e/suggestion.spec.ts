/**
 * Suggestions: a comment with a diff in it.
 *
 * Three things are worth holding still. The grammar — a suggestion is a
 * suggestion and a thread is a thread, and neither is ever read as the other.
 * The card — live one against the paragraph it quotes, stale one against a
 * paragraph that has gone. And the two moves, which are ordinary edits: accept
 * replaces the passage and takes the proposal away, reject only the second
 * half, and the file afterwards says so.
 */
import { test, expect, type Page } from "@playwright/test";
import { installFakeBackend, type FakeRepo } from "./fake-backend";

const LIVE = [
  "<!--",
  "@ratul suggests:",
  "The poll picks up a teammate's edits through the existing watcher.",
  "---",
  "The stamp poll notices a teammate's write and reloads a clean buffer.",
  "-->",
].join("\n");

const STALE = [
  "<!--",
  "@ratul suggests:",
  "A paragraph that is nowhere in this document.",
  "---",
  "Whatever it should have said instead.",
  "-->",
].join("\n");

/** A two-voice thread, and a body with two separators: neither is a proposal. */
const THREAD = ["<!--", "@ratul: Is this the right order?", "@sam: Yes, the room first.", "-->"].join("\n");
const MALFORMED = ["<!--", "@ratul suggests:", "one", "---", "two", "---", "three", "-->"].join("\n");

const PLAN = [
  "# Plan",
  "",
  "The poll picks up a teammate's edits through the existing watcher.",
  "",
  LIVE,
  "",
  "An ordinary thread sits below this one.",
  "",
  THREAD,
  "",
  "Nothing in the document matches the next one.",
  "",
  STALE,
  "",
  "And this one is not a proposal either.",
  "",
  MALFORMED,
  "",
].join("\n");

const REPOS: FakeRepo[] = [
  {
    path: "/repo/one",
    name: "one",
    branch: "main",
    files: {
      "plan.md": PLAN,
      "plain.md": "# Plain\n\nFirst paragraph here.\n\nSecond paragraph here.\n",
    },
  },
];

async function open(page: Page, file: string) {
  await page.addInitScript(
    ([fn, list]) => {
      // eslint-disable-next-line no-new-func
      new Function(`return ${fn}`)()(list);
      localStorage.setItem(
        "plans.repos.v1",
        JSON.stringify((list as FakeRepo[]).map((r) => r.path)),
      );
      localStorage.setItem("plans.tabs.v1", "[]");
    },
    [installFakeBackend.toString(), REPOS] as const,
  );
  await page.goto("/");
  await expect(page.locator(".files")).toBeVisible();
  const repo = page.locator('.row.repo[aria-expanded="false"]');
  if (await repo.count()) await repo.click();
  await page.locator(".row.file", { hasText: file }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

test("the grammar tells a proposal from a thread, and draws each as itself", async ({ page }) => {
  await open(page, "plan");

  // Two suggestions; the thread and the two-separator body stay comments.
  await expect(page.locator(".md-suggestion")).toHaveCount(2);
  await expect(page.locator(".md-comment")).toHaveCount(2);

  const live = page.locator(".md-suggestion").first();
  await expect(live).not.toHaveClass(/stale/);
  await expect(live.locator(".md-suggestion-handle")).toHaveText("@ratul");
  // A word diff, not two blocks of text: what stays is neither in nor out.
  await expect(live.locator(".md-suggestion-out")).toContainText("poll");
  await expect(live.locator(".md-suggestion-in")).toContainText("stamp");
  await expect(live.locator(".md-suggestion-act", { hasText: "Accept" })).toBeVisible();

  // The one whose quote matches nothing says so, and offers the other move.
  const stale = page.locator(".md-suggestion.stale");
  await expect(stale).toHaveCount(1);
  await expect(stale).toContainText("the text it changes is gone");
  await expect(stale.locator(".md-suggestion-act", { hasText: "Accept" })).toHaveCount(0);
  await expect(stale.locator(".md-suggestion-act", { hasText: "Insert here" })).toBeVisible();

  // The document still reads as it reads. Nothing was applied by rendering it.
  await expect(page.locator(".ProseMirror")).toContainText(
    "The poll picks up a teammate's edits through the existing watcher.",
  );
  await expect(page.locator(".ProseMirror")).not.toContainText("The stamp poll notices");
});

test("accept replaces the passage and leaves no trace in the file", async ({ page }) => {
  await open(page, "plan");
  await page.locator(".md-suggestion").first().locator(".md-suggestion-act", { hasText: "Accept" }).click();

  await expect(page.locator(".ProseMirror")).toContainText(
    "The stamp poll notices a teammate's write and reloads a clean buffer.",
  );
  await expect(page.locator(".ProseMirror")).not.toContainText("The poll picks up a teammate's edits");
  // The card went with it: resolving is deleting, as it is for a thread.
  await expect(page.locator(".md-suggestion")).toHaveCount(1);

  await page.keyboard.press("Meta+s");
  await page.waitForTimeout(500);
  await page.locator(".view-switch button", { hasText: "Source" }).click();
  const source = await page.locator(".source .cm-content").innerText();
  expect(source).toContain("The stamp poll notices a teammate's write");
  expect(source).not.toContain("suggests:\nThe poll picks up");
  // The thread below is untouched by any of it.
  expect(source).toContain("@sam: Yes, the room first.");
});

test("reject takes the proposal away and changes nothing else", async ({ page }) => {
  await open(page, "plan");
  await page.locator(".md-suggestion").first().locator(".md-suggestion-act", { hasText: "Reject" }).click();

  await expect(page.locator(".md-suggestion")).toHaveCount(1);
  await expect(page.locator(".ProseMirror")).toContainText(
    "The poll picks up a teammate's edits through the existing watcher.",
  );
  await expect(page.locator(".ProseMirror")).not.toContainText("The stamp poll notices");
});

test("a stale proposal goes in where it sits, rather than nowhere", async ({ page }) => {
  await open(page, "plan");
  await page.locator(".md-suggestion.stale .md-suggestion-act", { hasText: "Insert here" }).click();

  await expect(page.locator(".ProseMirror")).toContainText("Whatever it should have said instead.");
  await expect(page.locator(".md-suggestion.stale")).toHaveCount(0);
});

test("a person proposes the same way an agent does, from the page menu", async ({ page }) => {
  await open(page, "plain");

  // Select the paragraph, then ask to suggest against it.
  const para = page.locator(".ProseMirror p", { hasText: "Second paragraph" });
  await para.click({ clickCount: 3 });
  await para.click({ button: "right" });
  await page.locator(".ctx-item", { hasText: "Suggest…" }).click();

  // The box is prefilled with the block as it stands — the quote has to match
  // a whole node, so what you edit is the paragraph, not the selection.
  const field = page.locator(".matter-sheet textarea").first();
  await expect(field).toHaveValue("Second paragraph here.");
  await field.fill("Second paragraph, tightened.");
  await page.locator(".matter-sheet .act", { hasText: "Suggest" }).click();

  const card = page.locator(".md-suggestion");
  await expect(card).toHaveCount(1);
  await expect(card).not.toHaveClass(/stale/);
  await expect(card.locator(".md-suggestion-in")).toContainText("tightened");
  await expect(card.locator(".md-suggestion-act", { hasText: "Accept" })).toBeVisible();

  // And it applies to the paragraph it was written under, not another.
  await card.locator(".md-suggestion-act", { hasText: "Accept" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Second paragraph, tightened.");
  await expect(page.locator(".ProseMirror")).toContainText("First paragraph here.");
  await expect(page.locator(".md-suggestion")).toHaveCount(0);
});
