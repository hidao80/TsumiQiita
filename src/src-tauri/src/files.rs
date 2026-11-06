//! 記事ファイル（.md）の読み書き。
//! プレビューは記事中の生HTMLを描画するため、読み書きできるのは .md ファイルに限定する。

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, PartialEq)]
pub struct MarkdownFile {
    pub name: String,
    pub path: String,
}

pub fn is_markdown(path: &str) -> bool {
    path.ends_with(".md")
}

fn require_markdown(path: &str) -> Result<(), String> {
    if is_markdown(path) {
        Ok(())
    } else {
        Err("Markdownファイル以外は扱えません".into())
    }
}

/// フォルダ内の .md ファイルを名前順に返す
pub fn list_markdown_files(dir: &str) -> Result<Vec<MarkdownFile>, String> {
    if dir.is_empty() {
        return Err("フォルダが指定されていません".into());
    }
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let path_str = path.to_string_lossy().into_owned();
        if is_markdown(&path_str) && path.is_file() {
            files.push(MarkdownFile {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: path_str,
            });
        }
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

pub fn read_markdown(path: &str) -> Result<String, String> {
    require_markdown(path)?;
    fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn write_markdown(path: &str, content: &str) -> Result<(), String> {
    require_markdown(path)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

/// 新規作成時のパス。拡張子が無ければ .md を付ける
pub fn with_markdown_extension(path: &Path) -> String {
    let s = path.to_string_lossy().into_owned();
    if is_markdown(&s) {
        s
    } else {
        format!("{s}.md")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("tsumiqiita-files-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn lists_only_markdown_files_sorted() {
        let dir = temp_dir();
        fs::write(dir.join("b.md"), "").unwrap();
        fs::write(dir.join("a.md"), "").unwrap();
        fs::write(dir.join("ignore.txt"), "").unwrap();
        fs::create_dir(dir.join("folder.md")).unwrap();
        let names: Vec<_> = list_markdown_files(dir.to_str().unwrap())
            .unwrap()
            .into_iter()
            .map(|f| f.name)
            .collect();
        assert_eq!(names, ["a.md", "b.md"]);
    }

    #[test]
    fn rejects_non_markdown_paths() {
        let dir = temp_dir();
        let txt = dir.join("x.txt");
        assert!(write_markdown(txt.to_str().unwrap(), "x").is_err());
        assert!(!txt.exists());
        assert!(read_markdown(txt.to_str().unwrap()).is_err());
    }

    #[test]
    fn reads_and_writes_markdown() {
        let dir = temp_dir();
        let md = dir.join("記事.md");
        write_markdown(md.to_str().unwrap(), "# 本文\r\n").unwrap();
        assert_eq!(read_markdown(md.to_str().unwrap()).unwrap(), "# 本文\r\n");
    }

    #[test]
    fn appends_markdown_extension() {
        assert_eq!(with_markdown_extension(Path::new("new")), "new.md");
        assert_eq!(with_markdown_extension(Path::new("new.md")), "new.md");
    }
}
