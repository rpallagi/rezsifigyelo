# OCR / AI mérőállás beolvasás — beállítás

Az app OCR-t használ mérőóra fotókból mérőállás kinyerésére. Claude Haiku 4.5 vision model fut a háttérben (gyors, olcsó, pontos).

Route: `POST /api/ocr` (`src/app/api/ocr/route.ts`)

## Mikor fut

- **Leolvasás wizard** (`/properties/[id]/readings/new`) — a user fotóz/feltölt egy fotót, az OCR kinyeri a számot és bejelöli az "Érték" mezőbe.
- **Bérlő leolvasás** (`/my-home/readings`) — ugyanígy.

A frontend a `/api/upload`-ra ÉS `/api/ocr`-re is küldi a fájlt párhuzamosan (az első tárolja, a második kiolvassa).

## Szükséges env változó

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Beállítás lokálisan (`.env.local`)

1. Menj a [console.anthropic.com](https://console.anthropic.com) oldalra
2. Bejelentkezés → **API Keys** → **Create Key**
3. Másold ki az azonnal megjelenő kulcsot (utána nem látható többet!)
4. Írd be a `.env.local` fájlba:
   ```
   ANTHROPIC_API_KEY="sk-ant-api03-..."
   ```

### Beállítás Vercel prod-on

```bash
# Prod
vercel env add ANTHROPIC_API_KEY production

# Dev és preview is, ha akarod:
vercel env add ANTHROPIC_API_KEY development
vercel env add ANTHROPIC_API_KEY preview
```

A parancs interaktív — beilleszted a kulcsot, Enter, kész. Utána **redeploy kell**: push bármelyik commit-ot, vagy `vercel --prod --yes`.

### Ellenőrzés

```bash
vercel env ls | grep ANTHROPIC
```

## Használt model

`claude-haiku-4-5-20251001` — Claude Haiku 4.5

- Olcsóbb mint Sonnet (~5x)
- Gyorsabb (~3x)
- Tökéletes OCR-re meter olvasásnál

Ha pontatlan lenne, válthatunk Sonnet-re: `claude-sonnet-4-6`.

## Prompt

Jelenlegi prompt (ld. `src/app/api/ocr/route.ts`):
- Számokat ad vissza ONLY (nincs magyarázat, egység, prefix)
- Kezeli a mechanikus tekercses mérők piros (tizedes) digitjeit
- Kezeli LCD digitálisakat
- Ignorálja a T1/T2/HT/NT tarifa jelölőket, serial számot, QR-t
- Ha nem sikerül: "ERROR" szót ad vissza

## Hibakezelés

- Ha nincs API kulcs: `500 OCR not configured (missing ANTHROPIC_API_KEY)`
- Ha nem ismerhető fel: `{ success: false, raw, error: "Nem sikerült leolvasni a mérőállást" }`
- A wizard mutatja a hibát a fotó alatt

## Alternatíva: Vercel AI Gateway

Ha nem akarsz saját Anthropic accountot, a Vercel AI Gateway egy megosztott proxy (nincs saját kulcs, Vercel számolja).

Kapcsolod:
```bash
vercel env add AI_GATEWAY_API_KEY production
```

És az OCR route-ba átírod:
```ts
const response = await fetch("https://ai-gateway.vercel.sh/v1/messages", {
  headers: { "Authorization": `Bearer ${process.env.AI_GATEWAY_API_KEY}` },
  // ...
});
```

Jelenleg **direkt Anthropic API-n** megy, nem AI Gateway-en.

## Költségek

Claude Haiku 4.5 árazás (2026-04):
- Input: $1 / 1M token
- Output: $5 / 1M token

Egy átlagos mérő fotó ~1,500 input token + ~10 output token → kb. **0.0015 USD / leolvasás** (~0.5 Ft).
