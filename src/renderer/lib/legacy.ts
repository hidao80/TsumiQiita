import { SettingSchema } from '../../shared/schema';
import { api } from './api';
import { config } from './config';
import { db } from './db';

/** 旧Electron版がlocalStorageに保存していた設定（表示モード・テーマは旧版に無い） */
const LEGACY_KEYS = ['TOKEN', 'TARGET_DIR', 'CURRENT_FILE'] as const;

/**
 * 以前IndexedDB（Dexie）に保存していた設定を、設定ファイル・OSの資格情報ストアへ移す。
 * 設定ファイルが既にあれば何もしない。移し終えたらIndexedDBの設定は消す。
 * 途中で失敗した場合に次回の起動で再試行できるよう、資格情報ストア（失敗しやすい）へのトークンを先に移す。
 */
export async function migrateIndexedDbSettings(): Promise<void> {
  if (await api.readConfig()) return;
  const rows = await db.settings.toArray();
  rows.sort((a, b) => Number(b.key === 'TOKEN') - Number(a.key === 'TOKEN'));
  for (const row of rows) {
    const parsed = SettingSchema.safeParse(row);
    if (parsed.success) await config.set(parsed.data.key, parsed.data.value);
  }
  if (rows.length > 0) await db.settings.clear();
}

/**
 * 初回起動時に旧Electron版の設定を移行する。
 * 移行済み・旧版が無い場合は印を付けて以後は何もしない。読み出しに失敗した場合は次回の起動で再試行する。
 * 既に設定済みの値は上書きしない。
 */
export async function migrateLegacySettings(): Promise<void> {
  if (await config.get('LEGACY_MIGRATED')) return;

  const result = await api.readLegacySettings();
  if (result.status === 'found') {
    for (const key of LEGACY_KEYS) {
      const value = result.values[key];
      if (!value || value === 'undefined') continue;
      if ((await config.get(key)) === undefined) await config.set(key, value);
    }
  }
  await config.set('LEGACY_MIGRATED', '1');
}
