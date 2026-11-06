# AGENTS.md

このリポジトリで作業するAIエージェント向けのガイド。

## プロジェクト概要

TsumiQiita — MarkdownファイルをQiitaに投稿するTauri製デスクトップアプリ。
Tauri v2（Rust）+ Vite + React + TypeScriptで実装し、bunでビルド・テストする。
スタイルはTailwind CSS v4、Lint/FormatはBiome、設定保存は`~/.config/TsumiQiita/config.json`（APIトークンのみOSの資格情報ストア）、入力検証はZod（画面側）とRust（コマンド側）、E2EはWebdriverIO + tauri-driver。
下書きに入りきらない「積みQiita」をローカルに際限なく貯めることを目的とする。

- 詳細: [docs/README.md](docs/README.md)
- インストール手順: [docs/INSTALL.md](docs/INSTALL.md)
- 設計判断の記録: [docs/ADR.md](docs/ADR.md)

## ディレクトリ構成

```
src/            アプリ本体（package.jsonのルート）
  src-tauri/           Rust（Tauri）側
    src/lib.rs         コマンド（ファイルI/O・ダイアログ・Qiita API・外部ブラウザ・設定・旧版設定の読み出し）とウィンドウ作成
    src/config.rs      設定ファイル（~/.config/TsumiQiita/config.json）の読み書き
    src/credential.rs  APIトークンの保存（keyring。Windows: 資格情報マネージャー / macOS: キーチェーン / Linux: Secret Service）
    src/files.rs       .mdファイルの読み書き
    src/qiita.rs       Qiita API v2 の呼び出しと入力検証
    src/legacy.rs      旧Electron版のlocalStorage（LevelDB）の読み出し
    src/e2e.rs         E2E用の差し替え（デバッグビルドのみ有効）
    tests/fixtures/    旧Electron版で実際に作ったLevelDB（拡張子 .bin を付けて保存）
    tauri.conf.json    アプリ設定（identifier・CSP・バンドル）
    icons/             アプリアイコン（app-icon.svg から `bun run tauri icon` で生成。使わないストア用・モバイル用・64x64は削除する）
  renderer/            画面（Viteのroot。React製UI）
    index.html / main.tsx / App.tsx
    lib/               Rustコマンドの呼び出し（api.ts）・Markdown描画・設定の読み書き（config.ts）・以前の保存先からの移行（Dexie/IndexedDB・旧Electron版）
    css/               スタイル（Tailwindの読み込みを含む）
  shared/              型・Zodスキーマ・記事ヘッダー解析（*.test.ts はbun test）
  e2e/                 WebdriverIOによるE2Eテスト（wdio.conf.ts）
  dist/                画面のビルド出力（gitignore対象）
docs/           GitHub Pages公開用ドキュメント（README/INSTALL/ADR/LP）
```

## パッケージマネージャー

**bun** を使用する（npmではない）。`src/`直下で実行する。Rustのツールチェーン（rustup）も必要。

```sh
cd src
bun i              # 依存関係インストール
bun run dev        # Vite開発サーバー（HMR、ポート1420）＋Tauriアプリを起動
bun run build      # 本番ビルド＋インストーラー作成（src-tauri/target/release/bundle/）
bun run typecheck  # tscによる型チェック
bun run lint       # Biomeによるlint/formatチェック（bun run format で自動修正）
bun test           # ユニットテスト（bunfigで shared/ に限定）
bun run test:rust  # Rust側の単体テスト（cargo test）
bun run test:e2e   # デバッグビルドを作り、WebdriverIO + tauri-driverでE2Eテスト
```

- `src/bunfig.toml` が `.npmrc` の代わり（`ignoreScripts` / `minimumReleaseAge` を設定済み）。
- ロックファイルは `src/bun.lock` と `src/src-tauri/Cargo.lock`。
- 画面はViteでバンドルされるため、JSの依存パッケージは`devDependencies`に置く。
- `package.json`の`overrides`で`glob`（^14.0.2）と`minimatch`（^11.0.1）を上書きしている。E2E用の`@wdio/config` 10.1.0と`mocha` 12.0.3が脆弱な版（GHSA-3g3m-2fjr-6pw4、GHSA-g3hv-75wg-m249）を範囲指定しているため。両パッケージが修正版を範囲に含めたら`overrides`を外す。
- Rustは `cargo fmt` と `cargo clippy --all-targets -- -D warnings` が通ること（CIで確認）。

