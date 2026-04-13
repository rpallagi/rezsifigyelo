import {
  index,
  json,
  pgEnum,
  pgTableCreator,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const createTable = pgTableCreator((name) => `rezsi_${name}`);

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("rezsi_user_role", [
  "landlord",
  "tenant",
  "admin",
]);

export const subscriptionStatusEnum = pgEnum("rezsi_subscription_status", [
  "active",
  "canceled",
  "incomplete",
  "past_due",
  "trialing",
  "unpaid",
  "paused",
]);

export const propertyTypeEnum = pgEnum("rezsi_property_type", [
  "lakas",
  "uzlet",
  "telek",
  "egyeb",
]);

export const utilityTypeEnum = pgEnum("rezsi_utility_type", [
  "villany",
  "viz",
  "gaz",
  "csatorna",
  "internet",
  "kozos_koltseg",
  "egyeb",
]);

export const invoiceStatusEnum = pgEnum("rezsi_invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
]);

export const tenantInvitationStatusEnum = pgEnum(
  "rezsi_tenant_invitation_status",
  ["pending", "accepted", "revoked", "expired"],
);

export const paymentMethodEnum = pgEnum("rezsi_payment_method", [
  "stripe",
  "cash",
  "transfer",
]);

export const invoiceBuyerTypeEnum = pgEnum("rezsi_invoice_buyer_type", [
  "individual",
  "company",
]);

export const billingModeEnum = pgEnum("rezsi_billing_mode", [
  "advance",
  "arrears",
]);

export const landlordProfileTypeEnum = pgEnum("rezsi_landlord_profile_type", [
  "individual",
  "company",
  "co_ownership",
]);

export const readingSourceEnum = pgEnum("rezsi_reading_source", [
  "manual",
  "tenant",
  "smart_ttn",
  "smart_mqtt",
  "home_assistant",
]);

export const todoStatusEnum = pgEnum("rezsi_todo_status", [
  "pending",
  "in_progress",
  "done",
]);

export const todoPriorityEnum = pgEnum("rezsi_todo_priority", [
  "low",
  "medium",
  "high",
]);

export const documentCategoryEnum = pgEnum("rezsi_document_category", [
  "atadas_atvetel",
  "szerzodes",
  "marketing",
  "egyeb",
]);

export const smartMeterSourceEnum = pgEnum("rezsi_smart_meter_source", [
  "ttn",
  "mqtt",
  "home_assistant",
  "shelly_cloud",
  "homewizard",
]);

export const taxModeEnum = pgEnum("rezsi_tax_mode", [
  "maganszemely_10pct",
  "maganszemely_teteles",
  "egyeni_vallalkozo_atalany",
  "egyeni_vallalkozo_vszja",
]);

export const checklistTypeEnum = pgEnum("rezsi_checklist_type", [
  "move_in",
  "move_out",
]);

export const ocrProviderEnum = pgEnum("rezsi_ocr_provider", [
  "claude",
  "openai",
  "gemini",
  "tesseract",
]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = createTable(
  "user",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    clerkId: d.varchar({ length: 256 }).notNull(),
    email: d.varchar({ length: 256 }).notNull(),
    firstName: d.varchar({ length: 256 }),
    lastName: d.varchar({ length: 256 }),
    phone: d.varchar({ length: 30 }),
    imageUrl: d.text(),
    role: userRoleEnum().notNull().default("landlord"),
    locale: d.varchar({ length: 5 }).notNull().default("hu"),
    theme: d.varchar({ length: 10 }).notNull().default("system"),
    isActive: d.boolean().notNull().default(true),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("user_clerk_id_idx").on(t.clerkId),
    index("user_email_idx").on(t.email),
  ],
);

// ---------------------------------------------------------------------------
// Subscriptions (landlord pays for app access)
// ---------------------------------------------------------------------------

