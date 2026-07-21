ALTER TABLE "tickets" ALTER COLUMN "issue_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."issue_type";--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('BUG', 'FEATURE', 'IMPROVEMENT', 'CHANGE_REQUEST');--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "issue_type" SET DATA TYPE "public"."issue_type" USING "issue_type"::"public"."issue_type";