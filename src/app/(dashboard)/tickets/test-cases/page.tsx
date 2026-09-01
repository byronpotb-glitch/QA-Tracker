import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { db } from "@/db";
import { testCases, tickets } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { TicketTestCasesCard } from "./ticket-test-cases-card";
import { TicketFilters } from "../ticket-filters";
import { PaginationControls } from "@/components/pagination-controls";
import { PageSizeSelect } from "@/components/page-size-select";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "@/lib/page-size";
import { getProjects } from "@/lib/projects";
import { dedupeDevNames } from "@/lib/dev-performance";
import { DashboardDateFilter, type DateField } from "../../dashboard/date-filter";
import type { Company, IssueType, TestCaseStatus, TicketStatus } from "@/lib/validations";

export const dynamic = "force-dynamic";

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
const TEST_CASE_STATUSES: readonly TestCaseStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
  "NOT_TESTED",
];

export default async function AllTestCasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    company?: string;
    status?: string;
    system?: string;
    issue_type?: string;
    dev?: string;
    tc_status?: string;
    page?: string;
    pageSize?: string;
    from?: string;
    to?: string;
    field?: string;
  }>;
}) {
  const params = await searchParams;
  const dateField: DateField = params.field === "updated" ? "updated" : "created";
  const page = Math.max(1, Number(params.page) || 1);
  const requestedPageSize = Number(params.pageSize);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;

  const [projects, devRows] = await Promise.all([
    getProjects(),
    db
      .selectDistinct({ dev: tickets.dev })
      .from(tickets)
      .where(isNotNull(tickets.dev)),
  ]);
  const systems = projects.map((p) => p.name);
  const devs = dedupeDevNames(devRows.map((r) => r.dev).filter((d): d is string => d !== null));

  const filters = [];
  if (params.q && params.q.trim()) {
    const q = `%${params.q.trim()}%`;
    const matchingTestCaseTickets = await db
      .selectDistinct({ ticketId: testCases.ticketId })
      .from(testCases)
      .where(or(ilike(testCases.tcNumber, q), ilike(testCases.description, q)));
    const qFilters = [
      ilike(tickets.title, q),
      ilike(tickets.system, q),
      ilike(tickets.module, q),
      ilike(tickets.tester, q),
      ilike(tickets.dev, q),
    ];
    if (matchingTestCaseTickets.length) {
      qFilters.push(
        inArray(tickets.id, matchingTestCaseTickets.map((r) => r.ticketId))
      );
    }
    filters.push(or(...qFilters));
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
  if (params.from && params.to) {
    const dateColumn = dateField === "updated" ? tickets.updatedAt : tickets.createdAt;
    filters.push(
      gte(dateColumn, new Date(`${params.from}T00:00:00`)),
      lte(dateColumn, new Date(`${params.to}T23:59:59.999`))
    );
  }

  const whereClause = filters.length ? and(...filters) : undefined;

  const [allTickets, [{ count: totalCount }]] = await Promise.all([
    db.query.tickets.findMany({
      where: whereClause,
      with: { testCases: true },
      orderBy: desc(tickets.updatedAt),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(tickets).where(whereClause),
  ]);

  const tcStatus =
    params.tc_status && TEST_CASE_STATUSES.includes(params.tc_status as TestCaseStatus)
      ? (params.tc_status as TestCaseStatus)
      : undefined;

  const ticketsWithTestCases = allTickets
    .map((t) => ({
      ...t,
      testCases: [...t.testCases]
        .filter((tc) => !tcStatus || tc.status === tcStatus)
        .sort((a, b) => a.tcNumber.localeCompare(b.tcNumber, undefined, { numeric: true })),
    }))
    .filter((t) => t.testCases.length > 0);

  const totalTestCases = ticketsWithTestCases.reduce(
    (sum, t) => sum + t.testCases.length,
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/tickets"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to tickets
      </Link>

      <div>
        <h1 className="text-lg font-semibold">Test Cases</h1>
        <p className="text-sm text-muted-foreground">
          {totalTestCases} test case{totalTestCases === 1 ? "" : "s"} across{" "}
          {ticketsWithTestCases.length} ticket
          {ticketsWithTestCases.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <TicketFilters
          q={params.q}
          company={params.company}
          status={params.status}
          system={params.system}
          issueType={params.issue_type}
          dev={params.dev}
          systems={systems}
          devs={devs}
        />
        <DashboardDateFilter from={params.from} to={params.to} field={dateField} />
      </div>

      {tcStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Filtered by test case status:{" "}
            <span className="font-medium text-foreground">
              {tcStatus.replace(/_/g, " ")}
            </span>
          </span>
          <Link href="/tickets/test-cases" className="text-primary hover:underline">
            Clear
          </Link>
        </div>
      )}

      <div className="flex items-center justify-end">
        <PageSizeSelect pageSize={pageSize} />
      </div>

      {ticketsWithTestCases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No test cases yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {ticketsWithTestCases.map((ticket) => (
            <TicketTestCasesCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}

      <PaginationControls
        basePath="/tickets/test-cases"
        searchParams={params}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
      />
    </div>
  );
}
