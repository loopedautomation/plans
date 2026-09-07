//! A folder an agent is allowed to believe in.
//!
//! A workspace file has no path: its truth is a Yjs document on the wire. An
//! agent wants a working directory all the same — its shell, its grep, its
//! listing tools all read disk — so each workspace gets a folder under
//! `~/plans/workspaces`, written from the room's tree and rewritten whenever
//! the room changes. The room stays the truth; this is the copy the agent
//! starts in. Reads and writes the agent routes through the client are caught
//! in `client.rs` and answered from the room.
//!
//! Not every write comes through the client. A `sed -i` in the agent's shell,
//! a heredoc, an agent whose adapter never learned the client filesystem — all
//! of those land on disk and nowhere else, and used to be swept away by the
//! next rewrite. So the folder is watched the other way too: each write of
//! the tree remembers what it put on disk, and a file that no longer reads as
//! what was put there was changed from outside. Those are answered back to
//! the frontend, which turns them into edits of the room, rather than being
//! overwritten. The copy still never *is* the document; it is just no longer
//! a place where work can silently vanish.

use crate::R;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// One workspace's folder: which workspace it stands in for, and what was
/// last put on disk for each file, so an outside edit can be told from our
/// own rewrite.
#[derive(Default)]
pub struct Entry {
    pub id: String,
    pub written: HashMap<String, String>,
}

/// Every scratch folder in use, by folder.
#[derive(Default)]
pub struct Scratch(Mutex<HashMap<PathBuf, Entry>>);

/// One line of the tree as the frontend hands it over: a path within the
/// workspace, whether it is a file or a folder, and — for a file — its text.
#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScratchFile {
    pub path: String,
    pub kind: String,
    #[serde(default)]
    pub text: Option<String>,
}

/// A file the agent changed on disk rather than through the room: the path
/// within the workspace and what is there now.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct Outside {
    pub path: String,
    pub text: String,
}

/// What a write of the tree answers with: the folder, and every file found
/// changed on disk since the last write.
#[derive(Serialize, Debug)]
pub struct ScratchOut {
    pub dir: String,
    pub changed: Vec<Outside>,
}

/// Where the workspaces live: `~/plans/workspaces`. Somewhere a person can
/// find, and somewhere that survives — a cache directory is the first thing
/// a disk-cleaning tool empties, and an agent mid-task in a folder that just
/// vanished is not a thing to explain.
pub fn root() -> R<PathBuf> {
    Ok(crate::home_dir()?.join("plans").join("workspaces"))
}

/// Where a workspace's folder lives: `<root>/<id>`.
fn folder_for(id: &str) -> R<PathBuf> {
    // The id is the server's, and opaque — but it is about to become a path
    // segment, so anything that could climb out of the root is refused.
    if id.is_empty() || id.contains(['/', '\\', '\0']) || id == "." || id == ".." {
        return Err("not a workspace id".into());
    }
    Ok(root()?.join(id))
}

/// The scratch folder's idea of a relative path: forward slashes, no
/// climbing, nothing absolute.
fn safe_rel(path: &str) -> Option<PathBuf> {
    if path.is_empty() {
        return None;
    }
    let mut out = PathBuf::new();
    for part in path.split('/') {
        if part.is_empty() || part == "." || part == ".." || part.contains('\\') {
            return None;
        }
        out.push(part);
    }
    Some(out)
}

/// Write the tree into `folder`, and answer with what was changed there from
/// outside since the last write.
///
/// `written` is what the last write put on disk, by path, and is brought up
/// to date here. For a file the tree names, the room's text goes to disk
/// unless the disk no longer holds what was last written to it — then the
/// disk is what someone (the agent) changed, and it is reported instead of
/// overwritten. A file on disk the tree does not name is either one the
/// tree dropped, still reading as what was put there, which goes; or one
/// made from outside, which is reported. Dotfiles are the agent's own
/// business and are neither reported nor removed.
pub fn materialise(
    folder: &Path,
    files: &[ScratchFile],
    written: &mut HashMap<String, String>,
) -> R<Vec<Outside>> {
    std::fs::create_dir_all(folder).map_err(|e| format!("{}: {e}", folder.display()))?;
    let mut keep: HashSet<PathBuf> = HashSet::new();
    let mut changed = Vec::new();
    for f in files {
        let Some(rel) = safe_rel(&f.path) else {
            continue;
        };
        // Every ancestor is kept too, or a folder holding only files would be
        // taken for an outside one.
        for a in rel.ancestors() {
            if !a.as_os_str().is_empty() {
                keep.insert(folder.join(a));
            }
        }
        let at = folder.join(&rel);
        if f.kind == "folder" {
            std::fs::create_dir_all(&at).map_err(|e| format!("{}: {e}", at.display()))?;
            continue;
        }
        if let Some(parent) = at.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
        }
        let room = f.text.as_deref().unwrap_or("");
        let on_disk = std::fs::read_to_string(&at).ok();
        if let (Some(disk), Some(last)) = (on_disk.as_deref(), written.get(&f.path)) {
            if disk != last && disk != room {
                changed.push(Outside {
                    path: f.path.clone(),
                    text: disk.to_string(),
                });
                written.insert(f.path.clone(), disk.to_string());
                continue;
            }
        }
        if on_disk.as_deref() != Some(room) {
            std::fs::write(&at, room).map_err(|e| format!("{}: {e}", at.display()))?;
        }
        written.insert(f.path.clone(), room.to_string());
    }
    sweep(folder, folder, &keep, written, &mut changed)?;
    // What was on disk and is not any more has nothing to be compared with.
    written.retain(|rel, _| safe_rel(rel).map(|r| folder.join(r).exists()).unwrap_or(false));
    Ok(changed)
}

