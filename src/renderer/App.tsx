import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiError, MarkdownFile } from '../shared/api';
import { parseArticle, setItemId } from '../shared/frontMatter';
import { QiitaItemBodySchema, QiitaItemIdSchema, type Theme, type ViewMode, ViewModeSchema } from '../shared/schema';
import { basename, config } from './lib/config';
import { renderMarkdown } from './lib/markdown';
import { currentTheme, saveTheme } from './lib/theme';

const WRITE_INTERVAL = 3000;
const HEADER_HELP_URL =
  'https://github.com/hidao80/TsumiQiita/tree/master#qiita%E8%A8%98%E4%BA%8B%E3%81%AE%E3%83%98%E3%83%83%E3%83%80%E6%9B%B8%E5%BC%8F';

import { api } from './lib/api';

// ファイル一覧・メニューの項目（ラジオボタン＋ラベル）
const ITEM_DIV = 'm-4 border-b border-[color:var(--tq-border)]';
const ITEM_RADIO = 'peer hidden';
const ITEM_LABEL =
  'm-0 block h-full w-full text-[1.3rem] whitespace-nowrap peer-checked:bg-[color:var(--tq-accent)] peer-checked:text-white';

// 表示モード切替（連続したトグルボタン風のラジオボタン。iconはMaterial Symbolsのアイコン名）
const VIEW_MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: 'editor', label: '全画面エディター', icon: 'edit_note' },
  { value: 'split', label: '半々', icon: 'horizontal_split' },
  { value: 'preview', label: '全画面プレビュー', icon: 'visibility' },
];
const VIEW_MODE_LABEL =
  'block cursor-pointer border border-[color:var(--tq-accent-text)] py-1 text-center leading-none text-[color:var(--tq-accent-text)] select-none peer-checked:bg-[color:var(--tq-accent)] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--tq-accent-text)]';
// 端のボタンだけ角を丸め、隣接する境界線は重ねる
const VIEW_MODE_EDGE = ['rounded-l-md', '-ml-px', '-ml-px rounded-r-md'];

// 表示モードごとの各要素のクラス（Tailwindが検出できるよう完全な文字列で列挙する）
const PREVIEW_CLASS: Record<ViewMode, string> = {
  editor: 'hidden',
  split: 'h-1/2 overflow-y-auto',
  preview: 'h-full overflow-y-auto',
};
const EDITOR_CLASS: Record<ViewMode, string> = {
  editor: 'h-[calc(100%-20px-1.1rem)]',
  split: 'h-[calc(50%-20px-1.1rem)]',
  preview: 'hidden',
};

