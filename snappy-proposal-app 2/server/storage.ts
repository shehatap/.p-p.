import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { proposals, type Proposal, type InsertProposal } from "@shared/schema";
import { eq } from "drizzle-orm";

const sqlite = new Database("proposals.db");
export const db = drizzle(sqlite);

// Create table if it doesn't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_address TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    estimate_number TEXT NOT NULL,
    estimate_total TEXT NOT NULL,
    subtotal TEXT NOT NULL,
    tax TEXT NOT NULL,
    payment_schedule TEXT NOT NULL,
    scope_items TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    pdf_path TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL
  )
`);

export interface IStorage {
  createProposal(data: InsertProposal & { id: string; createdAt: number }): Proposal;
  getProposal(id: string): Proposal | undefined;
  updateProposalStatus(id: string, status: string, pdfPath?: string, errorMessage?: string): void;
  listProposals(): Proposal[];
}

export const storage: IStorage = {
  createProposal(data) {
    return db.insert(proposals).values(data).returning().get();
  },
  getProposal(id) {
    return db.select().from(proposals).where(eq(proposals.id, id)).get();
  },
  updateProposalStatus(id, status, pdfPath?, errorMessage?) {
    db.update(proposals)
      .set({ status, pdfPath: pdfPath ?? null, errorMessage: errorMessage ?? null })
      .where(eq(proposals.id, id))
      .run();
  },
  listProposals() {
    return db.select().from(proposals).all().sort((a, b) => b.createdAt - a.createdAt);
  },
};
