CREATE TABLE "patient_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"binding_id" uuid,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signal_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"telegram_chat_id" text,
	"web_token_hash" text,
	"language" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "signal_bindings_web_token_hash_unique" UNIQUE("web_token_hash")
);
--> statement-breakpoint
CREATE TABLE "signal_link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"issued_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "signal_link_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "patient_signals" ADD CONSTRAINT "patient_signals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_signals" ADD CONSTRAINT "patient_signals_binding_id_signal_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."signal_bindings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_signals" ADD CONSTRAINT "patient_signals_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_bindings" ADD CONSTRAINT "signal_bindings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_link_codes" ADD CONSTRAINT "signal_link_codes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_link_codes" ADD CONSTRAINT "signal_link_codes_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_signals_status_idx" ON "patient_signals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "patient_signals_patient_idx" ON "patient_signals" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "signal_bindings_patient_idx" ON "signal_bindings" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "signal_bindings_chat_idx" ON "signal_bindings" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "signal_link_codes_patient_idx" ON "signal_link_codes" USING btree ("patient_id");