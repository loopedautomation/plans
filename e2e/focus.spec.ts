/**
 * Focus, which nothing asserted before.
 *
 * The keyboard tests that already exist are about *commands* — which keys run
 * what. These are about the other half: where focus is, where Tab may go, and
 * where it lands when a dialog closes. That half had no coverage at all, which
 * is part of why every sheet leaked and every sheet dropped focus on the floor.
 */
import { test, expect, type Page } from "@playwright/test";
import { installFakeBackend, type FakeRepo } from "./fake-backend";

const REPOS: FakeRepo[] = [
  {
    path: "/repo/one",
    name: "one",
    branch: "main",
    files: {
      "first.md": "# First\n\nOne.\n",
      "notes/second.md": "# Second\n\nTwo.\n",
      "notes/third.md": "# Third\n\nThree.\n",
    },
  },
];

/** The repository opens itself at launch, so the tree starts as repo + notes/ + first. */
async function boot(page: Page) {
  await page.addInitScript(
    ([fn, list]) => {
      // eslint-disable-next-line no-new-func
      new Function(`return ${fn}`)()(list);
      localStorage.setItem(
        "plans.repos.v1",
        JSON.stringify((list as FakeRepo[]).map((r) => r.path)),
      );
      localStorage.setItem("plans.tabs.v1", "[]");
      localStorage.setItem("plans.split.v1", "null");
      localStorage.setItem("plans.splitTabs.v1", "[]");
    },
    [installFakeBackend.toString(), REPOS] as const,
  );
  await page.goto("/");
  await expect(page.locator(".files")).toBeVisible();
  await expect(page.locator(".row.file")).toHaveCount(1);
}

/** What has focus right now, as "<tag>.<first class>" — enough to place it. */
const where = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "none";
    return `${el.tagName.toLowerCase()}.${el.classList[0] ?? ""}`;
  });

/** The tree row that currently holds the widget's one tab stop. */
const cursor = (page: Page) =>
  page.evaluate(
    () =>
      (document.querySelector('.tree [data-rove][tabindex="0"]') as HTMLElement | null)?.dataset
        .rove ?? null,
  );

/** Put focus on the repository heading, the top of the tree. */
async function atTop(page: Page) {
  await page.locator(".row.repo").first().focus();
  expect(await cursor(page)).toBe("/repo/one::");
}

test("the tree is one tab stop, and arrows walk it", async ({ page }) => {
  await boot(page);

  // Exactly one row is reachable by Tab; the rest answer to arrows.
  await expect(page.locator('.tree [data-rove][tabindex="0"]')).toHaveCount(1);
  await atTop(page);

  // ← on an open row closes it, → opens it again: the same key, both ways.
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".row.repo")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".row.repo")).toHaveAttribute("aria-expanded", "true");

  // ↓ steps to the folder, and the tab stop travels with focus.
  await page.keyboard.press("ArrowDown");
  expect(await cursor(page)).toBe("/repo/one::notes");
  await expect(page.locator('.tree [data-rove][tabindex="0"]')).toHaveCount(1);

  // → on a closed folder opens it; ↓ then steps inside.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('.row.dir[data-rove="/repo/one::notes"]')).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("ArrowDown");
  expect(await cursor(page)).toBe("/repo/one::notes/second.md");

  // ← on a leaf climbs to its parent rather than moving one row up.
  await page.keyboard.press("ArrowLeft");
  expect(await cursor(page)).toBe("/repo/one::notes");

  // End goes to the last row, Home back to the first.
  await page.keyboard.press("End");
  expect(await cursor(page)).toBe("/repo/one::first.md");
  await page.keyboard.press("Home");
  expect(await cursor(page)).toBe("/repo/one::");
});

/*
 * The widget that is not there yet.
 *
 * A first launch has no repositories, so the tree is a sentence rather than a
 * tree, and the roving cursor has nothing to attach to. Whatever installs the
 * arrows has to notice when the tree finally arrives — a hook that reads its
 * ref once, at mount, would leave this app keyboard-dead until a reload.
 */
