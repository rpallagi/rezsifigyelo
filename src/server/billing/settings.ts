import { and, eq, inArray } from "drizzle-orm";

import { appSettings } from "@/server/db/schema";
import type { db } from "@/server/db";

export type InvoiceSettings = {
  agentKey: string;
  eInvoice: boolean;
  defaultDueDays: number;
};

const invoiceSettingDefinitions = {
  agentKey: "szamlazz_agent_key",
  eInvoice: "szamlazz_e_invoice",
  defaultDueDays: "szamlazz_default_due_days",
} as const;

function getScopedKey(baseKey: string, userId: number) {
  return `${baseKey}:${userId}`;
}

export async function getInvoiceSettings(
  database: typeof db,
  userId: number,
): Promise<InvoiceSettings> {
  const keys = Object.values(invoiceSettingDefinitions).map((baseKey) =>
    getScopedKey(baseKey, userId),
  );

  const rows = await database.query.appSettings.findMany({
    where: inArray(appSettings.key, keys),
  });

  const values = new Map(rows.map((row) => [row.key, row.value ?? ""]));

  return {
    agentKey: values.get(getScopedKey(invoiceSettingDefinitions.agentKey, userId)) ?? "",
    eInvoice:
      (values.get(getScopedKey(invoiceSettingDefinitions.eInvoice, userId)) ?? "true") !==
      "false",
    defaultDueDays: Number(
      values.get(getScopedKey(invoiceSettingDefinitions.defaultDueDays, userId)) ?? "8",
    ),
  };
}

export async function saveInvoiceSettings(
  database: typeof db,
  userId: number,
  settings: InvoiceSettings,
) {
  const entries = [
    [invoiceSettingDefinitions.agentKey, settings.agentKey],
    [invoiceSettingDefinitions.eInvoice, String(settings.eInvoice)],
    [invoiceSettingDefinitions.defaultDueDays, String(settings.defaultDueDays)],
  ] as const;

  for (const [baseKey, value] of entries) {
    const key = getScopedKey(baseKey, userId);
    const existing = await database.query.appSettings.findFirst({
      where: eq(appSettings.key, key),
    });

    if (existing) {
      await database
        .update(appSettings)
        .set({ value })
        .where(eq(appSettings.key, key));
    } else {
      await database.insert(appSettings).values({ key, value });
    }
  }
}

export async function deleteInvoiceSettings(
  database: typeof db,
  userId: number,
) {
  const keys = Object.values(invoiceSettingDefinitions).map((baseKey) =>
    getScopedKey(baseKey, userId),
  );

  await database
    .delete(appSettings)
    .where(
      and(
        inArray(appSettings.key, keys),
        eq(appSettings.key, appSettings.key),
      ),
    );
}
