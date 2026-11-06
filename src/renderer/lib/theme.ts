import { type Theme, ThemeSchema } from '../../shared/schema';
import { config } from './config';

/** テーマを画面に反映する（CSSは :root[data-theme] で切り替える） */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** 現在画面に反映されているテーマ */
export function currentTheme(): Theme {
  return ThemeSchema.catch('light').parse(document.documentElement.dataset.theme);
}

/** 保存済みのテーマを読み込む。未設定ならOSの設定に合わせる */
export async function loadTheme(): Promise<Theme> {
  const saved = ThemeSchema.safeParse(await config.get('THEME'));
  if (saved.success) return saved.data;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** テーマを反映して保存する */
export async function saveTheme(theme: Theme): Promise<void> {
  applyTheme(theme);
  await config.set('THEME', theme);
}
