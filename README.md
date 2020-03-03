# TsumiQiitaとは

[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE.md)
[![npm v6.0.0](https://img.shields.io/badge/node-6.0.0-blue.svg)](https://nodejs.org/ja/)
![hidao quality](https://img.shields.io/badge/hidao-quality-orange.svg)

MarkdownファイルをQiitaに投稿するelectron製デスクトップアプリです。\
下書きに入りきらない**積みQiita**をするためにご利用ください。

<img src="ss.png" width=80%>

node.jsでビルドします。<wbr>**インストール方法は[INSTALL.md](INSTALL.md)**<wbr>を参照してください。

ビルド済みは[**こちら**](https://github.com/hidao80/TsumiQiita/releases)

## 主な機能

- 選択したファイルをQiitaに状態を指定して投稿（限定公開投稿可）
- 選択したMarkdownファイルをプレビュー
- PCのストレージから任意のMarkdownファイルを開く
- 新規Markdownファイルの作成
- Markdownで編集
- リアルタイムプレビュー
- 最後に編集してから3秒後に自動保存
- タグをつけて投稿
- 同一フォルダ内の Markdown ファイルをリストにして常時表示
- Windows / macOS / Linux でほぼ同一の UI を提供
- twitter連携オプション可
- Qiita team用オプション可

以上の機能により、<wbr>**記事の草案をローカルに際限なく貯めることを可能にします**<wbr>。

### ユースケース

1. クラウドストレージにMarkdownファイルを保存し、任意の端末から編集して置いて本アプリで投稿する。
1. リアルタイムプレビューを見ながら下書きをする。

## 注意

1. プレビューはQiitaやGitHubでの表示と異なります。あくまで参考程度とご理解ください。
1. 既存の記事とまったく同じ記事が投稿できます。上書きされません。

### Qiita記事のヘッダ書式

    ---
    title: 記事のタイトル
    tags: タグA:0.0.1 タグB
    tweet: false
    private: false
    coediting: false
    group_url_name: dev
    ---   
    # 見出し1
    本文...

フィールド | 必須 | Type | 説明
---|---|---|---
title | 〇 | string | 記事のタイトル
tags | 〇 | string | タグ。バージョン併記可。5つまで。
tweet | | true/false | Twitterに投稿するかどうか (Twitter連携を有効化している場合のみ有効)
private | | true/false | 限定共有状態かどうかを表すフラグ (Qiita Teamでは無効)  
coedition | | true/false | この記事が共同更新状態かどうか (Qiita Teamでのみ有効)
group_url_name | | null/string | この投稿を公開するグループの url_name (null で全体に公開。Qiita Teamでのみ有効)

### TODO

- [ ] 同期スクロールでプレビューが一番下まで表示されない
- [x] ~~対象フォルダ選択~~
- [x] ~~Markdownファイル選択~~
- [x] ~~Markdownファイルプレビュー~~
- [x] ~~プレビュー中のファイルをQiitaへ限定公開として投稿する~~
- [x] ~~編集~~
- [x] ~~新ファイル作成~~
- [ ] Qiita CSS 適用
- [x] ~~最後に編集してから3秒後に自動保存する~~
- [x] ~~タグを登録できる~~
- [x] ~~シンタックスハイライトに対応~~
- [x] ~~CommonMarkdown に作表と打ち消し線、チェックボックス表示機能を追加~~
- [x] ~~Qiita風のコードブロック（ファイル名表示機能付）~~
- [x] ~~投稿できない~~