-- Add reactions support to messages
ALTER TABLE "messages" ADD COLUMN "reactions" JSONB DEFAULT '{}';
