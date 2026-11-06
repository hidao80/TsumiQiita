mod config;
mod credential;
mod e2e;
mod files;
mod legacy;
mod qiita;

use files::MarkdownFile;
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::io::Write;
use std::path::PathBuf;
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// アプリ自身の画面のURLか（それ以外への遷移は止めて外部ブラウザで開く）
fn is_app_url(url: &Url) -> bool {
    match (url.scheme(), url.host_str()) {
        ("tauri", _) => true,
        (_, Some("tauri.localhost")) => true,
        // 開発時（tauri dev）はVite開発サーバーを表示する（ポートは tauri dev --config で変えられるため問わない）
        ("http", Some("localhost")) => cfg!(debug_assertions),
        _ => false,
    }
}

/// http/https のURLだけを既定ブラウザで開く
fn open_external_url(app: &AppHandle, url: &str) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|e| e.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("http/https 以外のURLは開けません".into());
    }
    if let Some(log) = e2e::opened_log() {
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log)
            .map_err(|e| e.to_string())?;
        return writeln!(file, "{url}").map_err(|e| e.to_string());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn select_target_dir(app: AppHandle) -> Option<String> {
    if let Some(dir) = e2e::open_dir() {
        return Some(dir);
    }
    app.dialog()
        .file()
        .set_title("フォルダの選択")
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
async fn create_article(app: AppHandle) -> Result<Option<String>, String> {
    let picked = match e2e::save_path() {
        Some(path) => Some(PathBuf::from(path)),
        None => app
            .dialog()
            .file()
            .set_title("新規作成")
            .add_filter("Markdownファイル", &["md"])
            .blocking_save_file()
            .and_then(|p| p.into_path().ok()),
    };
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = files::with_markdown_extension(&picked);
    files::write_markdown(&path, "")?;
    Ok(Some(path))
}

#[tauri::command]
fn list_markdown_files(dir: String) -> Result<Vec<MarkdownFile>, String> {
    files::list_markdown_files(&dir)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    files::read_markdown(&path)
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    files::write_markdown(&path, &content)
}

#[tauri::command]
async fn post_item(
    token: String,
    body: qiita::ItemBody,
    item_id: Option<String>,
) -> Result<Value, String> {
    qiita::post_item(&token, body, item_id.as_deref()).await
}

#[tauri::command]
async fn verify_token(token: String) -> Result<Value, String> {
    qiita::verify_token(&token).await
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    open_external_url(&app, &url)
}

/// 設定ファイルのパス（`~/.config/TsumiQiita/config.json`）
fn config_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match e2e::config_dir() {
        Some(dir) => PathBuf::from(dir),
        None => config::default_dir(&app.path().home_dir().map_err(|e| e.to_string())?),
    };
    Ok(config::config_path(&dir))
}

/// 設定を読む。設定ファイルが無ければ null
#[tauri::command]
fn read_config(app: AppHandle) -> Result<Option<BTreeMap<String, String>>, String> {
    config::read(&config_file(&app)?)
}

/// 設定を1つ書き換える。value が null なら削除する
#[tauri::command]
fn write_config(app: AppHandle, key: String, value: Option<String>) -> Result<(), String> {
    config::write(&config_file(&app)?, &key, value.as_deref())
}

// 資格情報ストアはOSの確認ダイアログを出すことがあるため、メインスレッドを塞がないようasyncにする
#[tauri::command]
async fn read_token() -> Result<Option<String>, String> {
    credential::read()
}

#[tauri::command]
async fn write_token(token: Option<String>) -> Result<(), String> {
    credential::write(token.as_deref())
}

/// 旧Electron版の設定を読み出す。旧版のプロファイルが無ければ status: absent
#[tauri::command]
fn read_legacy_settings(app: AppHandle) -> Result<Value, String> {
    let profile = match e2e::legacy_dir() {
        Some(dir) => {
            Some(PathBuf::from(dir)).filter(|p| p.join("Local Storage").join("leveldb").is_dir())
        }
        None => legacy::find_profile(&app.path().config_dir().map_err(|e| e.to_string())?),
    };
    match profile {
        None => Ok(json!({ "status": "absent" })),
        Some(profile) => {
            Ok(json!({ "status": "found", "values": legacy::read_settings(&profile)? }))
        }
    }
}

/// E2Eテストで、WebViewのデータが実際のプロファイルから分離されているか確認するためのもの（デバッグビルドのみ）
#[tauri::command]
fn e2e_data_dir() -> Value {
    if !cfg!(debug_assertions) {
        return Value::Null;
    }
    // WindowsではmsedgedriverがWebView2の保存先を環境変数で指定する（アプリの指定より優先される）
    let env = |name: &str| std::env::var(name).ok();
    json!({
        "override": e2e::data_dir(),
        "webview2UserDataFolder": env("WEBVIEW2_USER_DATA_FOLDER"),
        "webview2Arguments": env("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 多重起動時は既存のウィンドウを前面に出す（最初に登録する必要がある）
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            select_target_dir,
            create_article,
            list_markdown_files,
            read_file,
            write_file,
            post_item,
            verify_token,
            open_external,
            read_config,
            write_config,
            read_token,
            write_token,
            read_legacy_settings,
            e2e_data_dir,
        ])
        .setup(|app| {
            let navigation_app = app.handle().clone();
            let new_window_app = app.handle().clone();
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("TsumiQiita")
                .inner_size(1000.0, 800.0)
                // アプリ外への遷移は止め、http/httpsなら既定ブラウザで開く
                .on_navigation(move |url| {
                    if is_app_url(url) {
                        return true;
                    }
                    let _ = open_external_url(&navigation_app, url.as_str());
                    false
                })
                .on_new_window(move |url, _features| {
                    let _ = open_external_url(&new_window_app, url.as_str());
                    NewWindowResponse::Deny
                });
            if let Some(dir) = e2e::data_dir() {
                builder = builder.data_directory(PathBuf::from(dir));
            }
            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_only_app_urls() {
        assert!(is_app_url(
            &Url::parse("tauri://localhost/index.html").unwrap()
        ));
        assert!(is_app_url(&Url::parse("http://tauri.localhost/").unwrap()));
        assert!(!is_app_url(&Url::parse("https://example.com/").unwrap()));
        assert!(!is_app_url(
            &Url::parse("https://tauri.localhost.example.com/").unwrap()
        ));
        // Vite開発サーバーはデバッグビルドでのみ許可する
        assert_eq!(
            is_app_url(&Url::parse("http://localhost:5173/").unwrap()),
            cfg!(debug_assertions)
        );
    }
}
