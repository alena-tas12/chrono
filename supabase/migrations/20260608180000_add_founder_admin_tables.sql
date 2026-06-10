CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id text PRIMARY KEY,
    action text NOT NULL,
    actor text NOT NULL,
    target_user_id text,
    result text NOT NULL,
    details text,
    previous_hash text,
    audit_hash text,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.admin_user_flags (
    user_id varchar(100) PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    disabled boolean DEFAULT false,
    disabled_reason text,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS previous_hash text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS audit_hash text;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
REVOKE ALL ON public.admin_user_flags FROM anon, authenticated;
