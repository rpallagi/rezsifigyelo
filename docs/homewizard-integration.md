# HomeWizard Energy Cloud API Integration

## Overview

HomeWizard P1 meters have a **local-only** REST API, but the HomeWizard Energy app
syncs data to the cloud. The cloud API is undocumented but reverse-engineered by the
community. The free tier stores 12 months of data.

We use the **cloud API** to poll readings — no RPi or local device needed.

## Authentication

**Endpoint:** `GET https://api.homewizardeasyonline.com/v1/auth/account/token`

- **Method:** HTTP Basic Auth
- **Username:** HomeWizard Energy app email (plain text)
- **Password:** Plain text password (NOT hashed)
- **Response:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 3600,
  "token_type": "bearer"
}
```
- Token valid for 1 hour
- All subsequent requests use `Authorization: Bearer <token>`

### Env vars

```
HOMEWIZARD_EMAIL=rpallagi@gmail.com
HOMEWIZARD_PASSWORD=<password>
```

## Endpoints

### List locations & devices

**GET** `https://homes.api.homewizard.com/locations`

Returns array of locations, each with `devices[]`:
```json
{
  "id": 691888,
  "name": "O Utca 42",
  "location": "Budapest",
  "devices": [
    {
      "id": 1445147,
      "device_id": "p1dongle/5c2faf12b60a",
      "name": "P1 Meter",
      "type": "p1dongle"
    }
  ]
}
```

### Fetch historical data (daily)

**POST** `https://tsdb-reader.homewizard.com/devices/date/{YYYY}/{MM}/{DD}`

Body:
```json
{
  "devices": ["p1dongle/5c2faf12b60a"],
  "resolution": "days",
  "type": "main_connection"
}
```

Response:
```json
{
  "total": {
    "time": "2026-02-28T23:00:00.000Z",
    "netto_costs": 0,
    "import": 18.36,
    "export": 0,
    "netto": 18.36
  }
}
```

- `import` = total kWh consumed in the period
- `export` = total kWh exported (solar)
- Use `YYYY/MM` for monthly total, `YYYY/MM/DD` for daily

### Fetch historical data (weekly)

**POST** `https://tsdb-reader.homewizard.com/devices/date/{YYYY}/week/{WW}`

Same body format. Returns weekly totals.

### Valid `type` values

`main_connection`, `gas`, `solar`, `water`, `other`, `heatpump`,
`home_battery`, `electric_car`, `electric_bike`, `washing_machine`,
`refrigerator`, `tv`, `aquarium`, `oven`, `dishwasher`, `ventilation`,
`gaming`, `computer`, `standby_usage`, `temperature`, `humidity`,
`overvoltage`, `home_usage`, `solar_combined`, `self_consumption`, `battery`

## Our devices

| Location | Device ID | Type | Name |
|----------|-----------|------|------|
| Portyazo 32 | p1dongle/5c2faf11f192 | p1dongle | P1 Meter |
| Portyazo 32 | display/5c2faf1930f8 | display | Living Room |
| Portyazo 32 | watermeter/5c2faf3b0658 | watermeter | Watermeter |
| Haros | p1dongle/5c2faf1030b8 | p1dongle | P1 Meter |
| Haros | huawei/rpallagi@gmail.com | unknown | (solar?) |
| O Utca 42 | p1dongle/5c2faf12b60a | p1dongle | P1 Meter |
| Gyapot Kontener | energymeter/5c2faf1d8f04 | energymeter | OfficeContainer |

## Community references

- `fdegier/energy-history-saver` — Python, downloads cloud history to SQLite
- `pyrech/homewizard_cloud_watermeter` — HA integration, best cloud API documentation in source code

## Local API (for future use with RPi)

If a device on the same LAN as the P1 meter is available:
- `GET http://<IP>/api/v1/data` — current reading (kWh, W, gas, voltage)
- `GET http://<IP>/api/v1/telegram` — raw P1 telegram
- No auth, no history, real-time only
- Must enable "Local API" in HomeWizard Energy app settings
