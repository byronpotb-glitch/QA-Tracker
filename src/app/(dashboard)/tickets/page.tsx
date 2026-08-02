import Link from "next/link";
import { and, desc, eq, gt, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/lib/status";
import { TicketFilters } from "./ticket-filters";
import { CreatedDateCell } from "./created-date-cell";
import { getCurrentUser } from "@/lib/auth/roles";
import { getProjects } from "@/lib/projects";
import { dedupeDevNames } from "@/lib/dev-performance";
import { PaginationControls } from "@/components/pagination-controls";
import { PageSizeSelect } from "@/components/page-size-select";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "@/lib/page-size";
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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    company?: string;
    status?: string;
    system?: string;
    issue_type?: string;
    dev?: string;
    recurring?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();
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

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, [{ count: totalCount }]] = await Promise.all([
    db
      .select()
      .from(tickets)
      .where(whereClause)
      .orderBy(desc(tickets.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(tickets).where(whereClause),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Tickets</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/tickets/test-cases" />}
          >
            Test Cases
          </Button>
          {currentUser?.role === "admin" && (
            <Button nativeButton={false} render={<Link href="/tickets/new" />}>
              New Ticket
            </Button>
          )}
        </div>
      </div>

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

      {params.recurring === "1" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtered by recurring failures</span>
          <Link href="/tickets" className="text-primary hover:underline">
            Clear
          </Link>
        </div>
      )}

      <div className="flex items-center justify-end">
        <PageSizeSelect pageSize={pageSize} />
      </div>

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>System / Module</TableHead>
              <TableHead>Issue Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tester</TableHead>
              <TableHead>Dev</TableHead>
              <TableHead>Recurring</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-muted-foreground"
                >
                  No tickets yet. Create one or import from the AI workflow.
                </TableCell>
              </TableRow>
            )}
            {rows.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="max-w-72 truncate">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="font-medium hover:underline"
                  >
                    {ticket.title}
                  </Link>
                </TableCell>
                <TableCell>{ticket.company}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ticket.system} / {ticket.module}
                </TableCell>
                <TableCell>{ticket.issueType.replace(/_/g, " ")}</TableCell>
                <TableCell>
                  <StatusBadge status={ticket.ticketStatus} />
                </TableCell>
                <TableCell>{ticket.tester}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ticket.dev ?? "—"}
                </TableCell>
                <TableCell>{ticket.failedCounter}</TableCell>
                <TableCell className="text-muted-foreground">
                  <CreatedDateCell ticketId={ticket.id} createdAt={ticket.createdAt} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFormatter.format(ticket.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        basePath="/tickets"
        searchParams={params}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
      />
    </div>
  );
}
