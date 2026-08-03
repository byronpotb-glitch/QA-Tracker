import { and, eq, gt, ilike, or, type SQL } from "drizzle-orm";
import { tickets } from "@/db/schema";
import type { Company, IssueType, TicketStatus } from "@/lib/validations";

const COMPANIES: readonly Company[] = ["POTB", "GLADEX"];
const STATUSES: readonly TicketStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
];
const ISSUE_TYPES: readonly IssueType[] = [
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "CHANGE_REQUEST",
];

export interface TicketFilterParams {
  q?: string;
  company?: string;
  status?: string;
  system?: string;
  issue_type?: string;
  dev?: string;
  recurring?: string;
}

/**
 * Shared between the tickets list page and its CSV export action, so the
 * export always matches whatever filters are currently applied on screen.
 */
export function buildTicketWhereClause(
  params: TicketFilterParams,
  systems: string[]
): SQL | undefined {
  const filters = [];

  if (params.q && params.q.trim()) {
    const q = `%${params.q.trim()}%`;
    filters.push(
      or(
        ilike(tickets.title, q),
        ilike(tickets.system, q),
        ilike(tickets.module, q),
        ilike(tickets.tester, q),
        ilike(tickets.dev, q)
      )
    );
  }
  if (params.company && COMPANIES.includes(params.company as Company)) {
    filters.push(eq(tickets.company, params.company as Company));
  }
  if (params.status && STATUSES.includes(params.status as TicketStatus)) {
    filters.push(eq(tickets.ticketStatus, params.status as TicketStatus));
  }
  if (params.system && systems.includes(params.system)) {
    filters.push(eq(tickets.system, params.system));
  }
  if (params.issue_type && ISSUE_TYPES.includes(params.issue_type as IssueType)) {
    filters.push(eq(tickets.issueType, params.issue_type as IssueType));
  }
  if (params.dev) {
    filters.push(ilike(tickets.dev, params.dev));
  }
  if (params.recurring === "1") {
    filters.push(gt(tickets.failedCounter, 0));
  }

  return filters.length ? and(...filters) : undefined;
}
