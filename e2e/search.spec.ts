/**
 * `*`: search inside every file, in every open repository.
 *
 * The palette's third mode used to be a flat list of trimmed lines from one
 * repository, capped globally — which meant one dense file could be the whole
 * answer and a second repository could be silently absent. These tests hold
 * the three things that fixed: hits grouped under their file with the
 * per-file cap owning up to what it withheld, the fan-out across repositories
 * and the chip that narrows it, and a preview that follows the selection so a
 * hit can be judged without opening it.
 */
import { test, expect, type Page } from "@playwright/test";
import { installFakeBackend, type FakeRepo } from "./fake-backend";

/*
 * `dense.md` holds eight matches on odd lines from 3 to 17 — more than the
 * per-file cap of five, which is the point of it.
 */
const DENSE = [
  "# Dense",
  "",
  "alpha one",
  "filler",
  "alpha two",
  "filler",
  "alpha three",
  "filler",
  "alpha four",
  "filler",
  "alpha five",
  "filler",
  "alpha six",
  "filler",
  "alpha seven",
  "filler",
  "alpha eight",
  "",
].join("\n");

const REPOS: FakeRepo[] = [
  {
    path: "/repo/one",
    name: "one",
    branch: "main",
    files: {
      "dense.md": DENSE,
      "guide.md": "# Guide\n\nalpha here\n",
    },
  },
  {
    path: "/repo/two",
    name: "two",
    branch: "main",
    files: { "notes.md": "# Notes\n\nalpha over there\n" },
  },
];

async function boot(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([fn, list, prefs]) => {
      // eslint-disable-next-line no-new-func
      new Function(`return ${fn}`)()(list);
      localStorage.setItem(
        "plans.repos.v1",
        JSON.stringify((list as FakeRepo[]).map((r) => r.path)),
      );
      localStorage.setItem("plans.tabs.v1", "[]");
      localStorage.setItem("plans.settings.v1", JSON.stringify(prefs));
    },
    [installFakeBackend.toString(), REPOS, settings] as const,
  );
  await page.goto("/");
  await expect(page.locator(".files")).toBeVisible();
}

/** Unfold every repository and folder, so any file can be clicked. */
async function expandAll(page: Page) {
  for (let pass = 0; pass < 4; pass++) {
    const shut = page.locator(
      '.row.repo[aria-expanded="false"], .row.dir[aria-expanded="false"]',
    );
    const n = await shut.count();
    if (!n) return;
    for (let i = 0; i < n; i++) await shut.nth(0).click();
  }
}

/** Open the palette straight into `*`, and wait for the debounce to land. */
async function search(page: Page, term: string) {
  await page.keyboard.press("Meta+Shift+f");
  await expect(page.locator(".palette-input")).toHaveValue("*");
  await page.keyboard.type(term);
  await expect(page.locator(".palette-row.head").first()).toBeVisible();
}

test("⌘⇧F opens the palette already in search-inside mode", async ({ page }) => {
  await boot(page);
  await page.keyboard.press("Meta+Shift+f");
  await expect(page.locator(".palette-input")).toHaveValue("*");
  await expect(page.locator(".palette-foot")).toContainText("Inside files");
});

test("hits group under their file, and the per-file cap says what it kept back", async ({
  page,
}) => {
  await boot(page);
  await search(page, "alpha");

  // Three files across two repositories, each named by the repository it is
  // in, because more than one is open.
  const heads = page.locator(".palette-row.head");
  await expect(heads).toHaveCount(3);
  await expect(heads.nth(0)).toContainText("one/dense.md");
  await expect(heads.nth(1)).toContainText("one/guide.md");
  await expect(heads.nth(2)).toContainText("two/notes.md");

  // Five of eight from the dense file — and it says so, rather than letting
  // the missing three look like matches that were never there.
  await expect(heads.nth(0)).toContainText("5 shown · +3 more");
  await expect(page.locator(".palette-row.hit")).toHaveCount(7);
});

test("the scope chip narrows the fan-out to the active repository", async ({ page }) => {
  await boot(page);
  // Make repository one unambiguously the active one.
  await expandAll(page);
  await page.locator(".row.file", { hasText: "guide" }).first().click();
  await expect(page.locator(".milkdown")).toContainText("alpha here");

  await search(page, "alpha");
  await expect(page.locator(".palette-row.head")).toHaveCount(3);

  await page.locator(".palette-scope", { hasText: "all repos" }).click();
  await expect(page.locator(".palette-scope", { hasText: "this repo" })).toBeVisible();
  await expect(page.locator(".palette-row.head")).toHaveCount(2);
  await expect(page.locator(".palette-list")).not.toContainText("two/notes.md");
});

test("the preview shows the hit in context and follows the selection", async ({ page }) => {
  await boot(page);
  await search(page, "alpha");

  // The first row is the dense file's heading, which points at its first hit.
  const current = page.locator(".palette-preview .pv-line.on");
  await expect(current.locator(".pv-n")).toHaveText("3");
  await expect(current).toContainText("alpha one");
  await expect(current.locator(".pv-mark")).toHaveText("alpha");
  // Context, not just the line: the preview is a window around the hit.
  await expect(page.locator(".palette-preview")).toContainText("# Dense");

  // Down to the heading's own first hit, then to the second — the preview
  // moves with the selection, no extra keys.
  await page.keyboard.press("ArrowDown");
  await expect(current.locator(".pv-n")).toHaveText("3");
  await page.keyboard.press("ArrowDown");
  await expect(current.locator(".pv-n")).toHaveText("5");
  await expect(current).toContainText("alpha two");
});

test("Enter on a file's heading opens it with the find bar seeded", async ({ page }) => {
  await boot(page);
  await search(page, "alpha");

  await page.keyboard.press("Enter");
  await expect(page.locator(".milkdown")).toContainText("alpha one");
  await expect(page.locator(".find-input")).toHaveValue("alpha");
  await expect(page.locator(".find-count")).toHaveText("1 of 8");
});
