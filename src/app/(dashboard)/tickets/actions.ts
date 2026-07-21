"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets, testCases } from "@/db/schema";
import {
  ticketInputSchema,
  testCaseInputSchema,
  ticketStatusSchema,
  testCaseStatusSchema,
  importSchema,
  type TicketStatus,
  type TestCaseStatus,
  type ImportPayload,
} from "@/lib/validations";
import { applyRollup } from "@/lib/rollup";

export interface ActionResult {
  error: string | null;
}

function optionalFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

async function recomputeRollup(ticketId: string) {
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
    ticketStatus !== ticket.ticketStatus ||
    failedCounter !== ticket.failedCounter
  ) {
    await db
      .update(tickets)
      .set({ ticketStatus, failedCounter, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
  }
}

export interface CreateTicketState {
  error: string | null;
}

export async function createTicket(
  _prevState: CreateTicketState,
  formData: FormData
): Promise<CreateTicketState> {
  const parsed = ticketInputSchema.safeParse({
    title: formData.get("title"),
    company: formData.get("company"),
    system: formData.get("system"),
    module: formData.get("module"),
    issue_type: formData.get("issue_type"),
    tester: formData.get("tester"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [ticket] = await db
    .insert(tickets)
    .values({
      title: parsed.data.title,
      company: parsed.data.company,
      system: parsed.data.system,
      module: parsed.data.module,
      issueType: parsed.data.issue_type,
      tester: parsed.data.tester,
    })
    .returning({ id: tickets.id });

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function addTestCase(
  ticketId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = testCaseInputSchema.safeParse({
    tc_number: formData.get("tc_number"),
    page: formData.get("page"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    expected_result: formData.get("expected_result"),
    actual_result: optionalFormValue(formData, "actual_result"),
    comments: optionalFormValue(formData, "comments"),
    status: formData.get("status"),
    tested_date: optionalFormValue(formData, "tested_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    return { error: "Ticket not found." };
  }

  await db.insert(testCases).values({
    ticketId,
    tcNumber: parsed.data.tc_number,
    page: parsed.data.page,
    description: parsed.data.description,
    priority: parsed.data.priority,
    expectedResult: parsed.data.expected_result,
    actualResult: parsed.data.actual_result ?? null,
    comments: parsed.data.comments ?? null,
    status: parsed.data.status,
    testedDate: parsed.data.tested_date ?? null,
    // The import contract has no per-test-case tester; the ticket's tester
    // is the one running the whole test pass, so it applies to every case.
    tester: ticket.tester,
  });

  await recomputeRollup(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function updateTestCase(
  ticketId: string,
  testCaseId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = testCaseInputSchema.safeParse({
    tc_number: formData.get("tc_number"),
    page: formData.get("page"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    expected_result: formData.get("expected_result"),
    actual_result: optionalFormValue(formData, "actual_result"),
    comments: optionalFormValue(formData, "comments"),
    status: formData.get("status"),
    tested_date: optionalFormValue(formData, "tested_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db
    .update(testCases)
    .set({
      tcNumber: parsed.data.tc_number,
      page: parsed.data.page,
      description: parsed.data.description,
      priority: parsed.data.priority,
      expectedResult: parsed.data.expected_result,
      actualResult: parsed.data.actual_result ?? null,
      comments: parsed.data.comments ?? null,
      status: parsed.data.status,
      testedDate: parsed.data.tested_date ?? null,
      updatedAt: new Date(),
    })
    .where(eq(testCases.id, testCaseId));

  await recomputeRollup(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function updateTestCaseStatus(
  ticketId: string,
  testCaseId: string,
  status: TestCaseStatus
): Promise<ActionResult> {
  const parsed = testCaseStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  await db
    .update(testCases)
    .set({ status: parsed.data, updatedAt: new Date() })
    .where(eq(testCases.id, testCaseId));

  await recomputeRollup(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function deleteTestCase(
  ticketId: string,
  testCaseId: string
): Promise<ActionResult> {
  await db.delete(testCases).where(eq(testCases.id, testCaseId));

  await recomputeRollup(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function toggleManualOverride(
  ticketId: string,
  next: boolean
): Promise<ActionResult> {
  await db
    .update(tickets)
    .set({ manualOverride: next, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  if (!next) {
    // Turning override off resumes automatic rollup immediately.
    await recomputeRollup(ticketId);
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<ActionResult> {
  const parsed = ticketStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    return { error: "Ticket not found." };
  }
  if (!ticket.manualOverride) {
    return { error: "Enable manual override to set status manually." };
  }

  await db
    .update(tickets)
    .set({ ticketStatus: parsed.data, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export interface ImportResult {
  error: string | null;
  ticketId?: string;
  title?: string;
}

export async function importTicket(
  payload: ImportPayload
): Promise<ImportResult> {
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import payload." };
  }

  const { ticket: ticketInput, test_cases } = parsed.data;

  const hasHistoricalStatus =
    ticketInput.ticket_status !== undefined || ticketInput.failed_counter !== undefined;

  const ticketId = await db.transaction(async (tx) => {
    const [ticket] = await tx
      .insert(tickets)
      .values({
        title: ticketInput.title,
        company: ticketInput.company,
        system: ticketInput.system,
        module: ticketInput.module,
        issueType: ticketInput.issue_type,
        tester: ticketInput.tester,
        ...(hasHistoricalStatus
          ? {
              ticketStatus: ticketInput.ticket_status ?? "PENDING",
              failedCounter: ticketInput.failed_counter ?? 0,
              // Freeze the imported historical status so the rollup that
              // runs right after inserting test cases doesn't recompute it.
              manualOverride: true,
            }
          : {}),
      })
      .returning({ id: tickets.id });

    await tx.insert(testCases).values(
      test_cases.map((tc) => ({
        ticketId: ticket.id,
        tcNumber: tc.tc_number,
        page: tc.page,
        description: tc.description,
        priority: tc.priority,
        expectedResult: tc.expected_result,
        actualResult: tc.actual_result ?? null,
        comments: tc.comments ?? null,
        status: tc.status,
        testedDate: tc.tested_date ?? null,
        tester: ticketInput.tester,
      }))
    );

    return ticket.id;
  });

  await recomputeRollup(ticketId);
  revalidatePath("/tickets");
  return { error: null, ticketId, title: ticketInput.title };
}
