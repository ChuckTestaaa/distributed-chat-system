CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "friendships" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "requester_id"  TEXT NOT NULL,
    "addressee_id"  TEXT NOT NULL,
    "status"        "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "friendships_requester_fkey" FOREIGN KEY ("requester_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "friendships_addressee_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "friendships_unique" UNIQUE ("requester_id", "addressee_id")
);

CREATE INDEX "friendships_addressee_idx" ON "friendships" ("addressee_id", "status");