export const subscriptions = createTable(
  "subscription",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: d.varchar({ length: 256 }).notNull(),
    stripeSubscriptionId: d.varchar({ length: 256 }).notNull(),
    stripePriceId: d.varchar({ length: 256 }),
    status: subscriptionStatusEnum().notNull().default("incomplete"),
    currentPeriodStart: d.timestamp({ withTimezone: true }),
    currentPeriodEnd: d.timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("subscription_stripe_customer_id_idx").on(t.stripeCustomerId),
    uniqueIndex("subscription_stripe_subscription_id_idx").on(
      t.stripeSubscriptionId,
    ),
    index("subscription_user_id_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Tariff Groups
// ---------------------------------------------------------------------------

export const tariffGroups = createTable(
  "tariff_group",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    landlordId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: d.varchar({ length: 100 }).notNull(),
    description: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("tariff_group_landlord_id_idx").on(t.landlordId)],
);

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export const properties = createTable(
  "property",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    landlordId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buildingPropertyId: d.integer(), // self-reference: lakás -> épület
    tariffGroupId: d
      .integer()
      .references(() => tariffGroups.id, { onDelete: "set null" }),
    collectorId: d
      .integer()
      .references(() => users.id, { onDelete: "set null" }),
    landlordProfileId: d
      .integer()
      .references(() => landlordProfiles.id, { onDelete: "set null" }),
    name: d.varchar({ length: 100 }).notNull(),
    propertyType: d.varchar({ length: 50 }).notNull().default("lakas"),
    address: d.text(),
    notes: d.text(),
    contactName: d.varchar({ length: 100 }),
    contactPhone: d.varchar({ length: 30 }),
    contactEmail: d.varchar({ length: 120 }),
    billingName: d.varchar({ length: 255 }),
    billingEmail: d.varchar({ length: 255 }),
    billingAddress: d.text(),
    billingTaxNumber: d.varchar({ length: 50 }),
    billingBuyerType: invoiceBuyerTypeEnum().notNull().default("individual"),
    billingVatCode: d.varchar({ length: 20 }).notNull().default("TAM"),
    billingMode: billingModeEnum().notNull().default("advance"),
    billingDueDay: d.integer().notNull().default(5),
    // Auto-billing
    autoBilling: d.boolean().notNull().default(false),
    autoBillingDay: d.integer().notNull().default(1),
    autoBillingMissingReadings: d.varchar({ length: 20 }).notNull().default("skip_readings"),
    // Area (m²)
    buildingArea: d.doublePrecision(),
    landArea: d.doublePrecision(),
    // ROI
    purchasePrice: d.doublePrecision(),
    monthlyRent: d.doublePrecision(),
    rentCurrency: d.varchar({ length: 3 }).notNull().default("HUF"),
    // Avatar
    avatarUrl: d.text(),
    archived: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("property_landlord_id_idx").on(t.landlordId),
    index("property_building_id_idx").on(t.buildingPropertyId),
  ],
);

export const landlordProfiles = createTable(
  "landlord_profile",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    ownerUserId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: d.varchar({ length: 255 }).notNull(),
    profileType: landlordProfileTypeEnum().notNull().default("individual"),
    billingName: d.varchar({ length: 255 }).notNull(),
    billingEmail: d.varchar({ length: 255 }),
    billingAddress: d.text(),
    taxNumber: d.varchar({ length: 50 }),
    color: d.varchar({ length: 20 }),
    agentKey: d.text(),
    eInvoice: d.boolean().notNull().default(true),
    defaultDueDays: d.integer().notNull().default(5),
    defaultVatCode: d.varchar({ length: 20 }).notNull().default("TAM"),
    isDefault: d.boolean().notNull().default(false),
    isActive: d.boolean().notNull().default(true),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("landlord_profile_owner_user_id_idx").on(t.ownerUserId),
    index("landlord_profile_default_idx").on(t.ownerUserId, t.isDefault),
  ],
);

// ---------------------------------------------------------------------------
// Tenancies (bérlő <-> ingatlan kapcsolat)
// ---------------------------------------------------------------------------

