import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets, testCases } from "@/db/schema";
import { applyRollup } from "@/lib/rollup";

/**
 * Recomputes one ticket's status/failedCounter from its test cases and writes
 * the result if it changed. A no-op for tickets with manualOverride set.
 *
 * Lives outside the server-action files so both the ticket actions and the
 * Excel import can call it without either becoming a server-action endpoint.
 */
export async function recomputeRollup(ticketId: string): Promise<void> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) return;

  const rows = await db
    .select({ status: testCases.status })
    .from(testCases)
    .where(eq(testCases.ticketId, ticketId));

  const { ticketStatus, failedCounter } = applyRollup({
    currentStatus: ticket.ticketStatus,
    manualOverride: ticket.manualOverride,
    failedCounter: ticket.failedCounter,
    testCaseStatuses: rows.map((r) => r.status),
  });

  if (
    ticketStatus === ticket.ticketStatus &&
    failedCounter === ticket.failedCounter
  ) {
    return;
  }

  await db
    .update(tickets)
    .set({ ticketStatus, failedCounter, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));
}
