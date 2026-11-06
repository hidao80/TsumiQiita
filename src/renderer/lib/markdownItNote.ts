import type { MarkdownIt, RendererRule, StateBlock } from 'markdown-it';

// Qiita Markdown のカスタムブロック（:::note info / warn / alert ～ :::）。
// 構文は qiita_marker の qfm_custom_block、描画は qiita-markdown の CustomBlock フィルタに合わせる
// https://github.com/increments/qiita-markdown/blob/master/lib/qiita/markdown/filters/custom_block.rb
// - 開始行は ":" 3つ以上＋":" を含まない任意の文字列（メタデータ）。閉じ行は ":" 3つ以上のみ
// - 種類が note 以外（空を含む）は装飾の無い <div> になる
// - note の種類は info / warn / alert で、それ以外・省略時は info
// - カスタムブロックは入れ子にできない。閉じ行が無ければ親ブロックの終わりまで続く

// アイコンは material-symbols（アプリに同梱済み）のリガチャ名。
// Qiita の fa-check-circle / fa-exclamation-circle / fa-times-circle に相当する
const NOTE_ICONS = {
  info: 'check_circle',
  warn: 'error',
  alert: 'cancel',
} as const;
type NoteType = keyof typeof NOTE_ICONS;

const OPEN = /^:{3,}([^:\r\n]*)$/;
const CLOSE = /^:{3,}[ \t]*$/;

/** 入れ子を禁止するため、カスタムブロック内を解析中かどうかを StateBlock に持たせる */
type CustomBlockState = StateBlock & { qfmInCustomBlock?: boolean };

/** メタデータ（例 "note warn"）から note の種類を返す。note 以外なら null */
function noteType(metadata: string): NoteType | null {
  const [type, subtype = ''] = metadata.trim().split(/\s+/);
  if (type !== 'note') return null;
  return Object.hasOwn(NOTE_ICONS, subtype) ? (subtype as NoteType) : 'info';
}

function customBlock(state: CustomBlockState, startLine: number, endLine: number, silent: boolean): boolean {
  // 4つ以上のインデントはコードブロック
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.qfmInCustomBlock) return false;

  const start = state.bMarks[startLine] + state.tShift[startLine];
  const m = state.src.slice(start, state.eMarks[startLine]).match(OPEN);
  if (!m) return false;
  if (silent) return true;

  // 閉じ行を探す。無ければ親ブロックの終わりまでをカスタムブロックとする
  let nextLine = startLine;
  let closed = false;
  while (++nextLine < endLine) {
    const pos = state.bMarks[nextLine] + state.tShift[nextLine];
    const max = state.eMarks[nextLine];
    // 親（リスト等）より浅いインデントの行で終わる
    if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
    if (CLOSE.test(state.src.slice(pos, max))) {
      closed = true;
      break;
    }
  }

  const oldLineMax = state.lineMax;
  state.lineMax = nextLine;

  const open = state.push('qfm_custom_block_open', 'div', 1);
  open.block = true;
  open.info = m[1].trim();
  open.markup = ':::';
  open.map = [startLine, nextLine];

  state.qfmInCustomBlock = true;
  state.md.block.tokenize(state, startLine + 1, nextLine);
  state.qfmInCustomBlock = false;

  const close = state.push('qfm_custom_block_close', 'div', -1);
  close.block = true;
  close.info = open.info;
  close.markup = ':::';

  state.lineMax = oldLineMax;
  state.line = nextLine + (closed ? 1 : 0);
  return true;
}

/** Qiita Markdown の :::note 記法（カスタムブロック）をプレビューで描画する markdown-it プラグイン */
export default function markdownItNote(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'qfm_custom_block', customBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  const renderOpen: RendererRule = (tokens, idx) => {
    const type = noteType(tokens[idx].info);
    if (!type) return '<div>\n';
    return (
      `<div class="note ${type}">` +
      `<span class="note-icon material-symbols-outlined" aria-hidden="true">${NOTE_ICONS[type]}</span>` +
      '<div class="note-body">\n'
    );
  };
  const renderClose: RendererRule = (tokens, idx) => (noteType(tokens[idx].info) ? '</div></div>\n' : '</div>\n');
  md.renderer.rules.qfm_custom_block_open = renderOpen;
  md.renderer.rules.qfm_custom_block_close = renderClose;
}
