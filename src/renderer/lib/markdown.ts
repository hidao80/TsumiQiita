import escapeHtml from 'escape-html';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import markdownItCheckbox from 'markdown-it-checkbox';
import { getBody } from '../../shared/frontMatter';
import markdownItNote from './markdownItNote';

// 旧 rendaring() のコードブロック描画を移植（"lang:filename" でファイル名ヘッダを表示）
function highlight(str: string, langWithFile: string): string {
  let lang = langWithFile;
  let filename = '';
  if (lang && lang.indexOf(':') >= 1) {
    [lang, filename] = lang.split(':');
  }

  // 見た目は css/qiita-preview.css で指定する（インラインスタイルは使わない）
  const header = filename ? `<div class='code-lang'>${escapeHtml(filename)}</div>` : '';

  let code = escapeHtml(str);
  if (lang) {
    try {
      code = hljs.highlight(str, { language: lang }).value;
    } catch {
      // 未対応言語はエスケープのみ
    }
  }

  return `<div class='code-frame highlight'>${header}<div class='highlight'><pre><code>${code}</code></pre></div></div>\n`;
}

const md = new MarkdownIt('commonmark').enable(['table', 'strikethrough']).use(markdownItCheckbox).use(markdownItNote);

// highlightオプションでは出力が<pre><code>で二重に包まれるため、フェンスの描画を置き換える
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  return highlight(token.content, token.info.trim());
};

/** 記事ヘッダを除いた本文をHTMLに変換する */
export function renderMarkdown(text: string): string {
  return md.render(getBody(text));
}