export const tenancies = createTable(
  "tenancy",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    tenantId: d.integer().references(() => users.id, { onDelete: "set null" }),
    tenantName: d.varchar({ length: 200 }),
    tenantEmail: d.varchar({ length: 255 }),
    tenantPhone: d.varchar({ length: 50 }),
    moveInDate: d.date(),
    moveOutDate: d.date(),
    leaseMonths: d.integer(),
    leaseEndDate: d.date(),
    leaseRenewalNotified: d.boolean().notNull().default(false),
    depositAmount: d.doublePrecision(),
    active: d.boolean().notNull().default(true),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("tenancy_property_id_idx").on(t.propertyId),
    index("tenancy_tenant_id_idx").on(t.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Tenant History (archivált bérlők)
// ---------------------------------------------------------------------------

export const tenantHistory = createTable(
  "tenant_history",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    tenantId: d.integer().references(() => users.id, { onDelete: "set null" }),
    tenantName: d.varchar({ length: 100 }),
    tenantEmail: d.varchar({ length: 255 }),
    moveInDate: d.date(),
    moveOutDate: d.date(),
    depositAmount: d.doublePrecision(),
    depositReturned: d.doublePrecision(),
    depositDeductions: d.doublePrecision(),
    depositNotes: d.text(),
    totalPayments: d.doublePrecision(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("tenant_history_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// Tenant Invitations (meghivasos onboarding)
// ---------------------------------------------------------------------------

export const tenantInvitations = createTable(
  "tenant_invitation",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    landlordId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    tenantEmail: d.varchar({ length: 255 }).notNull(),
    tenantName: d.varchar({ length: 255 }),
    moveInDate: d.date(),
    depositAmount: d.doublePrecision(),
    clerkInvitationId: d.varchar({ length: 255 }),
    invitedUserId: d.integer().references(() => users.id, {
      onDelete: "set null",
    }),
    status: tenantInvitationStatusEnum().notNull().default("pending"),
    invitedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    acceptedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("tenant_invitation_landlord_id_idx").on(t.landlordId),
    index("tenant_invitation_property_id_idx").on(t.propertyId),
    index("tenant_invitation_email_idx").on(t.tenantEmail),
  ],
);

// ---------------------------------------------------------------------------
// Tariffs (díjszabás)
// ---------------------------------------------------------------------------

export const tariffs = createTable(
  "tariff",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    tariffGroupId: d
      .integer()
      .notNull()
      .references(() => tariffGroups.id, { onDelete: "cascade" }),
    utilityType: utilityTypeEnum().notNull(),
    rateHuf: d.doublePrecision().notNull(),
    unit: d.varchar({ length: 10 }).notNull(), // kWh, m3, GJ
    validFrom: d.date().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("tariff_group_id_idx").on(t.tariffGroupId)],
);

// ---------------------------------------------------------------------------
// Meter Info (mérőóra gyári szám, helyszín)
// ---------------------------------------------------------------------------

export const meterInfo = createTable(
  "meter_info",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    utilityType: utilityTypeEnum().notNull(),
    serialNumber: d.varchar({ length: 100 }),
    location: d.varchar({ length: 200 }),
    notes: d.text(),
    photoUrls: d.jsonb().$type<string[]>(),
    // Optional per-meter tariff group override (falls back to property's tariff group)
    tariffGroupId: d.integer().references(() => tariffGroups.id, { onDelete: "set null" }),
    // Virtual meter support: calculate consumption from other meters
    meterType: d.varchar({ length: 20 }).notNull().default("physical"), // 'physical' | 'virtual'
    formulaType: d.varchar({ length: 50 }), // 'subtraction' (main - sub)
    primaryMeterId: d.integer(), // FK to meterInfo.id — the main meter to read from
    subtractMeterIds: d.jsonb().$type<number[]>(), // array of meterInfo.id to subtract
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("meter_info_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// Meter Readings (mérőállások)
// ---------------------------------------------------------------------------

export const meterReadings = createTable(
  "meter_reading",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    utilityType: utilityTypeEnum().notNull(),
    meterInfoId: d.integer().references(() => meterInfo.id, { onDelete: "set null" }),
    value: d.doublePrecision().notNull(),
    prevValue: d.doublePrecision(),
    consumption: d.doublePrecision(),
    tariffId: d.integer().references(() => tariffs.id, { onDelete: "set null" }),
    costHuf: d.doublePrecision(),
    photoUrl: d.text(),
    photoUrls: d.jsonb().$type<string[]>(),
    readingDate: d.date().notNull(),
    notes: d.text(),
    source: readingSourceEnum().notNull().default("manual"),
    recordedBy: d.integer().references(() => users.id, { onDelete: "set null" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("meter_reading_property_id_idx").on(t.propertyId),
    index("meter_reading_date_idx").on(t.readingDate),
    index("meter_reading_utility_idx").on(t.propertyId, t.utilityType),
    index("meter_reading_meter_info_idx").on(t.meterInfoId, t.readingDate),
  ],
);

// ---------------------------------------------------------------------------
// Payments (befizetések)
// ---------------------------------------------------------------------------

export const payments = createTable(
  "payment",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    amountHuf: d.doublePrecision().notNull(),
    paymentDate: d.date().notNull(),
    paymentMethod: d.varchar({ length: 50 }),
    category: d.varchar({ length: 30 }),
    periodFrom: d.date(),
    periodTo: d.date(),
    notes: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("payment_property_id_idx").on(t.propertyId),
    index("payment_date_idx").on(t.paymentDate),
  ],
);

// ---------------------------------------------------------------------------
// Invoices (szamlazz.hu sync + local records)
// ---------------------------------------------------------------------------

export const invoices = createTable(
  "invoice",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    landlordId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    sellerProfileId: d.integer().references(() => landlordProfiles.id, {
      onDelete: "set null",
    }),
    tenantId: d.integer().references(() => users.id, { onDelete: "set null" }),
    status: invoiceStatusEnum().notNull().default("draft"),
    issueDate: d.date().notNull(),
    dueDate: d.date(),
    fulfillmentDate: d.date(),
    periodFrom: d.date(),
    periodTo: d.date(),
    currency: d.varchar({ length: 3 }).notNull().default("HUF"),
    paymentMethod: paymentMethodEnum().notNull().default("transfer"),
    invoiceNumber: d.varchar({ length: 100 }),
    provider: d.varchar({ length: 50 }).notNull().default("szamlazz_hu"),
    providerInvoiceId: d.varchar({ length: 255 }),
    pdfUrl: d.text(),
    sellerDisplayName: d.varchar({ length: 255 }),
    sellerName: d.varchar({ length: 255 }),
    sellerEmail: d.varchar({ length: 255 }),
    sellerAddress: d.text(),
    sellerTaxNumber: d.varchar({ length: 50 }),
    sellerProfileType: landlordProfileTypeEnum().default("individual"),
    buyerName: d.varchar({ length: 255 }).notNull(),
    buyerEmail: d.varchar({ length: 255 }),
    buyerAddress: d.text(),
    buyerTaxNumber: d.varchar({ length: 50 }),
    buyerType: invoiceBuyerTypeEnum().notNull().default("individual"),
    vatCode: d.varchar({ length: 20 }).notNull().default("TAM"),
    note: d.text(),
    netTotalHuf: d.doublePrecision().notNull().default(0),
    vatTotalHuf: d.doublePrecision().notNull().default(0),
    grossTotalHuf: d.doublePrecision().notNull().default(0),
    emailedToBuyer: d.boolean().notNull().default(false),
    reminderSentAt: d.timestamp({ withTimezone: true }),
    paidAt: d.timestamp({ withTimezone: true }),
    paidAmount: d.doublePrecision(),
    paidMethod: d.varchar({ length: 50 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("invoice_landlord_id_idx").on(t.landlordId),
    index("invoice_property_id_idx").on(t.propertyId),
    index("invoice_status_idx").on(t.status),
    uniqueIndex("invoice_provider_invoice_id_idx").on(t.providerInvoiceId),
  ],
);

export const invoiceItems = createTable(
  "invoice_item",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    invoiceId: d
      .integer()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: d.varchar({ length: 255 }).notNull(),
    quantity: d.doublePrecision().notNull().default(1),
    unit: d.varchar({ length: 20 }).notNull().default("db"),
    unitPriceHuf: d.doublePrecision().notNull(),
    netAmountHuf: d.doublePrecision().notNull().default(0),
    vatRate: d.doublePrecision().notNull().default(0),
    vatCode: d.varchar({ length: 20 }).notNull().default("TAM"),
    vatAmountHuf: d.doublePrecision().notNull().default(0),
    grossAmountHuf: d.doublePrecision().notNull().default(0),
    utilityType: utilityTypeEnum(),
    sourceType: d.varchar({ length: 50 }),
    sourceId: d.integer(),
    sortOrder: d.integer().notNull().default(0),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("invoice_item_invoice_id_idx").on(t.invoiceId)],
);

// ---------------------------------------------------------------------------
// Maintenance Logs (karbantartás)
// ---------------------------------------------------------------------------

export const maintenanceLogs = createTable(
  "maintenance_log",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d.integer().references(() => properties.id, {
      onDelete: "cascade",
    }),
    description: d.text().notNull(),
    category: d.varchar({ length: 50 }),
    costHuf: d.doublePrecision().default(0),
    priority: d.varchar({ length: 20 }).notNull().default("normal"),
    status: d.varchar({ length: 20 }).notNull().default("pending"),
    performedBy: d.varchar({ length: 100 }),
    performedDate: d.date(),
    photoUrls: json().$type<string[]>().default([]),
    documentUrls: json().$type<string[]>().default([]),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("maintenance_log_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// Todos (feladatok)
// ---------------------------------------------------------------------------

export const todos = createTable(
  "todo",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d.integer().references(() => properties.id, {
      onDelete: "cascade",
    }),
    landlordId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 200 }).notNull(),
    description: d.text(),
    priority: todoPriorityEnum().notNull().default("medium"),
    status: todoStatusEnum().notNull().default("pending"),
    dueDate: d.date(),
    completedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("todo_property_id_idx").on(t.propertyId),
    index("todo_landlord_id_idx").on(t.landlordId),
  ],
);

// ---------------------------------------------------------------------------
// Documents (dokumentumok)
// ---------------------------------------------------------------------------

export const documents = createTable(
  "document",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    filename: d.varchar({ length: 255 }).notNull(),
    storedUrl: d.text().notNull(), // Vercel Blob URL
    category: documentCategoryEnum().notNull().default("egyeb"),
    notes: d.text(),
    fileSize: d.integer(),
    mimeType: d.varchar({ length: 100 }),
    uploadedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("document_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// Marketing Content (hirdetés szöveg)
// ---------------------------------------------------------------------------

export const marketingContent = createTable(
  "marketing_content",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    listingTitle: d.varchar({ length: 200 }),
    listingDescription: d.text(),
    listingUrl: d.varchar({ length: 500 }),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("marketing_content_property_id_idx").on(t.propertyId),
  ],
);

// ---------------------------------------------------------------------------
// Property Tax (ingatlanadó)
// ---------------------------------------------------------------------------

export const propertyTaxes = createTable(
  "property_tax",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    year: d.integer().notNull(),
    bankAccount: d.varchar({ length: 50 }),
    recipient: d.varchar({ length: 200 }),
    annualAmount: d.doublePrecision().notNull(),
    installmentAmount: d.doublePrecision(),
    paymentMemo: d.varchar({ length: 200 }),
    deadlineAutumn: d.date(),
    deadlineSpring: d.date(),
    autumnPaid: d.boolean().notNull().default(false),
    autumnPaidDate: d.date(),
    springPaid: d.boolean().notNull().default(false),
    springPaidDate: d.date(),
    documentId: d.integer().references(() => documents.id, {
      onDelete: "set null",
    }),
    includeInRoi: d.boolean().notNull().default(true),
    notes: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("property_tax_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// Common Fees (közös költség)
// ---------------------------------------------------------------------------

export const commonFees = createTable(
  "common_fee",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    bankAccount: d.varchar({ length: 50 }),
    recipient: d.varchar({ length: 200 }),
    monthlyAmount: d.doublePrecision().notNull(),
    paymentMemo: d.varchar({ length: 200 }),
    frequency: d.varchar({ length: 20 }).notNull().default("monthly"),
    paymentDay: d.integer(),
    documentId: d.integer().references(() => documents.id, {
      onDelete: "set null",
    }),
    includeInRoi: d.boolean().notNull().default(true),
    isActive: d.boolean().notNull().default(true),
    validFrom: d.date(),
    validTo: d.date(),
    notes: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("common_fee_property_id_idx").on(t.propertyId)],
);

export const commonFeePayments = createTable(
  "common_fee_payment",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    commonFeeId: d
      .integer()
      .notNull()
      .references(() => commonFees.id, { onDelete: "cascade" }),
    periodDate: d.date().notNull(),
    paid: d.boolean().notNull().default(false),
    paidDate: d.date(),
    amount: d.doublePrecision(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("common_fee_payment_fee_id_idx").on(t.commonFeeId)],
);

// ---------------------------------------------------------------------------
// Rental Tax Config (bérleti jövedelem adózás)
// ---------------------------------------------------------------------------

export const rentalTaxConfigs = createTable(
  "rental_tax_config",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    taxMode: taxModeEnum().notNull().default("maganszemely_10pct"),
    isVatRegistered: d.boolean().notNull().default(false),
    vatRate: d.doublePrecision(),
    notes: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("rental_tax_config_property_id_idx").on(t.propertyId),
  ],
);

// ---------------------------------------------------------------------------
// Handover Checklist (átadás-átvétel)
// ---------------------------------------------------------------------------

export const handoverChecklists = createTable(
  "handover_checklist",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    tenantId: d.integer().references(() => users.id, { onDelete: "set null" }),
    checklistType: checklistTypeEnum().notNull(),
    step: d.varchar({ length: 50 }).notNull(),
    status: d.varchar({ length: 20 }).notNull().default("pending"),
    dataJson: json(),
    completedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("handover_checklist_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// Chat Messages (bérlő <-> bérbeadó)
// ---------------------------------------------------------------------------

export const chatMessages = createTable(
  "chat_message",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    senderId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderType: d.varchar({ length: 10 }).notNull(), // 'admin' / 'tenant'
    message: d.text().notNull(),
    attachmentUrl: d.text(),
    attachmentType: d.varchar({ length: 20 }),
    attachmentName: d.varchar({ length: 255 }),
    isRead: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("chat_message_property_id_idx").on(t.propertyId),
    index("chat_message_sender_id_idx").on(t.senderId),
  ],
);

// ---------------------------------------------------------------------------
// Smart Meter Devices (okos mérő integráció)
// ---------------------------------------------------------------------------

export const smartMeterDevices = createTable(
  "smart_meter_device",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    utilityType: utilityTypeEnum().notNull(),
    deviceId: d.varchar({ length: 200 }).notNull(),
    source: smartMeterSourceEnum().notNull().default("mqtt"),
    name: d.varchar({ length: 200 }),
    // TTN
    ttnAppId: d.varchar({ length: 200 }),
    // MQTT
    mqttTopic: d.varchar({ length: 500 }),
    // Shelly Cloud
    shellyDeviceId: d.varchar({ length: 200 }),
    shellyChannel: d.integer().default(0),
    shellyAuthKey: d.text(),
    shellyServer: d.varchar({ length: 100 }),
    shellyReversedPhases: d.varchar({ length: 10 }), // "A", "B", "C" or combo like "B,C"
    // Payload parsing
    valueField: d.varchar({ length: 100 }).notNull().default("meter_value"),
    multiplier: d.doublePrecision().notNull().default(1.0),
    offset: d.doublePrecision().notNull().default(0.0),
    deviceUnit: d.varchar({ length: 20 }),
    // State
    isActive: d.boolean().notNull().default(true),
    minIntervalMinutes: d.integer().notNull().default(60),
    lastSeenAt: d.timestamp({ withTimezone: true }),
    lastRawValue: d.doublePrecision(),
    lastError: d.text(),
    meterInfoId: d.integer().references(() => meterInfo.id, {
      onDelete: "set null",
    }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("smart_meter_device_id_idx").on(t.deviceId),
    index("smart_meter_property_id_idx").on(t.propertyId),
  ],
);

export const smartMeterLogs = createTable(
  "smart_meter_log",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    deviceId: d.varchar({ length: 200 }).notNull(),
    source: smartMeterSourceEnum().notNull(),
    rawPayload: d.text(),
    parsedValue: d.doublePrecision(),
    finalValue: d.doublePrecision(),
    status: d.varchar({ length: 20 }).notNull(), // ok / rejected / error
    errorMessage: d.text(),
    readingId: d.integer().references(() => meterReadings.id, {
      onDelete: "set null",
    }),
    receivedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("smart_meter_log_device_id_idx").on(t.deviceId)],
);

// ---------------------------------------------------------------------------
// WiFi Networks
// ---------------------------------------------------------------------------

export const wifiNetworks = createTable(
  "wifi_network",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    propertyId: d
      .integer()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    ssid: d.varchar({ length: 200 }).notNull(),
    password: d.varchar({ length: 200 }),
    securityType: d.varchar({ length: 20 }).notNull().default("WPA2"),
    location: d.varchar({ length: 200 }),
    isPrimary: d.boolean().notNull().default(false),
    routerIp: d.varchar({ length: 100 }),
    routerUser: d.varchar({ length: 100 }),
    routerPassword: d.varchar({ length: 200 }),
    tailscaleIp: d.varchar({ length: 100 }),
    tailscaleDns: d.varchar({ length: 200 }),
    notes: d.text(),
    photoUrls: d.jsonb().$type<string[]>(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("wifi_network_property_id_idx").on(t.propertyId)],
);

// ---------------------------------------------------------------------------
// App Settings (key-value config)
// ---------------------------------------------------------------------------

export const appSettings = createTable("app_setting", (d) => ({
  key: d.varchar({ length: 100 }).primaryKey(),
  value: d.text(),
}));

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  ownedProperties: many(properties, { relationName: "landlord" }),
  landlordProfiles: many(landlordProfiles),
  tenancies: many(tenancies),
  tenantInvitations: many(tenantInvitations, { relationName: "invitedTenant" }),
  sentTenantInvitations: many(tenantInvitations, { relationName: "landlordInviter" }),
  readings: many(meterReadings),
  todos: many(todos),
  sentChatMessages: many(chatMessages),
  invoices: many(invoices, { relationName: "landlordInvoices" }),
  tenantInvoices: many(invoices, { relationName: "tenantInvoices" }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const landlordProfilesRelations = relations(
  landlordProfiles,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [landlordProfiles.ownerUserId],
      references: [users.id],
    }),
    properties: many(properties),
    invoices: many(invoices),
  }),
);

export const tariffGroupsRelations = relations(
  tariffGroups,
  ({ one, many }) => ({
    landlord: one(users, {
      fields: [tariffGroups.landlordId],
      references: [users.id],
    }),
    tariffs: many(tariffs),
    properties: many(properties),
  }),
);

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(users, {
    fields: [properties.landlordId],
    references: [users.id],
    relationName: "landlord",
  }),
  landlordProfile: one(landlordProfiles, {
    fields: [properties.landlordProfileId],
    references: [landlordProfiles.id],
  }),
  building: one(properties, {
    fields: [properties.buildingPropertyId],
    references: [properties.id],
  }),
  tariffGroup: one(tariffGroups, {
    fields: [properties.tariffGroupId],
    references: [tariffGroups.id],
  }),
  collector: one(users, {
    fields: [properties.collectorId],
    references: [users.id],
  }),
  tenancies: many(tenancies),
  tenantHistory: many(tenantHistory),
  tenantInvitations: many(tenantInvitations),
  readings: many(meterReadings),
  payments: many(payments),
  invoices: many(invoices),
  maintenanceLogs: many(maintenanceLogs),
  todos: many(todos),
  documents: many(documents),
  meterInfo: many(meterInfo),
  smartMeters: many(smartMeterDevices),
  wifiNetworks: many(wifiNetworks),
  chatMessages: many(chatMessages),
  commonFees: many(commonFees),
  propertyTaxes: many(propertyTaxes),
  handoverChecklists: many(handoverChecklists),
}));

