//! Read-only SSH remote roots.
//!
//! A remote root is not a repository. It is one canonical directory behind an
//! SFTP subsystem, and every public operation takes a relative path beneath
//! that directory. The manager owns one live session per saved connection and
//! retries a failed read once with a fresh session.

use crate::{stamp_of, PlanText, R};
use russh::client::{self, AuthResult, KeyboardInteractiveAuthResponse};
use russh::keys::{decode_secret_key, key::PrivateKeyWithHashAlg, HashAlg, PublicKeyOrCertificate};
use russh::MethodKind;
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::io::AsyncReadExt;
use tokio::sync::{Mutex as AsyncMutex, RwLock};

const KEYCHAIN_SERVICE: &str = "com.ratulmaharaj.plans.remote";
const MAX_TEXT_BYTES: u64 = 12 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteRoot {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub root: String,
    pub auth: RemoteAuth,
    pub host_key: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RemoteAuth {
    Password,
    Key,
    /// No credential: the server accepts the connection on identity alone, as
    /// Tailscale SSH does. If the server answers with a keyboard-interactive
    /// prompt instead (Tailscale's "check mode" sends a URL to confirm in a
    /// browser), the prompt's text is what the sheet shows.
    None,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSecret {
    /// Password for password auth; an OpenSSH private key for key auth.
    pub secret: String,
    /// Only used for an encrypted private key.
    #[serde(default)]
    pub passphrase: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResult {
    status: ConnectStatus,
    fingerprint: Option<String>,
    previous: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum ConnectStatus {
    Connected,
    TrustRequired,
    AuthRequired,
}

impl ConnectResult {
    fn connected(fingerprint: String) -> Self {
        Self {
            status: ConnectStatus::Connected,
            fingerprint: Some(fingerprint),
            previous: None,
            message: None,
        }
    }

    fn trust(fingerprint: String, previous: Option<String>) -> Self {
        Self {
            status: ConnectStatus::TrustRequired,
            fingerprint: Some(fingerprint),
            previous,
            message: None,
        }
    }

    fn auth(fingerprint: String, message: impl Into<String>) -> Self {
        Self {
            status: ConnectStatus::AuthRequired,
            fingerprint: Some(fingerprint),
            previous: None,
            message: Some(message.into()),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEntry {
    path: String,
    name: String,
    kind: RemoteEntryKind,
    modified: u64,
    size: u64,
    status: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum RemoteEntryKind {
    File,
    Dir,
}

#[derive(Default)]
pub struct RemoteManager {
    sessions: AsyncMutex<HashMap<String, RemoteSession>>,
    configs: RwLock<HashMap<String, RemoteRoot>>,
    #[cfg(test)]
    test_secrets: RwLock<HashMap<String, RemoteSecret>>,
}

struct RemoteSession {
    // The SFTP channel is carried by `sftp`; retaining the SSH handle also
    // makes the lifetime explicit and gives disconnect a single owner.
    _ssh: client::Handle<HostHandler>,
    sftp: SftpSession,
    root: String,
}

#[derive(Clone)]
struct HostHandler {
    expected: Option<String>,
    seen: Arc<Mutex<Option<String>>>,
}

/// The "none" method, and the fallback a Tailscale SSH server in check mode
/// takes: a keyboard-interactive exchange whose only prompt is a URL to open.
///
/// Ok(true) is authenticated; Ok(false) is a plain refusal; Err carries the
/// server's own words when it asked for something, so the sheet can show the
/// URL rather than "rejected".
async fn authenticate_none(
    ssh: &mut client::Handle<HostHandler>,
    user: &str,
) -> Result<Result<bool, String>, String> {
    let first = ssh
        .authenticate_none(user.to_string())
        .await
        .map_err(|e| format!("authentication failed: {e}"))?;
    let remaining = match first {
        AuthResult::Success => return Ok(Ok(true)),
        AuthResult::Failure {
            remaining_methods, ..
        } => remaining_methods,
    };
    if !remaining.contains(&MethodKind::KeyboardInteractive) {
        return Ok(Ok(false));
    }
    let mut answer = ssh
        .authenticate_keyboard_interactive_start(user.to_string(), None)
        .await
        .map_err(|e| format!("authentication failed: {e}"))?;
    // A server that only wants to tell us something (a URL, a notice) sends
    // prompts with nothing to type. Answer each with nothing, once; whatever
    // it said is kept, so that when it then refuses (check mode does, until
    // the link has been visited) the person sees the link and not "rejected".
    let mut said: Vec<String> = Vec::new();
    let mut rounds = 0;
    loop {
        match answer {
            KeyboardInteractiveAuthResponse::Success => return Ok(Ok(true)),
            KeyboardInteractiveAuthResponse::Failure { .. } => {
                return Ok(if said.is_empty() {
                    Ok(false)
                } else {
                    Err(said.join("\n"))
                });
            }
            KeyboardInteractiveAuthResponse::InfoRequest {
                name,
                instructions,
                prompts,
            } => {
                said.extend(
                    [name, instructions]
                        .into_iter()
                        .chain(prompts.iter().map(|p| p.prompt.clone()))
                        .filter(|t| !t.trim().is_empty()),
                );
                if rounds >= 1 || prompts.iter().any(|p| !p.echo) {
                    return Ok(Err(if said.is_empty() {
                        "The server asked for something this app cannot answer.".to_string()
                    } else {
                        said.join("\n")
                    }));
                }
                rounds += 1;
                answer = ssh
                    .authenticate_keyboard_interactive_respond(vec![String::new(); prompts.len()])
                    .await
                    .map_err(|e| format!("authentication failed: {e}"))?;
            }
        }
    }
}

fn host_key_matches(expected: Option<&str>, presented: &str) -> bool {
    expected == Some(presented)
}

impl client::Handler for HostHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let fingerprint = server_public_key
            .public_key()
            .fingerprint(HashAlg::Sha256)
            .to_string();
        if let Ok(mut seen) = self.seen.lock() {
            *seen = Some(fingerprint.clone());
        }
        Ok(host_key_matches(self.expected.as_deref(), &fingerprint))
    }
}

fn secret_entry(id: &str) -> R<keyring::Entry> {
    keyring::Entry::new(KEYCHAIN_SERVICE, id).map_err(|e| e.to_string())
}

fn stored_secret(id: &str) -> R<Option<RemoteSecret>> {
    match secret_entry(id)?.get_password() {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| format!("stored SSH credential is invalid: {e}")),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("could not read SSH credential: {e}")),
    }
}

fn clean_relative(path: &str) -> R<Vec<&str>> {
    if path.starts_with('/') || path.starts_with('\\') {
        return Err("absolute paths are not allowed".into());
    }
    if path.contains('\\') {
        return Err("remote paths must use '/' separators".into());
    }
    let mut parts = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => return Err("path escapes the remote root".into()),
            normal => parts.push(normal),
        }
    }
    Ok(parts)
}

fn join_remote(root: &str, parts: &[&str]) -> String {
    if parts.is_empty() {
        return root.to_string();
    }
    format!("{}/{}", root.trim_end_matches('/'), parts.join("/"))
}

fn within_root(root: &str, canonical: &str) -> bool {
    let root = root.trim_end_matches('/');
    canonical == root
        || canonical
            .strip_prefix(root)
            .is_some_and(|p| p.starts_with('/'))
}

fn frontmatter_status(text: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(text);
    let mut lines = text.lines();
    if lines.next()?.trim_end() != "---" {
        return None;
    }
    for line in lines {
        if line.trim_end() == "---" {
            return None;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        if !key.starts_with(char::is_whitespace) && key.trim().eq_ignore_ascii_case("status") {
            let value = value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();
            return (!value.is_empty()).then_some(value);
        }
    }
    None
}

impl RemoteSession {
    async fn confined_path(&self, relative: &str, include_leaf: bool) -> R<String> {
        let parts = clean_relative(relative)?;
        let checked = if include_leaf {
            parts.len()
        } else {
            parts.len().saturating_sub(1)
        };
        for end in 1..=checked {
            let path = join_remote(&self.root, &parts[..end]);
            let metadata = self
                .sftp
                .symlink_metadata(path)
                .await
                .map_err(|e| format!("could not inspect {relative}: {e}"))?;
            if metadata.is_symlink() {
                return Err(format!(
                    "symbolic links are not followed: {}",
                    parts[end - 1]
                ));
            }
            if end < checked && !metadata.is_dir() {
                return Err(format!("not a directory: {}", parts[end - 1]));
            }
        }
        let path = join_remote(&self.root, &parts);
        let canonical = self
            .sftp
            .canonicalize(path)
            .await
            .map_err(|e| format!("could not resolve {relative}: {e}"))?;
        if !within_root(&self.root, &canonical) {
            return Err("path escapes the remote root".into());
        }
        Ok(canonical)
    }

    async fn list(&self, relative: &str) -> R<Vec<RemoteEntry>> {
        let path = self.confined_path(relative, true).await?;
        let metadata = self
            .sftp
            .symlink_metadata(path.clone())
            .await
            .map_err(|e| format!("could not inspect {relative}: {e}"))?;
        if !metadata.is_dir() {
            return Err(format!("{relative} is not a directory"));
        }

        let parent = clean_relative(relative)?.join("/");
        let mut out = Vec::new();
        let entries = self
            .sftp
            .read_dir(path)
            .await
            .map_err(|e| format!("could not list {relative}: {e}"))?;
        for entry in entries {
            let name = entry.file_name();
            let kind = match entry.file_type() {
                russh_sftp::protocol::FileType::Dir => RemoteEntryKind::Dir,
                russh_sftp::protocol::FileType::File => RemoteEntryKind::File,
                // Directory symlinks are intentionally absent from the browser;
                // following them would make the configured root a suggestion.
                _ => continue,
            };
            let rel = if parent.is_empty() {
                name.clone()
            } else {
                format!("{parent}/{name}")
            };
            let metadata = entry.metadata();
            let status = if kind == RemoteEntryKind::File
                && matches!(
                    name.rsplit_once('.')
                        .map(|(_, e)| e.to_ascii_lowercase())
                        .as_deref(),
                    Some("md" | "markdown")
                ) {
                let remote_path = join_remote(&self.root, &clean_relative(&rel)?);
                match self.sftp.open(remote_path).await {
                    Ok(file) => {
                        let mut head = Vec::new();
                        let mut take = file.take(2048);
                        take.read_to_end(&mut head).await.ok();
                        frontmatter_status(&head)
                    }
                    Err(_) => None,
                }
            } else {
                None
            };
            out.push(RemoteEntry {
                path: rel,
                name,
                kind,
                modified: metadata.mtime.unwrap_or(0) as u64,
                size: metadata.size.unwrap_or(0),
                status,
            });
        }
        out.sort_by(|a, b| {
            (a.kind != RemoteEntryKind::Dir, a.name.to_ascii_lowercase())
                .cmp(&(b.kind != RemoteEntryKind::Dir, b.name.to_ascii_lowercase()))
        });
        Ok(out)
    }

    async fn read(&self, relative: &str) -> R<PlanText> {
        let path = self.confined_path(relative, true).await?;
        let metadata = self
            .sftp
            .symlink_metadata(path.clone())
            .await
            .map_err(|e| format!("could not inspect {relative}: {e}"))?;
        if !metadata.is_regular() {
            return Err(format!("{relative} is not a file"));
        }
        if metadata.size.unwrap_or(0) > MAX_TEXT_BYTES {
            return Err(format!("{relative} is too large to read"));
        }
        let bytes = self
            .sftp
            .read(path)
            .await
            .map_err(|e| format!("could not read {relative}: {e}"))?;
        if bytes.len() as u64 > MAX_TEXT_BYTES {
            return Err(format!("{relative} is too large to read"));
        }
        let content = String::from_utf8(bytes.clone())
            .map_err(|_| format!("{relative} is not UTF-8 text"))?;
        Ok(PlanText {
            stamp: stamp_of(&bytes),
            content,
        })
    }
}

impl RemoteManager {
    async fn credential(&self, id: &str) -> R<Option<RemoteSecret>> {
        #[cfg(test)]
        if let Some(secret) = self.test_secrets.read().await.get(id).cloned() {
            return Ok(Some(secret));
        }
        stored_secret(id)
    }

    async fn establish(&self, remote: &RemoteRoot) -> R<ConnectResult> {
        self.sessions.lock().await.remove(&remote.id);
        let seen = Arc::new(Mutex::new(None));
        let handler = HostHandler {
            expected: remote.host_key.clone(),
            seen: seen.clone(),
        };
        let config = client::Config::default();
        let connected = tokio::time::timeout(
            std::time::Duration::from_secs(12),
            client::connect(
                Arc::new(config),
                (remote.host.as_str(), remote.port),
                handler,
            ),
        )
        .await
        .map_err(|_| format!("connection to {} timed out", remote.host))?;
        let fingerprint = seen.lock().ok().and_then(|v| v.clone());
        let mut ssh = match connected {
            Ok(ssh) => ssh,
            Err(_e)
                if fingerprint.as_deref().is_some_and(|current| {
                    !host_key_matches(remote.host_key.as_deref(), current)
                }) =>
            {
                let current = fingerprint.expect("guard requires a fingerprint");
                return Ok(ConnectResult::trust(current, remote.host_key.clone()));
            }
            Err(e) => return Err(format!("could not connect to {}: {e}", remote.host)),
        };
        let fingerprint =
            fingerprint.ok_or_else(|| "SSH server did not present a host key".to_string())?;
        let authenticated = if remote.auth == RemoteAuth::None {
            match authenticate_none(&mut ssh, &remote.user).await? {
                Ok(ok) => ok,
                Err(prompt) => return Ok(ConnectResult::auth(fingerprint, prompt)),
            }
        } else {
            let Some(secret) = self.credential(&remote.id).await? else {
                return Ok(ConnectResult::auth(
                    fingerprint,
                    "A credential is required.",
                ));
            };
            match remote.auth {
                RemoteAuth::Password => ssh
                    .authenticate_password(remote.user.clone(), secret.secret)
                    .await
                    .map_err(|e| format!("password authentication failed: {e}"))?
                    .success(),
                RemoteAuth::Key => {
                    let key = match decode_secret_key(&secret.secret, secret.passphrase.as_deref())
                    {
                        Ok(key) => key,
                        Err(e) => {
                            return Ok(ConnectResult::auth(
                                fingerprint,
                                format!("Private key: {e}"),
                            ))
                        }
                    };
                    let hash = ssh
                        .best_supported_rsa_hash()
                        .await
                        .map_err(|e| format!("could not negotiate key authentication: {e}"))?
                        .flatten();
                    ssh.authenticate_publickey(
                        remote.user.clone(),
                        PrivateKeyWithHashAlg::new(Arc::new(key), hash),
                    )
                    .await
                    .map_err(|e| format!("key authentication failed: {e}"))?
                    .success()
                }
                RemoteAuth::None => unreachable!("handled above"),
            }
        };
        if !authenticated {
            return Ok(ConnectResult::auth(
                fingerprint,
                "The server rejected this credential.",
            ));
        }

        let channel = ssh
            .channel_open_session()
            .await
            .map_err(|e| format!("could not open SFTP channel: {e}"))?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("could not start SFTP: {e}"))?;
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("could not start SFTP: {e}"))?;
        sftp.set_timeout(15);
        let root = sftp
            .canonicalize(remote.root.clone())
            .await
            .map_err(|e| format!("could not open remote root {}: {e}", remote.root))?;
        let meta = sftp
            .symlink_metadata(root.clone())
            .await
            .map_err(|e| format!("could not inspect remote root: {e}"))?;
        if meta.is_symlink() || !meta.is_dir() {
            return Err("remote root must be a real directory, not a symbolic link".into());
        }
        let root = root.trim_end_matches('/').to_string();
        self.sessions.lock().await.insert(
            remote.id.clone(),
            RemoteSession {
                _ssh: ssh,
                sftp,
                root,
            },
        );
        Ok(ConnectResult::connected(fingerprint))
    }

    async fn reconnect(&self, id: &str) -> R<()> {
        let remote = self
            .configs
            .read()
            .await
            .get(id)
            .cloned()
            .ok_or_else(|| "unknown remote root".to_string())?;
        let result = self.establish(&remote).await?;
        if result.status == ConnectStatus::Connected {
            Ok(())
        } else {
            Err("remote connection needs attention".into())
        }
    }

    async fn list(&self, id: &str, relative: &str) -> R<Vec<RemoteEntry>> {
        let first = {
            let sessions = self.sessions.lock().await;
            let session = sessions
                .get(id)
                .ok_or_else(|| "remote is disconnected".to_string())?;
            session.list(relative).await
        };
        if first.is_ok() {
            return first;
        }
        self.sessions.lock().await.remove(id);
        self.reconnect(id).await?;
        let sessions = self.sessions.lock().await;
        sessions
            .get(id)
            .ok_or_else(|| "remote is disconnected".to_string())?
            .list(relative)
            .await
    }

    async fn read(&self, id: &str, relative: &str) -> R<PlanText> {
        let first = {
            let sessions = self.sessions.lock().await;
            let session = sessions
                .get(id)
                .ok_or_else(|| "remote is disconnected".to_string())?;
            session.read(relative).await
        };
        if first.is_ok() {
            return first;
        }
        self.sessions.lock().await.remove(id);
        self.reconnect(id).await?;
        let sessions = self.sessions.lock().await;
        sessions
            .get(id)
            .ok_or_else(|| "remote is disconnected".to_string())?
            .read(relative)
            .await
    }
}

#[tauri::command]
pub async fn remote_connect(
    manager: State<'_, RemoteManager>,
    id: String,
    remote: RemoteRoot,
) -> R<ConnectResult> {
    if id != remote.id {
        return Err("connection id does not match its configuration".into());
    }
    if remote.host.trim().is_empty()
        || remote.user.trim().is_empty()
        || remote.root.trim().is_empty()
    {
        return Err("host, user and remote root are required".into());
    }
    manager.configs.write().await.insert(id, remote.clone());
    manager.establish(&remote).await
}

#[tauri::command]
pub async fn remote_list(
    manager: State<'_, RemoteManager>,
    id: String,
    relative_dir: String,
) -> R<Vec<RemoteEntry>> {
    manager.list(&id, &relative_dir).await
}

#[tauri::command]
pub async fn remote_read(
    manager: State<'_, RemoteManager>,
    id: String,
    relative_path: String,
) -> R<PlanText> {
    manager.read(&id, &relative_path).await
}

#[tauri::command]
pub async fn remote_disconnect(manager: State<'_, RemoteManager>, id: String) -> R<()> {
    if let Some(session) = manager.sessions.lock().await.remove(&id) {
        let _ = session.sftp.close().await;
    }
    Ok(())
}

#[tauri::command]
pub fn remote_secret_set(id: String, secret: RemoteSecret) -> R<()> {
    if secret.secret.is_empty() {
        return Err("credential cannot be empty".into());
    }
    let raw = serde_json::to_string(&secret).map_err(|e| e.to_string())?;
    secret_entry(&id)?
        .set_password(&raw)
        .map_err(|e| format!("could not store SSH credential: {e}"))
}

#[tauri::command]
pub fn remote_secret_clear(id: String) -> R<()> {
    match secret_entry(&id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("could not clear SSH credential: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use russh::keys::{Algorithm, PrivateKey};
    use russh::server::{Auth, ChannelOpenHandle, Msg, Server as _, Session};
    use russh::MethodSet;
    use russh::{Channel, ChannelId};
    use russh_sftp::protocol::{
        Attrs, Data, File, FileAttributes, Handle, Name, OpenFlags, Status, StatusCode,
    };
    use std::collections::HashMap;
    use std::net::SocketAddr;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use tokio::net::TcpListener;

    fn status(id: u32) -> Status {
        Status {
            id,
            status_code: StatusCode::Ok,
            error_message: "Ok".into(),
            language_tag: "en-US".into(),
        }
    }

    fn file_attrs(id: u32, path: &str) -> Result<Attrs, StatusCode> {
        let metadata = std::fs::symlink_metadata(path).map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => StatusCode::NoSuchFile,
            std::io::ErrorKind::PermissionDenied => StatusCode::PermissionDenied,
            _ => StatusCode::Failure,
        })?;
        let mut attrs = FileAttributes::from(&metadata);
        if metadata.file_type().is_symlink() {
            attrs.set_regular(false);
            attrs.set_symlink(true);
        }
        Ok(Attrs { id, attrs })
    }

    #[derive(Clone)]
    struct TestSshServer {
        fail_read_once: Arc<AtomicBool>,
        connections: Arc<AtomicUsize>,
    }

    impl russh::server::Server for TestSshServer {
        type Handler = TestSshSession;

        fn new_client(&mut self, _: Option<SocketAddr>) -> Self::Handler {
            self.connections.fetch_add(1, Ordering::SeqCst);
            TestSshSession {
                channels: HashMap::new(),
                fail_read_once: self.fail_read_once.clone(),
            }
        }
    }

    struct TestSshSession {
        channels: HashMap<ChannelId, Channel<Msg>>,
        fail_read_once: Arc<AtomicBool>,
    }

    impl russh::server::Handler for TestSshSession {
        type Error = russh::Error;

        async fn auth_password(&mut self, _: &str, password: &str) -> Result<Auth, Self::Error> {
            Ok(if password == "reader-password" {
                Auth::Accept
            } else {
                Auth::reject()
            })
        }

        /// "tailnet" is a Tailscale SSH server: identity is the credential.
        /// "checked" is one in check mode: it wants a browser visit first.
        async fn auth_none(&mut self, user: &str) -> Result<Auth, Self::Error> {
            Ok(match user {
                "tailnet" => Auth::Accept,
                "checked" => Auth::Reject {
                    proceed_with_methods: Some(MethodSet::from(
                        &[MethodKind::KeyboardInteractive][..],
                    )),
                    partial_success: false,
                },
                _ => Auth::reject(),
            })
        }

        async fn auth_keyboard_interactive<'a>(
            &'a mut self,
            user: &str,
            _: &str,
            response: Option<russh::server::Response<'a>>,
        ) -> Result<Auth, Self::Error> {
            if user != "checked" {
                return Ok(Auth::reject());
            }
            // The first round carries the link; a reply to it is not enough
            // on its own, which is what check mode does until you visit it.
            Ok(if response.is_none() {
                Auth::Partial {
                    name: "Tailscale SSH".into(),
                    instructions: "To authenticate, visit: https://login.tailscale.com/a/abc123"
                        .into(),
                    prompts: std::borrow::Cow::Borrowed(&[]),
                }
            } else {
                Auth::reject()
            })
        }

        async fn channel_open_session(
            &mut self,
            channel: Channel<Msg>,
            reply: ChannelOpenHandle,
            _: &mut Session,
        ) -> Result<(), Self::Error> {
            self.channels.insert(channel.id(), channel);
            reply.accept().await;
            Ok(())
        }

        async fn subsystem_request(
            &mut self,
            channel_id: ChannelId,
            name: &str,
            session: &mut Session,
        ) -> Result<(), Self::Error> {
            if name != "sftp" {
                session.channel_failure(channel_id)?;
                return Ok(());
            }
            let channel = self
                .channels
                .remove(&channel_id)
                .expect("opened SFTP channel");
            session.channel_success(channel_id)?;
            russh_sftp::server::run(
                channel.into_stream(),
                TestSftpSession {
                    fail_read_once: self.fail_read_once.clone(),
                },
            )
            .await;
            Ok(())
        }
    }

    struct TestSftpSession {
        fail_read_once: Arc<AtomicBool>,
    }

    impl russh_sftp::server::Handler for TestSftpSession {
        type Error = StatusCode;

        fn unimplemented(&self) -> Self::Error {
            StatusCode::OpUnsupported
        }

        async fn realpath(&mut self, id: u32, path: String) -> Result<Name, Self::Error> {
            let path = std::fs::canonicalize(path).map_err(|_| StatusCode::NoSuchFile)?;
            Ok(Name {
                id,
                files: vec![File::dummy(path.to_string_lossy())],
            })
        }

        async fn lstat(&mut self, id: u32, path: String) -> Result<Attrs, Self::Error> {
            if path.ends_with("plan.md") && self.fail_read_once.swap(false, Ordering::SeqCst) {
                return Err(StatusCode::ConnectionLost);
            }
            file_attrs(id, &path)
        }

        async fn open(
            &mut self,
            id: u32,
            filename: String,
            _: OpenFlags,
            _: FileAttributes,
        ) -> Result<Handle, Self::Error> {
            file_attrs(id, &filename)?;
            Ok(Handle {
                id,
                handle: filename,
            })
        }

        async fn read(
            &mut self,
            id: u32,
            handle: String,
            offset: u64,
            len: u32,
        ) -> Result<Data, Self::Error> {
            let bytes = std::fs::read(handle).map_err(|_| StatusCode::Failure)?;
            let start = usize::try_from(offset).map_err(|_| StatusCode::Failure)?;
            if start >= bytes.len() {
                return Err(StatusCode::Eof);
            }
            let end = start.saturating_add(len as usize).min(bytes.len());
            Ok(Data {
                id,
                data: bytes[start..end].to_vec(),
            })
        }

        async fn close(&mut self, id: u32, _: String) -> Result<Status, Self::Error> {
            Ok(status(id))
        }
    }

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            // Two tests can start in the same nanosecond; the counter keeps
            // their directories apart.
            static SEQ: AtomicUsize = AtomicUsize::new(0);
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let seq = SEQ.fetch_add(1, Ordering::SeqCst);
            let path = std::env::temp_dir().join(format!(
                "plans-remote-test-{}-{nonce}-{seq}",
                std::process::id()
            ));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn relative_paths_are_confined() {
        assert_eq!(
            clean_relative("plans/./ssh.md").unwrap(),
            ["plans", "ssh.md"]
        );
        for path in [
            "/etc/passwd",
            "../secret",
            "plans/../../secret",
            "C:\\secret",
        ] {
            assert!(clean_relative(path).is_err(), "accepted {path}");
        }
    }

    #[test]
    fn root_prefix_needs_a_component_boundary() {
        assert!(within_root("/srv/work", "/srv/work/plans/a.md"));
        assert!(within_root("/srv/work", "/srv/work"));
        assert!(!within_root("/srv/work", "/srv/work-old/a.md"));
    }

    #[test]
    fn status_head_matches_the_local_parser_contract() {
        assert_eq!(
            frontmatter_status(b"---\nstatus: busy\n---\nbody"),
            Some("busy".into())
        );
        assert_eq!(frontmatter_status(b"hello\nstatus: busy"), None);
    }

    #[test]
    fn invalid_utf8_is_not_lossily_rendered() {
        assert!(String::from_utf8(vec![0xff, 0xfe]).is_err());
    }

    #[test]
    fn host_key_comparison_is_exact() {
        assert!(host_key_matches(Some("SHA256:abc"), "SHA256:abc"));
        assert!(!host_key_matches(Some("SHA256:abc"), "SHA256:abd"));
        assert!(!host_key_matches(None, "SHA256:abc"));
    }

    #[tokio::test]
    async fn none_auth_connects_on_identity_and_surfaces_a_check_mode_link() {
        let root = TestDir::new();
        std::fs::write(root.path().join("plan.md"), b"# Over the tailnet\n").unwrap();
        let host_key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap();
        let fingerprint = host_key
            .public_key()
            .fingerprint(HashAlg::Sha256)
            .to_string();
        let server_config = Arc::new(russh::server::Config {
            auth_rejection_time: std::time::Duration::from_millis(0),
            auth_rejection_time_initial: Some(std::time::Duration::from_millis(0)),
            keys: vec![host_key],
            ..Default::default()
        });
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let mut server = TestSshServer {
            fail_read_once: Arc::new(AtomicBool::new(false)),
            connections: Arc::new(AtomicUsize::new(0)),
        };
        let mut running = server.run_on_socket(server_config, &listener);
        let stop = running.handle();

        let client = async {
            let manager = RemoteManager::default();
            let remote = RemoteRoot {
                id: "tailnet".into(),
                name: "Laptop".into(),
                host: "127.0.0.1".into(),
                port,
                user: "tailnet".into(),
                root: root.path().to_string_lossy().into_owned(),
                auth: RemoteAuth::None,
                host_key: Some(fingerprint.clone()),
            };
            manager
                .configs
                .write()
                .await
                .insert(remote.id.clone(), remote.clone());
            // No secret was ever stored, and none is asked for.
            assert_eq!(
                manager.establish(&remote).await.unwrap().status,
                ConnectStatus::Connected
            );
            let text = manager.read(&remote.id, "plan.md").await.unwrap();
            assert_eq!(text.content, "# Over the tailnet\n");

            // Check mode: the server's link comes back as the message, so the
            // sheet can show it rather than "rejected".
            let checked = RemoteRoot {
                id: "checked".into(),
                user: "checked".into(),
                ..remote.clone()
            };
            manager
                .configs
                .write()
                .await
                .insert(checked.id.clone(), checked.clone());
            let result = manager.establish(&checked).await.unwrap();
            assert_eq!(result.status, ConnectStatus::AuthRequired);
            assert!(result
                .message
                .as_deref()
                .unwrap_or("")
                .contains("https://login.tailscale.com/a/abc123"));
        };

        tokio::select! {
            result = &mut running => panic!("test SSH server stopped early: {result:?}"),
            () = client => {}
        }
        stop.shutdown("test complete".into());
        let _ = running.await;
    }

    #[tokio::test]
    async fn sftp_reader_reconnects_and_refuses_symlinks_and_non_utf8() {
        let root = TestDir::new();
        std::fs::write(root.path().join("plan.md"), b"# Reconnected\n").unwrap();
        std::fs::write(root.path().join("binary.md"), [0xff, 0xfe]).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(root.path().join("plan.md"), root.path().join("linked.md"))
            .unwrap();

        let host_key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap();
        let fingerprint = host_key
            .public_key()
            .fingerprint(HashAlg::Sha256)
            .to_string();
        let server_config = Arc::new(russh::server::Config {
            auth_rejection_time: std::time::Duration::from_millis(0),
            auth_rejection_time_initial: Some(std::time::Duration::from_millis(0)),
            keys: vec![host_key],
            ..Default::default()
        });
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let connections = Arc::new(AtomicUsize::new(0));
        let mut server = TestSshServer {
            fail_read_once: Arc::new(AtomicBool::new(true)),
            connections: connections.clone(),
        };
        let mut running = server.run_on_socket(server_config, &listener);
        let stop = running.handle();

        let client = async {
            let manager = RemoteManager::default();
            let remote = RemoteRoot {
                id: "test".into(),
                name: "Test computer".into(),
                host: "127.0.0.1".into(),
                port,
                user: "reader".into(),
                root: root.path().to_string_lossy().into_owned(),
                auth: RemoteAuth::Password,
                host_key: Some(fingerprint),
            };
            manager.test_secrets.write().await.insert(
                remote.id.clone(),
                RemoteSecret {
                    secret: "reader-password".into(),
                    passphrase: None,
                },
            );
            manager
                .configs
                .write()
                .await
                .insert(remote.id.clone(), remote.clone());
            assert_eq!(
                manager.establish(&remote).await.unwrap().status,
                ConnectStatus::Connected
            );

            let text = manager.read(&remote.id, "plan.md").await.unwrap();
            assert_eq!(text.content, "# Reconnected\n");
            assert_eq!(
                connections.load(Ordering::SeqCst),
                2,
                "the failed read opens one fresh SSH session"
            );

            #[cfg(unix)]
            assert!(manager
                .read(&remote.id, "linked.md")
                .await
                .err()
                .unwrap()
                .contains("symbolic links"));
            assert!(manager
                .read(&remote.id, "binary.md")
                .await
                .err()
                .unwrap()
                .contains("not UTF-8"));
        };

        tokio::select! {
            result = &mut running => panic!("test SSH server stopped early: {result:?}"),
            () = client => {}
        }
        stop.shutdown("test complete".into());
        let _ = running.await;
    }
}
