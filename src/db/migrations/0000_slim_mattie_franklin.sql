CREATE TYPE "public"."company" AS ENUM('POTB', 'GLADEX');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('BUG', 'BUG_FIX', 'FEATURE', 'IMPROVEMENT', 'CHANGE_REQUEST');--> statement-breakpoint
CREATE TYPE "public"."test_case_priority" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."test_case_status" AS ENUM('PASSED', 'FAILED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'NOT_TESTED');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('PASSED', 'FAILED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD');--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"tc_number" text NOT NULL,
	"page" text NOT NULL,
	"description" text NOT NULL,
	"priority" "test_case_priority" NOT NULL,
	"expected_result" text NOT NULL,
	"actual_result" text,
	"comments" text,
	"status" "test_case_status" DEFAULT 'NOT_TESTED' NOT NULL,
	"tested_date" date,
	"tester" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company" "company" NOT NULL,
	"system" text NOT NULL,
	"module" text NOT NULL,
	"issue_type" "issue_type" NOT NULL,
	"ticket_status" "ticket_status" DEFAULT 'PENDING' NOT NULL,
	"manual_override" boolean DEFAULT false NOT NULL,
	"failed_counter" integer DEFAULT 0 NOT NULL,
	"tester" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;