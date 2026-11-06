import { invoke } from '@tauri-apps/api/core';
import type { TsumiQiitaApi } from '../../shared/api';

// Rustのコマンド（src-tauri/src/lib.rs）を呼ぶ。引数名はRust側のsnake_caseをcamelCaseにしたもの
export const api: TsumiQiitaApi = {
  selectTargetDir: async () => (await invoke<string | null>('select_target_dir')) ?? undefined,
  createArticle: async () => (await invoke<string | null>('create_article')) ?? undefined,
  listMarkdownFiles: (dir) => invoke('list_markdown_files', { dir }),
  readFile: (path) => invoke('read_file', { path }),
  writeFile: (path, content) => invoke('write_file', { path, content }),
  postItem: (token, body, id) => invoke('post_item', { token, body, itemId: id ?? null }),
  verifyToken: (token) => invoke('verify_token', { token }),
  openExternal: (url) => invoke('open_external', { url }),
  readConfig: () => invoke('read_config'),
  writeConfig: (key, value) => invoke('write_config', { key, value }),
  readToken: () => invoke('read_token'),
  writeToken: (token) => invoke('write_token', { token }),
  readLegacySettings: () => invoke('read_legacy_settings'),
};
