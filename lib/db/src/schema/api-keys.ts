import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull(),
  provider: text("provider"),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  validationStatus: text("validation_status"),
  validationMessage: text("validation_message"),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;
