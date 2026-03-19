import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appLicensesTable = pgTable("app_licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseKey: text("license_key").notNull().unique(),
  appId: text("app_id").notNull(),
  appRecordId: uuid("app_record_id").notNull(),
  duration: text("duration").notNull(),
  username: text("username"),
  hwid: text("hwid"),
  ownerId: text("owner_id").notNull(),
  banned: boolean("banned").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAppLicenseSchema = createInsertSchema(appLicensesTable).omit({ id: true, createdAt: true });
export type InsertAppLicense = z.infer<typeof insertAppLicenseSchema>;
export type AppLicense = typeof appLicensesTable.$inferSelect;
