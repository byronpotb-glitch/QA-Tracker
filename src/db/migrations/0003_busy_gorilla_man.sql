CREATE TABLE "test_case_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_case_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"status" "test_case_status" NOT NULL,
	"actual_result" text,
	"comments" text,
	"tested_date" date,
	"tester" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_case_history" ADD CONSTRAINT "test_case_history_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_case_history" ADD CONSTRAINT "test_case_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;