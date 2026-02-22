# Rezsi Figyelő v3.0 — Ingatlan Részletek + Interaktivitás Terv

## Összefoglaló

Az app jelenleg modal-alapú CRUD-dal dolgozik. A cél: **teljes ingatlan részletek oldal** tabokkal, **interaktív táblázatok**, **dokumentum kezelés**, **bérlő historika**, és **marketing szekció**.

---

## 🔴 Fázis 1 — Ingatlan Részletek Oldal (core)

### Cél
Modal helyett teljes oldal: `/admin/properties/:id` — tabokkal

### Új Route
```
/admin/properties/:id → AdminPropertyDetail.tsx
/admin/properties/:id?tab=readings|payments|maintenance|docs|marketing
```

### Tabok (bal→jobb):
1. **Alapadatok** — szerkesztő form (jelenlegi modal tartalom) + ingatlan avatár/fotó feltöltés
2. **Mérőállások** — property-specifikus readings + admin is rögzíthet + sparkline + % változás
3. **Kifizetések** — property-specifikus payments + CRUD
4. **Karbantartás** — property-specifikus maintenance logs + CRUD
5. **Dokumentumok** — fájl feltöltés (átadás-átvételi, szerződések, egyéb)
6. **Marketing** — hirdetés szöveg szerkesztő + fotó galéria

### DB módosítások (Fázis 1)

**Property modell bővítés:**
```python
class Property(db.Model):
    # ... meglévő mezők ...
    avatar_filename = db.Column(db.String(255), nullable=True)  # Ingatlan kis fotó
```

**Új modell: Document**
```python
class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)     # eredeti fájlnév
    stored_filename = db.Column(db.String(255), nullable=False) # UUID-s tárolt név
    category = db.Column(db.String(50), nullable=False)       # atadas_atvetel / szerzodes / marketing / egyeb
    notes = db.Column(db.Text, nullable=True)
    file_size = db.Column(db.Integer, nullable=True)          # bytes
    mime_type = db.Column(db.String(100), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
```

**Új modell: MarketingContent**
```python
class MarketingContent(db.Model):
    __tablename__ = 'marketing_contents'
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False, unique=True)
    listing_title = db.Column(db.String(200), nullable=True)    # Hirdetés cím
    listing_description = db.Column(db.Text, nullable=True)     # Hirdetés szöveg (markdown)
    listing_url = db.Column(db.String(500), nullable=True)      # Ingatlan.com link
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Új API endpointok (Fázis 1)

```
GET    /api/admin/properties/:id/detail    → Teljes property adatok + tabok összesítése
PUT    /api/admin/properties/:id/avatar     → Avatar fotó feltöltés (multipart)
POST   /api/admin/properties/:id/readings   → Admin mérőállás rögzítés
GET    /api/admin/properties/:id/readings   → Property-specifikus readings (sparkline + % change)
GET    /api/admin/properties/:id/payments   → Property-specifikus payments
GET    /api/admin/properties/:id/maintenance → Property-specifikus maintenance
GET    /api/admin/properties/:id/documents  → Dokumentum lista
POST   /api/admin/properties/:id/documents  → Dokumentum feltöltés (multipart)
DELETE /api/admin/documents/:id             → Dokumentum törlés
GET    /api/admin/properties/:id/marketing  → Marketing tartalom
PUT    /api/admin/properties/:id/marketing  → Marketing tartalom mentés
POST   /api/admin/properties/:id/marketing/photos → Marketing fotó feltöltés
```

### Új React komponensek

```
frontend/src/pages/admin/AdminPropertyDetail.tsx  → Fő detail oldal (tab router)
frontend/src/pages/admin/property-tabs/
  ├─ PropertyBasicInfo.tsx     → Szerkesztő form + avatar
  ├─ PropertyReadings.tsx      → Mérőállások tab + admin rögzítés
  ├─ PropertyPayments.tsx      → Kifizetések tab
  ├─ PropertyMaintenance.tsx   → Karbantartás tab
  ├─ PropertyDocuments.tsx     → Dokumentumok tab
  └─ PropertyMarketing.tsx     → Marketing tab