export const tenanciesRelations = relations(tenancies, ({ one }) => ({
  property: one(properties, {
    fields: [tenancies.propertyId],
    references: [properties.id],
  }),
  tenant: one(users, {
    fields: [tenancies.tenantId],
    references: [users.id],
  }),
}));

export const tenantHistoryRelations = relations(tenantHistory, ({ one }) => ({
  property: one(properties, {
    fields: [tenantHistory.propertyId],
    references: [properties.id],
  }),
  tenant: one(users, {
    fields: [tenantHistory.tenantId],
    references: [users.id],
  }),
}));

export const tenantInvitationsRelations = relations(
  tenantInvitations,
  ({ one }) => ({
    landlord: one(users, {
      fields: [tenantInvitations.landlordId],
      references: [users.id],
      relationName: "landlordInviter",
    }),
    property: one(properties, {
      fields: [tenantInvitations.propertyId],
      references: [properties.id],
    }),
    invitedTenant: one(users, {
      fields: [tenantInvitations.invitedUserId],
      references: [users.id],
      relationName: "invitedTenant",
    }),
  }),
);

export const tariffsRelations = relations(tariffs, ({ one }) => ({
  tariffGroup: one(tariffGroups, {
    fields: [tariffs.tariffGroupId],
    references: [tariffGroups.id],
  }),
}));

