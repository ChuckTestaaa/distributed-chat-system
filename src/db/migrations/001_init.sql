-- Initial schema (ported from Prisma migration)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE "RoomType" AS ENUM ('PRIVATE', 'GROUP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "username"      TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url"    TEXT,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key"    ON "users" ("email");

CREATE TABLE IF NOT EXISTS "rooms" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name"          TEXT NOT NULL,
    "type"          "RoomType" NOT NULL DEFAULT 'PRIVATE',
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by_id" TEXT NOT NULL,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rooms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "room_members" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "user_id"   TEXT NOT NULL,
    "room_id"   TEXT NOT NULL,
    CONSTRAINT "room_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "room_members_user_id_room_id_key" ON "room_members" ("user_id", "room_id");

CREATE TABLE IF NOT EXISTS "messages" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "content"    TEXT NOT NULL,
    "type"       "MessageType" NOT NULL DEFAULT 'TEXT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "sender_id"  TEXT NOT NULL,
    "room_id"    TEXT NOT NULL,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "messages_room_id_fkey"   FOREIGN KEY ("room_id")   REFERENCES "rooms" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "messages_room_id_created_at_idx" ON "messages" ("room_id", "created_at" DESC);

