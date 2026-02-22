# Lovable UI Design Prompt — Rezsi Figyelő

> Copy everything below into Lovable as your project prompt.

---

## Project Overview

Build a **modern, premium UI** for a Hungarian **utility meter reading & property management web app** called **"Rezsi Figyelő"** (Utility Tracker). The backend already exists (Flask + PostgreSQL), so this is a **frontend-only redesign**. The final result should look polished enough to serve as both a **working product** and a **marketing showcase** for potential landlord clients.

**Language:** All UI text is in **Hungarian**. Use the exact labels provided below.

**Design philosophy:**
- Apple/Stripe-inspired — clean, spacious, confident typography
- Card-based layout everywhere
- **Dark mode + Light mode** with system preference detection + manual toggle
- Mobile-first (tenants use phones 95% of the time)
- Admin panel also works great on desktop browsers (responsive sidebar → bottom nav on mobile)
- Subtle micro-animations (card hover lift, page transitions, skeleton loading)
- Use Tailwind CSS or similar utility framework
- Chart library: **Recharts** (or Chart.js) for consumption/cost graphs

---

## Color System

### Light mode
- Background: `#f8fafc` (cool gray)
- Card surface: `#ffffff`
- Primary: `#6366f1` (Indigo 500) — main actions, active states
- Primary hover: `#4f46e5` (Indigo 600)
- Secondary: `#64748b` (Slate 500)
- Success: `#10b981` (Emerald 500) — positive values, confirmations
- Danger: `#ef4444` (Red 500) — errors, delete actions
- Warning: `#f59e0b` (Amber 500) — alerts, pending
- Text primary: `#0f172a` (Slate 900)
- Text secondary: `#64748b` (Slate 500)
- Border: `#e2e8f0` (Slate 200)

### Dark mode
- Background: `#0f172a` (Slate 900)
- Card surface: `#1e293b` (Slate 800)
- Primary: `#818cf8` (Indigo 400)
- Text primary: `#f1f5f9` (Slate 100)
- Text secondary: `#94a3b8` (Slate 400)
- Border: `#334155` (Slate 700)

---

## Page Structure (5 sections)

### SECTION 1: Landing Page (Marketing + Entry Point)

**Route:** `/`

This is the **first thing anyone sees** — it doubles as a marketing page and entry point.

**Layout (top to bottom):**

1. **Hero Section** — full viewport height
   - Large heading: **"Rezsi Figyelő"**
   - Subheading: **"Közüzemi mérőállás nyilvántartó bérbeadóknak és bérlőknek"**
   - Subtle animated background gradient (indigo → purple → blue, slow shift)
   - App icon/logo centered above the heading

