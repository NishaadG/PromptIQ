CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text,
	"status" text NOT NULL,
	"policy" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"error" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_subject_idx" ON "agent_runs" USING btree ("agent","subject_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status","created_at");