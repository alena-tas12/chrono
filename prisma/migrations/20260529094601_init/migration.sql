-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "cognitive_style" VARCHAR(50) NOT NULL DEFAULT 'adaptive',
    "reassurance_needs" VARCHAR(50) NOT NULL DEFAULT 'moderate',
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "owner_id" VARCHAR(100) NOT NULL,
    "layer_type" VARCHAR(50) NOT NULL DEFAULT 'personal',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "device_id" VARCHAR(100),
    "deleted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_members" (
    "calendar_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'viewer',
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "device_id" VARCHAR(100),
    "deleted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calendar_members_pkey" PRIMARY KEY ("calendar_id","user_id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" VARCHAR(100) NOT NULL,
    "calendar_id" VARCHAR(100) NOT NULL,
    "text" TEXT NOT NULL,
    "date" VARCHAR(30),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "start_time" VARCHAR(50),
    "duration_min" INTEGER NOT NULL DEFAULT 60,
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "device_id" VARCHAR(100),
    "deleted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_history" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "user_input" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "model_used" VARCHAR(50) NOT NULL DEFAULT 'mock-engine',
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cognitive_memories" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "memory_type" VARCHAR(50) NOT NULL DEFAULT 'short_term',
    "content" TEXT NOT NULL,
    "importance_score" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cognitive_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cognitive_memories" ADD CONSTRAINT "cognitive_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
