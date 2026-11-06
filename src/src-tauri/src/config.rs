//! 設定ファイル（`~/.config/TsumiQiita/config.json`）の読み書き。
//! 値は文字列のみ。画面側のZodスキーマ（shared/schema.ts の SettingKeySchema）とキーを揃える。
//! APIトークン（TOKEN）はここには保存せず、OSの資格情報ストアに保存する（credential.rs）。

use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// 保存できる設定のキー
pub const KEYS: [&str; 5] = [
    "TARGET_DIR",
    "CURRENT_FILE",
    "VIEW_MODE",
    "THEME",
    "LEGACY_MIGRATED",
];

/// 読み込み→書き換え→保存の間に他の書き込みが割り込まないようにする
static LOCK: Mutex<()> = Mutex::new(());

/// 設定ファイルのパス（ディレクトリは `~/.config/TsumiQiita`）
pub fn config_path(dir: &Path) -> PathBuf {
    dir.join("config.json")
}

/// ホームディレクトリから設定ファイルのディレクトリを求める
pub fn default_dir(home: &Path) -> PathBuf {
    home.join(".config").join("TsumiQiita")
}

fn read_object(path: &Path) -> Result<Option<Map<String, Value>>, String> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    match serde_json::from_str(&text) {
        Ok(Value::Object(map)) => Ok(Some(map)),
        _ => Err(format!(
            "設定ファイルの形式が正しくありません: {}",
            path.display()
        )),
    }
}

/// 設定を読む。ファイルが無ければ None。既知のキーで空でない文字列の値だけを返す
pub fn read(path: &Path) -> Result<Option<BTreeMap<String, String>>, String> {
    Ok(read_object(path)?.map(|map| {
        map.into_iter()
            .filter(|(k, _)| KEYS.contains(&k.as_str()))
            .filter_map(|(k, v)| match v {
                Value::String(s) if !s.is_empty() => Some((k, s)),
                _ => None,
            })
            .collect()
    }))
}

/// 設定を1つ書き換える。値が None・空文字なら削除する。手で追加された未知のキーは残す
pub fn write(path: &Path, key: &str, value: Option<&str>) -> Result<(), String> {
    if !KEYS.contains(&key) {
        return Err(format!("未知の設定です: {key}"));
    }
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut map = read_object(path)?.unwrap_or_default();
    match value.filter(|v| !v.is_empty()) {
        Some(v) => map.insert(key.to_owned(), Value::String(v.to_owned())),
        None => map.remove(key),
    };
    let text = serde_json::to_string_pretty(&Value::Object(map)).map_err(|e| e.to_string())?;

    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // 書き込み途中で壊れないよう、一時ファイルに書いてから置き換える
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text + "\n").map_err(|e| e.to_string())?;
    restrict_permissions(&tmp)?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// フォルダーのパス等を含むため、本人以外が読めないようにする（WindowsはユーザーフォルダーのACLに任せる）
#[cfg(unix)]
fn restrict_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        config_path(&std::env::temp_dir().join(format!("tsumiqiita-config-{nanos}")))
    }

    #[test]
    fn default_dir_is_under_dot_config() {
        assert_eq!(
            default_dir(Path::new("home")),
            Path::new("home").join(".config").join("TsumiQiita")
        );
    }

    #[test]
    fn returns_none_when_missing() {
        assert_eq!(read(&temp_path()).unwrap(), None);
    }

    #[test]
    fn writes_and_deletes_values() {
        let path = temp_path();
        write(&path, "TARGET_DIR", Some("C:/記事")).unwrap();
        write(&path, "THEME", Some("dark")).unwrap();
        write(&path, "THEME", None).unwrap();
        write(&path, "VIEW_MODE", Some("")).unwrap();
        let read = read(&path).unwrap().unwrap();
        assert_eq!(read.len(), 1);
        assert_eq!(read["TARGET_DIR"], "C:/記事");
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn rejects_unknown_keys() {
        let path = temp_path();
        assert!(write(&path, "OTHER", Some("x")).is_err());
        // トークンは資格情報ストアに保存するため、設定ファイルには書かない
        assert!(write(&path, "TOKEN", Some("t")).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn ignores_but_keeps_unknown_or_invalid_entries() {
        let path = temp_path();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(
            &path,
            r#"{"OTHER":"x","THEME":1,"TOKEN":"t","VIEW_MODE":"split"}"#,
        )
        .unwrap();
        assert_eq!(read(&path).unwrap().unwrap().len(), 1);
        write(&path, "VIEW_MODE", Some("editor")).unwrap();
        let raw: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(raw["OTHER"], "x");
        assert_eq!(raw["VIEW_MODE"], "editor");
    }

    #[test]
    fn does_not_overwrite_broken_file() {
        let path = temp_path();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "not json").unwrap();
        assert!(read(&path).is_err());
        assert!(write(&path, "THEME", Some("dark")).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "not json");
    }
}
