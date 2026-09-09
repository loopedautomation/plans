/**
 * The design gallery: every section present, every swatch carrying a value
 * on every paper, and the editor section drawing the fixture's cards.
 *
 * Served by the same dev server as the app: Vite serves any html under the
 * root, so the gallery's entry is reachable at its source path here and at
 * /design/ on the site.
 */
import { test, expect } from "@playwright/test";

const SECTIONS = ["thesis", "paper", "colour", "type", "ledger", "page"];

test("the gallery renders its sections, and the swatches read the live paper", async ({ page }) => {
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(e.message));
  await page.goto("/src/design/index.html");
  for (const id of SECTIONS) await expect(page.locator(`section#${id}`)).toBeVisible();

  const swatches = page.getByTestId("swatch");
  expect(await swatches.count()).toBeGreaterThan(30);
  const inkOn = async () => (await swatches.first().getAttribute("data-value")) ?? "";
  for (const paper of ["day", "sepia", "night"]) {
    await page.getByTestId(`paper-${paper}`).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", paper);
    // Every swatch re-read a value from the stylesheet; none came back blank.
    const values = await swatches.evaluateAll((els) => els.map((e) => e.getAttribute("data-value") ?? ""));
    expect(values.every((v) => v.length > 0)).toBe(true);
  }
  // The paper swatch is a different value on night than on day.
  await page.getByTestId("paper-day").click();
  const day = await inkOn();
  await page.getByTestId("paper-night").click();
  expect(await inkOn()).not.toBe(day);

  // Type: one specimen per reading face.
  expect(await page.getByTestId("face").count()).toBeGreaterThanOrEqual(5);
  // The ledger: badges in every tone, and the page head with its people.
  expect(await page.getByTestId("badge").count()).toBeGreaterThanOrEqual(6);
  await expect(page.getByTestId("owner")).toHaveAttribute("data-handle", "alice");
  await expect(page.getByTestId("reviewer").first()).toHaveAttribute("data-commented", "1");
  await expect(page.getByTestId("offer-approve")).toBeVisible();
  await page.getByTestId("ask").click();
  await expect(page.locator(".matter-sheet")).toContainText("Request review");
  await page.keyboard.press("Escape");
  await expect(page.locator(".matter-sheet")).toHaveCount(0);

  // The page: the editor drew the fixture, cards and all.
  const editor = page.locator("#page .ProseMirror");
  await expect(editor).toContainText("A page, as the editor draws it");
  await expect(page.locator("#page .md-comment")).toHaveCount(1);
  await expect(page.locator("#page .md-suggestion")).toHaveCount(1);
  await expect(page.locator("#page .md-suggestion-act")).toHaveCount(0);
  await expect(page.locator("#page .md-alert, #page [data-alert]").first()).toBeVisible();

  expect(faults).toEqual([]);
});
