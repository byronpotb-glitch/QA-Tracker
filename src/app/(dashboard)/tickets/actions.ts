"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets, testCases, testCaseHistory } from "@/db/schema";
import {
  ticketInputSchema,
  testCaseInputSchema,
  ticketStatusSchema,
  testCaseStatusSchema,
  type TicketStatus,
  type TestCaseStatus,
} from "@/lib/validations";
import { recomputeRollup } from "@/lib/recompute-rollup";
import { requireAdmin } from "@/lib/auth/roles";

export interface ActionResult {
  error: string | null;
}

function optionalFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export interface CreateTicketState {
  error: string | null;
}

export async function createTicket(
  _prevState: CreateTicketState,
  formData: FormData
): Promise<CreateTicketState> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

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

  const enteringFailed = parsed.data === "FAILED" && ticket.ticketStatus !== "FAILED";

  await db
    .update(tickets)
    .set({
      ticketStatus: parsed.data,
      failedCounter: enteringFailed ? ticket.failedCounter + 1 : ticket.failedCounter,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function setTicketDev(
  ticketId: string,
  dev: string
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const trimmed = dev.trim();

  await db
    .update(tickets)
    .set({ dev: trimmed === "" ? null : trimmed, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function setTicketCreatedAt(
  ticketId: string,
  date: string
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Must be a date in YYYY-MM-DD format." };
  }

  await db
    .update(tickets)
    .set({ createdAt: new Date(`${date}T00:00:00`), updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

export async function retestTicket(ticketId: string): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    with: { testCases: true },
  });
  if (!ticket) {
    return { error: "Ticket not found." };
  }
  if (ticket.ticketStatus !== "FAILED") {
    return { error: "Only FAILED tickets can be retested." };
  }

  await db.transaction(async (tx) => {
    if (ticket.testCases.length > 0) {
      await tx.insert(testCaseHistory).values(
        ticket.testCases.map((tc) => ({
          testCaseId: tc.id,
          ticketId: ticket.id,
          round: ticket.failedCounter,
          status: tc.status,
          actualResult: tc.actualResult,
          comments: tc.comments,
          testedDate: tc.testedDate,
          tester: tc.tester,
        }))
      );
    }

    for (const tc of ticket.testCases) {
      if (tc.status !== "FAILED") continue;
      await tx
        .update(testCases)
        .set({
          status: "NOT_TESTED",
          actualResult: null,
          comments: null,
          testedDate: null,
          updatedAt: new Date(),
        })
        .where(eq(testCases.id, tc.id));
    }
  });

  await recomputeRollup(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { error: null };
}

