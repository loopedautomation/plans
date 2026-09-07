import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { installFakeBackend, type FakeRepo } from "./fake-backend";
const REPOS: FakeRepo[] = [{ path: "/repo/one", name: "one", branch: "main", files: { "plans/existing.md": "# Existing\n" } }];
let server: ChildProcess; let base: string;
test.beforeAll(async ({}, info) => {
  const port = 1471 + info.workerIndex; base = `http://127.0.0.1:${port}`;
  const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../server/src/index.js");
  server = spawn(process.execPath, [entry], { env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", WORKSPACES_DB: ":memory:", WORKSPACES_DEV_LOGIN: "1" }, stdio: "ignore" });
  const until = Date.now() + 15_000;
  while (Date.now() < until) { try { if ((await fetch(`${base}/health`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("no server");
});
test.afterAll(() => { server?.kill(); });
async function session(login: string) { const r = await fetch(`${base}/auth/dev`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login }) }); return (await r.json()).token; }
async function boot(browser: Browser, login: string): Promise<Page> {
  const token = await session(login); const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.addInitScript(([fn, list, tok, url]) => { new Function(`return ${fn}`)()(list); (window as any).__fake.workspaceToken = tok;
    localStorage.setItem("plans.workspaceServer", url as string); localStorage.setItem("plans.repos.v1", JSON.stringify((list as FakeRepo[]).map((r) => r.path))); localStorage.setItem("plans.tabs.v1", "[]");
  }, [installFakeBackend.toString(), REPOS, token, base] as const);
  await page.goto("/"); await expect(page.getByTestId("account")).toHaveText(login); (page as any).token = token; return page;
}
const count = (p: Page) => p.evaluate(() => Object.fromEntries(Object.entries((window as any).__fake.listeners as Record<string, unknown[]>).filter(([k]) => k.startsWith("agent-")).map(([k, v]) => [k, v.length])));
test("chunks in a workspace chat", async ({ browser }) => {
  test.setTimeout(120000);
  const alice = await boot(browser, "alice");
  await alice.locator(".ws-new").click();
  await alice.locator(".matter-sheet .name-field").fill("Ratul");
  await alice.locator(".matter-sheet .act", { hasText: "Create" }).click();
  await expect(alice.locator(".milkdown .ProseMirror h1")).toHaveText("Ratul");
  const list = await (await fetch(`${base}/workspaces`, { headers: { Authorization: `Bearer ${(alice as any).token}` } })).json();
  const dir = `/scratch/${list[0].id}`;
  await alice.locator(".rail-btn", { hasText: "Chat" }).click();
  await expect(alice.locator(".mux")).toBeVisible();
  console.log("LISTENERS after open", JSON.stringify(await count(alice)));
  const input = alice.locator(".chat-input textarea");
  await input.fill("hello"); await input.press("Enter");
  await alice.waitForTimeout(1500);
  console.log("LISTENERS after send", JSON.stringify(await count(alice)));
  await alice.evaluate((repo) => { const f = (window as any).__fake;
    f.emit("agent-tool", { repo, turn: 1, callId: "t1", title: "Write x.md", status: "completed" });
    f.emit("agent-message", { repo, turn: 1, text: "A" }); f.emit("agent-message", { repo, turn: 1, text: "B" }); f.emit("agent-message", { repo, turn: 1, text: "C" });
  }, dir);
  await alice.waitForTimeout(500);
  console.log("TEXT", JSON.stringify(await alice.locator(".chat-msg.assistant").allTextContents()));
  console.log("LISTENERS after chunks", JSON.stringify(await count(alice)));
  // Now type in the editor (the room changes, the folder is rewritten) and stream again.
  await alice.locator(".milkdown .ProseMirror h1").click(); await alice.keyboard.press("End"); await alice.keyboard.type(" typed");
  await alice.waitForTimeout(1500);
  await alice.evaluate((repo) => { const f = (window as any).__fake; f.emit("agent-message", { repo, turn: 1, text: "D" }); }, dir);
  await alice.waitForTimeout(500);
  console.log("TEXT2", JSON.stringify(await alice.locator(".chat-msg.assistant").allTextContents()));
  console.log("LISTENERS end", JSON.stringify(await count(alice)));
});
