import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appsTable = pgTable("apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: text("app_id").notNull().unique(),
  name: text("name").notNull(),
  userId: uuid("user_id").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAppSchema = createInsertSchema(appsTable).omit({ id: true, createdAt: true });
export type InsertApp = z.infer<typeof insertAppSchema>;
export type App = typeof appsTable.$inferSelect;
