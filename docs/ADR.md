# TsumiQiita アーキテクチャ決定記録（ADR）

> このドキュメントは Git コミット履歴（`ea2ef4a` 1st commit 〜 `2012369`、2018-03-29〜2026-08-14、全217コミット）を分析し、コードやコミットメッセージから読み取れるアーキテクチャ上の決定を再構成したものです。当時の議論（Issue/PR本文など）までは追えていないため、根拠はコミットメッセージと差分から推測しています。

## ADR-0001: Electron によるクロスプラットフォームデスクトップアプリとして実装

- **Status**: Accepted
- **Date**: 2018-03-29（`ea2ef4a` 1st commit）

**Context**: Markdownで書いた記事をQiitaに投稿するツールが欲しい。Windows/macOS/Linuxでほぼ同一のUIを提供したい。

**Decision**: Webview相当のUI（HTML/CSS/JS）と Node.js のファイルシステム/HTTPアクセスを1プロセスで扱える Electron を採用する。

**Consequences**: ブラウザ技術（markdown-itなど）とNode.jsのエコシステムをそのまま使えるが、Electron自体のメジャーバージョン追従（2→28→35→42、[ADR-0009](#adr-0009-2026年のdependabot脆弱性一斉是正)参照）が継続的な保守コストになっている。

## ADR-0002: プロジェクト名を QiitaBarrel から TsumiQiita に変更

- **Status**: Accepted
- **Date**: 2018-04-01（`ecf976e`, `ca0f336`）

**Context**: 初期の作業名は `QiitaBarrel`（リポジトリ名も同様）。「下書きに入りきらない記事を溜めておく」というコンセプトを名前に反映したい。

**Decision**: 「積みQiita」の意を込め、プロダクト名・`package.json` の `name`・リポジトリ名を `TsumiQiita` に統一する。

**Consequences**: 以降の全コミットで一貫した名称になった。旧名 `QiitaBarrel` はGit履歴上のリモートURL参照（`b019266`）にのみ残る。

## ADR-0003: ライセンスを CC BY 4.0 から MIT に変更

- **Status**: Accepted
- **Date**: 2018-04-28（`4d5a591`）

**Context**: プロジェクト開始時は Creative Commons Attribution 4.0 International（CC BY 4.0）を採用していたが、これはソフトウェアのライセンスとしては一般的でない（コード再利用の許諾条件が不明瞭になりやすい）。

**Decision**: ソフトウェア向けの標準的な OSS ライセンスである MIT License に切り替える。

**Consequences**: 現在の `LICENSE.md` および `package.json` の `license` フィールドは `MIT` で一貫している。

## ADR-0004: 記事メタデータを Markdown ファイル先頭の YAML フロントマターとして保持

- **Status**: Accepted
- **Date**: 2018-05-01（`24aedc7` 他、README記載は現行版まで継続）

**Context**: Qiitaへの投稿には `title` / `tags` / 公開範囲などの付随情報が必要。当初はこれをタグ入力欄など別UIで管理する案（`4390296`「タグを記事の1行目から取得する」からの `e6bbded`「直感的でないので戻す」の揺り戻しあり）も試された。

**Decision**: 記事本文と同じ `.md` ファイルの先頭に `---` で囲んだYAML風ヘッダー（`title`, `tags`, `tweet`, `private`, `coediting`, `group_url_name`）を書く方式に統一する。ファイル単体でメタデータが完結し、クラウドストレージ経由での編集・同期にも耐える。

**Consequences**: エディタ側でこのヘッダーをパースする実装が必要（`src/js/functions.js`）。フォーマット変更時は README の「Qiita記事のヘッダ書式」表も同時更新する運用になっている（`63b71ca`, `68d97dd`）。

## ADR-0005: プレビュー描画スタックに markdown-it + highlight.js + GFM/Qiita互換CSSを採用

- **Status**: Accepted
- **Date**: 2018-04-21〜2018-07-21（`0a882ad`, `dc7e057`, `39c2bea`）

**Context**: ローカルプレビューの見た目をQiita/GitHub上の表示に近づけたいが、完全一致は目標にしない（README「注意」節に明記）。

**Decision**: Markdownパーサーに `markdown-it`（+ `markdown-it-checkbox` でチェックボックス対応）、コードハイライトに `highlight.js`、記事全体のスタイルに GitHub Flavored な CSS（Kobito-OSS由来のスタイルシート `074554a` → 後に `github-markdown-css` パッケージ）を採用。コードブロックはmonokaiテイストのQiita風スタイルを独自CSSで追加（`701d26a`, `39c2bea`）。

**Consequences**: プレビューは「参考程度」と明示され、完全再現より軽量な実装を優先。`escape-html` によるコードブロックの非HTML言語でもエスケープする対応（`f52303f`）など、markdown-it単体でカバーしない部分は個別に手当てしている。

## ADR-0006: 自動保存のデバウンス時間を10秒から3秒に短縮

- **Status**: Accepted（Supersedes: `2ec4ee2`）
- **Date**: 2018-04-27〜2018-04-28（`2ec4ee2` → `23d82d9`）

**Context**: 編集停止後に自動保存する機能を追加した際、当初は10秒のディレイだった。

**Decision**: ユーザーの体感待ち時間を短くするため、最後の編集から3秒後に自動保存する仕様に変更。

**Consequences**: 現行READMEにも「最後に編集してから3秒後に自動保存」と明記され、以降変更されていない。

## ADR-0007: ビルド／配布ツールを electron-packager から electron-builder に移行

- **Status**: Accepted
- **Date**: 2018-10-31（`14dd59b`）

**Context**: 当初は `electron-packager` でOS別に生の実行ファイル一式（asar化のみ）を生成していた（`build-win`, `build-mac`, `build-linux` などスクリプトが乱立）。Windows版でメニュー非表示にする等、配布形態の見直しが必要になった。

**Decision**: `electron-builder` に切り替え、`package.json` の `build` セクションで設定を一元化し、Windowsはインストーラー形式で配布する。ビルドスクリプトも `npm run build` 一本化。

**Consequences**: OS別スクリプトの重複がなくなった。後年のセキュリティ対応でも `electron-builder` 自体のバージョンアップ（20→26、[ADR-0009](#adr-0009-2026年のdependabot脆弱性一斉是正)）で追従している。

## ADR-0008: Qiita API 呼び出し方式の変遷（qiita-js → isomorphic-fetch → request → Node標準 https）

- **Status**: Accepted（最新: Node標準 `https` モジュール）
- **Date**: 2018-04-06 初出 → 2020-03-03 (`970d7aa`) → 2020-03-04 (`889d976`, `6f2b2f8`) → 2026-06-13 (`65d48a1`)

**Context**: Qiita投稿APIへのHTTPリクエスト手段は4段階で変遷している。
1. 初期はQiita専用ラッパー `qiita-js` を利用。
2. 2020-03-03、`qiita-js` を汎用の `isomorphic-fetch` に置き換え（`970d7aa`）。
3. しかし実行ファイル形態ではファイルリストが読み込めない不具合の修正過程で `request` パッケージを導入（`889d976`）、同日中に不要になった `isomorphic-fetch` を削除（`6f2b2f8`）。
4. 2026-06-13、`request` が非推奨かつ依存の `tough-cookie` にCVE-2023-26136があるため、Node.js組み込みの `https` モジュールへ書き換え（`65d48a1`）。

**Decision**: 外部HTTPクライアントライブラリへの依存をやめ、Node.js標準の `https` モジュールで完結させる。

**Consequences**: 依存パッケージが1つ減り、サプライチェーンリスクが低下。`src/js/functions.js` の `post()` 関数がPromiseベースの薄いラッパーを自前実装する形になった。

## ADR-0009: 2026年のDependabot脆弱性一斉是正

- **Status**: Accepted
- **Date**: 2026-06-13（`65d48a1`）

**Context**: 2020-03から2025-07まで約5年間、依存関係の更新がほぼ止まっていた（`b41766f`/`dc2ad7d`/`a790e17` で `electron` のみ段階的に更新: 2.0.12→28.3.2→35.7.5、`highlight.js` 9→10、`markdown-it` 8→12）。その結果GitHub Dependabotから複数の脆弱性アラートが出ていた。

**Decision**: 一括で以下を実施し、`npm audit` の指摘をゼロにする。
- `request`（`tough-cookie` のCVE-2023-26136）を削除し、Node標準 `https` に置換（[ADR-0008](#adr-0008-qiita-api-呼び出し方式の変遷qiita-js--isomorphic-fetch--request--node標準-https)）。
- `highlight.js` を 10.4.1 → 11.9.0 に更新（ReDoS CVE-2021-23566）。API変更（`highlight(lang, str)` → `highlight(str, {language})`、`initHighlightingOnLoad()` → `highlightAll()`）に追従。
- `electron-store`（`conf`/`ajv` 経由のReDoS）を削除し、設定保存を `localStorage` ベースの自前実装に置換。外部パッケージを増やさない方針。
- `electron-builder` を 20.29.0 → 26.0.0 に更新（`node-tar` のパストラバーサル対応）。
- `electron` を 35.7.5 → 42.4.0 に更新（高リスクCVE 17件対応）。

**Consequences**: 依存パッケージ数が純減（`request`, `electron-store` を削除、代替の新規パッケージ追加なし）。一方で、更新が5年近く滞留していた事実は、依存関係を定期的に追従する仕組み（Dependabotの自動PRやCIでの `npm audit` 実行など）がなければ再発しうることを示唆している。

## ADR-0010: Electron の remote モジュール廃止に伴い、ファイル/ディレクトリ選択を IPC ハンドラ経由に統一

- **Status**: Accepted
- **Date**: 2026-08-11（`a47f9c5`）

**Context**: `nodeIntegration: true` / `contextIsolation: false` の構成（[ADR-0001](#adr-0001-electron-によるクロスプラットフォームデスクトップアプリとして実装)）のもと、ディレクトリ選択・新規ファイル作成のダイアログ呼び出し方法を見直す必要があった。旧来の `app.makeSingleInstance` も新しい Electron では廃止されている。

**Decision**: `src/index.js` の main process 側に `ipcMain.handle('select-target-dir', ...)` と `ipcMain.handle('create-article', ...)` を追加し、`dialog.showOpenDialog` / `dialog.showSaveDialog` をmain process側に集約する。多重起動防止も `app.makeSingleInstance` から `app.requestSingleInstanceLock()` + `second-instance` イベントに置き換える。`BrowserWindow` 生成時に `webPreferences`（`nodeIntegration: true` / `contextIsolation: false`）を明示する。

**Consequences**: レンダラー側（`src/js/functions.js`）はダイアログ処理をIPC呼び出しに委譲する形に整理された。IPCハンドラは `src/index.js` に集約されており、以後ダイアログ系の機能を追加する際もこのパターンに従う（`AGENTS.md`にも明記）。

## ADR-0011: ビルドスクリプトの実行コマンド修正と npm セキュリティ設定の追加

- **Status**: Accepted
- **Date**: 2026-08-11（`809ef4c`, `a77f2d3`）

**Context**: `package.json` の `scripts` が `node_modules/.bin/electron` / `node_modules/.bin/build` という直接パス指定になっており、`npm run build` が実際には `electron-builder` を指していなかった（ADR-0007当時の設定が形骸化していた）。また `package-lock.json` が `.gitignore` に含まれておりリポジトリに存在しない状態だった。

**Decision**: `scripts.start` を `electron .`、`scripts.build` を `electron-builder` に修正し、`npm bin` 経由の実行に統一する。バージョンを1.8.3に上げ、`markdown-it` を12.3.2→15.0.0に更新する。`.gitignore` から `package-lock.json` を除外し、ロックファイルをリポジトリにコミットする。あわせて `src/.npmrc` に `ignore-scripts=true` / `min-release-age=7` を追加し、インストール時のライフサイクルスクリプト実行を禁止・新規公開パッケージの即時インストールを抑止する。

**Consequences**: `npm run build` が実際にelectron-builderを実行するようになった。ロックファイルのコミットにより依存バージョンが再現可能になった。この `.npmrc` の設定は後の [ADR-0014](#adr-0014-パッケージマネージャを-npm-から-bun-に移行) で `bunfig.toml` に引き継がれている。

## ADR-0012: GitHub Pages公開用ランディングページ（index.html）とOGP対応の追加

- **Status**: Accepted
- **Date**: 2026-08-11（`355ef2d`, `60c957b`）

**Context**: リポジトリ紹介用のWebページがなく、README上のバッジ（Node/Electronバージョン）も実際のバージョンと乖離していた。

**Decision**: pico.cssベースの`index.html`（LP）と`social-preview.png`（OGP/Twitterカード画像）をリポジトリ直下に追加する。READMEのNode/Electronバージョンバッジを実際の値に更新する。OGP/Twitterカードの画像URLをその後修正する（`60c957b`）。

**Consequences**: このLPと画像一式は、後の [ADR-0013](#adr-0013-プロジェクトドキュメントを-docs-配下に集約し-github-pages-公開構成に移行) で `docs/` 配下へ移動されている。バッジの更新はバージョンアップ時に手動同期が必要な運用になっている。

## ADR-0013: プロジェクトドキュメントを docs/ 配下に集約し GitHub Pages 公開構成に移行

- **Status**: Accepted
- **Date**: 2026-08-14（`dd135ad`）

**Context**: `README.md` / `INSTALL.md` / `index.html` / `social-preview.png` / `ss.png` はリポジトリ直下に置かれていた。GitHub Pages でランディングページ（`index.html`）を公開するには、公開対象一式を専用ディレクトリにまとめておく方が構成として明快になる。

**Decision**: 上記ドキュメント・画像一式をすべて `docs/` 配下へ移動する（`git mv` 相当、`INSTALL.md` は内容も一部更新）。GitHub Pages のソースを `docs/` に向ける運用を前提とする。

**Consequences**: リポジトリ直下はコード（`src/`）とビルド設定中心になり、公開用ドキュメントは `docs/` に一元化された。以後、README・INSTALL・LP・OGP画像を変更する際は `docs/` 配下を編集する。本ADR自体（`docs/ADR.md`）も同構成に含まれる。

## ADR-0014: パッケージマネージャを npm から bun に移行

- **Status**: Accepted
- **Date**: 2026-08-14（`4dc1050`）

**Context**: `src/` の依存関係管理は npm（`package-lock.json`, `.npmrc` の `ignore-scripts` / `min-release-age` 設定）で行っていた。より高速なインストールと、同等のサプライチェーン対策設定を維持したまま移行する余地があった。

**Decision**: `src/.npmrc` を廃止し `src/bunfig.toml` に置き換える（`ignoreScripts = true` / `minimumReleaseAge = 604800`（秒単位、npm側の7日設定を踏襲））。`src/package-lock.json` を削除し `bun install` で生成した `src/bun.lock` に切り替える。`docs/INSTALL.md` のセットアップ手順も `npm i` / `npm run build` から `bun i` / `bun run build` に書き換える。

**Consequences**: `package.json` の `scripts`（`start` / `build`）自体はnpm/bun互換の記述のまま維持しており、変更していない。開発者は Node.js に加えて bun のインストールが前提になる（インストール手順は `docs/INSTALL.md` 参照）。`node_modules` は `bun install` で再構築済み。

## ADR-0015: AI エージェント向け開発ガイド（AGENTS.md）を追加

- **Status**: Accepted
- **Date**: 2026-08-14（`2012369`）

**Context**: Claude Code などのAIコーディングエージェントがこのリポジトリで作業する際、ディレクトリ構成・パッケージマネージャ（bun）・Electronの `nodeIntegration: true` / `contextIsolation: false` 構成といった前提を都度探索するコストがあった。

**Decision**: リポジトリ直下に `AGENTS.md` を新設し、ディレクトリ構成・bunコマンド・JSHintベースのコーディングスタイル・Electron構成上の注意点をまとめる。`CLAUDE.md` から参照する形で連携させる。

**Consequences**: エージェント向けのオンボーディング情報が一箇所に集約された。ディレクトリ構成やコマンドを変更した際は `AGENTS.md` も追随して更新する必要がある（本ADRの範囲では追跡できないため、更新漏れは今後のレビューで検知する）。

---

## 観察事項（決定ではないが留意すべきパターン）

- **開発が断続的**: 2018-11-23〜2020-03-03、2020-03-04〜2025-07-01 の2回、長期間コミットが止まっている。個人開発（コミット者は一貫して `hidao80`）による低頻度メンテナンスが実態であり、今後も依存更新の定期チェック（例: Dependabot設定、`npm audit` のCI組み込み）が望ましい。
- **CI設定**（`sideci.yml`, `lint_yml/.jshintrc`）は2018年に導入されたまま現存しているが、直近のコミット履歴からは実際に稼働しているか確認できていない。稼働確認は本ADRのスコープ外。
- **`.claude/commands/` の追加**（`5fd05d6`、2026-08-14）: `code-analyze` / `make-lp` / `make-social-preview` / `update-adr` のコマンド定義が追加された。これはAIエージェントの作業手順を定義したものであり、アプリケーション自体のアーキテクチャ決定ではないため、本ADRの対象外として観察事項に留める。
