/**
 * HomeWizard Energy Cloud API client
 *
 * Undocumented API reverse-engineered by the community.
 * See docs/homewizard-integration.md for details.
 */

const AUTH_URL = "https://api.homewizardeasyonline.com/v1/auth/account/token";
const LOCATIONS_URL = "https://homes.api.homewizard.com/locations";
const TSDB_URL = "https://tsdb-reader.homewizard.com/devices/date";

export type HWDevice = {
  id: number;
  device_id: string;
  name: string;
  type: string;
  created: string;
  geo_state_enabled: boolean;
};

export type HWLocation = {
  id: number;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  devices: HWDevice[];
};

export type HWHistoryTotal = {
  time: string;
  netto_costs: number;
  import: number;
  export: number;
  netto: number;
};

export type HWHistoryEntry = {
  time: string;
  import: number;
  export: number;
  netto: number;
  netto_costs: number;
};

export type HWHistoryResponse = {
  total: HWHistoryTotal;
  data?: HWHistoryEntry[];
};

/** Authenticate and get a bearer token (valid for 1 hour) */
export async function getToken(
  email: string,
  password: string,
): Promise<string> {
  const credentials = Buffer.from(`${email}:${password}`).toString("base64");
  const res = await fetch(AUTH_URL, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "User-Agent": "RezsiFigyelo/1.0",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HomeWizard auth failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** List all locations and their devices */
export async function listLocations(token: string): Promise<HWLocation[]> {
  const res = await fetch(LOCATIONS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HomeWizard listLocations failed (${res.status})`);
  }
  return res.json() as Promise<HWLocation[]>;
}

/**
 * Fetch historical data for a device.
 *
 * @param datePath - e.g. "2026/04" for monthly, "2026/04/01" for daily
 * @param resolution - "days" for daily breakdown within month, "hours" for hourly
 * @param type - "main_connection" for electricity, "gas" for gas, "water" for water
 */
export async function fetchHistory(
  token: string,
  deviceId: string,
  datePath: string,
  resolution: "days" | "hours" = "days",
  type: string = "main_connection",
): Promise<HWHistoryResponse> {
  const res = await fetch(`${TSDB_URL}/${datePath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      devices: [deviceId],
      resolution,
      type,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HomeWizard fetchHistory failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<HWHistoryResponse>;
}

/**
 * Fetch monthly totals for the last N months.
 * Returns array of { month: "2026-03", importKwh: number }.
 */
export async function fetchMonthlyHistory(
  token: string,
  deviceId: string,
  monthsBack: number = 12,
  type: string = "main_connection",
): Promise<{ month: string; importKwh: number; exportKwh: number }[]> {
  const results: { month: string; importKwh: number; exportKwh: number }[] = [];
  const now = new Date();

  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");

    try {
      const data = await fetchHistory(
        token,
        deviceId,
        `${yyyy}/${mm}`,
        "days",
        type,
      );
      if (data.total) {
        const imp = data.total.import ?? 0;
        const exp = data.total.export ?? 0;
        results.push({
          month: `${yyyy}-${mm}`,
          // Some energymeters report consumption as export (reversed CT)
          // Use whichever is larger as the actual consumption
          importKwh: Math.max(imp, exp),
          exportKwh: Math.min(imp, exp),
        });
      }
    } catch {
      // Skip months with no data
    }
  }

  return results.reverse(); // oldest first
}
