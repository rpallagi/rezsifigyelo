# TODO

## Properties redesign

Az ingatlanos felület még nincs végig egységesítve. Eddig elkészült:

- a `properties` lista thumbnailes cardokra lett átírva
- a `move-in` wizard kapott új, Stitch-közelibb layoutot
- a `marketing` oldal már menti a hirdetési tartalmat, tud marketing fotót és alaprajzot feltölteni
- a tariff group név szerkesztése bekerült
- a property thumbnail feltöltés hibakezelése javítva lett

## Következő kör

1. A `properties/[id]` főoldal headerét igazítani a lista card vizuális nyelvéhez.
2. A `properties/[id]/edit` oldalt újratervezni, mert még nyers admin form érzetű.
3. A `properties/[id]/marketing` oldalt tovább finomítani:
   - jobb képkezelés
   - cover photo kijelölés
   - preset room/view címkék
   - drag and drop sorrend
4. A marketing média meta jelenleg a `documents.notes` mezőben JSON-ként van tárolva.
   - hosszabb távon külön `marketing_media` tábla kellene
5. A `move-out` oldalt felhozni ugyanarra a vizuális szintre, mint a `move-in`.
6. A properties szekcióhoz közös komponensek kellenek:
   - `PropertyHeroCard`
   - `PropertyStatCard`
   - `PropertyMediaCard`

## Megjegyzés

- A `CODEX_HANDOFF.md` és a `src/app/icon.svg` jelenleg nincs ebbe a munkába bevonva.
- A build korábban `ENOSPC` miatt megakadt, most a `pnpm typecheck` zöld.