test("the tree answers arrows even when it arrives after the empty state", async ({ page }) => {
  await page.addInitScript(
    ([fn, list]) => {
      // eslint-disable-next-line no-new-func
      new Function(`return ${fn}`)()(list);
      localStorage.setItem("plans.repos.v1", "[]");
      localStorage.setItem("plans.tabs.v1", "[]");
      localStorage.setItem("plans.split.v1", "null");
      localStorage.setItem("plans.splitTabs.v1", "[]");
    },
    [installFakeBackend.toString(), REPOS] as const,
  );
  await page.goto("/");
  await expect(page.locator(".files")).toContainText("Add a repository to begin.");

  await page.evaluate(() => {
    (window as unknown as { __fake: { pick: string } }).__fake.pick = "/repo/one";
  });
  await page.getByRole("button", { name: "Add a repository" }).first().click();
  await expect(page.locator(".row.repo")).toHaveCount(1);

  // The tree that grew into an empty state is still one tab stop with arrows.
  await expect(page.locator('.tree [data-rove][tabindex="0"]')).toHaveCount(1);
  await atTop(page);
  await page.keyboard.press("ArrowDown");
  expect(await cursor(page)).toBe("/repo/one::notes");
});

test("Enter on a focused row opens the file", async ({ page }) => {
  await boot(page);
  await atTop(page);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.locator(".page-path")).toHaveText("first.md");
});

test("the menu key opens the row's menu, and Escape hands the row back", async ({ page }) => {
  await boot(page);
  await atTop(page);
  await page.keyboard.press("End");

  await page.keyboard.press("Shift+F10");
  const menu = page.locator(".ctx[role='menu']");
  await expect(menu).toBeVisible();
  // Focus moved into the menu — the thing `onContextMenu` alone never did.
  expect(await where(page)).toBe("button.ctx-item");
  await page.keyboard.press("ArrowDown");
  expect(await where(page)).toBe("button.ctx-item");

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.row.file[data-rove="/repo/one::first.md"]')).toBeFocused();
});

test("a sheet traps Tab and gives focus back when it closes", async ({ page }) => {
  await boot(page);
  await atTop(page);
  await page.keyboard.press("End");
  const row = page.locator('.row.file[data-rove="/repo/one::first.md"]');
  await expect(row).toBeFocused();

  await page.keyboard.press("Meta+/");
  const sheet = page.locator(".shortcut-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");

  // Tab cannot walk out of it, however long it walks.
  const inside = () =>
    page.evaluate(() => !!document.activeElement?.closest(".shortcut-sheet"));
  for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
  expect(await inside()).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await inside()).toBe(true);

  // And closing puts focus back where it was, rather than on <body>.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("the palette says which row is current, and returns focus on close", async ({ page }) => {
  await boot(page);
  await atTop(page);
  const row = page.locator('.row.repo[data-rove="/repo/one::"]');

  await page.keyboard.press("Meta+p");
  const input = page.locator(".palette-input");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-activedescendant", "palette-row-0");
  await expect(page.locator("#palette-row-0")).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", "palette-row-1");

  await page.keyboard.press("Escape");
  await expect(page.locator(".palette")).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("the tab strip honours its role: arrows select, ⌘arrows reorder", async ({ page }) => {
  await boot(page);
  await page.locator(".row.dir").first().click();
  await page.locator(".row.file", { hasText: "second" }).first().click();
  await expect(page.locator(".page-path")).toHaveText("notes/second.md");
  await page.locator(".row.file", { hasText: "third" }).first().click();
  await expect(page.locator(".tab")).toHaveCount(2);

  // One tab stop for the strip, as for the tree.
  await expect(page.locator('.tabs[data-strip="main"] .tab-name[tabindex="0"]')).toHaveCount(1);

  await page.locator(".tab.on .tab-name").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".page-path")).toHaveText("notes/second.md");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".page-path")).toHaveText("notes/third.md");

  // ⌘← is the drag, one step at a time: the order changes, the selection does not.
  const names = () => page.locator('.tabs[data-strip="main"] .tab-name').allTextContents();
  const before = await names();
  await page.keyboard.press("Meta+ArrowLeft");
  expect(await names()).toEqual([before[1], before[0]]);
  await expect(page.locator(".page-path")).toHaveText("notes/third.md");
});

test("the tree's separator moves from the keyboard", async ({ page }) => {
  await boot(page);
  const width = () =>
    page.evaluate(() =>
      Number((document.querySelector(".files-edge") as HTMLElement).getAttribute("aria-valuenow")),
    );
  await page.locator(".files-edge").focus();
  const start = await width();
  await page.keyboard.press("ArrowRight");
  expect(await width()).toBe(start + 16);
  await page.keyboard.press("ArrowLeft");
  expect(await width()).toBe(start);
});
