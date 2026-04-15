# Tarifa kutatás prompt

Ez a prompt az AI tarifa frissítés funkcióhoz.
Szerkesztheted a pontosabb eredményekért.

## Prompt

Keresd meg a jelenlegi magyar lakossági közüzemi árakat (bruttó, 27% ÁFA-val).

Villany (MVM Next, A1 tarifa, egyetemes szolgáltatás):
- Rezsicsökkentett ár Ft/kWh (éves limit: 2523 kWh)
- Piaci ár Ft/kWh (limit felett)
- Tartalmazza: energia ár + rendszerhasználati díj

Víz (Fővárosi Vízművek, lakossági):
- Ivóvíz díj Ft/m³ (bruttó)

Csatorna (FCSM, lakossági):
- Csatornahasználati díj + vízterhrelési díj Ft/m³ (bruttó)

Gáz (MVM Next, egyetemes szolgáltatás):
- Rezsicsökkentett ár Ft/m³ (éves limit: ~1729 m³)
- Piaci ár Ft/m³ (limit felett)

FONTOS: Válaszolj KIZÁRÓLAG az alábbi JSON formátumban, semmi mást ne írj:

```json
{
  "villany_rezsis": 36,
  "villany_piaci": 70,
  "viz": 219,
  "csatorna": 381,
  "gaz_rezsis": 102,
  "gaz_piaci": 747,
  "datum": "2026-01-01",
  "megjegyzes": "Rezsicsökkentett árak 2013 óta változatlanok. Piaci árak 2022 óta érvényesek."
}
```
