// WebdriverIO + tauri-driver で、デバッグビルドの実アプリを操作するE2Eテスト（Windows / Linux）。
//
// 必要なもの:
// - tauri-driver: `cargo install tauri-driver --version "^2" --locked`
// - Windows: WebView2と同じ版の msedgedriver.exe（PATH上、または環境変数 TSUMIQIITA_MSEDGEDRIVER でパスを指定）
// - Linux: WebKitWebDriver（Debian系は webkit2gtk-driver パッケージ）
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { prepareSession, stopMockQiita } from './e2e/support';

const exe = process.platform === 'win32' ? '.exe' : '';
const application = path.resolve('src-tauri', 'target', 'debug', `tsumiqiita${exe}`);

let tauriDriver: ChildProcess | undefined;
let exiting = false;

function closeTauriDriver() {
  exiting = true;
  tauriDriver?.kill();
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: 4444,
  specs: ['./e2e/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      'wdio:maxInstances': 1,
      // @ts-expect-error tauri-driver 独自のcapability
      'tauri:options': { application },
    },
  ],
  logLevel: 'warn',
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 120_000 },

  // デバッグビルド（E2E用の環境変数が有効）を作る
  onPrepare: () => {
    const result = spawnSync('bun', ['run', 'tauri', 'build', '--debug', '--no-bundle'], {
      stdio: 'inherit',
      shell: true,
    });
    if (result.status !== 0) throw new Error('Tauriアプリのビルドに失敗しました');
  },

  // セッションごとに一時ディレクトリ・モックQiitaを用意し、その環境変数でtauri-driver（→アプリ）を起動する
  beforeSession: async () => {
    const session = await prepareSession();
    exiting = false;
    const args = process.env.TSUMIQIITA_MSEDGEDRIVER ? ['--native-driver', process.env.TSUMIQIITA_MSEDGEDRIVER] : [];
    tauriDriver = spawn(path.resolve(os.homedir(), '.cargo', 'bin', `tauri-driver${exe}`), args, {
      stdio: [null, process.stdout, process.stderr],
      env: { ...process.env, ...session.env },
    });
    tauriDriver.on('error', (error) => {
      console.error('tauri-driver error:', error);
      process.exit(1);
    });
    tauriDriver.on('exit', (code) => {
      if (!exiting) {
        console.error('tauri-driver exited with code:', code);
        process.exit(1);
      }
    });
    // tauri-driver の待ち受け開始を待つ
    await new Promise((resolve) => setTimeout(resolve, 1500));
  },

  afterSession: () => closeTauriDriver(),
};

process.on('exit', () => {
  closeTauriDriver();
  stopMockQiita();
});
