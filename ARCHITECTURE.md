# Rezsi Figyelő — Architektúra & Szolgáltatás Setup

Közüzemi mérőállás nyilvántartó és bérlői fizetéskövető SaaS webapp.
~20 ingatlan kezelése, később eladható más bérbeadóknak is előfizetéses modellben.

---

## Tech Stack

| Technológia | Szerep |
|-------------|--------|
| Next.js 16 + React 19 | Frontend + Backend |
| TypeScript | Nyelv |
| tRPC v11 | API |
| Drizzle ORM + PostgreSQL (Neon) | Adatbázis |
| Clerk | Autentikáció |
| Stripe | Fizetés (előfizetés + bérlői fizetés) |
| Tailwind CSS 4 + shadcn/ui | UI |
| Vercel | Hosting |
| Vercel Blob | Fotó feltöltés (mérőóra képek) |
| Zod | Validáció |
| Recharts | Grafikonok (fogyasztás, költségek) |
| next-intl | Többnyelvűség (HU/EN) |
| next-themes | Dark/Light mód |
| szamlazz.hu API | Magyar számlázás (NAV kompatibilis) |
| Home Assistant + MQTT | Okos mérők automatikus leolvasása (későbbi fázis) |

---

## Felhasználói szerepek

| Szerep | Leírás |
|--------|--------|
| **Bérbeadó** (landlord) | Ingatlanok, bérlők, mérők, tarifák, számlák kezelése. Fizet előfizetést az appért. |
| **Bérlő** (tenant) | Mérőállás rögzítés, előzmények, üzenetek. Ingyenes hozzáférés. |
| **Admin** | Platform adminisztrátor, minden bérbeadó látható. |

---

## Adatmodell

```
users              — clerkId, email, név, szerep (landlord/tenant/admin), nyelv, téma
subscriptions      — Stripe előfizetés bérbeadóknak

properties         — bérbeadó ingatlanjai (név, cím, típus)
tenancies          — bérleti viszonyok (melyik bérlő melyik ingatlanban, mettől meddig)

meters             — mérőórák (gáz/víz/villany/fűtés/internet/közös költség/egyéb)
meter_readings     — mérőállások (érték, dátum, fotó, fogyasztás automatikusan számolva)

tariffs            — tarifák (egységár, pénznem, érvényesség)
invoices           — számlák (időszak, összeg, státusz: draft/sent/paid/overdue, fizetési mód)
invoice_items      — számla tételek (melyik mérő, fogyasztás, egységár, összeg)

messages           — üzenetek bérbeadó ↔ bérlő között
```

---

## Oldalak

### Bérbeadó
- Dashboard — összesítő (fizetetlen számlák, friss mérőállások)
- Ingatlanok — lista + CRUD
- Ingatlan részletek — mérők, állások, bérlő, számlák
- Bérlők — összes bérlő
- Tarifák — kezelés
- Számlázás — saját Stripe előfizetés
- Üzenetek — inbox
- Beállítások — profil, nyelv, téma

### Bérlő
- Otthonom — aktuális bérlemény áttekintés
- Mérőállások — rögzítés + előzmények
- Számlák — megtekintés + fizetés
- Üzenetek — bérbeadónak írni

---

## Stripe modell

- **angolozzunk.hu** → PlayENG EV Stripe fiók
- **Rezsi Figyelő** → Geo-Ép Kft / Pallagi Roland **ÚJ Stripe fiók** (másik bankszámlaszám!)
- Egy Stripe fiók = egy bankszámlaszám per pénznem, ezért kell külön fiók

---

# Szolgáltatás Setup — Step by Step

## 1. lépés: Neon (PostgreSQL adatbázis)