## コーディングスタイル

- TypeScript（strict）。`bun run typecheck`と`bun run lint`が通ること。
- 書式はBiome（`src/biome.json`：シングルクォート・セミコロンあり・幅120）に従う。ルールの無効化は理由付きの`biome-ignore`で局所的に行う。
- Tailwindはpreflight無しで読み込んでいる（プレビューの見た目を保つため）。`tsumiqiita.css`のレイヤー外ルールはユーティリティより優先されるため、同じ要素・同じプロパティを両方で指定しないこと。
- テーマ（ライト/ダーク）はメニューのトグルで切り替え、設定 `THEME` に保存する（未設定時はOSの設定）。`<html data-theme>` と `color-scheme` で切り替えるため、色はハードコードせず `tsumiqiita.css` の `--tq-*` 変数か `Canvas`/`CanvasText` 等のシステムカラーを使う。
- 表示モード（全画面エディター／半々／全画面プレビュー）はサイドバーのトグルで切り替え、設定 `VIEW_MODE` に保存する。ボタンのアイコンは `material-symbols`（Outlined、約4MB）のアイコンフォント。
- プレビューのスタイルは`renderer/css/qiita-preview.css`（Qiita記事風の独自CSS、`.markdown-content`配下に限定）。Qiita本体のCSSはライセンス上コピー・同梱しない。
- Qiitaのノート記法（Note - 補足説明。`:::note info` / `:::note warn` / `:::note alert` ～ `:::`）は`renderer/lib/markdownItNote.ts`（markdown-itプラグイン）でプレビューする。構文は[qiita_marker](https://github.com/increments/qiita_marker)のカスタムブロック、描画は[qiita-markdown](https://github.com/increments/qiita-markdown)の`CustomBlock`フィルターに合わせる（種類の省略・不明時は`info`、`note`以外は装飾なしの`<div>`、入れ子不可）。
- フォントはNoto Sans JP（400/700）を`@fontsource/noto-sans-jp`で同梱し、`font-sans`で適用する。CDNは使わない（CSP・オフライン対応のため）。
- コメントは日本語で書かれている箇所が多い。既存の言語に合わせる。

## Tauri構成の注意点

- 画面はNode/RustのAPIを直接使わず、`renderer/lib/api.ts`（`invoke`）経由でRustのコマンドを呼ぶ。コマンドは`src-tauri/src/lib.rs`に集約し、引数は必ずRust側でも検証する（.mdのみ・記事idは英数字・トークン必須・未知の項目を拒否など）。画面側のZodスキーマ（`shared/schema.ts`）と`qiita.rs`の`ItemBody`は項目を揃える。
- 設定は`~/.config/TsumiQiita/config.json`（全OS共通。Windowsは`%USERPROFILE%\.config\TsumiQiita`）にRust側で保存する。キーは`config.rs`の`KEYS`と`SettingKeySchema`で揃え、未知のキーは書き込みを拒否する。APIトークン（`TOKEN`）だけは設定ファイルに書かず、OSの資格情報ストア（サービス名 `io.github.hidao80.tsumiqiita`）に保存する。画面からは`config.get`/`config.set`でどちらも同じように扱う。
- 以前の保存先だったIndexedDB（Dexie）の設定は、設定ファイルがないときだけ設定ファイル・資格情報ストアへ移し、移し終えたらIndexedDB側を消す（`renderer/lib/legacy.ts`の`migrateIndexedDbSettings`）。
- **`identifier`（`io.github.hidao80.tsumiqiita`）とアプリのURL（オリジン）を変えないこと。** WebViewの保存先・IndexedDBのオリジン・資格情報ストアのサービス名が変わり、移行前の設定やトークンを読めなくなる。
- 旧Electron版の設定（TOKEN / TARGET_DIR / CURRENT_FILE）は、初回起動時に`%APPDATA%\tsumiqiita`等（Tauriの`config_dir()`配下）のLevelDBを一時ディレクトリに複製して読み、設定ファイル・資格情報ストアへ移行する（`renderer/lib/legacy.ts`）。移行済みの印は設定 `LEGACY_MIGRATED`。読み出しに失敗したら印を付けず次回に再試行し、設定済みの値は上書きしない。旧版のプロファイルは書き換えない。
- CSPは`tauri.conf.json`の`app.security.csp`で付与する（記事中の生HTMLのスクリプトを遮断するため）。IPCのため`connect-src ipc: http://ipc.localhost`が必要。`style-src`の`'unsafe-inline'`を活かすため、`dangerousDisableAssetCspModification`で`style-src`へのnonce付与を止めている。
- リンクはWebView内で開かない。画面側でクリックを横取りして`open_external`（http/httpsのみ）で既定ブラウザに渡し、Rust側でもアプリ外への遷移・新しいウィンドウを止める。
- Qiita APIはRust側（reqwest）で呼ぶ。記事ヘッダーに`id`が無ければ`POST /api/v2/items`（201）、あれば`PATCH /api/v2/items/:id`（200）。新規投稿で得たidは記事ヘッダーに書き戻す（`shared/frontMatter.ts`の`setItemId`）。トークン保存時は`GET /api/v2/authenticated_user`で確認する。

## セキュリティ対策

アプリが対応している範囲は次のとおり。変更したら`docs/README.md`・`docs/INSTALL.md`・`docs/index.html`（5言語）・`docs/llms.txt`の記載も揃える。

- APIトークンはOSの資格情報ストア（`keyring`）に保存し、設定ファイルに書かない。
- Qiita APIはRust側から`https://qiita.com/api/v2`だけを呼ぶ。トークン保存時に`GET /api/v2/authenticated_user`で確認する。
- CSP（`tauri.conf.json`）で記事中のスクリプトを遮断する。`img-src`は`https:`を許可しているため、記事中の外部画像はプレビュー時に読み込まれる。
- capabilitiesは`core:default`のみ。ファイル・通信はコマンド経由で、引数はRust側で検証する（`.md`のみ・記事idは英数字・未知の項目を拒否・設定キーは`KEYS`のみ）。
- リンクは`open_external`（http/httpsのみ）で既定ブラウザに渡し、アプリ外への遷移・新しいウィンドウを止める。
- 依存関係は`bunfig.toml`の`ignoreScripts`・`minimumReleaseAge`（7日）、`bun.lock`の固定、CIのTakumi Guard・`bun audit`、GitHub ActionsのコミットSHA固定で守る。
- 配布物はコード署名・公証をしていない（macOSは`signingIdentity: "-"`のアドホック署名）。

## 変更時の確認

- UI/画面を変更したら `bun run test:e2e` を実行し、必要に応じて `bun run dev` で実機確認する。
- E2E（Windows / Linuxのみ。macOSはWebDriver非対応）には次が必要:
  - `cargo install tauri-driver --version "^2" --locked`
  - Windows: WebView2と同じ版の `msedgedriver.exe`。PATHに置くか、環境変数 `TSUMIQIITA_MSEDGEDRIVER` でパスを指定する。WebView2は自動更新されるため、版がずれたら <https://msedgedriver.microsoft.com/{版}/edgedriver_win64.zip> から取り直す（版は `C:\Program Files (x86)\Microsoft\EdgeWebView\Application` のフォルダー名）。
  - Linux: `webkit2gtk-driver` と `xvfb`（`xvfb-run bun run test:e2e`）
- E2Eはデバッグビルドの差し替え（`src-tauri/src/e2e.rs`の環境変数）で、実際のプロファイル・設定ファイル・資格情報ストア・旧版の設定・Qiita・ダイアログ・既定ブラウザに触れない。Qiita APIはテスト内のモックサーバーが応答する。
- 実際の資格情報ストアへの読み書きは`cargo test -- --ignored`で確認する（別名の項目を作って消す）。
- WindowsではmsedgedriverがセッションごとにWebView2の保存先（一時ディレクトリ）を指定するため、E2Eでアプリを再起動すると保存内容は引き継がれない。保持の確認はページの再読み込みで行う。
- ビルド関連の変更は `bun run build` が通ることを確認する。

## リリース

1. `src/package.json` の `version` を上げる（`tauri.conf.json` はこれを参照する）。
2. 同じバージョンのタグ（`v` は付けない。例: `1.9.0`）をpushする。
3. `.github/workflows/release.yml`がWindows / macOS（Apple Silicon・Intel）/ Linux向けにビルドし、インストーラーを添付したGitHub Releasesの**下書き**を作る。タグと `version` が違うと失敗する。
4. 下書きの内容を確認し、GitHub上で公開する。コード署名はしていない（macOSはアドホック署名のみ）。
