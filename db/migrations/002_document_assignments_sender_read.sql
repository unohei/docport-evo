-- =============================================================================
-- Migration 002: document_assignments に送信側 SELECT ポリシーを追加
-- 目的:
--   送信側（from_hospital_id=自院）が、受信側のアサイン情報（部署名）を
--   閲覧できるようにする。これにより送信側の一覧カードで受信側の対応部署を表示できる。
--
-- 変更内容:
--   SELECT ポリシーを1件追加（INSERT/UPDATE は不要: 送信側は閲覧のみ）
--
-- 既存ポリシーとの関係:
--   RLS の SELECT ポリシーは複数あると OR で評価される（Supabase / PostgREST の仕様）
--   da_select_own_hospital: hospital_id=自院 かつ documents.to_hospital_id=自院
--   da_select_for_sender  : documents.from_hospital_id=自院（★本migrationで追加）
--
-- ロールバック:
--   DROP POLICY IF EXISTS "da_select_for_sender" ON public.document_assignments;
-- =============================================================================

-- ------------------------------------------------------------
-- 送信側が自院送信ドキュメントの current assignment を閲覧できる（SELECT のみ）
-- 条件:
--   1. is_current = true （履歴行は見せない）
--   2. documents.from_hospital_id = ログインユーザーの所属病院
--      （自院が送信元である document のアサインのみ読める）
-- セキュリティ意図:
--   is_current = true をポリシー側で絞ることで、アプリ側フィルタを
--   バイパスされても過去の担当変更履歴が漏れない。
-- ------------------------------------------------------------
CREATE POLICY "da_select_for_sender" ON public.document_assignments
  FOR SELECT USING (
    is_current = true
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.from_hospital_id = (
          SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  );

-- 確認クエリ（実行後に目視確認）
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'document_assignments'
ORDER BY policyname;
