CREATE TABLE "scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stageNumber" integer NOT NULL,
	"name" varchar(20) NOT NULL,
	"result" double precision NOT NULL,
	"stars" real NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scores_stage_result_idx" ON "scores" USING btree ("stageNumber","result");