1. Nyisd meg: **console.neon.tech**
2. Jelentkezz be (GitHub vagy email)
3. Kattints: **"New Project"**
4. Project name: `rezsifigyelo`
5. Region: `eu-central-1` (Frankfurt — legközelebbi)
6. Kattints: **"Create Project"**
7. Megjelenik a **Connection string** — másold ki, ez lesz a `DATABASE_URL`
   - Formátum: `postgresql://neondb_owner:xxxxx@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
8. **Dev branch létrehozása:**
   - Bal menü → **Branches**
   - Kattints **"New Branch"**
   - Name: `dev`
   - Parent: `main`
   - Kattints **"Create Branch"**
   - Másold ki ennek is a connection stringjét (ez lesz a dev `DATABASE_URL`)

**Eredmény:** 2 connection string (prod + dev)

---

## 2. lépés: Clerk (autentikáció)

1. Nyisd meg: **dashboard.clerk.com**
2. Jelentkezz be
3. Bal felső sarokban kattints az aktuális app nevére → **"+ Create application"**
4. Application name: `Rezsi Figyelő`
5. Sign-in options: pipáld be a **Google**-t (+ Email ha kell)
6. Kattints **"Create"**
7. Megjelennek a kulcsok — másold ki:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_live_... vagy pk_test_...)
   - `CLERK_SECRET_KEY` (sk_live_... vagy sk_test_...)
8. **Webhook beállítás:**
   - Bal menü → **Webhooks**
   - Kattints **"+ Add Endpoint"**
   - URL: `https://rezsifigyelo.hu/api/webhooks/clerk` (vagy amit a domain lesz)
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Kattints **"Create"**
   - Másold ki a **Signing Secret**-et → ez lesz a `CLERK_WEBHOOK_SECRET`
9. **Domain beállítás (később, ha van domain):**
   - Bal menü → **Configure** → **Domains**
   - Add domain: `rezsifigyelo.hu`
   - 5 db CNAME rekord kell a DNS-be (ugyanúgy mint angolozzunk.hu-nál)

**Eredmény:** 3 kulcs (publishable key, secret key, webhook secret)

---

## 3. lépés: Stripe (fizetés — ÚJ FIÓK)

1. Nyisd meg: **dashboard.stripe.com**
2. **Ha be vagy jelentkezve a PlayENG fiókba:**
   - Bal felső sarokban kattints a fiók nevére
   - Kattints **"New account"**
3. **Ha nincs bejelentkezve:**
   - Regisztrálj ugyanazzal az email címmel
4. Account name: `Rezsi Figyelő`
5. **Cégadatok kitöltése:**
   - Business type: Company (ha Geo-Ép Kft) vagy Individual (ha Pallagi Roland)
   - Legal business name: `Geo-Ép Kft` vagy `Pallagi Roland`
   - Address, tax ID (adószám), stb.
6. **Bankszámlaszám hozzáadása:**
   - Settings → **Payouts** → **Add bank account**
   - IBAN: a Geo-Ép / Pallagi Roland HUF számlaszáma
7. **Termékek létrehozása:**
   - Felső menü → **Products** → **"+ Add product"**
   - Product 1: `Rezsi Figyelő Free`
     - Price: 0 Ft / month (vagy ne legyen ár, csak feature limit a kódban)
   - Product 2: `Rezsi Figyelő Pro`
     - Price: TBD Ft / month (recurring)
   - Másold ki mindkét **Price ID**-t (price_...)
8. **Webhook beállítás:**
   - Developers → **Webhooks** → **"+ Add endpoint"**
   - URL: `https://rezsifigyelo.hu/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Kattints **"Add endpoint"**
   - Másold ki a **Signing secret**-et → ez lesz a `STRIPE_WEBHOOK_SECRET`
9. **API kulcs:**
   - Developers → **API keys**
   - Másold ki a **Secret key**-t → ez lesz a `STRIPE_SECRET_KEY`
10. **Opcionális: Stripe Organization**
    - Settings → **Team** → keresd az Organization opciót
    - Összekötheted a PlayENG + Rezsi fiókokat konszolidált riportokhoz

**Eredmény:** Secret key, webhook secret, price ID-k

---

## 4. lépés: Vercel (hosting)

1. Nyisd meg: **vercel.com/dashboard**
2. Kattints: **"Add New..." → "Project"**
3. **Import Git Repository:** válaszd ki `rpallagi/rezsifigyelo`
4. Framework Preset: **Next.js** (auto-detected)
5. **NE kattints még a Deploy-ra!** Először env vars:
6. Kattints **"Environment Variables"** és add hozzá egyenként:

   | Név | Érték | Hova? |
   |-----|-------|-------|
   | `DATABASE_URL` | Neon **main** connection string | Production |
   | `DATABASE_URL` | Neon **dev** connection string | Preview + Development |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | All Environments |
   | `CLERK_SECRET_KEY` | Clerk secret key | All Environments |
   | `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | All Environments |
   | `STRIPE_SECRET_KEY` | Stripe secret key (ÚJ fiókból!) | All Environments |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | All Environments |

