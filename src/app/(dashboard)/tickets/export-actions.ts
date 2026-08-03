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

  const csv = toCsv(rows, [
    { key: "title", label: "Ticket Title", value: (r) => r.ticket.title },
    { key: "company", label: "Company", value: (r) => r.ticket.company },
    { key: "system", label: "System", value: (r) => r.ticket.system },
    { key: "module", label: "Module", value: (r) => r.ticket.module },
    { key: "issue_type", label: "Issue Type", value: (r) => r.ticket.issueType },
    { key: "ticket_status", label: "Ticket Status", value: (r) => r.ticket.ticketStatus },
    { key: "tester", label: "Tester", value: (r) => r.ticket.tester },
    { key: "dev", label: "Dev", value: (r) => r.ticket.dev ?? "" },
    { key: "times_failed", label: "Times Failed", value: (r) => r.ticket.failedCounter },
    { key: "tc_number", label: "TC Number", value: (r) => r.tc?.tcNumber ?? "" },
    { key: "page", label: "Page", value: (r) => r.tc?.page ?? "" },
    { key: "description", label: "Description", value: (r) => r.tc?.description ?? "" },
    { key: "priority", label: "Priority", value: (r) => r.tc?.priority ?? "" },
    { key: "expected_result", label: "Expected Result", value: (r) => r.tc?.expectedResult ?? "" },
    { key: "actual_result", label: "Actual Result", value: (r) => r.tc?.actualResult ?? "" },
    { key: "tc_status", label: "TC Status", value: (r) => r.tc?.status ?? "" },
    { key: "tested_date", label: "Tested Date", value: (r) => r.tc?.testedDate ?? "" },
    { key: "comments", label: "Comments", value: (r) => r.tc?.comments ?? "" },
  ]);

  return { csv };
}
