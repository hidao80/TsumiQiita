import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $, $$, browser, expect } from '@wdio/globals';
import { ARTICLE, current, LEGACY, queueResponses, takeRequests } from './support';

// 1つのセッション（アプリ1回の起動）で順に操作する。各テストは前のテストの状態を引き継ぐ

type TauriWindow = { __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> } };

/** Rustのコマンドを直接呼ぶ */
function invoke<T>(cmd: string): Promise<T> {
  return browser.execute((c) => (window as unknown as TauriWindow).__TAURI_INTERNALS__.invoke(c), cmd) as Promise<T>;
}

/** 設定ファイル（config.json）の内容と、資格情報ストアの代わりのファイルに保存されたトークン */
function settings(): Record<string, string> {
  const file = path.join(current().configDir, 'config.json');
  const values: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : {};
  if (existsSync(current().tokenFile)) values.TOKEN = readFileSync(current().tokenFile, 'utf-8');
  return values;
}

const dataFile = (name: string) => path.join(current().dataDir, name);
const label = (forId: string) => $(`label[for="${forId}"]`);
const message = () => $('#message');

async function openMenu() {
  if (!(await $('#nav-input').isSelected())) await $('#nav-open').click();
}

/** メニューの外側（背景）をクリックして閉じる */
async function closeMenu() {
  if (await $('#nav-input').isSelected()) await $('#nav-close').click({ x: 300 });
}

async function closeMessage() {
  await $('#msg-dialog button').click();
}

/** エディタの末尾に文字を入力する */
async function typeAtEnd(text: string) {
  const editor = $('#tsumiqiita-editor');
  await editor.click();
  await browser.keys(['Control', 'End']);
  await editor.addValue(text);
}

async function messageText(): Promise<string> {
  await expect(message()).toBeDisplayed();
  return message().getText();
}