2. **Two large entry cards** — centered, side by side on desktop, stacked on mobile
   - **Card 1: "Bérlő vagyok"** (I'm a tenant)
     - Icon: 🏠 or a key icon
     - Description: "Mérőállás rögzítés, előzmények megtekintése"
     - Leads to: `/tenant/login`
     - Style: Outlined card with hover fill animation
   - **Card 2: "Bérbeadó vagyok"** (I'm a landlord)
     - Icon: 📊 or a building icon
     - Description: "Ingatlanok kezelése, fizetések, riportok"
     - Leads to: `/admin/login`
     - Style: Filled primary card with hover glow

3. **Feature highlights** (optional scroll section below fold)
   - 3-4 feature cards in a grid:
     - "📸 Fotós mérőállás rögzítés" — Meter reading with photo proof
     - "📊 Automatikus költségszámítás" — Auto cost calculation
     - "🔔 Fizetés nyilvántartás" — Payment tracking
     - "📈 ROI kalkulátor" — Return on investment calculator
   - Each card: icon + title + 1-line description

4. **Footer** — minimal, version number, "Made with ❤️ in Hungary"

---

### SECTION 2: Tenant Interface (Mobile-First)

**Target:** Phone screens (375px–428px primary), tablets secondary, desktop works but not priority.

**Design:** Bottom navigation bar with 3 tabs — like a native mobile app.

---

#### Page 2.1: Tenant Login (`/tenant/login`)

**Layout:**
- Centered card on gradient background (same as landing but darker)
- **Property selector** — dropdown or bottom sheet selector listing all properties by name
  - Show property type as small badge (🏠 Lakás / 🏪 Üzlet)
- **PIN input** — 4-6 digit numeric keypad style (large touch targets)
  - Show dots for entered digits (like phone unlock)
  - OR: large number input with masked characters
- **"Belépés" button** — full width, primary color, large
- Small link at bottom: "Bérbeadó belépés →" pointing to admin login

---

#### Page 2.2: Tenant Dashboard (`/tenant/dashboard`)

**This is the main screen after login.**

**Top bar:**
- Property name (left): e.g., "1. Lakás"
- Dark/light toggle icon (center-right)
- Logout icon button (right)

**Content (scrollable):**

1. **Greeting + date** — "Üdv! 2025. január 15."

2. **Utility summary cards** (2 cards, stacked vertically or 2-column on wider screens):

   **Villany (Electricity) card:**
   - ⚡ icon with amber/yellow accent color
   - Large value: "5 231.0 kWh" (last meter reading)
   - Below: "Fogyasztás: 142 kWh" (consumption since last)
   - Below: "≈ 30 104 Ft" (estimated cost)
   - Small text: "Utolsó leolvasás: 2025.01.05"
   - **Mini sparkline chart** in the card background (last 6-12 months consumption trend)

   **Víz (Water) card:**
   - 💧 icon with blue accent color
   - Large value: "269.4 m³"
   - Below: "Fogyasztás: 3.2 m³"
   - Below: "≈ 2 426 Ft (víz) + 3 714 Ft (csatorna)"
   - Small text: "Utolsó leolvasás: 2025.01.05"
   - Mini sparkline in background

3. **Current tariffs info** — collapsible section or subtle card
   - Villany: 212 Ft/kWh
   - Víz: 758,19 Ft/m³
   - Csatorna: 1 160,78 Ft/m³

4. **Quick action buttons** (large, touch-friendly, full width):
   - "📝 Mérőállás rögzítése" → `/tenant/reading` (Primary, prominent)
   - "📋 Előzmények" → `/tenant/history` (Secondary/outlined)

**Bottom navigation bar** (fixed, 3 items):
- 🏠 Főoldal (Dashboard) — active
- 📝 Rögzítés (New reading)
- 📋 Előzmények (History)

---

#### Page 2.3: New Reading (`/tenant/reading`)

**Full-screen form, step-by-step feel:**

1. **Utility type selector** — two large tappable cards, side by side:
   - ⚡ Villany (amber border when selected)
   - 💧 Víz (blue border when selected)
   - Selection fills with light color + checkmark

2. **Meter value input** — centered, very large font (like calculator display)
   - Placeholder shows last reading: "Előző: 5 231.0"
   - Numeric keyboard on mobile (inputmode="decimal")
   - Unit label to the right: "kWh" or "m³" (auto-changes with type)

3. **Live calculation preview** — appears below input as user types
   - Green/success-colored card:
   - "Fogyasztás: 142.0 kWh"
   - "Becsült költség: ≈ 30 104 Ft"
   - If water: also shows "Csatorna: ≈ 3 714 Ft"
   - Animates in when value > previous reading

4. **Date picker** — defaults to today, compact
   - "Leolvasás dátuma: 2025.01.15"

5. **Photo upload** — large dashed upload area
   - Camera icon + "Fotó a mérőóráról"
   - Tap to open camera (on mobile) or file picker
   - Shows preview thumbnail after capture
   - Supports: jpg, png, webp (auto-resized server-side)

6. **Notes** — optional textarea, collapsed by default ("+ Megjegyzés hozzáadása")

7. **Submit button** — full width, large: "✅ Rögzítés"
   - Loading spinner state on submission
   - Success animation (checkmark) before redirecting to dashboard

---

#### Page 2.4: History (`/tenant/history`)

**Layout:**

1. **Filter tabs** — horizontal scroll pill buttons:
   - Összes (All) | ⚡ Villany | 💧 Víz | 🚰 Csatorna
   - Active tab: filled primary color

2. **Charts section** — two charts, swipeable or tabbed:
   - **Consumption chart** — bar chart (Recharts), monthly bars colored by utility type
   - **Cost chart** — line chart, monthly cost trend in Ft

3. **Reading list** — chronological cards:
   Each card shows:
   - Left color bar (amber = villany, blue = víz, purple = csatorna)
   - **Utility type + date** header: "⚡ Villany — 2025.01.05"
   - Value: "5 231.0 kWh"
   - Consumption: "142.0 kWh"
   - Cost: "30 104 Ft" (green color)
   - Photo thumbnail (if exists) — tap to view full size in modal/lightbox
   - Notes (if any) — italic, smaller text

---

### SECTION 3: Admin Interface (Desktop-First, Responsive)

**Target:** Desktop browsers (1280px+), but must work on tablets and phones too.

**Layout pattern:** Sidebar (desktop) → Bottom nav or hamburger (mobile)

---

#### Admin Sidebar Navigation (desktop: fixed left, 260px wide)

**Header:**
- "Rezsi Figyelő" title
- "Admin" badge/pill

**Menu items (icons + Hungarian labels):**
1. 📊 Dashboard
2. 🏠 Ingatlanok (Properties)
3. 📝 Mérőállások (Readings)
4. 💰 Fizetések (Payments)
5. 🔧 Karbantartás (Maintenance)
6. ☑️ Todo
7. 💲 Tarifák (Tariffs)
8. 📈 ROI
9. 🚀 Rendszer (System) — with orange dot when update available
10. ⚙️ Beállítások (Settings)

**Footer:**
- "Kilépés" (Logout) button

**On mobile:** Collapse to bottom tab bar (show top 5 items) with "More" menu for the rest.

---

#### Page 3.1: Admin Login (`/admin/login`)

- Centered card, same background as tenant login
- Username + password fields
- "Bejelentkezés" button
- Link: "← Bérlő belépés"

---

#### Page 3.2: Admin Dashboard (`/admin/`)

**Stats row** — 4 cards in a row (grid on mobile: 2x2):
- 🏠 Ingatlanok: **12** (number of properties)
- 📝 Mérőállások: **347** (total readings)
- 💰 Befizetések: **4 520 000 Ft** (total payments, formatted Hungarian)
- ☑️ Nyitott todók: **5** (pending todos)

**Recent readings table** — last 10 readings:
| Ingatlan | Típus | Érték | Fogyasztás | Költség | Dátum |
| Sortable columns, hover highlight, utility type shown as colored badge |

**Property overview** — card grid (auto-fit, 300px min):
Each card:
- Property name + type badge (Lakás=indigo, Üzlet=amber, Egyéb=purple)
- Last villany reading: value + date
- Last víz reading: value + date
- Quick link to property details

---

#### Page 3.3: Properties (`/admin/properties`)

**Action bar:** "+ Új ingatlan" button (opens modal/slide-over panel)

**Property grid** — responsive cards:
Each property card (large, detailed):
- **Name** as card title + type badge
- Info rows:
  - 📍 Cím (address)
  - 👤 Kapcsolattartó (contact name)
  - 📞 Telefon
  - 📧 Email
  - 💰 Havi bérleti díj: 150 000 Ft
  - 🏷️ Vételár: 18 000 000 Ft
  - 📋 Tarifa csoport: Lakás
  - 📝 Megjegyzés
- Action buttons: "Szerkesztés" (Edit) + "Törlés" (Delete, with confirmation)

**Add/Edit modal:**
- Form fields (2-column grid on desktop):
  - Név (name) — required
  - Típus (type) — dropdown: Lakás / Üzlet / Egyéb
  - PIN kód — required (4-6 digit)
  - Tarifa csoport — dropdown
  - Kapcsolattartó neve
  - Telefon
  - Email
  - Cím (address)
  - Havi bérleti díj (Ft)
  - Vételár (Ft)
  - Megjegyzés (textarea)
- "Mentés" (Save) + "Mégse" (Cancel) buttons

---

#### Page 3.4: Readings (`/admin/readings`)

**Filter bar:**
- Property dropdown filter
- Utility type filter (Összes / Villany / Víz / Csatorna)

**Data table** — full width, responsive (horizontal scroll on mobile):
| Ingatlan | Típus | Mérőállás | Előző | Fogyasztás | Költség (Ft) | Dátum | Fotó |
- Utility type: colored badge
- Photo: thumbnail click → lightbox
- Sortable columns
- Pagination or infinite scroll

---

#### Page 3.5: Payments (`/admin/payments`)

**Action bar:** "+ Új befizetés" button

**Filter:** Property dropdown

**Payment cards or table:**
Each entry:
- Property name
- Amount: **85 000 Ft** (large, green)
- Date + payment method
- Period: "2025.01 – 2025.01"
- Notes

**Add payment modal:**
- Ingatlan (property dropdown)
- Összeg Ft (amount)
- Dátum (date)
- Fizetési mód (method): Készpénz / Átutalás / Egyéb
- Időszak: tól–ig (period from/to)
- Megjegyzés (notes)

---

#### Page 3.6: Maintenance (`/admin/maintenance`)

**Action bar:** "+ Új bejegyzés" button

**Maintenance log cards:**
- Property name (or "Általános" if no property)
- Description
- Category badge (Villanyszerelés / Vízszerelés / Festés / Egyéb)
- Cost: 45 000 Ft
- Performed by: "Kovács János"
- Date

**Add modal fields:**
- Ingatlan (dropdown, optional)
- Leírás (description, textarea)
- Kategória (dropdown)
- Költség Ft
- Ki végezte (performed by)
- Dátum

---

#### Page 3.7: Todos (`/admin/todos`)

**Action bar:** "+ Új feladat" button

**Todo list** — Kanban-style or list view:
- Columns/sections: Függőben (Pending) | Folyamatban (In Progress) | Kész (Done)

Each todo card:
- Title (large)
- Description (smaller, truncated)
- Priority badge: 🟢 Alacsony / 🟡 Közepes / 🔴 Magas
- Property badge (if linked to a property)
- Due date
- Status toggle button (click to cycle: pending → in_progress → done)
- Delete button (with confirmation)

**Add modal fields:**
- Cím (title)
- Leírás (description)
- Prioritás (priority dropdown)
- Ingatlan (optional dropdown)
- Határidő (due date)

---

#### Page 3.8: Tariffs (`/admin/tariffs`)

**Display tariff groups** as cards:
Each group card (e.g., "Lakás", "Üzleti"):
- Group name + description
- Table of tariffs inside:
  | Típus | Díj | Egység | Érvényes: |
  | ⚡ Villany | 212 Ft | kWh | 2024.01.01-től |
  | 💧 Víz | 758,19 Ft | m³ | 2024.01.01-től |
  | 🚰 Csatorna | 1 160,78 Ft | m³ | 2024.01.01-től |

**"+ Új tarifa" button** → modal:
- Tarifa csoport (group dropdown)
- Közüzem típus (Villany / Víz / Csatorna)
- Díj Ft (rate)
- Egység (kWh / m³)
- Érvényes dátumtól (valid from date)

---

#### Page 3.9: ROI Calculator (`/admin/roi`)

**Only shows properties that have `purchase_price` and `monthly_rent` set.**

**ROI card per property:**
- Property name + type badge
- Key metrics:
  - 🏷️ Vételár: 18 000 000 Ft
  - 💰 Havi bérleti díj: 150 000 Ft
  - 🔧 Összes karbantartás: 450 000 Ft
  - 📊 Éves hozam: 8.3%
  - ⏱️ Megtérülés: 12.5 év
  - 📅 Break-even dátum: 2037. július
- **Break-even line chart** — X: months, Y: cumulative income vs purchase price
  - Green line: cumulative rental income
  - Red horizontal line: purchase price + maintenance costs
  - Intersection point highlighted

---

#### Page 3.10: System (`/admin/system`)

**Current version card:**
- Version badge: "v1.0.0"
- Git branch + commit hash
- Last commit message + date

**Update status card:**
- If up to date: green "✅ Naprakész" badge
- If update available: amber "3 új commit!" pulsing badge
  - Show new commit list
  - Two action buttons:
    - "📥 Git Pull (csak kód)" — secondary button
    - "🚀 Frissítés + Újraindítás" — primary button with confirm dialog

**Auto-update info card:**
- Cron schedule display
- Instructions text

---

#### Page 3.11: Settings (`/admin/settings`)

**Password change card:**
- Current password
- New password
- Confirm new password
- "Jelszó módosítása" button

**Theme toggle:**
- Light / Dark / Auto (system) — segmented control

---

## Data Model Reference (for generating mock data)

```
Property {
  name: "1. Lakás", type: "lakas"|"uzlet"|"egyeb",
  contact_name, contact_phone, contact_email, address, notes,
  purchase_price (Ft), monthly_rent (Ft/month)
}

MeterReading {
  property_id, utility_type: "villany"|"viz"|"csatorna",
  value (float), prev_value (float), consumption (auto),
  cost_huf (auto), photo_filename, reading_date, notes
}

Payment {
  property_id, amount_huf, payment_date, payment_method,
  period_from, period_to, notes
}

MaintenanceLog {
  property_id (optional), description, category, cost_huf,
  performed_by, performed_date
}

Todo {
  property_id (optional), title, description,
  priority: "low"|"medium"|"high",
  status: "pending"|"in_progress"|"done",
  due_date
}

Tariff {
  tariff_group_id, utility_type, rate_huf, unit: "kWh"|"m3",
  valid_from (date)
}
```

---

## API Endpoints (for connecting to existing backend)

### Tenant
- `POST /login` — form: property_id + pin
- `GET /logout`
- `GET /dashboard` — returns rendered page with property data
- `POST /reading` — form: utility_type, value, reading_date, photo, notes
- `GET /history?type=all|villany|viz|csatorna`
- `GET /api/chart-data?type=villany&limit=24` — JSON: {labels, values, consumption, costs}

### Admin
- `POST /admin/login` — form: username + password
- `GET /admin/` — dashboard
- `GET /admin/properties` + `POST /admin/properties/add` + `POST /admin/properties/<id>/edit` + `POST /admin/properties/<id>/delete`
- `GET /admin/readings?property_id=&utility_type=`
- `GET /admin/payments` + `POST /admin/payments/add`
- `GET /admin/maintenance` + `POST /admin/maintenance/add`
- `GET /admin/todos` + `POST /admin/todos/add` + `POST /admin/todos/<id>/toggle` + `POST /admin/todos/<id>/delete`
- `GET /admin/tariffs` + `POST /admin/tariffs/add`
- `GET /admin/roi`
- `GET /admin/system` + `POST /admin/system/pull` + `POST /admin/system/rebuild`
- `GET /admin/api/update-status` — JSON: {has_update, behind, remote_hash}
- `GET /admin/settings` + `POST /admin/settings/change-password`
- `GET /api/health` — JSON: {status, database, version}

---

## Key UX Requirements

1. **Number formatting:** Always use Hungarian format (space as thousands separator, comma as decimal): `30 104 Ft`, `5 231,0 kWh`
2. **Automatic sewer:** When water reading is submitted, sewer (csatorna) reading is auto-created from the same consumption value
3. **Photo support:** Meter reading photos, camera capture on mobile, preview before submit, lightbox view in history/admin
4. **PWA:** Add to homescreen support (manifest.json), works offline for viewing cached data
5. **Responsive breakpoints:** 375px (phone) → 768px (tablet) → 1024px (small desktop) → 1280px+ (desktop)
6. **Toast notifications:** Success/error/info toasts (auto-dismiss after 5s, swipeable on mobile)
7. **Loading states:** Skeleton screens for initial loads, spinner for form submissions
8. **Empty states:** Friendly illustration + text when no data (e.g., "Még nincs mérőállás rögzítve")
9. **Confirmation dialogs:** For all destructive actions (delete property, delete todo)
10. **Accessibility:** Proper contrast ratios in both themes, keyboard navigation, ARIA labels

---

## Typography

- Headings: **Inter** or **Plus Jakarta Sans** (bold, clean)
- Body: **Inter** (regular)
- Monospace (for values, codes): **JetBrains Mono** or **Fira Code**
- Scale: 14px base, 16px on desktop

---

## Mock Data for Preview

Use this sample data to populate the UI preview:

**Properties:** "1. Lakás" (Lakás), "2. Lakás" (Lakás), "3. Lakás" (Lakás), "Földszinti Üzlet" (Üzlet), "Tetőtéri Garzon" (Lakás)

**Recent readings:**
- 1. Lakás — Villany: 5231.0 kWh (fogyasztás: 142.0, költség: 30 104 Ft)
- 1. Lakás — Víz: 269.4 m³ (fogyasztás: 3.2, költség: 2 426 Ft)
- 2. Lakás — Villany: 3847.0 kWh (fogyasztás: 98.0, költség: 20 776 Ft)

**Tariffs:**
- Villany: 212 Ft/kWh
- Víz: 758,19 Ft/m³
- Csatorna: 1 160,78 Ft/m³

---

## Summary

This is a premium, card-based, dark/light mode utility tracking app with two distinct user interfaces: a mobile-native-feeling tenant app and a powerful desktop admin dashboard. The landing page should have marketing appeal with two prominent entry cards. Every page should feel spacious, modern, and fast — no clutter, no 2010s Bootstrap vibes. Think: **Stripe Dashboard** meets **Apple Health** meets **Hungarian property management**.
