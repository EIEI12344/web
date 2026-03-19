import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masterLicensesTable = pgTable("master_licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  used: boolean("used").notNull().default(false),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMasterLicenseSchema = createInsertSchema(masterLicensesTable).omit({ id: true, createdAt: true });
export type InsertMasterLicense = z.infer<typeof insertMasterLicenseSchema>;
export type MasterLicense = typeof masterLicensesTable.$inferSelect;
