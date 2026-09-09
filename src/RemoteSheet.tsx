import { useEffect, useRef, useState } from "react";
import { api, type RemoteConnect, type RemoteRoot } from "./api";
import { useFocusTrap } from "./focus";

type Props = {
  remote?: RemoteRoot | null;
  initialResult?: RemoteConnect | null;
  onSave: (remote: RemoteRoot) => void;
  onConnected: (remote: RemoteRoot) => void;
  onCancel: () => void;
  onForget?: (remote: RemoteRoot) => void;
};

const freshId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const blank = (): RemoteRoot => ({
  id: freshId(),
  name: "",
  host: "",
  port: 22,
  user: "",
  root: ".",
  auth: "password",
  hostKey: null,
});

/** Add, trust and authenticate one computer without reading a stored secret. */
export function RemoteSheet({
  remote,
  initialResult,
  onSave,
  onConnected,
  onCancel,
  onForget,
}: Props) {
  const [value, setValue] = useState<RemoteRoot>(() => remote ?? blank());
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [result, setResult] = useState<RemoteConnect | null>(
    initialResult ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  useFocusTrap(sheet);

  useEffect(() => first.current?.focus(), []);

  const update = <K extends keyof RemoteRoot>(key: K, next: RemoteRoot[K]) =>
    setValue((old) => ({ ...old, [key]: next }));

  const connect = async (candidate = value) => {
    if (
      !candidate.name.trim() ||
      !candidate.host.trim() ||
      !candidate.user.trim()
    )
      return;
    setBusy(true);
    setError(null);
    try {
      if (secret) {
        await api.remoteSecretSet(candidate.id, {
          secret,
          passphrase:
            candidate.auth === "key" && passphrase ? passphrase : null,
        });
      }
      const answer = await api.remoteConnect(candidate);
      setResult(answer);
      if (answer.status === "connected") {
        onSave(candidate);
        onConnected(candidate);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const trust = () => {
    if (!result?.fingerprint) return;
    const trusted = { ...value, hostKey: result.fingerprint };
    setValue(trusted);
    // The pin is configuration, so it lands before authentication is tried.
    onSave(trusted);
    setResult(null);
    void connect(trusted);
  };

  const valid =
    value.name.trim() &&
    value.host.trim() &&
    value.user.trim() &&
    value.root.trim() &&
    value.port > 0 &&
    value.port <= 65535;

  return (
    <div className="matter-scrim remote-scrim" onMouseDown={onCancel}>
      <div
        className="matter-sheet remote-sheet"
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={remote ? "Connection settings" : "Connect to a computer"}
        data-testid="remote-sheet"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <div className="matter-head">
          <span className="tag">
            {remote ? "Connection settings" : "Connect to a computer"}
          </span>
        </div>

        <div className="remote-fields">
          <label>
            <span>Name</span>
            <input
              ref={first}
              value={value.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          <label>
            <span>Host</span>
            <input
              value={value.host}
              autoCapitalize="none"
              onChange={(e) => update("host", e.target.value)}
            />
          </label>
          <label className="remote-port">
            <span>Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={value.port}
              onChange={(e) => update("port", Number(e.target.value))}
            />
          </label>
          <label>
            <span>User</span>
            <input
              value={value.user}
              autoCapitalize="none"
              onChange={(e) => update("user", e.target.value)}
            />
          </label>
          <label>
            <span>Repository</span>
            <input
              value={value.root}
              autoCapitalize="none"
              placeholder="~/Projects/plans"
              onChange={(e) => update("root", e.target.value)}
            />
            <small className="remote-hint">
              The path of one git repository on that computer, as you would
              type it in a shell there. The app opens it the way it opens a
              local one, and nothing outside it is reachable.
            </small>
          </label>
          <label>
            <span>Authentication</span>
            <select
              value={value.auth}
              onChange={(e) =>
                update("auth", e.target.value as RemoteRoot["auth"])
              }
            >
              <option value="password">Password</option>
              <option value="key">OpenSSH private key</option>
              <option value="none">None (Tailscale SSH)</option>
            </select>
          </label>
          {value.auth === "none" ? (
            <p className="remote-note">
              No credential is stored. The server accepts you on identity
              alone; Tailscale SSH does this, and in check mode it answers
              with a link to confirm in a browser, which shows here.
            </p>
          ) : value.auth === "password" ? (
            <label>
              <span>
                Password {remote ? "(leave blank to keep stored)" : ""}
              </span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="remote-key">
                <span>
                  Private key {remote ? "(leave blank to keep stored)" : ""}
                </span>
                <textarea
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <input
                  type="file"
                  aria-label="Import OpenSSH private key"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void file.text().then(setSecret);
                  }}
                />
              </label>
              <label>
                <span>Key passphrase (if encrypted)</span>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        {result?.status === "trust-required" && (
          <div className="remote-trust" data-testid="remote-trust">
            <p>
              {result.previous
                ? "This computer presented a different host key. Compare it before replacing the saved pin."
                : "Compare this SHA-256 host key fingerprint with the computer before trusting it."}
            </p>
            {result.previous && <code>Saved: {result.previous}</code>}
            <code>Presented: {result.fingerprint}</code>
            <button className="act" onClick={trust} disabled={busy}>
              {result.previous
                ? "Trust replacement and connect"
                : "Trust and connect"}
            </button>
          </div>
        )}
        {result?.status === "auth-required" && (
          <p className="remote-error" data-testid="remote-auth-required">
            {result.message ?? "Enter a credential and connect again."}
          </p>
        )}
        {error && <p className="remote-error">{error}</p>}

        <div className="matter-foot">
          <span>Credentials stay in this device's credential store.</span>
          <span className="remote-actions">
            {remote && onForget && (
              <button className="act warn" onClick={() => onForget(value)}>
                Forget
              </button>
            )}
            <button
              className="act"
              onClick={() => void connect()}
              disabled={!valid || busy}
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
