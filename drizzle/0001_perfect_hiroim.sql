ALTER TYPE "public"."rezsi_smart_meter_source" ADD VALUE 'shelly_cloud';--> statement-breakpoint
ALTER TABLE "rezsi_chat_message" ADD COLUMN "attachmentUrl" text;--> statement-breakpoint
ALTER TABLE "rezsi_chat_message" ADD COLUMN "attachmentType" varchar(20);--> statement-breakpoint
ALTER TABLE "rezsi_chat_message" ADD COLUMN "attachmentName" varchar(255);--> statement-breakpoint
ALTER TABLE "rezsi_meter_info" ADD COLUMN "photoUrls" jsonb;--> statement-breakpoint
ALTER TABLE "rezsi_meter_info" ADD COLUMN "tariffGroupId" integer;--> statement-breakpoint
ALTER TABLE "rezsi_meter_reading" ADD COLUMN "meterInfoId" integer;--> statement-breakpoint
ALTER TABLE "rezsi_meter_reading" ADD COLUMN "photoUrls" jsonb;--> statement-breakpoint
ALTER TABLE "rezsi_smart_meter_device" ADD COLUMN "shellyDeviceId" varchar(200);--> statement-breakpoint
ALTER TABLE "rezsi_smart_meter_device" ADD COLUMN "shellyChannel" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "rezsi_smart_meter_device" ADD COLUMN "shellyAuthKey" text;--> statement-breakpoint
ALTER TABLE "rezsi_smart_meter_device" ADD COLUMN "shellyServer" varchar(100);--> statement-breakpoint
ALTER TABLE "rezsi_smart_meter_device" ADD COLUMN "shellyReversedPhases" varchar(10);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "tenantAddress" text;--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "tenantMotherName" varchar(200);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "tenantBirthPlace" varchar(200);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "tenantBirthDate" date;--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "tenantType" varchar(20) DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "tenantTaxNumber" varchar(50);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "billingName" varchar(255);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "billingEmail" varchar(255);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "billingAddress" text;--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "billingTaxNumber" varchar(50);--> statement-breakpoint
ALTER TABLE "rezsi_tenancy" ADD COLUMN "billingBuyerType" varchar(20);--> statement-breakpoint
ALTER TABLE "rezsi_wifi_network" ADD COLUMN "routerIp" varchar(100);--> statement-breakpoint
ALTER TABLE "rezsi_wifi_network" ADD COLUMN "routerUser" varchar(100);--> statement-breakpoint
ALTER TABLE "rezsi_wifi_network" ADD COLUMN "routerPassword" varchar(200);--> statement-breakpoint
ALTER TABLE "rezsi_wifi_network" ADD COLUMN "tailscaleIp" varchar(100);--> statement-breakpoint
ALTER TABLE "rezsi_wifi_network" ADD COLUMN "tailscaleDns" varchar(200);--> statement-breakpoint
ALTER TABLE "rezsi_wifi_network" ADD COLUMN "photoUrls" jsonb;--> statement-breakpoint
ALTER TABLE "rezsi_meter_info" ADD CONSTRAINT "rezsi_meter_info_tariffGroupId_rezsi_tariff_group_id_fk" FOREIGN KEY ("tariffGroupId") REFERENCES "public"."rezsi_tariff_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rezsi_meter_reading" ADD CONSTRAINT "rezsi_meter_reading_meterInfoId_rezsi_meter_info_id_fk" FOREIGN KEY ("meterInfoId") REFERENCES "public"."rezsi_meter_info"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meter_reading_meter_info_idx" ON "rezsi_meter_reading" USING btree ("meterInfoId","readingDate");