describe('TsumiQiita（Tauri）', () => {
  it('WebViewのデータが実際のプロファイルではなく一時ディレクトリにある', async () => {
    await expect(browser).toHaveTitle('TsumiQiita');
    const dirs = await invoke<{ override?: string; webview2UserDataFolder?: string }>('e2e_data_dir');
    // WindowsではmsedgedriverがセッションごとのWebView2保存先を環境変数で指定し、アプリの指定より優先される
    const effective = dirs.webview2UserDataFolder ?? dirs.override;
    expect(effective).toBeDefined();
    expect(path.resolve(effective as string).startsWith(path.resolve(tmpdir()))).toBe(true);
  });

  it('初回起動時に旧Electron版の設定（LevelDB）を移行する', async () => {
    await openMenu();
    await label('path').click();
    await expect($('#input')).toHaveValue(LEGACY.token);
    await browser.keys('Escape');

    const s = settings();
    expect(s.TOKEN).toBe(LEGACY.token);
    expect(s.TARGET_DIR).toBe(LEGACY.targetDir);
    expect(s.LEGACY_MIGRATED).toBe('1');
    // トークンは設定ファイルではなく資格情報ストア（E2Eでは代わりのファイル）に保存する
    expect(readFileSync(path.join(current().configDir, 'config.json'), 'utf-8')).not.toContain(LEGACY.token);
  });

  it('対象フォルダを選択すると.mdファイルだけを一覧に表示する（ダイアログは差し替え）', async () => {
    await label('target-dir').click();
    await expect($$('#files label')).toHaveText(['a.md', 'b.md']);
    expect(settings().TARGET_DIR).toBe(current().dataDir);

    await closeMenu();
    await label('a_md').click();
    await expect($('#a_md')).toBeSelected();
    // toHaveValue は期待値の前後の空白を削るため、getValue で厳密に比べる
    expect(await $('#tsumiqiita-editor').getValue()).toBe(ARTICLE);
  });

  it('プレビューにMarkdownをQiita記事風のスタイルで描画する', async () => {
    const preview = $('#preview');
    await expect(preview.$('h1')).toHaveText('見出し');
    await expect(preview.$('table')).toBeDisplayed();
    await expect(preview.$$('input[type=checkbox]')).toBeElementsArrayOfSize(1);
    await expect(preview.$('s')).toHaveText('strike');
    await expect(preview.$('.code-lang')).toHaveText('sample.js');
    await expect(preview.$('.hljs-keyword')).toHaveText('const');
    await expect(preview.$$('pre pre')).toBeElementsArrayOfSize(0);
    const h1Border = await preview.$('h1').getCSSProperty('border-bottom-style');
    expect(h1Border.value).toBe('solid');
  });

  it('メニューボタンはアイコンフォントで、製品名の左側にある', async () => {
    const icon = $('#nav-open .material-symbols-outlined');
    await expect(icon).toHaveText('menu');
    expect((await icon.getCSSProperty('font-family')).value).toContain('material symbols outlined');
    const button = await $('#nav-open').getLocation();
    const title = await $('#title').getLocation();
    expect(button.x).toBeLessThan(title.x);
  });

  it('CSPで記事中のスクリプトが実行されない', async () => {
    await expect(browser).toHaveTitle('TsumiQiita');
  });

  it('Noto Sans JPとアイコンフォントを読み込む', async () => {
    const loaded = await browser.execute(async () => {
      await document.fonts.ready;
      return [
        document.fonts.check('400 16px "Noto Sans JP"', '見出し'),
        document.fonts.check('700 16px "Noto Sans JP"', '見出し'),
        document.fonts.check('24px "Material Symbols Outlined"', 'edit_note'),
      ];
    });
    expect(loaded).toEqual([true, true, true]);
  });

  it('編集内容を自動保存し、Tabキーでタブ文字を入力する', async () => {
    await typeAtEnd('追記');
    await expect($('#title')).toHaveElementClass('italic');
    await browser.keys('Tab');
    await $('#tsumiqiita-editor').addValue('X');

    await browser.waitUntil(() => readFileSync(dataFile('a.md'), 'utf-8') === `${ARTICLE}追記\tX`, {
      timeout: 10_000,
      timeoutMsg: '自動保存されませんでした',
    });
    await expect($('#title')).toHaveElementClass('not-italic');
  });

  it('未保存のままファイルを切り替えても元のファイルに保存される', async () => {
    await typeAtEnd('Z');
    await label('b_md').click();
    await browser.waitUntil(async () => (await $('#tsumiqiita-editor').getValue()) === '# B file\n', {
      timeoutMsg: 'b.md が開かれませんでした',
    });
    expect(readFileSync(dataFile('a.md'), 'utf-8')).toBe(`${ARTICLE}追記\tXZ`);
    expect(readFileSync(dataFile('b.md'), 'utf-8')).toBe('# B file\n');
  });

  it('トークンの確認と投稿前の検証メッセージを表示する（Qiitaはモック）', async () => {
    // トークンを空にして保存すると未設定になる
    await openMenu();
    await label('path').click();
    // WebDriverのclearはReactのinputイベントを発生させないため、キー入力で消す
    await $('#input').click();
    await browser.keys(['Control', 'a']);
    await browser.keys('Backspace');
    await $('#token-input-dialog button').click();
    await label('post').click();
    expect(await messageText()).toBe('トークンがセットされていません');
    await closeMessage();

    // 保存時に GET /authenticated_user で確認する
    queueResponses({ status: 200, body: { id: 'tester' } });
    await label('path').click();
    await $('#input').setValue('dummy-token');
    await $('#token-input-dialog button').click();
    expect(await messageText()).toBe('トークンを保存しました（@tester）');
    await closeMessage();
    expect(takeRequests()).toEqual([
      { url: '/api/v2/authenticated_user', method: 'GET', authorization: 'Bearer dummy-token', body: undefined },
    ]);

    // b.md には記事ヘッダが無い
    await label('post').click();
    expect(await messageText()).toBe('タイトルが入力されていません');
    await closeMessage();
  });

  it('新規投稿でidを記事ヘッダに書き戻し、次回はPATCHで更新する（Qiitaはモック）', async () => {
    const itemId = 'abc123def4567890abcd';
    const url = `https://qiita.com/tester/items/${itemId}`;
    await closeMenu();
    await label('a_md').click();
    await openMenu();

    queueResponses({ status: 201, body: { id: itemId, url } });
    await label('post').click();
    expect(await messageText()).toBe(`投稿しました！\n${url}`);
    await closeMessage();
    const [created] = takeRequests();
    expect(created).toMatchObject({
      url: '/api/v2/items',
      method: 'POST',
      authorization: 'Bearer dummy-token',
      body: { title: 'テスト記事', tags: [{ name: 'JavaScript', versions: ['ES6'] }, { name: 'Electron' }] },
    });
    await browser.waitUntil(() => readFileSync(dataFile('a.md'), 'utf-8').includes(`\nid: ${itemId}\n---`), {
      timeoutMsg: 'idが書き戻されませんでした',
    });
    expect(await $('#tsumiqiita-editor').getValue()).toContain(`\nid: ${itemId}\n`);

    queueResponses({ status: 200, body: { id: itemId, url } });
    await label('post').click();
    expect(await messageText()).toBe(`更新しました！\n${url}`);
    await closeMessage();
    const [updated] = takeRequests();
    expect(updated).toMatchObject({ url: `/api/v2/items/${itemId}`, method: 'PATCH' });
    expect(updated.body).not.toHaveProperty('tweet');

    queueResponses({ status: 404, body: { message: 'Not found', type: 'not_found' } });
    await label('post').click();
    const notFound = await messageText();
    expect(notFound).toContain('更新に失敗しました…（404）');
    expect(notFound).toContain('・Not found');
    expect(notFound).toContain('id を消すと新規投稿します');
    await closeMessage();

    queueResponses('network-error');
    await label('post').click();
    expect(await messageText()).toBe('通信エラーが発生しました');
    await closeMessage();
    takeRequests();
  });

  it('新規作成で空の.mdファイルを作って開く（ダイアログは差し替え）', async () => {
    await label('article-name').click();
    await expect($('#new_md')).toBeSelected();
    expect(await $('#tsumiqiita-editor').getValue()).toBe('');
    expect(readFileSync(current().newArticlePath, 'utf-8')).toBe('');
    await expect($$('#files label')).toHaveText(['a.md', 'b.md', 'new.md']);
    expect(settings().CURRENT_FILE).toBe(current().newArticlePath);
  });

  // WindowsではmsedgedriverがセッションごとにWebView2の保存先を作り直すため、アプリの再起動ではなく再読み込みで確かめる
  it('表示モード・テーマを切り替え、再読み込み後も保持する（移行済みの設定は上書きしない）', async () => {
    await label('theme-toggle').click();
    await expect($('html')).toHaveAttribute('data-theme', 'dark');
    await closeMenu();
    await label('view-mode-preview').click();
    await expect($('#tsumiqiita-editor')).not.toBeDisplayed();

    // 画面を読み込み直す（起動時の処理が保存済みの設定で動く）
    await browser.refresh();
    await expect($('html')).toHaveAttribute('data-theme', 'dark');
    await expect($('#view-mode-preview')).toBeSelected();
    await expect($('#tsumiqiita-editor')).not.toBeDisplayed();
    const html = await $('html').getCSSProperty('background-color');
    expect(html.parsed.hex).toBe('#22272e');
    // 移行済みなので、起動時に旧版の設定で上書きしない
    expect(settings().TOKEN).toBe('dummy-token');

    await label('view-mode-editor').click();
    await expect($('#preview')).not.toBeDisplayed();
    await label('view-mode-split').click();
    await expect($('#preview')).toBeDisplayed();
    await expect($('#tsumiqiita-editor')).toBeDisplayed();
    await openMenu();
    await label('theme-toggle').click();
    await expect($('html')).toHaveAttribute('data-theme', 'light');
    await closeMenu();
  });

  it('リンクはWebView内で開かず既定ブラウザで開く（記録で確認）', async () => {
    const before = await browser.getUrl();
    await label('a_md').click();
    await $('#preview a').click();
    await $('#tags-label a').click();
    await browser.waitUntil(() => readFileSync(current().openedLog, 'utf-8').trim().split('\n').length >= 2, {
      timeoutMsg: '外部ブラウザで開く処理が呼ばれませんでした',
    });
    const opened = readFileSync(current().openedLog, 'utf-8').trim().split('\n');
    expect(opened[0]).toBe('https://example.com/preview');
    expect(opened[1]).toContain('https://github.com/hidao80/TsumiQiita');
    expect(await browser.getUrl()).toBe(before);
    expect(await browser.getWindowHandles()).toHaveLength(1);
  });
});
