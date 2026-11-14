CREATE TABLE "outpost"."world_links" (
	"owner" text NOT NULL,
	"world_code" text NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_links_owner_world_code_pk" PRIMARY KEY("owner","world_code")
);
--> statement-breakpoint
CREATE TABLE "outpost"."worlds" (
	"code" text PRIMARY KEY NOT NULL,
	"base_id" text NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outpost"."world_links" ADD CONSTRAINT "world_links_world_code_worlds_code_fk" FOREIGN KEY ("world_code") REFERENCES "outpost"."worlds"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_links_seen_idx" ON "outpost"."world_links" USING btree ("last_seen_at");