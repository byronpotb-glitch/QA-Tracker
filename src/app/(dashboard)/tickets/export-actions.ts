"use server";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { getProjects } from "@/lib/projects";
import { buildTicketWhereClause, type TicketFilterParams } from "@/lib/build-ticket-filters";
import { toCsv } from "@/lib/csv";
import type { TestCase, Ticket } from "@/db/schema";

interface ExportRow {
  ticket: Ticket;
  tc: TestCase | null;
}

export async function exportTicketsCsv(
  params: TicketFilterParams
): Promise<{ csv: string }> {
  const projects = await getProjects();
  const systems = projects.map((p) => p.name);
  const whereClause = buildTicketWhereClause(params, systems);

  const matchingTickets = await db.query.tickets.findMany({
    where: whereClause,
    with: { testCases: true },
    orderBy: desc(tickets.updatedAt),
  });

  const rows: ExportRow[] = [];
  for (const ticket of matchingTickets) {
    if (ticket.testCases.length === 0) {
      rows.push({ ticket, tc: null });
      continue;
    }
    for (const tc of ticket.testCases) {
      rows.push({ ticket, tc });
    }
  }

  // Column set/order matches the Excel import template (Test ID, Title,
  // Test Case ID, ... Lakbay Tester's) so exports and imports stay symmetric.
  const csv = toCsv(rows, [
    { key: "test_id", label: "Test ID", value: () => "" },
    { key: "title", label: "Title", value: (r) => r.ticket.title },
    { key: "tc_number", label: "Test Case ID", value: (r) => r.tc?.tcNumber ?? "" },
    { key: "system", label: "System", value: (r) => r.ticket.system },
    { key: "module", label: "Module", value: (r) => r.ticket.module },
    { key: "page", label: "Page", value: (r) => r.tc?.page ?? "" },
    { key: "description", label: "Description", value: (r) => r.tc?.description ?? "" },
    { key: "priority", label: "Priority", value: (r) => r.tc?.priority ?? "" },
    { key: "issue_type", label: "Issue Type", value: (r) => r.ticket.issueType },
    { key: "expected_result", label: "Expected Result", value: (r) => r.tc?.expectedResult ?? "" },
    { key: "actual_result", label: "Actual Result", value: (r) => r.tc?.actualResult ?? "" },
    { key: "comments", label: "Comments", value: (r) => r.tc?.comments ?? "" },
    { key: "status", label: "Status", value: (r) => r.tc?.status ?? "" },
    { key: "ticket_status", label: "Ticket Status", value: (r) => r.ticket.ticketStatus },
    { key: "date", label: "Date", value: (r) => r.tc?.testedDate ?? "" },
    { key: "tester", label: "Lakbay Tester's", value: (r) => r.ticket.tester },
  ]);

  return { csv };
}
