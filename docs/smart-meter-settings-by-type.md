# Smart Meter Settings by Type

Ez a dokumentum leírja hogyan kell beállítani az egyes okosmérő típusokat a rezsifigyelő app-ban.

## Áttekintés

Az app **4 forrást** támogat:

| Forrás (`source` enum) | Adatáramlás | Státusz |
|---|---|---|
| `shelly_cloud` | Cron polloz a Shelly Cloud API-ból | ✅ Működik |
| `mqtt` | Külső rendszer POST-ol a webhook-ra | ⚠️ Webhook endpoint kész, nincs teszt |
| `ttn` | TTN Webhook integráció POST-ol | ⚠️ Webhook endpoint kész, nincs teszt |
| `home_assistant` | HA REST API-ról olvasás | ⚠️ API kész, nincs poll/webhook |

---

## Shelly Cloud (Shelly Pro 3EM, Shelly EM, stb.) ✅

**Preset neve a wizardban:** `Shelly Cloud (auto)`

Ez a javasolt beállítás minden Shelly eszközhöz. Teljesen automatikus, nincs szükség saját szerverre vagy webhook-ra.

### Beállítási lépések

1. **API kulcs megszerzése:**
   - Jelentkezz be a [control.shelly.cloud](https://control.shelly.cloud) oldalra
   - Bal alul / jobb felül → **User Settings**
   - Bal oldali menü: **Access And Permissions**
   - Görgess le: **Authorization cloud key** szekció
   - Másold ki a **Server** címet (pl. `shelly-63-eu.shelly.cloud`) és a kulcsot

2. **Kulcs bevitele az app-ba:**
   - Beállítások → Shelly Cloud (`/settings/shelly-cloud`)
   - Server: pl. `shelly-63-eu.shelly.cloud`
   - Authorization Cloud Key: a másolt kulcs
   - Mentés → Teszt (mutatnia kell az eszközök számát)

3. **Mérő hozzárendelése ingatlanhoz:**
   - Ingatlan → Új mérő (`/properties/[id]/meters/new`)
   - Közmű: Villany
   - Smart / Preset: **Shelly Cloud (auto)**
   - Device ID: az eszköz MAC címe **kisbetűs hex**, kettőspont nélkül (12 karakter)
     - Pl. `c8f09e8309f8` (Shelly app → eszköz → Settings → Device Information → Device ID)
   - Érték mező: `total_act` (alapértelmezett)
   - Szorzó: `0.001` (Wh → kWh)

### Hogy működik

- **Cron** (`/api/cron/poll-shelly`) óránként lekéri a `em:0.total_act_power`-t → `lastRawValue` (élő W)
- Hónap elsején létrehoz egy új havi kumulatív mérőállást (`emdata:0.total_act` Wh → kWh)
- **Frontend** 5 mp-enként közvetlenül a Shelly Cloud-ból olvassa a live power-t (`LivePowerBadge`)

### Historikus adat importálása

A Shelly Cloud API évekre visszamenő havi adatot ad. Havi bontásban lekérhető:

```
GET https://{server}/v2/statistics/power-consumption/em-3p
  ?id={mac_lowercase}
  &channel=0
  &date_range=custom
  &date_from=2024-01-01
  &date_to=2024-12-31
  &auth_key={key}
```

A válasz `sum` mezőjében havi összesítés van Wh-ban. Kumulatív mérőállás-sorozattá alakítva beszúrható a `rezsi_meter_reading` táblába.

---

## HomeWizard P1

**Preset:** `HomeWizard P1`

A HomeWizard egy okos villanyóra-leolvasó, ami P1 porton keresztül olvassa a digitális mérőt.

### Beállítás

1. HomeWizard local API engedélyezése a HomeWizard app-ban
2. Device ID: a HomeWizard device serial number
3. Érték mező: `total_power_import_kwh`
4. Szorzó: `1` (már kWh-ban van)
5. A HomeWizard-ot be kell állítani hogy POST-oljon a webhook-ra:
   ```
   POST https://rezsifigyelo.vercel.app/api/webhooks/smart-meter?source=mqtt&token=SMART_METER_WEBHOOK_TOKEN
   ```

---

## ESP32 MQTT

**Preset:** `ESP32 MQTT`

Saját ESP32 alapú áramlik-mérő projektekhez (pl. CT-clamp + ESP32).

### Beállítás

1. Az ESP32 kódjában HTTP POST kérést küldj:
   ```cpp
   {"device_id": "esp32_abc", "meter_value": 12345.67}
   ```
2. URL: `https://rezsifigyelo.vercel.app/api/webhooks/smart-meter?source=mqtt&token=...`
3. Device ID: amit az ESP32 küld
4. Érték mező: `meter_value`

---

## Zigbee2MQTT

**Preset:** `Zigbee2MQTT`

Zigbee okosmérők (pl. Aqara, Develco) Zigbee2MQTT bridgeen keresztül.

### Beállítás

1. Zigbee2MQTT Automations bridge-en (Node-RED, Home Assistant vagy saját script):
   - Subscribe: `zigbee2mqtt/<device-id>`
   - Forward: POST a webhook URL-re
2. Device ID: a Zigbee eszköz friendly name-je
3. Érték mező: `meter_value` (vagy amit a Zigbee driver küld)

---

## TTN LoRaWAN

**Preset:** `TTN LoRaWAN`

The Things Network-ön keresztül érkező LoRaWAN mérők.

### Beállítás

1. TTN Console → Application → Integrations → **Webhooks**
2. Add webhook:
   ```
   URL: https://rezsifigyelo.vercel.app/api/webhooks/smart-meter?source=ttn&token=...
   Format: JSON
   Uplink messages: enabled
   ```
3. Device ID: TTN device_id
4. TTN App ID: TTN application ID
5. Érték mező: `meter_value` (a TTN payload formatter-ben decoded_payload-ba kell tenni)

---

## Home Assistant

**Preset:** `Home Assistant`

Már meglévő Home Assistant setup-ból integrálható (pl. ahol már fut a Shelly integration, Tasmota, stb.).

### Beállítás

1. HA Long-Lived Access Token létrehozása:
   - HA → Profile (bal alul) → Security → Long-Lived Access Tokens → Create Token
2. App-ban: Beállítások → Home Assistant (`/settings/home-assistant`)
   - URL: pl. `http://homeassistant.local:8123`
   - Token: beillesztés
   - Teszt → majd "Sensors" lista letöltése
3. Ingatlan → Új mérő → Home Assistant preset
4. Device ID: a HA entity_id (pl. `sensor.shelly_pro_3em_channel_a_energy`)
5. Érték mező: `state`

### Megjegyzés

- Jelenleg csak **listázás**-ra van tRPC endpoint (`homeAssistant.listEntities`, `getEntityState`)
- **Nincs automatikus poll/cron**, az adatot webhook-kal kell pusholni HA-ból a `/api/webhooks/smart-meter?source=mqtt` URL-re (pl. HA REST Command automation)

---

## Fontos: nincs webhook token ellenőrzés?

A `/api/webhooks/smart-meter` endpoint opcionálisan ellenőriz egy `?token=` query paramot. Állítsd be a `SMART_METER_WEBHOOK_TOKEN` env változót Vercel-en produkcióhoz, és adj hozzá `&token=...` minden webhook URL-hez.
