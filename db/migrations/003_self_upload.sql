-- migration: 003_self_upload.sql
-- 自院に置く機能のための変更
-- 1. document_assignments.owner_user_id を nullable に
--    → 部署のみ設定・担当者は後からアサインできるようにする
-- 2. RLSポリシーを再作成（owner_user_id=NULLのINSERTを許可）

ALTER TABLE public.document_assignments
  ALTER COLUMN owner_user_id DROP NOT NULL;

-- RLS: INSERT ポリシーを再定義（owner_user_id NULL を許可するため）
-- 既存ポリシーは owner_user_id を制約に含めていないため変更不要の場合もあるが
-- 念のため再作成して明示する
DROP POLICY IF EXISTS da_insert_own_hospital ON public.document_assignments;
CREATE POLICY da_insert_own_hospital ON public.document_assignments
  FOR INSERT
  WITH CHECK (
    hospital_id = (
      SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
    )
  );
