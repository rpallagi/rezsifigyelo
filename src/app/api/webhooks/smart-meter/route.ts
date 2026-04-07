import { type NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/server/db";
import {
  smartMeterDevices,
  smartMeterLogs,
  meterReadings,
  properties,
  tariffs,
} from "@/server/db/schema";

/**
 * Smart meter webhook — handles both TTN and generic HTTP webhooks.
 * POST /api/webhooks/smart-meter?source=ttn|mqtt|http
 *
 * TTN payload: { end_device_ids: { device_id }, uplink_message: { decoded_payload } }
 * Generic:     { device_id, value } or { device_id, [value_field] }
 */
export async function POST(req: NextRequest) {
  const source =
    (req.nextUrl.searchParams.get("source") as "ttn" | "mqtt") ?? "mqtt";

  // Optional auth token
  const authToken = req.nextUrl.searchParams.get("token");
  const expectedToken = process.env.SMART_METER_WEBHOOK_TOKEN;
  if (expectedToken && authToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawPayload: string;
  let deviceId: string;
  let rawValue: number | undefined;

  try {
    const body = await req.json();
    rawPayload = JSON.stringify(body);

    if (source === "ttn") {
      // TTN v3 format
      deviceId = body.end_device_ids?.device_id;
      const decoded = body.uplink_message?.decoded_payload;
      rawValue =
        decoded?.meter_value ??
        decoded?.value ??
        decoded?.reading;
    } else {
      // Generic format
      deviceId = body.device_id;
      rawValue = body.value ?? body.meter_value ?? body.reading;
    }

    if (!deviceId) {
      return NextResponse.json(
        { error: "Missing device_id" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find device mapping
  const device = await db.query.smartMeterDevices.findFirst({
    where: and(
      eq(smartMeterDevices.deviceId, deviceId),
      eq(smartMeterDevices.isActive, true),
    ),
  });

  if (!device) {
    await db.insert(smartMeterLogs).values({
      deviceId,
      source,
      rawPayload,
      status: "rejected",
      errorMessage: `Unknown device: ${deviceId}`,
    });
    return NextResponse.json(
      { error: "Unknown device" },
      { status: 404 },
    );
  }

  // Use custom value field if configured
  if (rawValue === undefined) {
    try {
      const body = JSON.parse(rawPayload);
      rawValue = body[device.valueField];
    } catch {
      // already parsed
    }
  }

  if (rawValue === undefined || isNaN(rawValue)) {
    await db.insert(smartMeterLogs).values({
      deviceId,
      source,
      rawPayload,
      status: "error",
      errorMessage: "No valid meter value in payload",
    });
    return NextResponse.json(
      { error: "No meter value" },
      { status: 400 },
    );
  }

  // Apply multiplier + offset
  const finalValue = rawValue * device.multiplier + device.offset;

  // Deduplication: check min interval
  if (device.lastSeenAt) {
    const elapsed =
      (Date.now() - new Date(device.lastSeenAt).getTime()) / 1000 / 60;
    if (elapsed < device.minIntervalMinutes) {
      await db.insert(smartMeterLogs).values({
        deviceId,
        source,
        rawPayload,
        parsedValue: rawValue,
        finalValue,
        status: "rejected",
        errorMessage: `Too soon (${elapsed.toFixed(0)}min < ${device.minIntervalMinutes}min)`,
      });
      return NextResponse.json({ status: "deduplicated" });
    }
  }

  // Get previous reading for consumption
  const prevReading = await db.query.meterReadings.findFirst({
    where: and(
      eq(meterReadings.propertyId, device.propertyId),
      eq(meterReadings.utilityType, device.utilityType),
    ),
    orderBy: [desc(meterReadings.readingDate), desc(meterReadings.id)],
  });

  const prevValue = prevReading?.value ?? null;
  const consumption =
    prevValue !== null ? finalValue - prevValue : null;

  // Create reading
  const today = new Date().toISOString().split("T")[0]!;
  const [reading] = await db
    .insert(meterReadings)
    .values({
      propertyId: device.propertyId,
      utilityType: device.utilityType,
      value: finalValue,
      prevValue,
      consumption,
      readingDate: today,
      source: source === "ttn" ? "smart_ttn" : "smart_mqtt",
      notes: `Auto: ${device.name ?? device.deviceId}`,
    })
    .returning();

  // Update device state
  await db
    .update(smartMeterDevices)
    .set({
      lastSeenAt: new Date(),
      lastRawValue: rawValue,
      lastError: null,
    })
    .where(eq(smartMeterDevices.id, device.id));

  // Log success
  await db.insert(smartMeterLogs).values({
    deviceId,
    source,
    rawPayload,
    parsedValue: rawValue,
    finalValue,
    status: "ok",
    readingId: reading?.id,
  });

  return NextResponse.json({
    status: "ok",
    value: finalValue,
    consumption,
    readingId: reading?.id,
  });
}
