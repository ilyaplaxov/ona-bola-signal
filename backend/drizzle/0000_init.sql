CREATE TYPE "public"."alert_severity" AS ENUM('YELLOW', 'RED');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('PENDING', 'ACKNOWLEDGED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."measurement_source" AS ENUM('MANUAL', 'AI_ASSISTED', 'DEMO_SEED');--> statement-breakpoint
CREATE TYPE "public"."measurement_type" AS ENUM('BLOOD_PRESSURE', 'HEMOGLOBIN', 'PROTEINURIA', 'GLUCOSE');--> statement-breakpoint
CREATE TYPE "public"."risk_zone" AS ENUM('GREEN', 'YELLOW', 'RED');--> statement-breakpoint
CREATE TYPE "public"."rule_set_kind" AS ENUM('ILLUSTRATIVE', 'VALIDATED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('DOCTOR', 'NURSE', 'SPECIALIST', 'MANAGER');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"risk_assessment_id" uuid NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"triggered_rule_ids" jsonb NOT NULL,
	"recipient_role" "user_role" NOT NULL,
	"status" "alert_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"patient_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"type" "measurement_type" NOT NULL,
	"value" jsonb NOT NULL,
	"unit" text NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid NOT NULL,
	"source" "measurement_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_reference" text NOT NULL,
	"display_name" text NOT NULL,
	"date_of_birth" date,
	"district" text NOT NULL,
	"facility" text NOT NULL,
	"estimated_due_date" date,
	"risk_factors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_user_id" uuid,
	"current_risk_zone" "risk_zone",
	"current_assessment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_external_reference_unique" UNIQUE("external_reference")
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"trigger_submission_id" uuid,
	"zone" "risk_zone" NOT NULL,
	"triggered_rule_ids" jsonb NOT NULL,
	"reasons" jsonb NOT NULL,
	"trend_findings" jsonb NOT NULL,
	"data_warnings" jsonb NOT NULL,
	"rule_set_version" text NOT NULL,
	"rule_set_kind" "rule_set_kind" NOT NULL,
	"input_hash" text NOT NULL,
	"assessed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_assessments_trigger_submission_id_unique" UNIQUE("trigger_submission_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"district" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_risk_assessment_id_risk_assessments_id_fk" FOREIGN KEY ("risk_assessment_id") REFERENCES "public"."risk_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_current_assessment_id_risk_assessments_id_fk" FOREIGN KEY ("current_assessment_id") REFERENCES "public"."risk_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_status_created_idx" ON "alerts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "alerts_patient_idx" ON "alerts" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "audit_logs_patient_time_idx" ON "audit_logs" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "measurements_submission_type_uq" ON "measurements" USING btree ("submission_id","type");--> statement-breakpoint
CREATE INDEX "measurements_patient_time_idx" ON "measurements" USING btree ("patient_id","measured_at");--> statement-breakpoint
CREATE INDEX "patients_district_idx" ON "patients" USING btree ("district");--> statement-breakpoint
CREATE INDEX "patients_current_zone_idx" ON "patients" USING btree ("current_risk_zone");--> statement-breakpoint
CREATE INDEX "risk_assessments_patient_time_idx" ON "risk_assessments" USING btree ("patient_id","assessed_at");