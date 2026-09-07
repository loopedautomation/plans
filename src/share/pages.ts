/**
 * The reader's half of the page API.
 *
 * Deliberately small and deliberately separate from `src/workspace.ts`: that
 * module is the app as a signed-in client, and none of it — no token, no
 * keychain, no room — belongs on a public page. All the reader does is ask
 * one address for one document.
 */

export type Page = {
  id: string;
  kind: "file";
  name: string;
  source: "workspace" | "repository";
  /** A workspace document's page reads the room, so it is worth asking again. */
  live: boolean;
  publishedAt: number;
  markdown: string;
};

/**
 * A folder shared as one page: the files under its prefix, relative to it,
 * and which one a reader lands on. Each file's text is a second ask.
 */
export type Folder = {
  id: string;
  kind: "folder";
  name: string;
  source: "workspace";
  live: true;
  publishedAt: number;
  prefix: string;
  files: string[];
  landing: string | null;
};

/**
 * Where the API is.
 *
 * In a deployment the reader is served by the server itself, so the API is
 * the same origin and the answer is a path. The localStorage override is the
 * same one the app uses, and is for a browser test — or a dev server —
 * pointed at a server it started.
 */
export function apiBase(): string {
  try {
    const local = localStorage.getItem("plans.workspaceServer");
    if (local) return `${local.replace(/\/$/, "")}/api`;
  } catch {
    // no storage: same origin
  }
  return "/api";
}

/**
 * Which plan this is.
 *
 * The address is the whole of it: `plans.looped.sh/{id}`. `?id=` is the same
 * thing said explicitly, for a dev server that does not do the server's
 * routing — the e2e test runs the reader off Vite, not off the server.
 */
export function pageId(): { id: string; at: string | null } | null {
  const q = new URLSearchParams(location.search);
  const asked = q.get("id");
  if (asked) return { id: asked, at: q.get("at") || null };
  const [seg, ...rest] = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(seg ?? "")) return null;
  let at: string | null = null;
  try {
    at = rest.length ? rest.map(decodeURIComponent).join("/") : null;
  } catch {
    at = null;
  }
  return { id: seg, at };
}

/**
 * The address of one file in a folder page, in the form this page was
 * opened with: `/{id}/{path}` served by the server, or `?id=&at=` off a dev
 * server that does no routing. Navigation writes it with `pushState`, so
 * the back button is a real back.
 */
export function fileAddress(id: string, at: string | null): string {
  const q = new URLSearchParams(location.search);
  if (q.get("id")) {
    q.set("id", id);
    if (at) q.set("at", at);
    else q.delete("at");
    return `${location.pathname}?${q.toString()}`;
  }
  return at ? `/${id}/${at.split("/").map(encodeURIComponent).join("/")}` : `/${id}`;
}

/**
 * The plan, or null when there isn't one.
 *
 * Null covers revoked, never-shared and misspelt alike — the page says the
 * same thing to all three, because distinguishing them would tell a stranger
 * which ids exist. A thrown error is something else: the server is not
 * answering, which is worth saying differently.
 */
export async function fetchPage(id: string): Promise<Page | Folder | null> {
  const res = await fetch(`${apiBase()}/pages/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`the server answered ${res.status}`);
  const got = (await res.json()) as Page | Folder;
  // Pages from before folders carry no kind; they are files.
  return got.kind === "folder" ? got : { ...got, kind: "file" };
}

/** One file of a folder page, as markdown; null when it is not under the share. */
export async function fetchFile(id: string, at: string): Promise<string | null> {
  const res = await fetch(
    `${apiBase()}/pages/${encodeURIComponent(id)}/${at.split("/").map(encodeURIComponent).join("/")}`,
    { headers: { Accept: "text/markdown" } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`the server answered ${res.status}`);
  return res.text();
}