/// Walk what is under `dir` and not in `keep`: our own leftovers go, the
/// agent's files are reported.
fn sweep(
    root: &Path,
    dir: &Path,
    keep: &HashSet<PathBuf>,
    written: &mut HashMap<String, String>,
    changed: &mut Vec<Outside>,
) -> R<()> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if keep.contains(&p) {
            if is_dir {
                sweep(root, &p, keep, written, changed)?;
            }
            continue;
        }
        if is_dir {
            sweep(root, &p, keep, written, changed)?;
            // Ours if nothing outside was found under it: an empty folder
            // the tree dropped goes with its files.
            if std::fs::read_dir(&p).map(|mut d| d.next().is_none()).unwrap_or(false) {
                let _ = std::fs::remove_dir(&p);
            }
            continue;
        }
        let Some(rel) = under(root, &p) else { continue };
        let Ok(text) = std::fs::read_to_string(&p) else {
            // Not text: nothing the room could hold, nothing we wrote.
            continue;
        };
        match written.get(&rel) {
            // Still what we put there, and the tree dropped it.
            Some(last) if *last == text => {
                std::fs::remove_file(&p).map_err(|e| format!("{}: {e}", p.display()))?;
                written.remove(&rel);
            }
            // Made or changed from outside.
            _ => {
                changed.push(Outside {
                    path: rel.clone(),
                    text: text.clone(),
                });
                written.insert(rel, text);
            }
        }
    }
    Ok(())
}

/// Write a workspace's tree to its scratch folder and remember the folder.
/// Answers with the folder, which is what the chat starts its agent in, and
/// with whatever the agent changed there since the last write.
#[tauri::command]
pub fn workspace_scratch(app: AppHandle, id: String, files: Vec<ScratchFile>) -> R<ScratchOut> {
    let folder = folder_for(&id)?;
    let state: State<Scratch> = app.state();
    let mut folders = state.0.lock().unwrap();
    let entry = folders.entry(folder.clone()).or_insert_with(|| Entry {
        id: id.clone(),
        written: HashMap::new(),
    });
    let changed = materialise(&folder, &files, &mut entry.written)?;
    Ok(ScratchOut {
        dir: folder.display().to_string(),
        changed,
    })
}

/// Stop routing a folder's reads and writes to the room. The files stay; the
/// next chat writes over them.
#[tauri::command]
pub fn workspace_scratch_forget(app: AppHandle, id: String) -> R<()> {
    let folder = folder_for(&id)?;
    let state: State<Scratch> = app.state();
    state.0.lock().unwrap().remove(&folder);
    Ok(())
}

/// The workspace and the path within it that `path` stands for, if it is
/// under a registered scratch folder.
pub fn workspace_for(app: &AppHandle, path: &Path) -> Option<(String, String)> {
    let state = app.try_state::<Scratch>()?;
    let folders = state.0.lock().unwrap();
    for (folder, entry) in folders.iter() {
        if let Some(rel) = under(folder, path) {
            return Some((entry.id.clone(), rel));
        }
    }
    None
}

