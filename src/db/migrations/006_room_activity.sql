-- Add last_message_at to rooms for efficient sorting
ALTER TABLE "rooms" ADD COLUMN "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Initialize existing rooms with the timestamp of their latest message (if any)
UPDATE "rooms" r
SET "last_message_at" = COALESCE(
    (SELECT MAX("created_at") FROM "messages" m WHERE m."room_id" = r."id"),
    r."created_at"
);

-- Index for sorting performance
CREATE INDEX "rooms_last_message_at_idx" ON "rooms" ("last_message_at" DESC);
