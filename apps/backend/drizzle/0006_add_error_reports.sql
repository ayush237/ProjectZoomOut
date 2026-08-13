CREATE TYPE "public"."error_report_reason" AS ENUM('factual_error', 'wrong_answer', 'offensive', 'other');--> statement-breakpoint
CREATE TYPE "public"."error_report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "error_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"leaf_id" text NOT NULL,
	"track_id" text NOT NULL,
	"reason" "error_report_reason" NOT NULL,
	"detail" text,
	"status" "error_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "error_reports" ADD CONSTRAINT "error_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_reports_status_created_idx" ON "error_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "error_reports_leaf_id_idx" ON "error_reports" USING btree ("leaf_id");