7. Kattints **"Deploy"**
8. **Domain hozzáadás (később):**
   - Project → **Settings** → **Domains**
   - Add: `rezsifigyelo.hu`
   - Vercel megmondja milyen DNS rekordot kell beállítani
9. **Git branch mapping:**
   - Settings → **Git** → Production Branch: `main`
   - A `dev` branchre pusholt kód automatikusan Preview deployment lesz

**Eredmény:** Élő deployment, env vars beállítva

---

## 5. lépés: Vercel Blob (fotó tárhely)

1. Vercel dashboard → a `rezsifigyelo` projekt
2. Felső menü → **Storage**
3. Kattints **"Create"** → válaszd **"Blob"**
4. Name: `rezsifigyelo-uploads`
5. Kattints **"Create"**
6. Automatikusan hozzáadja a `BLOB_READ_WRITE_TOKEN` env var-t a projekthez

**Eredmény:** Fotó feltöltés működik

---

## 6. lépés: Domain DNS (ha van domain)

A domain registrárban (Versanus, stb.):

### Vercel-hez (hosting):
| Típus | Név | Érték |
|-------|-----|-------|
| CNAME | `@` vagy `www` | `cname.vercel-dns.com` |

Vagy amit a Vercel mond a Domains beállításnál.

### Clerk-hez (auth):
Ugyanaz az 5 CNAME mint angolozzunk.hu-nál, de a Clerk dashboard mutatja a pontos értékeket az új apphoz.

---

## 7. lépés: szamlazz.hu (magyar számlázás)

A szamlazz.hu állítja ki a hivatalos NAV-kompatibilis számlákat. Stripe fizetés után automatikusan generálja a számlát.

1. Nyisd meg: **szamlazz.hu**
2. Ha nincs fiókod, regisztrálj (Geo-Ép Kft vagy Pallagi Roland adataival)
3. **Számlázó fiók beállítása:**
   - Cégadatok: név, cím, adószám
   - Bankszámlaszám
   - Számla sorszám prefix (pl. `RF-2026-`)
4. **API kulcs generálás:**
   - Beállítások → **API integráció** (vagy "Fejlesztőknek")
   - Generálj egy API kulcsot
   - Ez lesz a `SZAMLAZZ_API_KEY` env var
5. **Vercel-ben add hozzá:**
   - `SZAMLAZZ_API_KEY` → All Environments

**Működés az appban:**
- Stripe webhook → fizetés befejezve → szamlazz.hu API hívás → számla kiállítva → PDF elküldve emailben
- A bérlő automatikusan megkapja a számlát

---

## Összefoglaló: mit kapsz végül

| Szolgáltatás | Fiók | Projekt/App neve |
|---|---|---|
| GitHub | rpallagi | `rezsifigyelo` repo |
| Neon | meglévő fiók | `rezsifigyelo` projekt (main + dev branch) |
| Clerk | meglévő fiók | `Rezsi Figyelő` application |
| Stripe | **ÚJ fiók** (Geo-Ép Kft / Pallagi Roland) | `Rezsi Figyelő` |
| Vercel | meglévő fiók | `rezsifigyelo` projekt |
| Vercel Blob | Vercel projekten belül | `rezsifigyelo-uploads` |
| szamlazz.hu | meglévő vagy **új fiók** (Geo-Ép Kft / Pallagi Roland) | számlázó fiók |

Env vars összesen: 8 db (DATABASE_URL, 2x Clerk, 2x Stripe, 1x Blob — auto, 1x szamlazz.hu)
