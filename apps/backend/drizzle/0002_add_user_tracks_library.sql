CREATE TYPE "public"."user_track_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "user_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"track_id" text NOT NULL,
	"status" "user_track_status" DEFAULT 'active' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_tracks" ADD CONSTRAINT "user_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_tracks_user_track_unique" ON "user_tracks" USING btree ("user_id","track_id");--> statement-breakpoint
CREATE INDEX "user_tracks_user_id_idx" ON "user_tracks" USING btree ("user_id");