/** Qiita APIのエラーを利用者向けのメッセージにする */
function describeApiError(error: ApiError, action: string, isUpdate = false): string {
  const hints: Record<number, string> = {
    400: '・記事ヘッダの内容（タグは5つまで等）を確認してください',
    401: '・トークンが無効です。トークンを再設定してください',
    403: '・トークンに write_qiita スコープが無いか、利用できない機能（スライド等）です',
    404: isUpdate
      ? '・記事が削除されたか、他のユーザーの記事です。記事ヘッダの id を消すと新規投稿します'
      : '・対象が見つかりません',
    429: '・APIの利用上限（1時間あたり1000回）に達しました。時間をおいて再度お試しください',
  };
  return [
    `${action}に失敗しました…（${error.status}）`,
    error.message ? `・${error.message}` : '',
    hints[error.status] ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

function fileNameEncode(name: string): string {
  return name.replace('.', '_');
}

export function App() {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [currentFile, setCurrentFile] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  // 描画前にmain.tsxで反映済みのテーマを初期値にする
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const tokenDialogRef = useRef<HTMLDialogElement>(null);
  const msgDialogRef = useRef<HTMLDialogElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  // 未保存の内容と保存先。ファイル切替時も元のファイルへ書き込むために保持する
  const pending = useRef<{ path: string; text: string } | undefined>(undefined);
  // 非同期処理の完了時点で開いているファイルを知るための参照
  const currentFileRef = useRef<string | undefined>(undefined);

  const previewHtml = useMemo(() => renderMarkdown(text), [text]);

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    msgDialogRef.current?.showModal();
  }, []);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = undefined;
    try {
      await api.writeFile(p.path, p.text);
    } catch {
      showMessage('保存に失敗しました');
      return;
    }
    if (!pending.current) setDirty(false);
  }, [showMessage]);

  const refreshFiles = useCallback(async (dir: string | undefined) => {
    if (!dir) return;
    setFiles(await api.listMarkdownFiles(dir));
  }, []);

  const openMarkdownFile = useCallback(
    async (path: string) => {
      await flush();
      try {
        setText(await api.readFile(path));
      } catch {
        return;
      }
      setCurrentFile(path);
      currentFileRef.current = path;
      await config.set('CURRENT_FILE', path);
    },
    [flush],
  );

  // 起動時に前回のフォルダ・ファイル・トークンを復元する
  useEffect(() => {
    void (async () => {
      const [last, dir, token, mode] = await Promise.all([
        config.get('CURRENT_FILE'),
        config.get('TARGET_DIR'),
        // 資格情報ストアを使えなくても、他の設定は復元する
        config.get('TOKEN').catch(() => undefined),
        config.get('VIEW_MODE'),
      ]);
      setTokenInput(token ?? '');
      setViewMode(ViewModeSchema.catch('split').parse(mode));
      if (last) await openMarkdownFile(last);
      await refreshFiles(dir);
    })();
  }, [openMarkdownFile, refreshFiles]);

  const onEdit = (value: string) => {
    setText(value);
    if (!currentFile) return;
    pending.current = { path: currentFile, text: value };
    setDirty(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), WRITE_INTERVAL);
  };

  // Tabキーでフォーカス移動せずタブ文字を入力する
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    // カーソル位置にタブを挿入し、カーソルをタブの直後へ移動する
    el.setRangeText('\t', el.selectionStart, el.selectionStart, 'end');
    onEdit(el.value);
  };

  const changeTheme = (next: Theme) => {
    setTheme(next);
    void saveTheme(next);
  };

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    void config.set('VIEW_MODE', mode);
  };

  const onEditorScroll = () => {
    const e = editorRef.current;
    const p = previewRef.current;
    if (!e || !p) return;
    // スクロール可能な範囲どうしを対応させ、エディタが末尾ならプレビューも末尾まで表示する
    const editorMax = e.scrollHeight - e.clientHeight;
    if (editorMax <= 0) return;
    p.scrollTop = (p.scrollHeight - p.clientHeight) * (e.scrollTop / editorMax);
  };

  const selectTargetDir = async () => {
    const dir = await api.selectTargetDir();
    if (dir === undefined) return;
    await config.set('TARGET_DIR', dir);
    await refreshFiles(dir);
  };

  const createArticle = async () => {
    const saved = await api.createArticle();
    if (!saved) return;
    await refreshFiles(await config.get('TARGET_DIR'));
    await openMarkdownFile(saved);
  };

  // トークンを保存し、GET /api/v2/authenticated_user で有効か確認する
  const setToken = async () => {
    tokenDialogRef.current?.close();
    try {
      await config.set('TOKEN', tokenInput);
    } catch (e) {
      showMessage(`トークンを保存できませんでした（${String(e)}）`);
      return;
    }
    if (!tokenInput) return;

    const result = await api.verifyToken(tokenInput);
    if ('networkError' in result) {
      showMessage('トークンを保存しました（通信エラーのため有効か確認できませんでした）');
    } else if (result.ok) {
      showMessage(`トークンを保存しました（@${result.userId}）`);
    } else {
      showMessage(describeApiError(result, 'トークンの確認'));
    }
  };

  // 新規投稿で払い出された記事idを、投稿したファイルの記事ヘッダに書き込む
  const writeBackItemId = async (path: string, itemId: string) => {
    if (currentFileRef.current === path && editorRef.current) {
      // 投稿中に編集が続いていても、最新の編集内容に対してidを追記して保存する
      const latest = setItemId(editorRef.current.value, itemId);
      setText(latest);
      pending.current = { path, text: latest };
      await flush();
    } else {
      await api.writeFile(path, setItemId(await api.readFile(path), itemId));
    }
  };

  const post = async () => {
    const token = await config.get('TOKEN').catch(() => undefined);
    if (token === undefined) {
      showMessage('トークンがセットされていません');
      return;
    }
    if (!currentFile) {
      showMessage('ファイルが選択されていません');
      return;
    }

    // 投稿はディスク上のファイル内容から行う（未保存分は先に保存する）
    const postedPath = currentFile;
    await flush();
    const { id, ignorePublish, item: body } = parseArticle(await api.readFile(postedPath));
    if (ignorePublish) {
      showMessage('ignorePublish: true の記事は投稿しません');
      return;
    }
    if (!body.title) {
      showMessage('タイトルが入力されていません');
      return;
    }
    if (body.tags === undefined) {
      showMessage('タグが入力されていません');
      return;
    }

    if (id !== undefined && !QiitaItemIdSchema.safeParse(id).success) {
      showMessage(`記事ヘッダの id（${id}）の形式が正しくありません`);
      return;
    }
    const checked = QiitaItemBodySchema.safeParse(body);
    if (!checked.success) {
      showMessage(checked.error.issues.map((issue) => issue.message).join('\n'));
      return;
    }

    // 記事ヘッダに id があれば既存記事を更新（PATCH）、無ければ新規投稿（POST）する
    const action = id ? '更新' : '投稿';
    const result = await api.postItem(token, checked.data, id);
    if ('networkError' in result) {
      showMessage('通信エラーが発生しました');
      return;
    }
    if (!result.ok) {
      showMessage(describeApiError(result, action, Boolean(id)));
      return;
    }
    if (!id && result.id) {
      try {
        await writeBackItemId(postedPath, result.id);
      } catch {
        showMessage(
          `投稿しました！\n記事ヘッダへの id の書き込みに失敗しました。次回の投稿前に id: ${result.id} を追記してください`,
        );
        return;
      }
    }
    showMessage(result.url ? `${action}しました！\n${result.url}` : `${action}しました！`);
  };

  const currentName = currentFile ? basename(currentFile) : undefined;

  return (
    <>
      <div id="controls" className="w-[30%]">
        <div id="header" className="m-4 flex h-8 w-[30%] items-center text-[2rem]">
          {/* サイドメニューを開くボタン（製品名の左側） */}
          <div id="menu">
            <input id="nav-input" type="checkbox" className="nav-unshown" />
            <label id="nav-open" htmlFor="nav-input" title="メニュー">
              <span className="material-symbols-outlined" aria-hidden="true">
                menu
              </span>
              <span className="sr-only">メニュー</span>
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: メニューを閉じる背景オーバーレイ。htmlForで関連付け済みでテキストを持たない */}
            <label className="nav-unshown" id="nav-close" htmlFor="nav-input" />
            <div id="nav-content">
              <div className={ITEM_DIV}>
                <input
                  type="radio"
                  className={`target-dir ${ITEM_RADIO}`}
                  name="menu"
                  id="article-name"
                  onClick={createArticle}
                />
                <label htmlFor="article-name" className={ITEM_LABEL}>
                  新規作成
                </label>
              </div>
              <div className={ITEM_DIV}>
                <input
                  type="radio"
                  className={`target-dir ${ITEM_RADIO}`}
                  name="menu"
                  id="target-dir"
                  onClick={selectTargetDir}
                />
                <label htmlFor="target-dir" className={ITEM_LABEL}>
                  対象フォルダを選択
                </label>
              </div>
              <div className={ITEM_DIV}>
                <input
                  type="radio"
                  className={ITEM_RADIO}
                  name="menu"
                  id="path"
                  onClick={() => tokenDialogRef.current?.showModal()}
                />
                <label htmlFor="path" className={ITEM_LABEL}>
                  トークンをセット
                </label>
              </div>
              <div>
                <dialog id="token-input-dialog" ref={tokenDialogRef}>
                  <input
                    id="input"
                    placeholder="トークンを入力してください"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                  />
                  <button type="button" onClick={setToken}>
                    保存
                  </button>
                </dialog>
              </div>
              <div className={ITEM_DIV}>
                <input type="radio" className={ITEM_RADIO} name="menu" id="post" onClick={post} />
                <label htmlFor="post" className={ITEM_LABEL}>
                  Qiitaに投稿
                </label>
              </div>
              <div>
                <dialog id="msg-dialog" ref={msgDialogRef}>
                  <span id="message" className="text-[1rem] whitespace-pre-line">
                    {message}
                  </span>
                  <br />
                  <button type="button" onClick={() => msgDialogRef.current?.close()}>
                    閉じる
                  </button>
                </dialog>
              </div>
              <div className={ITEM_DIV}>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  className="peer sr-only"
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onChange={(e) => changeTheme(e.target.checked ? 'dark' : 'light')}
                />
                <label
                  htmlFor="theme-toggle"
                  className="flex cursor-pointer items-center justify-between text-[1.3rem] whitespace-nowrap select-none peer-focus-visible:outline-2 peer-focus-visible:outline-[color:var(--tq-accent-text)]"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                    </span>
                    ダークテーマ
                  </span>
                  {/* トグルスイッチの見た目（状態はテーマから決める） */}
                  <span
                    aria-hidden="true"
                    className={`relative inline-block h-6 w-11 rounded-full transition-colors ${theme === 'dark' ? 'bg-[color:var(--tq-accent)]' : 'bg-[color:var(--tq-switch-off)]'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </span>
                </label>
              </div>
            </div>
          </div>
          <div id="title" className={dirty ? 'italic' : 'not-italic'}>
            TsumiQiita
          </div>
        </div>
        <div id="view-mode" role="radiogroup" aria-label="表示モード" className="mx-4 flex h-8">
          {VIEW_MODES.map(({ value, label, icon }, i) => (
            <div className="flex-1" key={value}>
              <input
                type="radio"
                className="peer sr-only"
                name="view-mode"
                id={`view-mode-${value}`}
                checked={viewMode === value}
                onChange={() => changeViewMode(value)}
              />
              <label htmlFor={`view-mode-${value}`} className={`${VIEW_MODE_LABEL} ${VIEW_MODE_EDGE[i]}`} title={label}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {icon}
                </span>
                <span className="sr-only">{label}</span>
              </label>
            </div>
          ))}
        </div>
        <div
          id="files"
          className="h-[calc((100%-2rem)*0.9-2rem)] w-[calc(100%-20px)] overflow-x-hidden overflow-y-scroll"
        >
          {files.map((f) => (
            <div className={ITEM_DIV} key={f.path}>
              <input
                type="radio"
                className={ITEM_RADIO}
                name="fileName"
                id={fileNameEncode(f.name)}
                checked={f.name === currentName}
                onChange={() => void openMarkdownFile(f.path)}
              />
              <label htmlFor={fileNameEncode(f.name)} className={ITEM_LABEL}>
                {f.name}
              </label>
            </div>
          ))}
        </div>
      </div>
      <div id="working-area" className="w-full">
        <div
          id="preview"
          className={`markdown-content m-0 w-[calc(100%-2px)] ${PREVIEW_CLASS[viewMode]}`}
          ref={previewRef}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Qiita同様に記事中のHTMLをプレビューする（本番はCSPでスクリプトを遮断）
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <label
          htmlFor="tsumiqiita-editor"
          id="tags-label"
          className={`h-[1.1rem] text-[1rem] text-[color:var(--tq-muted)] ${viewMode === 'preview' ? 'hidden' : ''}`}
        >
          <a href={HEADER_HELP_URL} target="_blank" rel="noreferrer">
            Qiitaの記事ヘッダを参照
          </a>
          してください。titleとtagsは必須です。
        </label>
        <textarea
          id="tsumiqiita-editor"
          className={`m-0 w-[calc(100%-22px)] resize-none overflow-scroll border border-[color:var(--tq-editor-border)] ${EDITOR_CLASS[viewMode]}`}
          ref={editorRef}
          value={text}
          onChange={(e) => onEdit(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={onEditorScroll}
        />
      </div>
    </>
  );
}
