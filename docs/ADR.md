# TsumiQiita アーキテクチャ決定記録（ADR）

> このドキュメントは Git コミット履歴（`ea2ef4a` 1st commit 〜 `3993994`、2018-03-29〜2026-08-14、全217コミット、タグ `0.1.0`〜`1.8.2` を含む全履歴ベース）を分析し、コードやコミットメッセージから読み取れるアーキテクチャ上の決定を再構成したものです。当時の議論（Issue/PR本文など）までは追えていないため、根拠はコミットメッセージと差分から推測しています。
>
> ADR-0018 以降は `307e7d5`〜`48ccd48`（〜2026-11-06）のコミットに加え、作業中に記録したユーザー判断（`z-ai/decision.jsonl`）を根拠にしています。根拠がコミットにも判断記録にも書かれておらず推測したものは「**Speculative**」と明記します。

## ADR-0001: Electron によるクロスプラットフォームデスクトップアプリとして実装

- **Status**: Superseded by [ADR-0018](#adr-0018-electronをtauri-v2rustに置き換える)
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

- **Status**: Accepted（記事全体のCSSは [ADR-0020](#adr-0020-プレビューのcssをqiita記事風の独自cssにしフォントアイコンを同梱する) で置き換え。markdown-it + highlight.jsは継続）
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

- **Status**: Superseded by [ADR-0018](#adr-0018-electronをtauri-v2rustに置き換える), [ADR-0025](#adr-0025-タグのpushでtauri-actionが各osのインストーラーをリリースの下書きに添付する)
- **Date**: 2018-10-31（`14dd59b`）

**Context**: 当初は `electron-packager` でOS別に生の実行ファイル一式（asar化のみ）を生成していた（`build-win`, `build-mac`, `build-linux` などスクリプトが乱立）。Windows版でメニュー非表示にする等、配布形態の見直しが必要になった。

**Decision**: `electron-builder` に切り替え、`package.json` の `build` セクションで設定を一元化し、Windowsはインストーラー形式で配布する。ビルドスクリプトも `npm run build` 一本化。

**Consequences**: OS別スクリプトの重複がなくなった。後年のセキュリティ対応でも `electron-builder` 自体のバージョンアップ（20→26、[ADR-0009](#adr-0009-2026年のdependabot脆弱性一斉是正)）で追従している。

## ADR-0008: Qiita API 呼び出し方式の変遷（qiita-js → isomorphic-fetch → request → Node標準 https）

- **Status**: Superseded by [ADR-0021](#adr-0021-qiita-apiをrust側で呼びidの有無で新規投稿と更新を切り替える)（直前の状態: Node標準 `https` モジュール）
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

- **Status**: Superseded by [ADR-0018](#adr-0018-electronをtauri-v2rustに置き換える)
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

## ADR-0016: アーキテクチャ決定記録（ADR）文書の追加

- **Status**: Accepted
- **Date**: 2026-08-14（`3993994`）

**Context**: これまでの15件の決定（Electron採用、ライセンス変更、依存関係の変遷など）が、コミット履歴以外の場所に文章化されていなかった。個人開発かつ開発が断続的である（後述の観察事項参照）ため、過去の経緯を都度コミットログから掘り起こすコストが高い。

**Decision**: `docs/ADR.md` として、Gitコミット履歴を分析したアーキテクチャ決定記録を新設する。

**Consequences**: 過去の意思決定の経緯が1ファイルに集約された。以後、アーキテクチャレベルの変更（依存関係の大幅な入れ替え、ディレクトリ構成の変更、通信方式の変更など）を行う際はこのファイルに追記する運用が期待される。

## ADR-0017: Qiitaのノート記法（Note - 補足説明）を独自のmarkdown-itプラグインでプレビューする

- **Status**: Accepted
- **Date**: 2026-11-06（`4a071b4`）

**Context**: Qiitaでは`:::note info` / `:::note warn` / `:::note alert` ～ `:::`で補足説明を囲むノート記法（[Markdown記法 チートシート](https://qiita.com/Qiita/items/c686397e4a0f4f11683d)の「Note - 補足説明」）が使えるが、プレビューでは段落として表示されていた。

**Decision**: 依存パッケージ（markdown-it-container等）を追加せず、`src/renderer/lib/markdownItNote.ts`に独自のmarkdown-itプラグインを実装する。構文はQiita公式の[qiita_marker](https://github.com/increments/qiita_marker)（`qfm_custom_block`）、描画は[qiita-markdown](https://github.com/increments/qiita-markdown)の`CustomBlock`フィルターに合わせる。アイコンは同梱済みのMaterial Symbols、見た目は`qiita-preview.css`の独自CSSとする。

**Consequences**: 種類の省略・不明時は`info`、`note`以外のカスタムブロックは装飾なし、入れ子不可など、Qiitaと同じ解釈でプレビューされる。Qiita側の仕様変更には追従が必要。

## ADR-0018: ElectronをTauri v2（Rust）に置き換える

- **Status**: Accepted（Supersedes: [ADR-0001](#adr-0001-electron-によるクロスプラットフォームデスクトップアプリとして実装), [ADR-0007](#adr-0007-ビルド配布ツールを-electron-packager-から-electron-builder-に移行), [ADR-0010](#adr-0010-electron-の-remote-モジュール廃止に伴いファイルディレクトリ選択を-ipc-ハンドラ経由に統一)）
- **Date**: 2026-11-06（`333fde0`, `c8a54bc`、19:10の判断記録）

**Context**: 同日の判断記録（17:00）では、Electronを継続したまま`contextIsolation` + preload構成へ移す方針だった。その後（19:10）、Tauri v2への置き換えに方針を変えている（この中間構成はコミットされていない）。**Speculative**: Electronのメジャーバージョン追従の保守コスト（ADR-0001・ADR-0009）と、配布物の大きさを減らしたいことが動機と考えられる。

**Decision**: アプリ本体をTauri v2（Rust、`src/src-tauri/`）にし、画面はWebViewで表示する。ファイル入出力・ダイアログ・Qiita API・設定の保存はRustのコマンド（`src-tauri/src/lib.rs`）に集約し、画面は`invoke`で呼ぶ。capabilitiesは`core:default`のみとし、CSPを`tauri.conf.json`で付与する。多重起動防止は`tauri-plugin-single-instance`、外部リンクは`tauri-plugin-opener`で既定ブラウザに渡す。アプリの`identifier`（`io.github.hidao80.tsumiqiita`）とURL（オリジン）は、保存先を変えないため固定する。

**Consequences**: 画面からNode/OSのAPIを直接使えなくなり、権限が最小化された。ビルドにRustとOS別の依存（WebView2、webkit2gtk等）が必要になった（`docs/INSTALL.md`）。旧Electron版の設定は[ADR-0022](#adr-0022-設定はconfigjsonとosの資格情報ストアに保存し旧版の設定を自動移行する)の方法で移行する。

## ADR-0019: 画面をReact + TypeScript + Viteで作り直し、Tailwind CSS v4とBiomeを導入する

- **Status**: Accepted
- **Date**: 2026-11-06（`865de4f`, `4a071b4`、17:00・17:40・19:10の判断記録）

**Context**: 旧版の画面は`src/index.html` + `src/js/functions.js`（JSHint前提のプレーンなJavaScript）で、型や部品の分割がなかった。

**Decision**: 画面（`src/renderer/`）をReact + TypeScript（strict）で書き直し、Viteでバンドルする。ViteはTauri移行後もバンドラーとして使い続け、devサーバーは`tauri dev`のHMRに使う。スタイルはTailwind CSS v4をpreflightなしで読み込む（プレビューの見た目を保つため）。Lint/FormatはBiome（シングルクォート・セミコロンあり・幅120）にする。

**Consequences**: `bun run typecheck` / `bun run lint`が品質の基準になった。JSHint・SideCIの設定は不要になり削除された（[ADR-0024](#adr-0024-github-actionsでlinttestbuildauditを実行しdependabotで依存を更新する)）。Tailwindのユーティリティとレイヤー外のCSSを同じ要素・同じプロパティに併用しない、という注意点が生じた（`AGENTS.md`）。

## ADR-0020: プレビューのCSSをQiita記事風の独自CSSにし、フォント・アイコンを同梱する

- **Status**: Accepted（[ADR-0005](#adr-0005-プレビュー描画スタックに-markdown-it--highlightjs--gfmqiita互換cssを採用)のCSS部分を置き換え）
- **Date**: 2026-11-06（`4a071b4`、17:40・18:10・19:00の判断記録）

**Context**: プレビューは`github-markdown-css`（GitHub風）で、Qiitaでの見た目と差があった。Qiita本体のCSSはライセンス上コピーできない。フォントやアイコンをCDNから読むと、CSPとオフライン利用の妨げになる。

**Decision**: プレビューのスタイルを`src/renderer/css/qiita-preview.css`の独自CSS（`.markdown-content`配下に限定）にし、未使用になった`github-markdown-css`を削除する。フォントはNoto Sans JP（400/700）を`@fontsource/noto-sans-jp`で同梱する。表示モード切替（全画面エディター・半々・全画面プレビュー）などのアイコンは`material-symbols`のアイコンフォントを同梱する。

**Consequences**: CDNへの依存がなくなり、CSPを`'self'`中心に保てる。一方で`material-symbols`（Outlined）は約4MBあり、配布物が大きくなる。Qiitaの見た目の変化には独自CSSで追従する必要がある。

## ADR-0021: Qiita APIをRust側で呼び、idの有無で新規投稿と更新を切り替える

- **Status**: Accepted（Supersedes: [ADR-0008](#adr-0008-qiita-api-呼び出し方式の変遷qiita-js--isomorphic-fetch--request--node標準-https)。[ADR-0004](#adr-0004-記事メタデータを-markdown-ファイル先頭の-yaml-フロントマターとして保持)のヘッダー項目を拡張）
- **Date**: 2026-11-06（`c8a54bc`, `4a071b4`、17:40・19:00の判断記録）

**Context**: 旧版は投稿のたびに新しい記事を作り、既存記事を更新できなかった（READMEの注意事項「上書きされません」）。Qiita CLIのフロントマター（`id`・`ignorePublish`・`organization_url_name`・`slide`など）やQiita APIの新しいパラメーターにも対応していなかった。

**Decision**: Qiita APIはRust側（`reqwest`、`src-tauri/src/qiita.rs`）から`https://qiita.com/api/v2`だけを呼ぶ。記事ヘッダーに`id`がなければ`POST /api/v2/items`、あれば`PATCH /api/v2/items/:id`とし、新規投稿で得たidを記事ヘッダーに書き戻す（`shared/frontMatter.ts`の`setItemId`）。トークン保存時は`GET /api/v2/authenticated_user`で確認する。送信する項目は画面側のZodスキーマ（`shared/schema.ts`）とRust側の`ItemBody`（`deny_unknown_fields`）で揃え、両方で検証する。

**Consequences**: 同じファイルからの再投稿が既存記事の更新になった（`id`を消すと新規投稿）。`tweet`はPATCHの引数にないため更新時は送らない。`null`の項目は送らないので、PATCHで投稿キャンペーンの登録を解除する操作には対応しない。HTTPクライアントはNode標準`https`からRustの`reqwest`に変わった。

## ADR-0022: 設定はconfig.jsonとOSの資格情報ストアに保存し、旧版の設定を自動移行する

- **Status**: Accepted（17:40の判断「設定をDexie/IndexedDBに保存」を置き換え）
- **Date**: 2026-11-06（`c8a54bc`, `4a071b4`, `f6346d8`, `bc78007`、17:40・18:15・19:10・19:30の判断記録）

**Context**: 旧版は設定（TOKEN / TARGET_DIR / CURRENT_FILE）を`localStorage`に平文で保存していた（[ADR-0009](#adr-0009-2026年のdependabot脆弱性一斉是正)）。同日の判断では一度Dexie（IndexedDB）への保存に移したが、Tauri移行（[ADR-0018](#adr-0018-electronをtauri-v2rustに置き換える)）でWebViewの保存先が旧版と変わる。記事そのものをIndexedDBに保存する案も出たが、取り消してローカルの`.md`ファイルのまま維持する（18:15の判断）。

**Decision**: 設定はRust側で`~/.config/TsumiQiita/config.json`（全OS共通）に保存し、APIトークンだけはOSの資格情報ストア（`keyring`、サービス名`io.github.hidao80.tsumiqiita`）に保存する。設定キーは`config.rs`の`KEYS`に限定し、未知のキーは拒否する。旧Electron版の`localStorage`（ChromiumのLevelDB）は初回起動時に一時ディレクトリへ複製して`rusty-leveldb`で読み、移行する（旧版のプロファイルは書き換えない）。Dexie（IndexedDB）は移行元としてのみ残す。テスト用のLevelDBは`src/src-tauri/tests/fixtures/`に置き、改行変換で壊れないよう`.gitattributes`でバイナリ扱いにする。

**Consequences**: トークンが平文のファイルに残らなくなった。旧版から設定を引き継げるが、`identifier`とアプリのURLを変えると移行元・保存先を読めなくなるため固定が必要（`AGENTS.md`）。記事は引き続きクラウドストレージ等で同期できる`.md`ファイルのまま扱える。

## ADR-0023: E2EテストをWebdriverIO + tauri-driverで実行する

- **Status**: Accepted（17:40の判断「PlaywrightでElectronのE2E」を置き換え）
- **Date**: 2026-11-06（`1b2d0dc`, `c8a54bc`、17:40・19:10・19:50の判断記録）

**Context**: Electron構成ではPlaywrightでE2Eを行う予定だったが、Tauri移行（[ADR-0018](#adr-0018-electronをtauri-v2rustに置き換える)）でPlaywrightから操作できなくなった。

**Decision**: E2EはWebdriverIO + tauri-driverでデバッグビルドの実アプリを操作する（`src/wdio.conf.ts`、Windows / Linuxのみ）。環境変数による差し替え（`src-tauri/src/e2e.rs`）で、実際のプロファイル・設定ファイル・資格情報ストア・Qiita・ダイアログ・既定ブラウザに触れない。Qiita APIはテスト内のモックサーバーが応答する。Windowsでは、WebView2と同じ版の`msedgedriver.exe`を環境変数`TSUMIQIITA_MSEDGEDRIVER`で指定して実行する。

**Consequences**: macOSではE2Eを実行できない（WebDriver非対応）。WebView2は自動更新されるため、版がずれたら`msedgedriver.exe`を取り直す必要がある。ユニットテストは`bun test`（`shared/`）と`cargo test`に分かれた。

## ADR-0024: GitHub Actionsでlint・test・build・auditを実行し、Dependabotで依存を更新する

- **Status**: Accepted
- **Date**: 2026-11-06（`67a34be`, `9f663cf`, `967d0eb`、20:10の判断記録）

**Context**: 2018年に導入したSideCI（`sideci.yml`, `lint_yml/.jshintrc`）は稼働が確認できず（観察事項）、依存の更新が5年近く止まった経緯がある（[ADR-0009](#adr-0009-2026年のdependabot脆弱性一斉是正)）。

**Decision**: SideCIとJSHintの設定を削除し、GitHub Actionsに`lint` / `test`（`bun test`・`cargo fmt --check`・`cargo clippy`・`cargo test`）/ `build` / `audit`（`bun audit`）を置く。各ワークフローでTakumi Guardによる依存パッケージのマルウェア検査を行い、`bun install --frozen-lockfile`を使う。Actionsはコミットハッシュで固定する。Dependabotで`github-actions`・`bun`・`cargo`の依存を毎週更新する。（後に`cooldown`・`concurrency`を追加。[ADR-0028](#adr-0028-ciの同時実行と時間切れを制御しdependabotにcooldownを設ける)参照）

**Consequences**: 依存の脆弱性とマルウェアをCIで検知できるようになり、ADR-0009のような更新の停滞を防ぎやすくなった。ワークフローは`master`ブランチと`src/`構成を前提にしている。

## ADR-0025: タグのpushでtauri-actionが各OSのインストーラーをリリースの下書きに添付する

- **Status**: Accepted（Supersedes: [ADR-0007](#adr-0007-ビルド配布ツールを-electron-packager-から-electron-builder-に移行)の配布方法）
- **Date**: 2026-11-06（`67a34be`、19:40の判断記録）

**Context**: Electron版は`electron-builder`で手元からビルドしていた。Tauri移行後は、Windows / macOS / Linuxのインストーラーをそれぞれのランナーで作る必要がある。

**Decision**: `release.yml`で、`v`なしのバージョンタグ（例: `1.9.0`）のpushを契機に各OSでビルドし、`tauri-apps/tauri-action`でGitHub Releaseの下書きを作ってインストーラーを添付する。タグは`src/package.json`の`version`と一致しなければ失敗させる。

**Consequences**: リリース作業は「バージョンを上げてタグをpushし、下書きを公開する」に単純化された。証明書がないためコード署名・公証はしておらず（macOSはアドホック署名）、初回起動時にOSの警告が出る（リリース本文に手順を記載）。取り消し時の後始末は[ADR-0028](#adr-0028-ciの同時実行と時間切れを制御しdependabotにcooldownを設ける)で追加した。

## ADR-0026: 脆弱な推移的依存（glob・minimatch）をoverridesで上書きする

- **Status**: Accepted
- **Date**: 2026-11-06（`fdd9c9a`, `997bf66`）

**Context**: E2E用の`@wdio/config` 10.1.0と`mocha` 12.0.3が、脆弱な版の`glob`・`minimatch`（GHSA-3g3m-2fjr-6pw4、GHSA-g3hv-75wg-m249）を範囲指定しており、両パッケージの更新だけでは解消できなかった（`AGENTS.md`）。

**Decision**: `src/package.json`の`overrides`で`glob`を`^14.0.2`、`minimatch`を`^11.0.1`に上書きする。両パッケージが修正版を範囲に含めたら`overrides`を外す。

**Consequences**: `bun audit`の指摘は解消するが、上書きした版は依存元が想定する範囲の外になる。依存元の更新を追い、外せる時点で外す保守作業が残る。

## ADR-0027: 修正版に上げられないglibの脆弱性アラートは開いたまま記録する

- **Status**: Accepted
- **Date**: 2026-11-06（`f43f103`、21:00の判断記録）

**Context**: Dependabot alert #23（Rustの`glib` 0.18.5、GHSA-wrw7-89jp-8q8g、`VariantStrIter`の不健全性）が出た。`glib`はLinux用のGTK3部分（`wry` → `webkit2gtk` 2.0 → `gtk` 0.18）から入り、最新のTauri 2.12.5・wry 0.57.1でも0.18のため、修正版の0.20に上げられない。このアプリのコードと依存クレートは`VariantStrIter`を使っていない（`~/.cargo/registry`を検索して確認）。

**Decision**: アラートを却下せず開いたままにし、理由と解消条件を`AGENTS.md`に記録する。Tauri（wry）がgtk-rs 0.20以降に移ったら`cargo update`で解消する。

**Consequences**: 未解消のアラートが残り続けるが、却下と違い、上流の更新で解消できる状態になったことに気づきやすい。

## ADR-0028: CIの同時実行と時間切れを制御し、Dependabotにcooldownを設ける

- **Status**: Accepted
- **Date**: 2026-11-06（`3b2ba4d`, `ef3edc7`, `2ff87fa`, `48ccd48`、21:30・22:00・22:05の判断記録）

**Context**: [ADR-0024](#adr-0024-github-actionsでlinttestbuildauditを実行しdependabotで依存を更新する)・[ADR-0025](#adr-0025-タグのpushでtauri-actionが各osのインストーラーをリリースの下書きに添付する)のワークフローには同時実行と実行時間の制御がなく、Dependabotは公開直後の版も提案していた。`bunfig.toml`の`minimumReleaseAge`（7日）より新しい版はbunが拒否するため、Dependabotの更新が失敗しうる。`3b2ba4d`の最初の設定は、同日のコードレビューで次の問題を指摘された。masterへのpushでも先の実行が取り消される。リリースの時間切れで作りかけの下書きが残る。cooldownはセキュリティ更新に効かない。cooldownの日単位の判定と`minimumReleaseAge`の秒単位の判定が境界でずれうる。

**Decision**:
- audit / build / lint / testは、同じPRへの新しいpushで古い実行を取り消す。masterへのpushは`github.sha`ごとに別のconcurrencyグループにし、取り消さずにコミットごとの結果を残す。
- `timeout-minutes`を付ける。ただし`ubuntu-slim`のジョブは15分で打ち切られるため付けない。
- releaseは同じタグで並行させず、実行中のものを取り消さない。取り消し（時間切れを含む）で終わったら、`cleanup`ジョブがそのタグの下書きリリースを添付ファイルごと消す。公開済みのリリース・タグ・Rustのキャッシュは消さない。
- Dependabotのバージョン更新に`cooldown`を設ける。`bun`は`minimumReleaseAge`より短くならないよう8日、`github-actions`・`cargo`は7日にする。

**Consequences**: 古いPRの実行がCIの枠を使い続けなくなり、masterでは壊れたコミットをCI結果から特定できる。`cleanup`ジョブは、時間切れのジョブの結果が`cancelled`になることを前提にしている（**Speculative**、未検証）。`cooldown`はセキュリティ更新に効かないため、公開から7日未満の修正版へのセキュリティ更新はbunに拒否されうる（7日たってから再実行する）。`timeout-minutes`を付けた理由（暴走したジョブによる実行時間の消費を防ぐ）はコミットにも判断記録にも書かれておらず推測である（**Speculative**）。concurrencyの設定は4つのワークフローに重複しているが、統合は見送った。

---

## 観察事項（決定ではないが留意すべきパターン）

- **ライセンスファイル名の変更**（`1710900`、2026-08-16）: `LICENSE.md`を`LICENSE`に改名した。ADR-0003の「`LICENSE.md`」はこの時点より前の名称。
- **ADRの対象外とした判断記録**: 表示テーマ切替（19:40）、ソーシャルプレビュー画像（20:00）、ドキュメントへのセキュリティ対策の記載（19:50）は、アプリの構成に関わらないためADRにしていない。

- **開発が断続的**: 2018-11-23〜2020-03-03、2020-03-04〜2025-07-01 の2回、長期間コミットが止まっている。個人開発（コミット者は一貫して `hidao80`）による低頻度メンテナンスが実態であり、今後も依存更新の定期チェック（例: Dependabot設定、`npm audit` のCI組み込み）が望ましい。
- **CI設定**（`sideci.yml`, `lint_yml/.jshintrc`）は2018年に導入されたまま現存しているが、直近のコミット履歴からは実際に稼働しているか確認できていない。稼働確認は本ADRのスコープ外。→ 2026-11-06に削除し、GitHub Actionsへ置き換えた（`9f663cf`, `967d0eb`、[ADR-0024](#adr-0024-github-actionsでlinttestbuildauditを実行しdependabotで依存を更新する)）。
- **`.claude/commands/` の追加**（`5fd05d6`、2026-08-14）: `code-analyze` / `make-lp` / `make-social-preview` / `update-adr` のコマンド定義が追加された。これはAIエージェントの作業手順を定義したものであり、アプリケーション自体のアーキテクチャ決定ではないため、本ADRの対象外として観察事項に留める。→ 2026-08-16に`.claude/skills/`形式へ移行し（`6df238d`）、2026-11-06にリポジトリから削除した（`bd135d9`、`CLAUDE.md`も`4f1f11c`で削除）。
- **タグ運用**: `0.1.0`〜`1.8.2` までのバージョンタグはコミット履歴上に残っているが、`package.json` の現行バージョン（1.8.3）に対応するタグは本分析時点で未作成。→ 2026-11-06時点でも`1.8.3`のタグは未作成。以後のタグは`release.yml`の規則（`v`なし・`package.json`の`version`と一致）に従う（[ADR-0025](#adr-0025-タグのpushでtauri-actionが各osのインストーラーをリリースの下書きに添付する)）。
