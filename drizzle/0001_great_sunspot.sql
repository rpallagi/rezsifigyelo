ALTER TABLE "rezsi_meter_info" ADD COLUMN "meterType" varchar(20) DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE "rezsi_meter_info" ADD COLUMN "formulaType" varchar(50);--> statement-breakpoint
ALTER TABLE "rezsi_meter_info" ADD COLUMN "primaryMeterId" integer;--> statement-breakpoint
ALTER TABLE "rezsi_meter_info" ADD COLUMN "subtractMeterIds" jsonb;