export const meterInfoRelations = relations(meterInfo, ({ one }) => ({
  property: one(properties, {
    fields: [meterInfo.propertyId],
    references: [properties.id],
  }),
  tariffGroup: one(tariffGroups, {
    fields: [meterInfo.tariffGroupId],
    references: [tariffGroups.id],
  }),
  primaryMeter: one(meterInfo, {
    fields: [meterInfo.primaryMeterId],
    references: [meterInfo.id],
    relationName: "primaryMeter",
  }),
}));

export const meterReadingsRelations = relations(meterReadings, ({ one }) => ({
  property: one(properties, {
    fields: [meterReadings.propertyId],
    references: [properties.id],
  }),
  tariff: one(tariffs, {
    fields: [meterReadings.tariffId],
    references: [tariffs.id],
  }),
  recorder: one(users, {
    fields: [meterReadings.recordedBy],
    references: [users.id],
  }),
  meterInfo: one(meterInfo, {
    fields: [meterReadings.meterInfoId],
    references: [meterInfo.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  property: one(properties, {
    fields: [payments.propertyId],
    references: [properties.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  landlord: one(users, {
    fields: [invoices.landlordId],
    references: [users.id],
    relationName: "landlordInvoices",
  }),
  sellerProfile: one(landlordProfiles, {
    fields: [invoices.sellerProfileId],
    references: [landlordProfiles.id],
  }),
  property: one(properties, {
    fields: [invoices.propertyId],
    references: [properties.id],
  }),
  tenant: one(users, {
    fields: [invoices.tenantId],
    references: [users.id],
    relationName: "tenantInvoices",
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const maintenanceLogsRelations = relations(
  maintenanceLogs,
  ({ one }) => ({
    property: one(properties, {
      fields: [maintenanceLogs.propertyId],
      references: [properties.id],
    }),
  }),
);

export const todosRelations = relations(todos, ({ one }) => ({
  property: one(properties, {
    fields: [todos.propertyId],
    references: [properties.id],
  }),
  landlord: one(users, {
    fields: [todos.landlordId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  property: one(properties, {
    fields: [documents.propertyId],
    references: [properties.id],
  }),
}));

export const marketingContentRelations = relations(
  marketingContent,
  ({ one }) => ({
    property: one(properties, {
      fields: [marketingContent.propertyId],
      references: [properties.id],
    }),
  }),
);

export const propertyTaxesRelations = relations(propertyTaxes, ({ one }) => ({
  property: one(properties, {
    fields: [propertyTaxes.propertyId],
    references: [properties.id],
  }),
  document: one(documents, {
    fields: [propertyTaxes.documentId],
    references: [documents.id],
  }),
}));

export const commonFeesRelations = relations(commonFees, ({ one, many }) => ({
  property: one(properties, {
    fields: [commonFees.propertyId],
    references: [properties.id],
  }),
  paymentsTracking: many(commonFeePayments),
}));

export const commonFeePaymentsRelations = relations(
  commonFeePayments,
  ({ one }) => ({
    commonFee: one(commonFees, {
      fields: [commonFeePayments.commonFeeId],
      references: [commonFees.id],
    }),
  }),
);

export const rentalTaxConfigsRelations = relations(
  rentalTaxConfigs,
  ({ one }) => ({
    property: one(properties, {
      fields: [rentalTaxConfigs.propertyId],
      references: [properties.id],
    }),
  }),
);

export const handoverChecklistsRelations = relations(
  handoverChecklists,
  ({ one }) => ({
    property: one(properties, {
      fields: [handoverChecklists.propertyId],
      references: [properties.id],
    }),
    tenant: one(users, {
      fields: [handoverChecklists.tenantId],
      references: [users.id],
    }),
  }),
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  property: one(properties, {
    fields: [chatMessages.propertyId],
    references: [properties.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const smartMeterDevicesRelations = relations(
  smartMeterDevices,
  ({ one }) => ({
    property: one(properties, {
      fields: [smartMeterDevices.propertyId],
      references: [properties.id],
    }),
    meterInfoRef: one(meterInfo, {
      fields: [smartMeterDevices.meterInfoId],
      references: [meterInfo.id],
    }),
  }),
);

export const wifiNetworksRelations = relations(wifiNetworks, ({ one }) => ({
  property: one(properties, {
    fields: [wifiNetworks.propertyId],
    references: [properties.id],
  }),
}));
