# インストール方法

1. gitをインストール (<https://git-scm.com/downloads>)
1. bunをインストール (<https://bun.com/>)
    ```sh
    ## for macOS and Linux
    curl -fsSL https://bun.com/install | bash

    ## for Windows
    powershell -c "irm bun.com/install.ps1 | iex"
    ```
1. Rustをインストール (<https://rustup.rs/>)
    - Windows: Visual Studio Build Tools（C++によるデスクトップ開発）とWebView2（Windows 10/11は導入済み）が必要です
    - macOS: Xcode Command Line Tools（`xcode-select --install`）が必要です
    - Linux（Debian系）: `sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf build-essential`
    - 詳細は <https://v2.tauri.app/start/prerequisites/> を参照してください
1. リポジトリのインストール
    ```sh
    git clone https://github.com/hidao80/TsumiQiita.git
    cd TsumiQiita/src
    bun i
    bun run build
    ```
    インストーラーは `src/src-tauri/target/release/bundle/` に作られます。

## インストール時のセキュリティ対策

- `bun i` は `src/bunfig.toml` の設定により、依存パッケージのインストールスクリプトを実行しません（`ignoreScripts`）。また、公開から7日未満の版はインストールしません（`minimumReleaseAge`）。
- 依存パッケージの版は `src/bun.lock` で固定しています。CIでは `bun install --frozen-lockfile` を使い、Takumi Guardによるマルウェア検査と `bun audit` による脆弱性検査を行います。Dependabotのバージョン更新も、`.github/dependabot.yml` の `cooldown` により公開から7日未満の版は提案しません。
- 作られるインストーラーにはコード署名・公証を行いません（macOSはアドホック署名）。アプリのセキュリティ対策は [README.md](README.md#セキュリティ) を参照してください。
