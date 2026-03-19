import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const securityAlertsTable = pgTable("security_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  ownerid: text("ownerid").notNull(),
  appId: text("app_id").notNull(),
  licenseKey: text("license_key"),
  hwid: text("hwid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSecurityAlertSchema = createInsertSchema(securityAlertsTable).omit({ id: true, createdAt: true });
export type InsertSecurityAlert = z.infer<typeof insertSecurityAlertSchema>;
export type SecurityAlert = typeof securityAlertsTable.$inferSelect;
