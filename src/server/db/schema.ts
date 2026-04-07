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

export const paymentMethodEnum = pgEnum("rezsi_payment_method", [
  "stripe",
  "cash",
  "transfer",
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
    name: d.varchar({ length: 100 }).notNull(),
    propertyType: propertyTypeEnum().notNull().default("lakas"),
    address: d.text(),
    notes: d.text(),
    contactName: d.varchar({ length: 100 }),
    contactPhone: d.varchar({ length: 30 }),
    contactEmail: d.varchar({ length: 120 }),
    // ROI
    purchasePrice: d.doublePrecision(),
    monthlyRent: d.doublePrecision(),
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
    tenantId: d
      .integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moveInDate: d.date(),
    moveOutDate: d.date(),
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
    value: d.doublePrecision().notNull(),
    prevValue: d.doublePrecision(),
    consumption: d.doublePrecision(),
    tariffId: d.integer().references(() => tariffs.id, { onDelete: "set null" }),
    costHuf: d.doublePrecision(),
    photoUrl: d.text(),
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
    performedBy: d.varchar({ length: 100 }),
    performedDate: d.date(),
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
    notes: d.text(),
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
  tenancies: many(tenancies),
  readings: many(meterReadings),
  todos: many(todos),
  sentChatMessages: many(chatMessages),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

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
  readings: many(meterReadings),
  payments: many(payments),
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
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  property: one(properties, {
    fields: [payments.propertyId],
    references: [properties.id],
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
