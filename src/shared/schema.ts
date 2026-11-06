import { z } from 'zod';

/** Qiita投稿APIに送るタグ */
export const QiitaTagSchema = z.object({
  name: z.string(),
  versions: z.array(z.string()).optional(),
});

/** Qiita投稿APIに送る本文（POST /api/v2/items・PATCH /api/v2/items/:item_id） */
export const QiitaItemBodySchema = z
  .object({
    body: z.string(),
    title: z.string().optional(),
    tags: z.array(QiitaTagSchema).optional(),
    coediting: z.boolean().optional(),
    private: z.boolean().optional(),
    tweet: z.boolean().optional(),
    group_url_name: z.string().optional(),
    organization_url_name: z.string().optional(),
    slide: z.boolean().optional(),
    posting_campaign_uuid: z
      .string()
      .regex(/^[0-9a-f]{20}$/, '投稿キャンペーンのUUIDの形式が正しくありません')
      .optional(),
    agreed_posting_campaign_term: z.boolean().optional(),
  })
  .refine((b) => !b.posting_campaign_uuid || b.agreed_posting_campaign_term === true, {
    message: 'posting_campaign_uuid を指定する場合は agreed_posting_campaign_term: true が必要です',
  });

/** Qiitaの記事ID（URLのパスに埋め込むため英数字のみ許可する。Rust側でも同じ検証をする） */
export const QiitaItemIdSchema = z.string().regex(/^[0-9a-zA-Z]+$/, '記事のidの形式が正しくありません');

/** 設定のキー（旧版のlocalStorageキー tsumiqiita_<KEY> と対応） */
export const SettingKeySchema = z.enum([
  'TOKEN',
  'TARGET_DIR',
  'CURRENT_FILE',
  'VIEW_MODE',
  'THEME',
  'LEGACY_MIGRATED',
]);

/** 画面のテーマ */
export const ThemeSchema = z.enum(['light', 'dark']);

/** 編集領域の表示モード（エディターのみ・半々・プレビューのみ） */
export const ViewModeSchema = z.enum(['editor', 'split', 'preview']);

/** IndexedDBに保存する設定 */
export const SettingSchema = z.object({
  key: SettingKeySchema,
  value: z.string().min(1),
});

export type QiitaTag = z.infer<typeof QiitaTagSchema>;
export type QiitaItemBody = z.infer<typeof QiitaItemBodySchema>;
export type SettingKey = z.infer<typeof SettingKeySchema>;
export type Setting = z.infer<typeof SettingSchema>;
export type ViewMode = z.infer<typeof ViewModeSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
