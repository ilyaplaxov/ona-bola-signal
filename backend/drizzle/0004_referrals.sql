CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_specialty" text NOT NULL,
	"to_user_id" uuid,
	"reason" text NOT NULL,
	"urgency" text NOT NULL,
	"status" text NOT NULL,
	"conclusion" text,
	"conclusion_attachment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"concluded_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_patient_idx" ON "referrals" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "referrals_inbox_idx" ON "referrals" USING btree ("to_specialty","status");--> statement-breakpoint
CREATE INDEX "referrals_to_user_idx" ON "referrals" USING btree ("to_user_id");