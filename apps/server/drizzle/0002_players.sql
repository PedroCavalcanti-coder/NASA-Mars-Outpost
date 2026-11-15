CREATE TABLE "outpost"."players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "players_key_idx" ON "outpost"."players" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "players_seen_idx" ON "outpost"."players" USING btree ("last_seen_at");--> statement-breakpoint
INSERT INTO "outpost"."players" ("key_hash", "nickname", "last_seen_at")
SELECT substring("owner" from 3), max("nickname"), max("last_seen_at") FROM "outpost"."world_links" WHERE "owner" LIKE 'k:%' GROUP BY substring("owner" from 3);--> statement-breakpoint
ALTER TABLE "outpost"."world_links" ADD COLUMN "player_id" uuid;--> statement-breakpoint
ALTER TABLE "outpost"."world_links" ADD COLUMN "linked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "outpost"."world_links" l SET "player_id" = p."id" FROM "outpost"."players" p WHERE l."owner" = 'k:' || p."key_hash";--> statement-breakpoint
DELETE FROM "outpost"."world_links" WHERE "player_id" IS NULL;--> statement-breakpoint
DELETE FROM "outpost"."worlds" w WHERE NOT EXISTS (SELECT 1 FROM "outpost"."world_links" l WHERE l."world_code" = w."code");--> statement-breakpoint
ALTER TABLE "outpost"."world_links" DROP CONSTRAINT "world_links_owner_world_code_pk";--> statement-breakpoint
ALTER TABLE "outpost"."world_links" DROP COLUMN "owner";--> statement-breakpoint
ALTER TABLE "outpost"."world_links" ALTER COLUMN "player_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "outpost"."world_links" ADD CONSTRAINT "world_links_player_id_world_code_pk" PRIMARY KEY("player_id","world_code");--> statement-breakpoint
ALTER TABLE "outpost"."world_links" ADD CONSTRAINT "world_links_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "outpost"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_links_world_idx" ON "outpost"."world_links" USING btree ("world_code");--> statement-breakpoint
DROP TABLE "outpost"."direct_messages" CASCADE;--> statement-breakpoint
DROP TABLE "outpost"."friendships" CASCADE;--> statement-breakpoint
DROP TABLE "outpost"."password_resets" CASCADE;--> statement-breakpoint
DROP TABLE "outpost"."sessions" CASCADE;--> statement-breakpoint
DROP TABLE "outpost"."users" CASCADE;
