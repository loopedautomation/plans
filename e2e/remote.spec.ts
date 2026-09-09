import { expect, test, type Page } from "@playwright/test";
import { installFakeBackend, type FakeRemote } from "./fake-backend";
import type { RemoteRoot } from "../src/api";

const remote: RemoteRoot = {
  id: "workstation",
  name: "Workstation",
  host: "workstation.tailnet",
  port: 22,
  user: "reader",
  root: "/srv/work",
  auth: "password",
  hostKey: null,
};

const server: FakeRemote = {
  id: remote.id,
  fingerprint: "SHA256:test-host-key",
  files: {
    "README.md": "# Remote readme\n",
    "plans/ssh.md": "---\nstatus: busy\n---\n# SSH plan\n\nRemote prose.\n",
    "plans/nested/later.md": "# Later\n",
    "src/main.ts": "export const remote = true;\n",
  },
};

async function boot(
  page: Page,
  saved: RemoteRoot[],
  options: { secret?: string; mobile?: boolean } = {},
) {
  await page.addInitScript(
    ([fn, roots, remotes, secret, target]) => {
      // eslint-disable-next-line no-new-func
      new Function(`return ${fn}`)()([], null, null, remotes, target);
      localStorage.setItem(
        "plans.settings.v1",
        JSON.stringify({ remoteRoots: roots }),
      );
      localStorage.setItem("plans.tabs.v1", "[]");
      if (secret)
        (window as any).__fake.remoteSecrets[roots[0].id] = { secret };
    },
    [
      installFakeBackend.toString(),
      saved,
      [server],
      options.secret ?? null,
      options.mobile ? "mobile" : "desktop",
    ] as const,
  );
  await page.goto("/");
}

test("desktop trusts, authenticates, lazily navigates and never writes", async ({
  page,
}) => {
  await boot(page, [remote]);
  await expect(
    page.locator(".row.repo.remote", { hasText: "Workstation" }),
  ).toBeVisible();

  await page.locator(".row.repo.remote", { hasText: "Workstation" }).click();
  await expect(page.getByTestId("remote-trust")).toContainText(
    "SHA256:test-host-key",
  );
  await page.getByRole("button", { name: "Trust and connect" }).click();
  await expect(page.getByTestId("remote-auth-required")).toBeVisible();

  await page.getByLabel(/^Password/).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByTestId("remote-sheet")).toHaveCount(0);
  await expect(page.locator(".row.dir", { hasText: "plans/" })).toBeVisible();
  await expect(page.locator(".row.file", { hasText: "ssh" })).toHaveCount(0);

  await page.locator(".row.dir", { hasText: "plans/" }).click();
  await expect(page.locator(".row.file", { hasText: "ssh" })).toBeVisible();
  const listed = await page.evaluate(() =>
    (window as any).__fake.calls
      .filter((call: any) => call.cmd === "remote_list")
      .map((call: any) => call.args.relativeDir),
  );
  expect(listed).toEqual(["", "plans"]);

  await page.locator(".row.file", { hasText: "ssh" }).click();
  await expect(page.locator(".milkdown")).toContainText("Remote prose");
  await expect(page.locator(".milkdown .ProseMirror")).toHaveAttribute(
    "contenteditable",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Git", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".view-switch")).toHaveCount(0);
  await page.keyboard.press("Meta+Shift+p");
  for (const query of [
    "source raw markdown",
    "split another file",
    "new plan",
  ]) {
    await page.locator(".palette-input").fill(`>${query}`);
    await expect(page.getByRole("option")).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("F2");
  await page.keyboard.press("Meta+g");
  await expect(page.locator(".git")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() =>
      (window as any).__fake.calls.filter((c: any) =>
        ["write_plan", "rename_plan", "create_plan"].includes(c.cmd),
      ),
    ),
  ).toHaveLength(0);

  // A dead connection does not clear the snapshot. The next explicit refresh
  // reconnects and repeats the read-only request.
  await page.evaluate(
    () => ((window as any).__fake.remotes[0].failNext = true),
  );
  await page
    .locator(".row.dir", { hasText: "plans/" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Refresh" }).click();
  await expect(page.locator(".row.repo.remote .repo-branch")).toHaveText(
    "disconnected",
  );
  await expect(page.locator(".row.file", { hasText: "ssh" })).toBeVisible();
  await page
    .locator(".row.dir", { hasText: "plans/" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Refresh" }).click();
  await expect(page.locator(".row.repo.remote .repo-branch")).toHaveText("SSH");

  await page.keyboard.press("Meta+Shift+p");
  await page.locator(".palette-input").fill(">show all files");
  await page.keyboard.press("Enter");
  await page.locator(".row.dir", { hasText: "src/" }).click();
  await page.locator(".row.file", { hasText: "main.ts" }).click();
  await expect(page.locator(".milkdown")).toContainText(
    "export const remote = true",
  );
  await expect(page.locator(".milkdown .ProseMirror")).toHaveAttribute(
    "contenteditable",
    "false",
  );
});

test("a changed host key stops before authentication and requires explicit replacement", async ({
  page,
}) => {
  await boot(page, [{ ...remote, hostKey: "SHA256:old-key" }], {
    secret: "password",
  });
  await page.locator(".row.repo.remote", { hasText: "Workstation" }).click();
  await expect(page.getByTestId("remote-trust")).toContainText(
    "Saved: SHA256:old-key",
  );
  await expect(page.getByTestId("remote-trust")).toContainText(
    "Presented: SHA256:test-host-key",
  );
  await page
    .getByRole("button", { name: "Trust replacement and connect" })
    .click();
  await expect(page.getByTestId("remote-sheet")).toHaveCount(0);
});

test("key authentication accepts an imported OpenSSH key without echoing a stored key", async ({
  page,
}) => {
  await boot(page, [{ ...remote, auth: "key", hostKey: server.fingerprint }]);
  await page.locator(".row.repo.remote", { hasText: "Workstation" }).click();
  await expect(page.getByTestId("remote-auth-required")).toBeVisible();
  await page
    .locator("textarea")
    .fill(
      "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
    );
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByTestId("remote-sheet")).toHaveCount(0);

  await page
    .locator(".row.repo.remote", { hasText: "Workstation" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Connection settings…" }).click();
  await expect(page.locator("textarea")).toHaveValue("");
});

test("the phone shell drills through files and keeps the document read-only", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, [{ ...remote, hostKey: server.fingerprint }], {
    secret: "password",
    mobile: true,
  });
  await page.getByTestId("tab-computers").click();
  await expect(page.getByRole("heading", { name: "Computers" })).toBeVisible();
  await page
    .getByRole("button", { name: "Connection settings for Workstation" })
    .click();
  await expect(page.getByTestId("remote-sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Browse Workstation" }).click();
  await expect(page.locator(".mobile-head")).toContainText("Workstation");
  await page.getByRole("button", { name: "plans/" }).click();
  await page.getByRole("button", { name: /ssh\.md/ }).click();
  await expect(page.locator(".mobile-document .milkdown")).toContainText(
    "Remote prose",
  );
  await expect(page.locator(".mobile-document .ProseMirror")).toHaveAttribute(
    "contenteditable",
    "false",
  );
});
