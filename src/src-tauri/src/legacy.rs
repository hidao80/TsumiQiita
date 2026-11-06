//! 旧Electron版の設定（localStorage）を読み出す。
//!
//! 旧版は `file://` オリジンの localStorage に `tsumiqiita_<KEY>` で保存していた。
//! Chromium は localStorage を `<userData>/Local Storage/leveldb` の LevelDB に、
//! キー `_file://\0\x01tsumiqiita_<KEY>`、値は先頭1バイトが 0x01 なら Latin-1、0x00 なら UTF-16LE で保存する。
//! 利用者のプロファイルを書き換えないよう、LevelDB は一時ディレクトリへ複製してから開く。

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// 移行対象のキー（リリース済みの旧版がlocalStorageに保存していたもの）
pub const LEGACY_KEYS: [&str; 3] = ["TOKEN", "TARGET_DIR", "CURRENT_FILE"];

/// 旧版のuserDataディレクトリ名の候補（Electronはpackage.jsonのnameを使う。Linuxは大文字小文字を区別する）
const PROFILE_NAMES: [&str; 2] = ["tsumiqiita", "TsumiQiita"];

/// 旧版のuserDataディレクトリを探す（`config_dir` はElectronの appData と同じ場所）
pub fn find_profile(config_dir: &Path) -> Option<PathBuf> {
    PROFILE_NAMES
        .iter()
        .map(|name| config_dir.join(name))
        .find(|dir| leveldb_dir(dir).is_dir())
}

fn leveldb_dir(profile: &Path) -> PathBuf {
    profile.join("Local Storage").join("leveldb")
}

/// localStorageの値をデコードする
fn decode_value(raw: &[u8]) -> Option<String> {
    let (kind, body) = raw.split_first()?;
    match kind {
        // Latin-1
        1 => Some(body.iter().map(|&b| b as char).collect()),
        // UTF-16LE
        0 => {
            if body.len() % 2 != 0 {
                return None;
            }
            let units: Vec<u16> = body
                .as_chunks::<2>()
                .0
                .iter()
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16(&units).ok()
        }
        _ => None,
    }
}

fn storage_key(key: &str) -> Vec<u8> {
    let mut k = b"_file://\x00\x01tsumiqiita_".to_vec();
    k.extend_from_slice(key.as_bytes());
    k
}

/// LevelDBディレクトリを一時ディレクトリへ複製する（LOCKは複製しない）
fn copy_to_temp(src: &Path) -> Result<PathBuf, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dst =
        std::env::temp_dir().join(format!("tsumiqiita-legacy-{}-{nanos}", std::process::id()));
    fs::create_dir_all(&dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        if name == "LOCK" || !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        fs::copy(entry.path(), dst.join(&name)).map_err(|e| e.to_string())?;
    }
    Ok(dst)
}

/// 旧版プロファイルのlocalStorageから設定を読み出す
pub fn read_settings(profile: &Path) -> Result<HashMap<String, String>, String> {
    let copy = copy_to_temp(&leveldb_dir(profile))?;
    let result = (|| {
        let options = rusty_leveldb::Options {
            create_if_missing: false,
            ..Default::default()
        };
        let mut db = rusty_leveldb::DB::open(&copy, options).map_err(|e| e.to_string())?;
        let mut values = HashMap::new();
        for key in LEGACY_KEYS {
            if let Some(raw) = db.get(&storage_key(key))
                && let Some(value) = decode_value(raw.as_ref())
            {
                values.insert(key.to_string(), value);
            }
        }
        Ok(values)
    })();
    let _ = fs::remove_dir_all(&copy);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 旧Electron版で実際に作ったLevelDB（.logのみ / Snappy圧縮の.ldbあり）を一時ディレクトリに展開する
    fn fixture(files: &[(&str, &[u8])]) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let profile = std::env::temp_dir()
            .join(format!("tsumiqiita-fixture-{nanos}"))
            .join("tsumiqiita");
        let dir = leveldb_dir(&profile);
        fs::create_dir_all(&dir).unwrap();
        for (name, bytes) in files {
            fs::write(dir.join(name), bytes).unwrap();
        }
        profile
    }

    fn expected() -> HashMap<String, String> {
        HashMap::from([
            ("TOKEN".to_string(), "legacy-token-123".to_string()),
            ("TARGET_DIR".to_string(), "C:\\Users\\記事".to_string()),
            (
                "CURRENT_FILE".to_string(),
                "C:\\Users\\記事\\a.md".to_string(),
            ),
        ])
    }

    #[test]
    fn reads_values_from_log() {
        let profile = fixture(&[
            (
                "CURRENT",
                include_bytes!("../tests/fixtures/electron-log/CURRENT.bin"),
            ),
            (
                "MANIFEST-000001",
                include_bytes!("../tests/fixtures/electron-log/MANIFEST-000001.bin"),
            ),
            (
                "000003.log",
                include_bytes!("../tests/fixtures/electron-log/000003.log.bin"),
            ),
        ]);
        assert_eq!(read_settings(&profile).unwrap(), expected());
    }

    #[test]
    fn reads_values_from_compressed_table() {
        let profile = fixture(&[
            (
                "CURRENT",
                include_bytes!("../tests/fixtures/electron-ldb/CURRENT.bin"),
            ),
            (
                "MANIFEST-000001",
                include_bytes!("../tests/fixtures/electron-ldb/MANIFEST-000001.bin"),
            ),
            (
                "000004.log",
                include_bytes!("../tests/fixtures/electron-ldb/000004.log.bin"),
            ),
            (
                "000005.ldb",
                include_bytes!("../tests/fixtures/electron-ldb/000005.ldb.bin"),
            ),
        ]);
        assert_eq!(read_settings(&profile).unwrap(), expected());
    }

    #[test]
    fn does_not_modify_the_profile() {
        let profile = fixture(&[
            (
                "CURRENT",
                include_bytes!("../tests/fixtures/electron-log/CURRENT.bin"),
            ),
            (
                "MANIFEST-000001",
                include_bytes!("../tests/fixtures/electron-log/MANIFEST-000001.bin"),
            ),
            (
                "000003.log",
                include_bytes!("../tests/fixtures/electron-log/000003.log.bin"),
            ),
        ]);
        let list = |p: &Path| {
            let mut names: Vec<_> = fs::read_dir(leveldb_dir(p))
                .unwrap()
                .map(|e| e.unwrap().file_name())
                .collect();
            names.sort();
            names
        };
        let before = list(&profile);
        read_settings(&profile).unwrap();
        assert_eq!(list(&profile), before);
    }

    #[test]
    fn finds_profile_by_name() {
        let profile = fixture(&[("CURRENT", b"MANIFEST-000001\n")]);
        let config_dir = profile.parent().unwrap();
        assert_eq!(find_profile(config_dir), Some(profile.clone()));
        assert_eq!(find_profile(&config_dir.join("missing")), None);
    }

    #[test]
    fn decodes_latin1_and_utf16() {
        assert_eq!(decode_value(b"\x01abc").as_deref(), Some("abc"));
        assert_eq!(
            decode_value(&[0, 0x18, 0x8a, 0x8b, 0x4e]).as_deref(),
            Some("記事")
        );
        assert_eq!(decode_value(&[2, 1]), None);
        assert_eq!(decode_value(&[]), None);
    }
}
