import { describe, expect, test } from 'bun:test';
import { buildItemBody, createTagsObject, getBody, getHeader, parseArticle, setItemId } from './frontMatter';

const article = `---
title: Hello
tags: JavaScript:ES6 Electron
private: true
coediting: false
tweet: true
group_url_name: mygroup
---
# 本文
text`;

describe('getHeader / getBody', () => {
  test('記事ヘッダと本文を分離する', () => {
    expect(getHeader(article)).toBe(
      'title: Hello\ntags: JavaScript:ES6 Electron\nprivate: true\ncoediting: false\ntweet: true\ngroup_url_name: mygroup\n',
    );
    expect(getBody(article)).toBe('# 本文\ntext');
  });

  test('ヘッダが無ければ全文が本文', () => {
    expect(getHeader('# only body')).toBe('');
    expect(getBody('# only body')).toBe('# only body');
  });
});

describe('createTagsObject', () => {
  test('バージョン付きタグを変換する', () => {
    expect(createTagsObject(['JavaScript:ES6', 'Electron'])).toEqual([
      { name: 'JavaScript', versions: ['ES6'] },
      { name: 'Electron' },
    ]);
  });

  test('空のタグはundefined', () => {
    expect(createTagsObject([''])).toBeUndefined();
  });
});

describe('buildItemBody', () => {
  test('ヘッダ項目を投稿本文に変換する', () => {
    expect(buildItemBody(article)).toEqual({
      body: '# 本文\ntext',
      title: 'Hello',
      tags: [{ name: 'JavaScript', versions: ['ES6'] }, { name: 'Electron' }],
      private: true,
      coediting: false,
      tweet: true,
      group_url_name: 'mygroup',
    });
  });

  test('title中の":"以降も保持する（旧実装では切り捨てていた）', () => {
    expect(buildItemBody('---\ntitle: a: b\n---\nx').title).toBe('a: b');
  });

  test('タグ未指定ならtagsはundefined', () => {
    expect(buildItemBody('---\ntitle: a\ntags:\n---\nx').tags).toBeUndefined();
  });
});

describe('parseArticle（Qiita CLI形式のヘッダ）', () => {
  const cli = `---
title: "CLI: 記事"
tags:
  - "Ruby"
  - Rails:7.0
private: false
updated_at: ""
id: 0123456789abcdef0123
organization_url_name: null
slide: true
ignorePublish: false
posting_campaign_uuid: 0123456789abcdef0123
agreed_posting_campaign_term: true
---
本文`;

  test('引用符・null・ブロック形式のタグ・新しい項目を解釈する', () => {
    expect(parseArticle(cli)).toEqual({
      id: '0123456789abcdef0123',
      ignorePublish: false,
      item: {
        body: '本文',
        title: 'CLI: 記事',
        tags: [{ name: 'Ruby' }, { name: 'Rails', versions: ['7.0'] }],
        private: false,
        slide: true,
        posting_campaign_uuid: '0123456789abcdef0123',
        agreed_posting_campaign_term: true,
      },
    });
  });

  test('フロー形式のタグを解釈する', () => {
    expect(buildItemBody('---\ntitle: a\ntags: [Ruby, "Go"]\n---\nx').tags).toEqual([{ name: 'Ruby' }, { name: 'Go' }]);
  });

  test('id: null は未投稿として扱う', () => {
    expect(parseArticle('---\ntitle: a\nid: null\n---\nx').id).toBeUndefined();
  });

  test('ignorePublish: true を検出する', () => {
    expect(parseArticle('---\ntitle: a\nignorePublish: true\n---\nx').ignorePublish).toBe(true);
  });

  test('CRLFのファイルも解釈できる', () => {
    expect(parseArticle('---\r\ntitle: a\r\nid: abc\r\n---\r\nx').id).toBe('abc');
  });
});

describe('setItemId', () => {
  test('id行が無ければヘッダ末尾に追加し、本文は変えない', () => {
    expect(setItemId('---\ntitle: a\n---\n本文\n---\n', 'abc')).toBe('---\ntitle: a\nid: abc\n---\n本文\n---\n');
  });

  test('id: null や空のidは置き換える', () => {
    expect(setItemId('---\nid: null\ntitle: a\n---\nx', 'abc')).toBe('---\nid: abc\ntitle: a\n---\nx');
    expect(setItemId('---\nid: ""\n---\nx', 'abc')).toBe('---\nid: abc\n---\nx');
  });

  test('既に有効なidがあれば変更しない', () => {
    const text = '---\nid: old\n---\nx';
    expect(setItemId(text, 'abc')).toBe(text);
  });

  test('CRLFの改行コードを保つ', () => {
    expect(setItemId('---\r\ntitle: a\r\n---\r\nx', 'abc')).toBe('---\r\ntitle: a\r\nid: abc\r\n---\r\nx');
    expect(setItemId('---\r\nid: null\r\n---\r\nx', 'abc')).toBe('---\r\nid: abc\r\n---\r\nx');
  });

  test('ヘッダが無ければ変更しない', () => {
    expect(setItemId('# only body', 'abc')).toBe('# only body');
  });
});