```

### AdminProperties lista változások
- Kártya kattintható → navigáció `/admin/properties/:id`-ra
- Szerkesztés gomb → navigáció `/admin/properties/:id?tab=basic`-ra (nem modal!)
- Típus badge kattintható → szűr az adott típusra
- Avatár thumbnail a kártya bal oldalán (ha van)
- Törlés marad AlertDialog (mert destruktív művelet)

---

## 🟡 Fázis 2 — AdminReadings interaktivitás

### Jelenlegi állapot
Statikus tábla, semmi nem kattintható.

### Változások
- **Ingatlan oszlop** kattintható → `/admin/properties/:id?tab=readings`
- **Közüzem badge** kattintható → szűr arra a típusra (filterType set)
- **Sparkline** mini grafikon a consumption oszlopban (utolsó 6 adat)
- **% változás** vs előző hónap: zöld ▼ ha csökkent, piros ▲ ha nőtt (badge formában)
- **"Új mérőállás" gomb** → Dialog ahol admin kiválasztja az ingatlant + közüzem típust + mérőállás értéket
  - Ugyanaz a számítási logika mint bérlőnél (consumption, cost, csatorna auto)

### Új API
```
POST /api/admin/readings → Admin mérőállás rögzítés (property_id + utility_type + value + date)
```

A backend kód a meglévő tenant reading submit logikát újrahasznosítja.

---

## 🟢 Fázis 3 — Bérlő historika + Szerződések (későbbi)

### Cél
Ingatlan → Bérlők tab: aktuális + korábbi bérlők listája, mindegyikhez hozzárendelve:
- Szerződés időszak (from - to)
- Összesített befizetések
- Összes mérőállás
- Átadás-átvételi dokumentumok

### DB módosítások

**tenant_property_access bővítés** (jelenleg egyszerű join tábla → modell lesz):
```python
class TenantPropertyAccess(db.Model):
    __tablename__ = 'tenant_property_access_v2'
    id = db.Column(db.Integer, primary_key=True)
    tenant_user_id = db.Column(db.Integer, db.ForeignKey('tenant_users.id'))
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'))
    is_active = db.Column(db.Boolean, default=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
```

**Új modell: ContractTemplate**
```python
class ContractTemplate(db.Model):
    __tablename__ = 'contract_templates'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)  # Markdown sablon
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Új modell: Contract**
```python
class Contract(db.Model):
    __tablename__ = 'contracts'
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'))
    tenant_user_id = db.Column(db.Integer, db.ForeignKey('tenant_users.id'), nullable=True)
    template_id = db.Column(db.Integer, db.ForeignKey('contract_templates.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)  # Kitöltött szerződés szöveg
    status = db.Column(db.String(20), default='draft')  # draft / sent / signed
    signed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### Ez maradjon későbbre mert:
- Komplex adatbázis migráció (tenant_property_access tábla módosítás)
- Email küldés infrastruktúra kell (SMTP config, template rendering)
- Szerződés sablon szerkesztő nem triviális (markdown editor + változó behelyettesítés)

---

## Implementációs sorrend

| # | Feladat | Fájlok | Becsült komplexitás |
|---|---------|--------|---------------------|
| 1 | DB modellek (Document, MarketingContent, Property.avatar) | models.py | Kicsi |
| 2 | Backend API endpointok (property detail + CRUD) | routes/api.py | Közepes |
| 3 | AdminPropertyDetail.tsx fő oldal (tab navigation) | Új fájl | Közepes |
| 4 | PropertyBasicInfo.tsx (form, avatar upload) | Új fájl | Közepes |
| 5 | PropertyReadings.tsx (admin reading submit, sparkline, % change) | Új fájl | Nagy |
| 6 | PropertyPayments.tsx + PropertyMaintenance.tsx | 2 új fájl | Közepes |
| 7 | PropertyDocuments.tsx (upload, kategóriák, lista) | Új fájl | Közepes |
| 8 | PropertyMarketing.tsx (szöveg editor, fotó galéria) | Új fájl | Közepes |
| 9 | AdminProperties.tsx átírás (kártyák kattinthatóak, típus filter, avatar) | Meglévő | Közepes |
| 10 | AdminReadings.tsx átírás (kattintható oszlopok, sparkline, %, admin submit) | Meglévő | Nagy |
| 11 | App.tsx route + i18n kulcsok | Meglévő | Kicsi |
| 12 | Build + deploy + tesztelés | - | Kicsi |

---

## i18n kulcs struktúra (új)

```
propDetail.title / propDetail.tabs.basic / propDetail.tabs.readings / ...
propDetail.avatar / propDetail.avatarUpload / propDetail.noAvatar
propDetail.adminReadingTitle / propDetail.adminReadingDesc
propDetail.prevMonth / propDetail.change / propDetail.increase / propDetail.decrease
docs.title / docs.upload / docs.category / docs.atadas / docs.szerzodes / docs.marketing / docs.egyeb
docs.deleteConfirm / docs.noFiles / docs.fileSize
marketing.title / marketing.listingTitle / marketing.listingDesc / marketing.listingUrl
marketing.photos / marketing.uploadPhoto / marketing.noPhotos / marketing.save
adminReadings.newReading / adminReadings.submitReading / adminReadings.changeVsPrev
```

---

## Megjegyzések a tervhez

1. **A szerződés kezelés (Fázis 3) marad későbbre** — az email küldés és sablon szerkesztés külön infrastruktúrát igényel. Viszont a Dokumentumok tabban már most lehet szerződés PDF-eket feltölteni.

2. **A bérlő historika (Fázis 3) szintén későbbre** — a jelenlegi tenant_property_access tábla nem tartalmaz dátumokat, ezt migrálni kell. De a property detail oldalon már látható a jelenlegi bérlő.

3. **Fázis 1 + 2 = v3.0** — ez önmagában egy hatalmas upgrade ami rögtön használható.

4. **Admin mérőállás rögzítés** — kritikus feature, mert a bérbeadó is akar óraállást felvinni. A PropertyReadings tabban pontosan ugyanaz a form mint a bérlőnél (közüzem választás + érték megadás + dátum + fotó).
