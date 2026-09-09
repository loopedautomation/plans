import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "../Editor";
import { RemoteSheet } from "../RemoteSheet";
import { api, type RemoteRoot } from "../api";
import { confirmed } from "../confirm";
import { splitFrontmatter } from "../matter";
import {
  applySettings,
  loadSettings,
  parseSettingsFile,
  saveSettings,
  serializeSettings,
  type Extras,
  type Settings,
} from "../settings";
import { RemoteNeedsAttention, useRemoteBrowser } from "../remote";
import { WorkspacesTab } from "./WorkspacesTab";
import { SettingsTab } from "./SettingsTab";
import SETTINGS_SCHEMA from "../settings.schema.json";
import "../App.css";
import "./mobile.css";

type Screen = "computers" | "files" | "document";
/**
 * Two stacks: Workspaces is where the person acts, Computers is how a
 * repository an agent is working in gets read over SSH. The bar is drawn
 * only at the root of each, so inside a document Back means Back.
 */
type Tab = "workspaces" | "computers" | "settings";

export default function MobileApp() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [booted, setBooted] = useState(false);
  const extras = useRef<Extras>({});
  const browser = useRemoteBrowser();
  const [tab, setTab] = useState<Tab>("workspaces");
  const [screen, setScreen] = useState<Screen>("computers");
  const [computer, setComputer] = useState<RemoteRoot | null>(null);
  const [dir, setDir] = useState("");
  const [openDoc, setOpenDoc] = useState<{
    path: string;
    content: string;
    stamp: string;
  } | null>(null);
  const [sheet, setSheet] = useState<true | RemoteRoot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    void api.settingsRead().then(
      (file) => {
        if (!live) return;
        if (file.text) {
          const parsed = parseSettingsFile(file.text);
          extras.current = parsed.extras;
          setSettings(parsed.settings);
        }
        setBooted(true);
      },
      () => setBooted(true),
    );
    void api
      .settingsWriteSchema(`${JSON.stringify(SETTINGS_SCHEMA, null, 2)}\n`)
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
    if (booted)
      void api
        .settingsWrite(serializeSettings(settings, extras.current))
        .catch(() => {});
  }, [booted, settings]);

  const saveRemote = useCallback((remote: RemoteRoot) => {
    setSettings((current) => ({
      ...current,
      remoteRoots: current.remoteRoots.some((item) => item.id === remote.id)
        ? current.remoteRoots.map((item) =>
            item.id === remote.id ? remote : item,
          )
        : [...current.remoteRoots, remote],
    }));
  }, []);

  const attention = (remote: RemoteRoot, reason: unknown) => {
    if (reason instanceof RemoteNeedsAttention) setSheet(remote);
    else setError(String(reason));
  };

  const openComputer = async (remote: RemoteRoot) => {
    setError(null);
    setComputer(remote);
    setDir("");
    try {
      await browser.listDir(remote, "", true);
      setScreen("files");
    } catch (e) {
      attention(remote, e);
    }
  };

  const refresh = useCallback(async () => {
    if (!computer) return;
    setError(null);
    try {
      if (screen === "document" && openDoc) {
        const text = await browser.readFile(computer, openDoc.path);
        setOpenDoc({ path: openDoc.path, ...text });
      } else if (screen === "files") {
        await browser.listDir(computer, dir, true);
      }
    } catch (e) {
      attention(computer, e);
    }
  }, [browser, computer, dir, openDoc, screen]);

  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refresh]);

  const pull = {
    onTouchStart: (e: React.TouchEvent) => {
      touch.current = e.touches[0]?.clientY ?? null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const from = touch.current;
      touch.current = null;
      const to = e.changedTouches[0]?.clientY;
      if (from !== null && to !== undefined && to - from > 64) void refresh();
    },
  };

  const entries = computer
    ? (browser.snapshots[computer.id]?.entries ?? []).filter((entry) => {
        const at = entry.path.lastIndexOf("/");
        const parent = at === -1 ? "" : entry.path.slice(0, at);
        return (
          parent === dir &&
          (entry.kind === "dir" ||
            settings.showAllFiles ||
            /\.(md|markdown)$/i.test(entry.path))
        );
      })
    : [];

  const forget = async (remote: RemoteRoot) => {
    if (
      !(await confirmed(
        `Forget ${remote.name}? Nothing on that computer is touched.`,
        { ok: "Forget" },
      ))
    )
      return;
    browser.forget(remote.id);
    await api.remoteSecretClear(remote.id).catch(() => {});
    setSettings((current) => ({
      ...current,
      remoteRoots: current.remoteRoots.filter((item) => item.id !== remote.id),
    }));
    setSheet(null);
    setComputer(null);
    setScreen("computers");
  };

  const bar = (
    <nav className="mobile-tabs" aria-label="Sections">
      <button className={tab === "workspaces" ? "on" : ""} onClick={() => setTab("workspaces")} data-testid="tab-workspaces">
        Workspaces
      </button>
      <button className={tab === "computers" ? "on" : ""} onClick={() => setTab("computers")} data-testid="tab-computers">
        Computers
      </button>
      <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")} data-testid="tab-settings">
        Settings
      </button>
    </nav>
  );

  if (tab === "settings") {
    return (
      <div className="mobile-app">
        <SettingsTab settings={settings} set={(patch) => setSettings((s) => ({ ...s, ...patch }))} bar={bar} />
      </div>
    );
  }

  if (tab === "workspaces") {
    return (
      <div className="mobile-app">
        <WorkspacesTab bar={bar} onError={setError} />
        {error && (
          <button className="mobile-error" onClick={() => setError(null)}>
            {error}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mobile-app">
      {screen === "computers" && (
        <>
          <header className="mobile-head">
            <h1>Computers</h1>
          </header>
          <main className="mobile-list">
            {settings.remoteRoots.map((remote) => {
              const phase =
                browser.snapshots[remote.id]?.phase ?? "disconnected";
              return (
                <div className="mobile-row mobile-computer-row" key={remote.id}>
                  <button
                    className="mobile-computer"
                    aria-label={`Browse ${remote.name}`}
                    onClick={() => void openComputer(remote)}
                  >
                    <span>
                      <b>{remote.name}</b>
                      <small>
                        {remote.user}@{remote.host}:{remote.port}
                      </small>
                    </span>
                    <span className={`mobile-state ${phase}`}>{phase}</span>
                  </button>
                  <button
                    className="mobile-more"
                    aria-label={`Connection settings for ${remote.name}`}
                    onClick={() => setSheet(remote)}
                  >
                    Settings
                  </button>
                </div>
              );
            })}
            {!settings.remoteRoots.length && (
              <p className="mobile-empty">
                Add a computer to open one of its repositories over SSH.
              </p>
            )}
          </main>
          <footer className="mobile-foot">
            <button className="mobile-primary" onClick={() => setSheet(true)}>
              Connect to a computer
            </button>
          </footer>
          {bar}
        </>
      )}

      {screen === "files" && computer && (
        <>
          <header className="mobile-head">
            <button
              onClick={() => {
                if (dir)
                  setDir(
                    dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "",
                  );
                else setScreen("computers");
              }}
            >
              Back
            </button>
            <span>
              <b>{computer.name}</b>
              <small>
                {dir || "/"} ·{" "}
                {browser.snapshots[computer.id]?.phase ?? "disconnected"}
              </small>
            </span>
            <button onClick={() => void refresh()}>Refresh</button>
          </header>
          <main className="mobile-list" {...pull}>
            {entries.map((entry) => (
              <button
                className="mobile-row"
                key={entry.path}
                onClick={() => {
                  if (entry.kind === "dir") {
                    void browser.listDir(computer, entry.path).then(
                      () => setDir(entry.path),
                      (e) => attention(computer, e),
                    );
                  } else {
                    void browser.readFile(computer, entry.path).then(
                      (text) => {
                        setOpenDoc({ path: entry.path, ...text });
                        setScreen("document");
                      },
                      (e) => attention(computer, e),
                    );
                  }
                }}
              >
                <span>
                  {entry.kind === "dir" ? `${entry.name}/` : entry.name}
                </span>
                {entry.status && (
                  <span className="mobile-status">{entry.status}</span>
                )}
              </button>
            ))}
            {!entries.length && (
              <p className="mobile-empty">
                No files here. Pull down to refresh.
              </p>
            )}
          </main>
          <footer className="mobile-foot mobile-toggle">
            <label>
              <input
                type="checkbox"
                checked={settings.showAllFiles}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showAllFiles: e.target.checked }))
                }
              />{" "}
              All files
            </label>
            <button onClick={() => setSheet(computer)}>
              Connection settings
            </button>
          </footer>
        </>
      )}

      {screen === "document" && computer && openDoc && (
        <>
          <header className="mobile-head">
            <button onClick={() => setScreen("files")}>Back</button>
            <span>
              <b>{openDoc.path.split("/").pop()}</b>
              <small>{openDoc.path}</small>
            </span>
            <button onClick={() => void refresh()}>Refresh</button>
          </header>
          <main className="mobile-document" {...pull}>
            <Editor
              key={`${computer.id}:${openDoc.path}:${openDoc.stamp}`}
              repo=""
              relPath={openDoc.path}
              docKey={`${computer.id}:${openDoc.path}:${openDoc.stamp}`}
              initialValue={splitFrontmatter(openDoc.content).body}
              spellcheck={false}
              imageFolder=""
              author=""
              onChange={() => {}}
              readOnly
            />
          </main>
        </>
      )}

      {error && (
        <button className="mobile-error" onClick={() => setError(null)}>
          {error}
        </button>
      )}

      {sheet && (
        <RemoteSheet
          remote={sheet === true ? null : sheet}
          initialResult={
            sheet === true
              ? null
              : (browser.snapshots[sheet.id]?.attention ?? null)
          }
          onSave={saveRemote}
          onConnected={(remote) => {
            setSheet(null);
            void openComputer(remote);
          }}
          onCancel={() => setSheet(null)}
          onForget={
            sheet === true ? undefined : (remote) => void forget(remote)
          }
        />
      )}
    </div>
  );
}
