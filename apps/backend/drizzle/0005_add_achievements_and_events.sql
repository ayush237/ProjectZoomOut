CREATE TYPE "public"."reader_event_type" AS ENUM('dinner_table_open', 'session_wrap');--> statement-breakpoint
CREATE TABLE "reader_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "reader_event_type" NOT NULL,
	"leaf_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reader_events" ADD CONSTRAINT "reader_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reader_events_user_type_idx" ON "reader_events" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_user_achievement_unique" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements" USING btree ("user_id");