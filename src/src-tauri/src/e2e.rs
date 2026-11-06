//! E2Eテスト用の差し替え。デバッグビルドでのみ環境変数を読み、リリースビルドでは常に無効。
//!
//! 実際のプロファイル・Qiita・ダイアログ・既定ブラウザに触れずにテストするために使う。

#[cfg(debug_assertions)]
fn var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

#[cfg(not(debug_assertions))]
fn var(_name: &str) -> Option<String> {
    None
}

/// WebViewのデータ（IndexedDB等）の保存先
pub fn data_dir() -> Option<String> {
    var("TSUMIQIITA_E2E_DATA_DIR")
}

/// 設定ファイル（config.json）を置くディレクトリ（本来は `~/.config/TsumiQiita`）
pub fn config_dir() -> Option<String> {
    var("TSUMIQIITA_E2E_CONFIG_DIR")
}

/// OSの資格情報ストアの代わりにAPIトークンを保存するファイル
pub fn token_file() -> Option<String> {
    var("TSUMIQIITA_E2E_TOKEN_FILE")
}

/// 移行元とする旧Electron版のuserDataディレクトリ
pub fn legacy_dir() -> Option<String> {
    var("TSUMIQIITA_E2E_LEGACY_DIR")
}

/// Qiita APIのベースURL（モックサーバー）
pub fn qiita_api() -> Option<String> {
    var("TSUMIQIITA_E2E_QIITA_API")
}

/// 保存ダイアログの代わりに返すパス
pub fn save_path() -> Option<String> {
    var("TSUMIQIITA_E2E_SAVE_PATH")
}

/// フォルダ選択ダイアログの代わりに返すパス
pub fn open_dir() -> Option<String> {
    var("TSUMIQIITA_E2E_OPEN_DIR")
}

/// 外部ブラウザで開く代わりにURLを追記するファイル
pub fn opened_log() -> Option<String> {
    var("TSUMIQIITA_E2E_OPENED_LOG")
}
