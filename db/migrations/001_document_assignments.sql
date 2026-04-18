-- =============================================================================
-- Migration 001: document_assignments テーブル追加
-- Phase 1: 受信側担当情報を documents テーブルから分離する
--
-- 目的:
--   documents テーブルには「書類の共有状態」(status/from/to) のみを持たせ、
--   受信側の担当情報 (部署・担当者) を document_assignments テーブルで管理する。
--   これにより受信側での部署変更が送信側の表示に影響しなくなる。
--
-- 実行環境: Supabase SQL Editor（手動実行）
-- 実行順序: このファイルを上から順に実行する。途中でエラーが出たら停止する。
-- ロールバック: 末尾のロールバック手順を参照
-- =============================================================================

-- ============================================================
-- Step 1: document_assignments テーブル作成
-- ============================================================

CREATE TABLE public.document_assignments (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  document_id      uuid        NOT NULL,
  hospital_id      uuid        NOT NULL,
  assigned_department text     NOT NULL,
  owner_user_id    uuid        NOT NULL,
  assigned_by      uuid,                          -- アサイン操作者（NULL=移行データ）
  is_current       boolean     NOT NULL DEFAULT true,
  assigned_at      timestamp with time zone NOT NULL DEFAULT now(),
  created_at       timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT document_assignments_pkey
    PRIMARY KEY (id),
  CONSTRAINT document_assignments_document_id_fkey
    FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT document_assignments_hospital_id_fkey
    FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id),
  CONSTRAINT document_assignments_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id),
  CONSTRAINT document_assignments_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
);

COMMENT ON TABLE public.document_assignments IS
  '受信側の担当情報（部署・担当者）を管理するテーブル。'
  '1ドキュメントにつき is_current=true のレコードが現在のアサインを表す。'
  'アサイン変更時は既存の is_current=true を false に更新してから新規 INSERT する。';

COMMENT ON COLUMN public.document_assignments.is_current IS
  'true: 現在有効なアサイン（1ドキュメントにつき1件のみ true）。'
  'アサイン変更時は旧レコードを false に更新してから新規 INSERT する。';

COMMENT ON COLUMN public.document_assignments.assigned_by IS
  'アサイン操作を行ったユーザーID。移行データ（既存 documents から INSERT）の場合は NULL。';

-- ============================================================
-- Step 2: インデックス
-- ============================================================

-- 受信病院 + is_current での絞り込みを高速化（loadAll で使用）
CREATE INDEX idx_doc_assignments_hospital_current
  ON public.document_assignments (hospital_id)
  WHERE is_current = true;

-- document_id 単体での検索を高速化（assign API で既存レコード検索に使用）
CREATE INDEX idx_doc_assignments_document_id
  ON public.document_assignments (document_id);

-- 1ドキュメントにつき is_current=true は1件のみ許可（一意制約）
-- アサイン変更手順: 既存の is_current=true を false → 新規 INSERT の順で実行すること
CREATE UNIQUE INDEX idx_doc_assignments_current_unique
  ON public.document_assignments (document_id)
  WHERE is_current = true;

-- ============================================================
-- Step 3: RLS 有効化
-- ============================================================

ALTER TABLE public.document_assignments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- SELECT: 以下の両条件を満たす場合のみ閲覧可
--   (A) hospital_id = ログインユーザーの所属病院
--   (B) document_id が指す documents.to_hospital_id = ログインユーザーの所属病院
-- 理由: (A) だけでは hospital_id を偽造した行を読まれる恐れがある。
--       (B) で文書の受信先が自院であることをDBレイヤーで保証する。
-- ------------------------------------------------------------
CREATE POLICY "da_select_own_hospital" ON public.document_assignments
  FOR SELECT USING (
    hospital_id = (
      SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.to_hospital_id = (
          SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  );

-- ------------------------------------------------------------
-- INSERT: 同様の二重チェックを WITH CHECK で適用
-- ------------------------------------------------------------
CREATE POLICY "da_insert_own_hospital" ON public.document_assignments
  FOR INSERT WITH CHECK (
    hospital_id = (
      SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.to_hospital_id = (
          SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  );

-- ------------------------------------------------------------
-- UPDATE: is_current を false に変更する操作のみを許可
--         同様の二重チェックを USING で適用
-- ------------------------------------------------------------
CREATE POLICY "da_update_own_hospital" ON public.document_assignments
  FOR UPDATE USING (
    hospital_id = (
      SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.to_hospital_id = (
          SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  );

-- ============================================================
-- Step 4: 既存データ移行
-- documents.assigned_department / owner_user_id が両方 NOT NULL の行を移行する
-- ============================================================

INSERT INTO public.document_assignments (
  document_id,
  hospital_id,
  assigned_department,
  owner_user_id,
  assigned_by,       -- 移行データのため NULL
  is_current,
  assigned_at
)
SELECT
  d.id,
  d.to_hospital_id,
  d.assigned_department,
  d.owner_user_id,
  NULL,              -- 移行データのため NULL
  true,
  COALESCE(d.assigned_at, d.created_at)
FROM public.documents d
WHERE d.assigned_department IS NOT NULL
  AND d.owner_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 移行件数の確認（実行後に確認すること）
SELECT
  COUNT(*) FILTER (WHERE assigned_by IS NULL) AS migrated_rows,
  COUNT(*) FILTER (WHERE assigned_by IS NOT NULL) AS new_rows,
  COUNT(*) AS total_rows
FROM public.document_assignments;

-- ============================================================
-- Step 5: 移行確認クエリ（実行して目視確認すること）
-- ============================================================

-- documents の assigned_* が設定されているのに document_assignments にない行がないか確認
-- 0件なら移行完了
SELECT COUNT(*)
FROM public.documents d
WHERE d.assigned_department IS NOT NULL
  AND d.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.document_assignments da
    WHERE da.document_id = d.id AND da.is_current = true
  );

-- =============================================================================
-- ロールバック手順（問題発生時）
-- =============================================================================
-- DROP TABLE IF EXISTS public.document_assignments;
-- （documents テーブルの assigned_* 列は変更していないため、ロールバック不要）
-- =============================================================================
