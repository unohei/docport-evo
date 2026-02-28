-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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