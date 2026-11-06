//! QiitaのAPIトークンをOSの資格情報ストアに保存する。
//! Windows: 資格情報マネージャー / macOS: キーチェーン / Linux: Secret Service（GNOME Keyring・KWallet等）

use crate::e2e;
use keyring::{Entry, Error};
use std::fs;

/// 資格情報ストア上の名前（サービス名はアプリのidentifierに合わせる）
const SERVICE: &str = "io.github.hidao80.tsumiqiita";
const USER: &str = "qiita-access-token";

fn describe(e: Error) -> String {
    format!("OSの資格情報ストアを利用できません: {e}")
}

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(describe)
}

/// 保存済みのトークン。未保存なら None
pub fn read() -> Result<Option<String>, String> {
    // E2Eテストでは実際の資格情報ストアに触れず、一時ファイルを使う
    if let Some(file) = e2e::token_file() {
        return match fs::read_to_string(file) {
            Ok(token) => Ok(Some(token).filter(|t| !t.is_empty())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        };
    }
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token).filter(|t| !t.is_empty())),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(describe(e)),
    }
}

/// トークンを保存する。None・空文字なら削除する
pub fn write(token: Option<&str>) -> Result<(), String> {
    let token = token.filter(|t| !t.is_empty());
    if let Some(file) = e2e::token_file() {
        return match token {
            Some(t) => fs::write(file, t).map_err(|e| e.to_string()),
            None => match fs::remove_file(file) {
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
                _ => Ok(()),
            },
        };
    }
    let entry = entry()?;
    match token {
        Some(t) => entry.set_password(t).map_err(describe),
        None => match entry.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(e) => Err(describe(e)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 実際の資格情報ストアに読み書きするため、手動でのみ実行する（cargo test -- --ignored）
    #[test]
    #[ignore]
    fn round_trips_in_os_store() {
        let entry = Entry::new(&format!("{SERVICE}.test"), USER).unwrap();
        entry.set_password("トークン").unwrap();
        assert_eq!(entry.get_password().unwrap(), "トークン");
        entry.delete_credential().unwrap();
        assert!(matches!(entry.get_password(), Err(Error::NoEntry)));
    }
}
