import Dexie, { type EntityTable } from 'dexie';
import type { Setting } from '../../shared/schema';

// 以前の設定の保存先。現在は設定ファイル・資格情報ストアへの移行元としてのみ使う（lib/legacy.ts）
export class TsumiQiitaDB extends Dexie {
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('tsumiqiita');
    this.version(1).stores({ settings: 'key' });
  }
}

export const db = new TsumiQiitaDB();
