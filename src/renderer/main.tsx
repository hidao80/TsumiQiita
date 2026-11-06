import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// アプリのフォント（Noto Sans JP 400/700）。オフラインでも使えるよう同梱する
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
// 表示モード切替ボタンのアイコンフォント
import 'material-symbols/outlined.css';
// 旧index.htmlと同じ読み込み順
import './css/tsumiqiita.css';
import 'highlight.js/styles/monokai.css';
// プレビュー用のQiita記事風スタイル（monokaiの背景色より優先させるため後に読み込む）
import './css/qiita-preview.css';
import { App } from './App';
import { api } from './lib/api';
import { migrateIndexedDbSettings, migrateLegacySettings } from './lib/legacy';
import { applyTheme, loadTheme } from './lib/theme';

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

// リンクはWebView内で開かず、既定ブラウザで開く（http/https以外はRust側で拒否する）
document.addEventListener('click', (e) => {
  const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement) || !/^https?:/.test(anchor.href)) return;
  e.preventDefault();
  void api.openExternal(anchor.href);
});

// 以前の保存先（IndexedDB・旧Electron版）の設定を移行し、起動時のちらつきを避けるためテーマを反映してから描画する
void migrateIndexedDbSettings()
  .catch(() => undefined)
  .then(() => migrateLegacySettings())
  .catch(() => undefined)
  .then(() => loadTheme())
  .catch(() => 'light' as const)
  .then((theme) => {
    applyTheme(theme);
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
