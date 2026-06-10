-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target_user_id" TEXT,
    "result" TEXT NOT NULL,
    "details" TEXT,
    "previous_hash" TEXT,
    "audit_hash" TEXT,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_user_flags" (
    "user_id" VARCHAR(100) NOT NULL,
    "disabled" BOOLEAN DEFAULT false,
    "disabled_reason" TEXT,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_flags_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "admin_audit_log" ADD COLUMN IF NOT EXISTS "previous_hash" TEXT;
ALTER TABLE "admin_audit_log" ADD COLUMN IF NOT EXISTS "audit_hash" TEXT;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'admin_user_flags_user_id_fkey'
    ) THEN
        ALTER TABLE "admin_user_flags"
        ADD CONSTRAINT "admin_user_flags_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
