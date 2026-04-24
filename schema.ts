import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientAddress: text("client_address").notNull(),
  clientPhone: text("client_phone").notNull(),
  estimateNumber: text("estimate_number").notNull(),
  estimateTotal: text("estimate_total").notNull(),
  subtotal: text("subtotal").notNull(),
  tax: text("tax").notNull(),
  paymentSchedule: text("payment_schedule").notNull(), // JSON
  scopeItems: text("scope_items").notNull(), // JSON
  status: text("status").notNull().default("pending"), // pending | generating | done | error
  pdfPath: text("pdf_path"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  status: true,
  pdfPath: true,
  errorMessage: true,
  createdAt: true,
});

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;
