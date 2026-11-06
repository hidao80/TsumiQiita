// E2Eテストの準備。WebdriverIOのワーカー内で1セッションにつき1回呼ぶ。
// アプリ（デバッグビルド）は src-tauri/src/e2e.rs の環境変数で、実際のプロファイル・Qiita・ダイアログ・既定ブラウザから切り離す。
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const ARTICLE = [
  '---',
  'title: テスト記事',
  'tags: JavaScript:ES6 Electron',
  '---',
  '# 見出し',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '[ ] todo',
  '',
  '~~strike~~ [link](https://example.com/preview)',
  '',
  '```js:sample.js',
  'const x = 1;',
  '```',
  '',
  `<img src="x" onerror="document.title='XSS'">`,
  '',
].join('\n');

/** 旧Electron版のlocalStorage（実際にElectronで作ったLevelDB）。値はRustの単体テストと同じ */
export const LEGACY = { token: 'legacy-token-123', targetDir: 'C:\\Users\\記事' };

export type StubResponse = { status: number; body: unknown } | 'network-error';
export interface RecordedRequest {
  url: string;
  method: string;
  authorization?: string;
  body?: Record<string, unknown>;
}

export interface Session {
  tmp: string;
  dataDir: string;
  webviewDataDir: string;
  configDir: string;
  tokenFile: string;
  newArticlePath: string;
  openedLog: string;
  env: Record<string, string>;
}

let session: Session | undefined;
let server: Server | undefined;
const responses: StubResponse[] = [];
const requests: RecordedRequest[] = [];

export function current(): Session {
  if (!session) throw new Error('E2Eセッションが準備されていません');
  return session;
}

/** 次のQiita APIの応答を予約する */
export function queueResponses(...rs: StubResponse[]): void {
  responses.push(...rs);
}

/** これまでのQiita APIへの要求を取り出す（取り出した分は消える） */
export function takeRequests(): RecordedRequest[] {
  return requests.splice(0);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

/** Qiita APIの代わりに、予約した応答を返すモックサーバー */
async function startMockQiita(): Promise<string> {
  server = createServer(async (req, res) => {
    const text = await readBody(req);
    requests.push({
      url: req.url ?? '',
      method: req.method ?? '',
      authorization: req.headers.authorization,
      body: text ? JSON.parse(text) : undefined,
    });
    const next = responses.shift();
    if (!next || next === 'network-error') {
      // 接続を切って通信エラーにする
      req.socket.destroy();
      return;
    }
    res.writeHead(next.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(next.body));
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/api/v2`;
}

/** 旧Electron版のプロファイルをテスト用に作る（拡張子 .bin を外して配置する） */
function createLegacyProfile(dir: string): string {
  const profile = path.join(dir, 'tsumiqiita');
  const leveldb = path.join(profile, 'Local Storage', 'leveldb');
  mkdirSync(leveldb, { recursive: true });
  const fixture = path.resolve('src-tauri/tests/fixtures/electron-ldb');
  for (const name of readdirSync(fixture)) {
    copyFileSync(path.join(fixture, name), path.join(leveldb, name.replace(/\.bin$/, '')));
  }
  return profile;
}

/**
 * 一時ディレクトリとモックQiitaを用意する。
 * browser.reloadSession()（アプリの再起動）でも beforeSession が呼ばれるため、同じワーカーでは使い回す
 */
export async function prepareSession(): Promise<Session> {
  if (session) return session;
  const tmp = mkdtempSync(path.join(tmpdir(), 'tsumiqiita-e2e-'));
  const dataDir = path.join(tmp, 'data');
  mkdirSync(dataDir);
  writeFileSync(path.join(dataDir, 'a.md'), ARTICLE);
  writeFileSync(path.join(dataDir, 'b.md'), '# B file\n');
  writeFileSync(path.join(dataDir, 'ignore.txt'), 'x');

  const webviewDataDir = path.join(tmp, 'webview');
  const configDir = path.join(tmp, 'config');
  const tokenFile = path.join(tmp, 'token.txt');
  const newArticlePath = path.join(dataDir, 'new.md');
  const openedLog = path.join(tmp, 'opened.log');
  writeFileSync(openedLog, '');

  const env: Record<string, string> = {
    // 実プロファイル（トークン等）を汚さないよう、WebViewのデータを一時ディレクトリに分離する
    // （WindowsではmsedgedriverがセッションごとのWebView2保存先を指定し、こちらより優先される）
    TSUMIQIITA_E2E_DATA_DIR: webviewDataDir,
    // 設定ファイル（~/.config/TsumiQiita）とOSの資格情報ストアの代わりに一時ディレクトリを使う
    TSUMIQIITA_E2E_CONFIG_DIR: configDir,
    TSUMIQIITA_E2E_TOKEN_FILE: tokenFile,
    // 実際の旧Electron版プロファイルではなく、テスト用のものから移行させる
    TSUMIQIITA_E2E_LEGACY_DIR: createLegacyProfile(tmp),
    // Qiitaには接続しない
    TSUMIQIITA_E2E_QIITA_API: await startMockQiita(),
    TSUMIQIITA_E2E_SAVE_PATH: newArticlePath,
    TSUMIQIITA_E2E_OPEN_DIR: dataDir,
    TSUMIQIITA_E2E_OPENED_LOG: openedLog,
  };
  session = { tmp, dataDir, webviewDataDir, configDir, tokenFile, newArticlePath, openedLog, env };
  return session;
}

export function stopMockQiita(): void {
  server?.close();
}
