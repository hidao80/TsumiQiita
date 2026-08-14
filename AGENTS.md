# AGENTS.md

このリポジトリで作業するAIエージェント向けのガイド。

## プロジェクト概要

TsumiQiita — MarkdownファイルをQiitaに投稿するElectron製デスクトップアプリ。
下書きに入りきらない「積みQiita」をローカルに際限なく貯めることを目的とする。

- 詳細: [docs/README.md](docs/README.md)
- インストール手順: [docs/INSTALL.md](docs/INSTALL.md)
- 設計判断の記録: [docs/ADR.md](docs/ADR.md)

## ディレクトリ構成

```
src/            アプリ本体（package.jsonのルート）
  index.js      Electron main process
  index.html    レンダラーのエントリポイント
  js/functions.js  レンダラーロジック（エディタ・プレビュー・Qiita投稿）
  css/          スタイル
docs/           GitHub Pages公開用ドキュメント（README/INSTALL/ADR/LP）
lint_yml/       JSHint設定 (.jshintrc)
build/          electron-builderのビルド出力（gitignore対象、触らない）
```

## パッケージマネージャ

**bun** を使用する（npmではない）。`src/`直下で実行する。

```sh
cd src
bun i              # 依存関係インストール
bun start          # electron . を起動
bun run build      # electron-builderでパッケージング
```

- `src/bunfig.toml` が `.npmrc` の代わり（`ignoreScripts` / `minimumReleaseAge` を設定済み）。
- ロックファイルは `src/bun.lock`。`package-lock.json` は使わない。
- `package.json`の`scripts`自体はnpm/bun互換の記述のまま維持している。

## コーディングスタイル

- `src/js/functions.js`・`src/index.js`はESVersion 6想定（`/*jshint esversion:6*/`）。
- Lintは`lint_yml/.jshintrc`のルールに準拠（browser + node環境、jQuery許容）。
- 既存コードは`var`と`const`が混在。新規コードは`const`/`let`を優先し、既存の`var`は無理に書き換えない。
- コメントは日本語で書かれている箇所が多い。既存の言語に合わせる。

## Electron構成の注意点

- `nodeIntegration: true` / `contextIsolation: false` で動作しており、レンダラーから直接`require`している（`ipcRenderer`経由のpreloadブリッジは未導入）。この構成を前提に変更する。
- IPCハンドラは`src/index.js`に`ipcMain.handle`で集約されている（`select-target-dir`, `create-article`など）。

## 変更時の確認

- UI/レンダラーを変更したら `bun start` で実機起動して動作確認する（自動テストは未整備）。
- ビルド関連の変更は `bun run build` が通ることを確認する。
