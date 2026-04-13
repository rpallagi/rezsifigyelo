import { eq, and, lte, desc } from "drizzle-orm";
import { tariffs, meterInfo, properties } from "@/server/db/schema";
import type { db as DB } from "@/server/db";

/**
 * Calculate costHuf and tariffId for a reading.
 * Prefers meter-specific tariff group, falls back to property's.
 */
type UtilityType = "villany" | "viz" | "gaz" | "csatorna" | "internet" | "kozos_koltseg" | "egyeb";

export async function calculateReadingCost(
  db: typeof DB,
  opts: {
    propertyId: number;
    utilityType: UtilityType | string;
    meterInfoId?: number | null;
    consumption: number;
    readingDate: string;
  },
): Promise<{ costHuf: number | null; tariffId: number | null }> {
  if (opts.consumption <= 0) return { costHuf: null, tariffId: null };

  // Find effective tariff group: meter-specific > property-level
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, opts.propertyId),
    columns: { tariffGroupId: true },
  });

  let effectiveTariffGroupId: number | null = property?.tariffGroupId ?? null;
  if (opts.meterInfoId) {
    const meter = await db.query.meterInfo.findFirst({
      where: eq(meterInfo.id, opts.meterInfoId),
      columns: { tariffGroupId: true },
    });
    if (meter?.tariffGroupId) {
      effectiveTariffGroupId = meter.tariffGroupId;
    }
  }

  if (!effectiveTariffGroupId) return { costHuf: null, tariffId: null };

  const activeTariff = await db.query.tariffs.findFirst({
    where: and(
      eq(tariffs.tariffGroupId, effectiveTariffGroupId),
      eq(tariffs.utilityType, opts.utilityType as UtilityType),
      lte(tariffs.validFrom, opts.readingDate),
    ),
    orderBy: [desc(tariffs.validFrom)],
  });

  if (!activeTariff) return { costHuf: null, tariffId: null };

  return {
    costHuf: opts.consumption * activeTariff.rateHuf,
    tariffId: activeTariff.id,
  };
}
