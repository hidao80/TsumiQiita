import type { QiitaItemBody, QiitaTag } from './api';

// 旧 js/functions.js の正規表現をそのまま移植（挙動互換のため）
const FRONT_MATTER = /(-{3,}[\s\S])([\s\S.]*?)(-{3,}[\s\S])([\s\S.]*)/;

/** 記事ヘッダを除いた本文を返す */
export function getBody(md: string): string {
  const m = md.match(FRONT_MATTER);
  return m ? m[4] : md;
}

/** 記事ヘッダ部分を返す */
export function getHeader(md: string): string {
  const m = md.match(FRONT_MATTER);
  return m ? m[2] : '';
}

/** "tag:version" 形式の配列をQiitaのタグ配列に変換する */
export function createTagsObject(tags: string[]): QiitaTag[] | undefined {
  if (JSON.stringify(tags) === JSON.stringify([''])) return undefined;

  return tags.map((t) => {
    const tag = t.split(':');
    return tag.length >= 2 ? { name: tag[0], versions: [tag[1]] } : { name: tag[0] };
  });
}

/** ヘッダの値を解釈する。null/~/空は null、前後の引用符は外す */
function parseValue(raw: string): string | null {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  const quoted = v.match(/^"(.*)"$/) ?? v.match(/^'(.*)'$/);
  if (!quoted) return v;
  return quoted[1] === '' ? null : quoted[1];
}

/** タグ指定を解釈する。旧形式 "A B:1.0"・フロー形式 "[A, B]"・ブロック形式（"- A" の行）に対応 */
function parseTags(value: string, blockItems: string[]): QiitaTag[] | undefined {
  let names: string[];
  if (blockItems.length > 0) {
    names = blockItems;
  } else {
    const flow = value.trim().match(/^\[(.*)\]$/);
    names = flow ? flow[1].split(',') : value.trim().split(' ');
  }
  names = names.map((n) => parseValue(n) ?? '');
  if (names.every((n) => n === '')) return undefined;
  return createTagsObject(names);
}

/** 記事ファイルを解釈した結果 */
export interface ParsedArticle {
  /** 投稿済み記事のid（あればPATCHで更新する） */
  id?: string;
  /** Qiita CLIの ignorePublish: true（投稿対象外） */
  ignorePublish: boolean;
  item: QiitaItemBody;
}

/** Markdownファイルの内容を解釈し、Qiita投稿APIの本文と記事idを返す */
export function parseArticle(text: string): ParsedArticle {
  const item: QiitaItemBody = { body: getBody(text) };
  let id: string | undefined;
  let ignorePublish = false;

  const lines = getHeader(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const label = line.slice(0, sep).trim();
    const rawValue = line.slice(sep + 1);
    const value = parseValue(rawValue);

    switch (label) {
      case 'coediting':
      case 'private':
      case 'tweet':
      case 'slide':
      case 'agreed_posting_campaign_term':
        item[label] = value === 'true';
        break;
      case 'title':
      case 'group_url_name':
      case 'organization_url_name':
      case 'posting_campaign_uuid':
        if (value !== null) item[label] = value;
        break;
      case 'id':
        if (value !== null) id = value;
        break;
      case 'ignorePublish':
        ignorePublish = value === 'true';
        break;
      case 'tags': {
        // 続くインデント付きの "- 値" 行をブロック形式のタグとして集める
        const blockItems: string[] = [];
        while (i + 1 < lines.length && /^\s*-\s/.test(lines[i + 1])) {
          blockItems.push(lines[i + 1].replace(/^\s*-\s/, ''));
          i++;
        }
        item.tags = parseTags(rawValue, blockItems);
        break;
      }
    }
  }
  return { id, ignorePublish, item };
}

/** Markdownファイルの内容からQiita投稿APIの本文を組み立てる */
export function buildItemBody(text: string): QiitaItemBody {
  return parseArticle(text).item;
}

/**
 * 記事ヘッダに投稿済み記事のidを書き込む（Qiita CLIと同じ id: 行）。
 * 既に有効なidがあれば変更しない。ヘッダ以外・改行コードはそのまま保つ。
 */
export function setItemId(text: string, itemId: string): string {
  const m = FRONT_MATTER.exec(text);
  if (!m) return text;

  const headerStart = m.index + m[1].length;
  const header = m[2];
  const eol = text.includes('\r\n') ? '\r\n' : '\n';

  const idLine = /^id:[^\r\n]*/m.exec(header);
  let newHeader: string;
  if (idLine) {
    if (parseValue(idLine[0].slice(3)) !== null) return text;
    newHeader = `${header.slice(0, idLine.index)}id: ${itemId}${header.slice(idLine.index + idLine[0].length)}`;
  } else {
    const needsBreak = header.length > 0 && !header.endsWith('\n');
    newHeader = `${header}${needsBreak ? eol : ''}id: ${itemId}${eol}`;
  }
  return text.slice(0, headerStart) + newHeader + text.slice(headerStart + header.length);
}
