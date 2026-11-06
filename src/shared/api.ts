// 型はzodスキーマから生成する
import type { QiitaItemBody, SettingKey } from './schema';

export type { QiitaItemBody, QiitaTag } from './schema';

/** Qiita APIのエラー内容（レスポンスの message / type） */
export interface ApiError {
  status: number;
  message?: string;
  type?: string;
}

/** Qiita投稿結果。networkErrorは通信自体が失敗した場合。id/urlはレスポンスが想定外の形式なら省略 */
export type PostResult =
  | { ok: true; status: number; id?: string; url?: string }
  | ({ ok: false } & ApiError)
  | { networkError: true };

/** トークン確認結果 */
export type VerifyTokenResult = { ok: true; userId: string } | ({ ok: false } & ApiError) | { networkError: true };

/** 旧Electron版の設定の読み出し結果 */
export type LegacySettingsResult = { status: 'absent' } | { status: 'found'; values: Record<string, string> };

/** フォルダ内のMarkdownファイル */
export interface MarkdownFile {
  name: string;
  path: string;
}

/** Rust側（src-tauri）のコマンドを呼ぶAPI */
export interface TsumiQiitaApi {
  selectTargetDir(): Promise<string | undefined>;
  createArticle(): Promise<string | undefined>;
  listMarkdownFiles(dir: string): Promise<MarkdownFile[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  /** idがあれば既存記事を更新（PATCH）、無ければ新規投稿（POST）する */
  postItem(token: string, body: QiitaItemBody, id?: string): Promise<PostResult>;
  verifyToken(token: string): Promise<VerifyTokenResult>;
  /** http/https のURLを既定ブラウザで開く */
  openExternal(url: string): Promise<void>;
  /** 設定ファイル（~/.config/TsumiQiita/config.json）を読む。ファイルが無ければ null */
  readConfig(): Promise<Partial<Record<SettingKey, string>> | null>;
  /** 設定を1つ書き換える（TOKENは不可）。null なら削除する */
  writeConfig(key: Exclude<SettingKey, 'TOKEN'>, value: string | null): Promise<void>;
  /** OSの資格情報ストアからAPIトークンを読む。未保存なら null */
  readToken(): Promise<string | null>;
  /** OSの資格情報ストアにAPIトークンを保存する。null なら削除する */
  writeToken(token: string | null): Promise<void>;
  readLegacySettings(): Promise<LegacySettingsResult>;
}