/// `path` relative to `folder`, forward slashes, when it is inside it.
pub fn under(folder: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(folder).ok()?;
    let parts: Vec<String> = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    if parts.is_empty() {
        return None;
    }
    Some(parts.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(path: &str, text: &str) -> ScratchFile {
        ScratchFile {
            path: path.into(),
            kind: "file".into(),
            text: Some(text.into()),
        }
    }

    fn dir(path: &str) -> ScratchFile {
        ScratchFile {
            path: path.into(),
            kind: "folder".into(),
            text: None,
        }
    }

    #[test]
    fn the_folder_is_the_tree_and_nothing_else() {
        let tmp = tempdir();
        let mut written = HashMap::new();
        let changed = materialise(
            &tmp,
            &[
                file("plan.md", "# Plan\n"),
                dir("notes"),
                file("notes/a.md", "a"),
            ],
            &mut written,
        )
        .unwrap();
        assert!(changed.is_empty());
        assert_eq!(
            std::fs::read_to_string(tmp.join("plan.md")).unwrap(),
            "# Plan\n"
        );
        assert_eq!(
            std::fs::read_to_string(tmp.join("notes/a.md")).unwrap(),
            "a"
        );

        // A file the tree dropped, still as we wrote it, goes.
        let changed = materialise(&tmp, &[file("plan.md", "# Plan\n"), dir("notes")], &mut written).unwrap();
        assert!(changed.is_empty());
        assert!(!tmp.join("notes/a.md").exists());
        assert!(tmp.join("notes").is_dir());
        assert!(!written.contains_key("notes/a.md"));
        std::fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn a_file_the_agent_changed_on_disk_is_reported_not_overwritten() {
        let tmp = tempdir();
        let mut written = HashMap::new();
        materialise(&tmp, &[file("plan.md", "# Plan\n")], &mut written).unwrap();

        // The agent's shell edits the file. The next write of the tree,
        // with the room unchanged, answers with the edit and leaves it be.
        std::fs::write(tmp.join("plan.md"), "# Plan\n\nDone by sed.\n").unwrap();
        let changed = materialise(&tmp, &[file("plan.md", "# Plan\n")], &mut written).unwrap();
        assert_eq!(
            changed,
            vec![Outside {
                path: "plan.md".into(),
                text: "# Plan\n\nDone by sed.\n".into()
            }]
        );
        assert_eq!(
            std::fs::read_to_string(tmp.join("plan.md")).unwrap(),
            "# Plan\n\nDone by sed.\n"
        );

        // Reported once: the same disk against the same room is not news.
        let changed = materialise(&tmp, &[file("plan.md", "# Plan\n")], &mut written).unwrap();
        assert!(changed.is_empty());

        // Once the room has taken the edit — re-serialised, say — the disk
        // follows the room again.
        let changed = materialise(&tmp, &[file("plan.md", "# Plan\n\nDone by sed.\n\n")], &mut written).unwrap();
        assert!(changed.is_empty());
        assert_eq!(
            std::fs::read_to_string(tmp.join("plan.md")).unwrap(),
            "# Plan\n\nDone by sed.\n\n"
        );
        std::fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn a_file_the_agent_made_is_reported_and_kept() {
        let tmp = tempdir();
        let mut written = HashMap::new();
        materialise(&tmp, &[file("plan.md", "# Plan\n")], &mut written).unwrap();
        std::fs::create_dir_all(tmp.join("notes")).unwrap();
        std::fs::write(tmp.join("notes/new.md"), "# New\n").unwrap();
        // The agent's own dotfiles are neither news nor litter.
        std::fs::create_dir_all(tmp.join(".claude")).unwrap();
        std::fs::write(tmp.join(".claude/settings.json"), "{}").unwrap();

        let changed = materialise(&tmp, &[file("plan.md", "# Plan\n")], &mut written).unwrap();
        assert_eq!(
            changed,
            vec![Outside {
                path: "notes/new.md".into(),
                text: "# New\n".into()
            }]
        );
        assert!(tmp.join("notes/new.md").exists());
        assert!(tmp.join(".claude/settings.json").exists());

        // Once the tree has it, it is an ordinary file of the tree.
        let changed = materialise(
            &tmp,
            &[file("plan.md", "# Plan\n"), dir("notes"), file("notes/new.md", "# New\n")],
            &mut written,
        )
        .unwrap();
        assert!(changed.is_empty());
        std::fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn a_path_that_climbs_is_skipped() {
        let tmp = tempdir();
        let mut written = HashMap::new();
        materialise(&tmp, &[file("../escape.md", "no"), file("/abs.md", "no")], &mut written).unwrap();
        assert!(!tmp.parent().unwrap().join("escape.md").exists());
        assert!(std::fs::read_dir(&tmp).unwrap().next().is_none());
        std::fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn under_answers_the_workspace_path() {
        let f = Path::new("/home/me/plans/workspaces/abc");
        assert_eq!(
            under(f, Path::new("/home/me/plans/workspaces/abc/notes/a.md")),
            Some("notes/a.md".into())
        );
        assert_eq!(under(f, Path::new("/home/me/plans/workspaces/abc")), None);
        assert_eq!(under(f, Path::new("/home/me/plans/workspaces/abcd/x.md")), None);
        assert_eq!(under(f, Path::new("/elsewhere/x.md")), None);
    }

    #[test]
    fn the_root_is_under_home_not_a_cache() {
        let r = root().unwrap();
        assert!(r.ends_with(Path::new("plans").join("workspaces")));
        assert!(!r.to_string_lossy().contains("Caches"));
    }

    fn tempdir() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "plans-scratch-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }
}
