ALTER TABLE "users" ADD COLUMN "subscriptionStatus" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscriptionUpdatedAt" timestamp with time zone;