CREATE TABLE "leaf_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"leaf_id" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"first_try_correct" boolean DEFAULT false NOT NULL,
	"correct_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_local_date" date,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leaf_progress" ADD CONSTRAINT "leaf_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leaf_progress_user_leaf_unique" ON "leaf_progress" USING btree ("user_id","leaf_id");--> statement-breakpoint
CREATE INDEX "leaf_progress_user_id_idx" ON "leaf_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leaf_progress_user_completed_date_idx" ON "leaf_progress" USING btree ("user_id","completed_local_date");