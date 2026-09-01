CREATE TABLE "resume_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobInfoId" uuid NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"rating" integer NOT NULL,
	"feedback" varchar NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "answer" varchar(10000);--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "feedback" varchar;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "answeredAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_jobInfoId_job_info_id_fk" FOREIGN KEY ("jobInfoId") REFERENCES "public"."job_info"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_analysis_job_info_id_idx" ON "resume_analysis" USING btree ("jobInfoId");--> statement-breakpoint
CREATE INDEX "resume_analysis_job_info_id_created_at_idx" ON "resume_analysis" USING btree ("jobInfoId","createdAt");--> statement-breakpoint
CREATE INDEX "question_job_id_answered_at_idx" ON "question" USING btree ("jobId","answeredAt");