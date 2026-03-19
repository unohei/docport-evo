-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- fax_inbounds: CloudFAX Inbound 受信本体ログ（v2.6 追加）
-- 責務: FAX 受信（inbound）1件ごとのライフサイクル管理
--   RECEIVED → DOC_CREATED（正常完了）
--   RECEIVED → FAILED（エラー時: error + error_stage に詳細を記録）
-- ※ outbound ステータス通知は fax_webhook_events テーブルを使う（v2.7 以降）
-- Supabase で手動適用が必要。
CREATE TABLE public.fax_inbounds (
  id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  provider             text NOT NULL,                           -- 'cloudfax'
  provider_message_id  text NOT NULL,                           -- CloudFAX 側の一意ID
  direction            text NOT NULL DEFAULT 'inbound',         -- 'inbound'（outbound は fax_webhook_events へ）
  -- status: RECEIVED → DOC_CREATED | FAILED
  status               text NOT NULL DEFAULT 'RECEIVED',
  hospital_id          uuid,                                    -- 受信先病院ID（NULL=不明）
  raw                  jsonb,                                   -- Webhook 生 payload（監査ログ）
  document_id          uuid,                                    -- 生成した documents.id
  file_key             text,                                    -- R2 保存キー
  error                text,                                    -- エラー内容（FAILED 時）
  error_stage          text,                                    -- C: 失敗ステージ（PDF_FETCH / PDF_VALIDATE / R2_UPLOAD / DOCUMENT_INSERT / STATUS_UPDATE）
  created_at           timestamp with time zone DEFAULT now(),
  updated_at           timestamp with time zone DEFAULT now(),
  CONSTRAINT fax_inbounds_pkey PRIMARY KEY (id),
  -- 冪等性保証: 同一 provider + provider_message_id は1件のみ（inbound は1FAX1処理）
  CONSTRAINT fax_inbounds_provider_message_id_unique UNIQUE (provider, provider_message_id),
  CONSTRAINT fax_inbounds_hospital_id_fkey  FOREIGN KEY (hospital_id)  REFERENCES public.hospitals(id),
  CONSTRAINT fax_inbounds_document_id_fkey  FOREIGN KEY (document_id)  REFERENCES public.documents(id)
);

-- fax_webhook_events: CloudFAX Outbound ステータス通知イベントログ（v2.7 追加）
-- 責務: FAX 送信ステータス通知（outbound）のイベント履歴管理
--   同一 FAX に複数通知（QUEUED / SENDING / SENT / FAILED 等）が来ても全て記録する
-- Supabase で手動適用が必要。
CREATE TABLE public.fax_webhook_events (
  id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  provider             text NOT NULL,                           -- 'cloudfax'
  provider_message_id  text NOT NULL,                           -- CloudFAX 側の FAX ID
  direction            text NOT NULL DEFAULT 'outbound',        -- 'outbound'（inbound は fax_inbounds へ）
  -- TODO(cloudfax-spec): event_status の実際の値セットは CloudFAX 仕様書で確認すること
  event_status         text NOT NULL DEFAULT 'UNKNOWN',         -- CloudFAX が送る status 値（SENT / FAILED 等）
  hospital_id          uuid,                                    -- 送信元病院ID（任意）
  raw                  jsonb,                                   -- Webhook 生 payload（監査ログ）
  received_at          timestamp with time zone DEFAULT now(),
  CONSTRAINT fax_webhook_events_pkey PRIMARY KEY (id),
  -- 冪等性: 同一 FAX + 同一 status の重複通知を防ぐ
  CONSTRAINT fax_webhook_events_unique UNIQUE (provider, provider_message_id, event_status),
  CONSTRAINT fax_webhook_events_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id)
);

-- RLS: 両テーブルとも service_role からのみ操作（Webhook処理専用）
-- 一般ユーザーへの公開は不要なため、デフォルト deny のまま

CREATE TABLE public.document_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  actor_user_id uuid,
  action text,
  created_at timestamp with time zone DEFAULT now(),
  hospital_id uuid NOT NULL,
  CONSTRAINT document_events_pkey PRIMARY KEY (id),
  CONSTRAINT document_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT document_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id),
  CONSTRAINT document_events_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id)
);
CREATE TABLE public.document_logs (
  id bigint NOT NULL DEFAULT nextval('document_logs_id_seq'::regclass),
  document_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT document_logs_pkey PRIMARY KEY (id),
  CONSTRAINT document_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT document_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_hospital_id uuid NOT NULL,
  to_hospital_id uuid NOT NULL,
  comment text,
  file_key text NOT NULL,
  status text DEFAULT 'UPLOADED'::text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  original_filename text,
  content_type text,
  file_ext text,
  file_size bigint,
  preview_file_key text,
  structured_json jsonb,
  structured_updated_by text,
  structured_updated_at timestamp with time zone,
  structured_version text,
  structured_source text,
  assigned_department text,
  owner_user_id uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_from_hospital_id_fkey FOREIGN KEY (from_hospital_id) REFERENCES public.hospitals(id),
  CONSTRAINT documents_to_hospital_id_fkey FOREIGN KEY (to_hospital_id) REFERENCES public.hospitals(id),
  CONSTRAINT documents_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.hospitals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  created_at timestamp with time zone DEFAULT now(),
  icon_url text,
  CONSTRAINT hospitals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  role text DEFAULT 'member'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id)
);