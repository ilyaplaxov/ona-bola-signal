CREATE TABLE "dimed_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dimed_outbox" ADD CONSTRAINT "dimed_outbox_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dimed_outbox_due_idx" ON "dimed_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "dimed_outbox_patient_idx" ON "dimed_outbox" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dimed_outbox_record_idx" ON "dimed_outbox" USING btree ("record_type","record_id");