CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "company" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."company";--> statement-breakpoint
INSERT INTO "companies" ("code", "name")
SELECT DISTINCT "company", "company" FROM "tickets"
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "companies" ("code", "name") VALUES
	('POTB', 'POTB'),
	('GLADEX', 'GLADEX')
ON CONFLICT ("code") DO NOTHING;