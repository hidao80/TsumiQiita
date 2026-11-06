import { type SettingKey, SettingSchema } from '../../shared/schema';
import { api } from './api';

// 設定は ~/.config/TsumiQiita/config.json に、APIトークンはOSの資格情報ストアに保存する（読み書きはRust側）。
// 以前の保存先（IndexedDB・旧Electron版）からの移行は legacy.ts を参照
export const config = {
  async get(key: SettingKey): Promise<string | undefined> {
    const value = key === 'TOKEN' ? await api.readToken() : (await api.readConfig())?.[key];
    const parsed = SettingSchema.safeParse({ key, value });
    return parsed.success ? parsed.data.value : undefined;
  },
  /** 値が空なら削除する */
  async set(key: SettingKey, value: string): Promise<void> {
    const parsed = SettingSchema.safeParse({ key, value });
    const valid = parsed.success ? parsed.data.value : null;
    await (key === 'TOKEN' ? api.writeToken(valid) : api.writeConfig(key, valid));
  },
};

/** パス文字列からファイル名を取り出す */
export function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}
