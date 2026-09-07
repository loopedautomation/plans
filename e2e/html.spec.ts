/**
 * Markdown that contains HTML.
 *
 * A README is markdown too: centred divs, <sub> subtitles, <br> breaks, badge
 * rows, <picture> covers. The editor is WYSIWYG, so it has to render what the
 * spec allows rather than print the source and hope.
 */
import { test, expect, type Page } from "@playwright/test";
import { installFakeBackend, type FakeRepo } from "./fake-backend";

const FILES: Record<string, string> = {
  "wrap.md": `Para with <sub>a subtitle</sub> and <b>bold</b> inline.\n`,
  "break.md": `Line one<br/>line two\n`,
  "fold.md":
    "# Fold\n\n<details>\n<summary>Full error output</summary>\n\n```\nError: ENOENT\n```\n\n</details>\n\n<details open>\n<summary>Open by default</summary>\n\nShown from the start.\n\n</details>\n\nAfter.\n",
  "centre.md": `<div align="center">\n\n# Title<br/><sub><b>Sub.</b></sub>\n\n</div>\n`,
  "plain.md": `# Plain\n\nNo html at all.\n`,
};

const REPO: FakeRepo = {
  path: "/repo/one",
  name: "one",
  branch: "main",
  files: FILES,
};

async function open(page: Page, file: string) {
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(e.message));
  await page.addInitScript(
    ([fn, repo]) => {
      new Function(`return ${fn}`)()([repo]);
      localStorage.setItem("plans.repos.v1", JSON.stringify(["/repo/one"]));
      localStorage.setItem("plans.tabs.v1", "[]");
    },
    [installFakeBackend.toString(), REPO] as const,
  );
  await page.goto("/");
  await page.locator(".row.file", { hasText: file.replace(".md", "") }).first().click();
  await expect(page.locator(".milkdown .ProseMirror")).toBeVisible();
  return faults;
}

test("an inline wrapper styles the text it wraps, and hides its tags", async ({ page }) => {
  await open(page, "wrap.md");
  const editor = page.locator(".milkdown .ProseMirror");
  await expect(editor.locator(".md-i-sub")).toHaveText("a subtitle");
  await expect(editor.locator(".md-i-b")).toHaveText("bold");
  // The tags themselves are in the document but not on the page.
  await expect(editor.locator(".md-html:not(.md-hidden)")).toHaveCount(0);
});

test("<br> is a line break, not a missing character", async ({ page }) => {
  await open(page, "break.md");
  const breaks = await page.evaluate(
    () =>
      document.querySelectorAll(".milkdown .ProseMirror br:not(.ProseMirror-trailingBreak)").length,
  );
  expect(breaks, "the break should be rendered").toBeGreaterThan(0);
});

test("a centred block is centred", async ({ page }) => {
  await open(page, "centre.md");
  const centred = page.locator(".milkdown .ProseMirror .md-center").first();
  await expect(centred).toHaveCount(1);
  await expect(centred).toHaveCSS("text-align", "center");
});

test("html round-trips unchanged when it is only read", async ({ page }) => {
  await open(page, "centre.md");
  await page.waitForTimeout(2600);
  const writes = await page.evaluate(() =>
    (window as any).__fake.calls.filter((c: any) => c.cmd === "write_plan"),
  );
  expect(writes, "rendering html is not editing it").toHaveLength(0);
});

test("a <details> section folds under its summary, and unfolds on a click", async ({ page }) => {
  await open(page, "fold.md");
  const editor = page.locator(".milkdown .ProseMirror");
  const heads = editor.locator(".md-details-head");
  await expect(heads).toHaveCount(2);
  await expect(heads.nth(0)).toHaveText("Full error output");
  await expect(heads.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(heads.nth(1)).toHaveAttribute("aria-expanded", "true");
  // Folded: the code is in the document and not on the page. Open: shown.
  await expect(editor.getByText("Error: ENOENT")).toBeHidden();
  await expect(editor.getByText("Shown from the start.")).toBeVisible();
  await expect(editor.getByText("After.")).toBeVisible();
  // The closers are never shown.
  await expect(editor.locator(".md-html:not(.md-hidden)")).toHaveCount(0);

  // An open head sits close over its body: no blank line between them.
  const [head, body] = await Promise.all([
    heads.nth(1).boundingBox(),
    editor.getByText("Shown from the start.").boundingBox(),
  ]);
  expect((body?.y ?? 0) - ((head?.y ?? 0) + (head?.height ?? 0))).toBeLessThan(24);

  await heads.nth(0).click();
  await expect(heads.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(editor.getByText("Error: ENOENT")).toBeVisible();
  await heads.nth(1).click();
  await expect(editor.getByText("Shown from the start.")).toBeHidden();
});
