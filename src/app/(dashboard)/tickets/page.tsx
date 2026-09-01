import Link from "next/link";
import { asc, desc, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";
import { StatusBadge } from "@/lib/status";
import { TicketFilters } from "./ticket-filters";
import { CreatedDateCell } from "./created-date-cell";
import { ExportTicketsButton } from "./export-tickets-button";
import { getCurrentUser } from "@/lib/auth/roles";
import { getProjects } from "@/lib/projects";
import { dedupeDevNames } from "@/lib/dev-performance";
import { buildTicketWhereClause } from "@/lib/build-ticket-filters";
import { buildSortHref, type SortDir } from "@/lib/sort-link";
import { PaginationControls } from "@/components/pagination-controls";
import { PageSizeSelect } from "@/components/page-size-select";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "@/lib/page-size";
import { DashboardDateFilter, type DateField } from "../dashboard/date-filter";

const SORT_COLUMNS = {
  title: { column: tickets.title, defaultDir: "asc" as SortDir },
  company: { column: tickets.company, defaultDir: "asc" as SortDir },
  system: { column: tickets.system, defaultDir: "asc" as SortDir },
  issue_type: { column: tickets.issueType, defaultDir: "asc" as SortDir },
  status: { column: tickets.ticketStatus, defaultDir: "asc" as SortDir },
  tester: { column: tickets.tester, defaultDir: "asc" as SortDir },
  dev: { column: tickets.dev, defaultDir: "asc" as SortDir },
  recurring: { column: tickets.failedCounter, defaultDir: "desc" as SortDir },
  created: { column: tickets.createdAt, defaultDir: "desc" as SortDir },
  updated: { column: tickets.updatedAt, defaultDir: "desc" as SortDir },
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value) && value! in SORT_COLUMNS;
}

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
    sort?: string;
    dir?: string;
    from?: string;
    to?: string;
    field?: string;
  }>;
}) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();
  const dateField: DateField = params.field === "updated" ? "updated" : "created";
  const page = Math.max(1, Number(params.page) || 1);
  const requestedPageSize = Number(params.pageSize);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const sortKey: SortKey = isSortKey(params.sort) ? params.sort : "updated";
  const sortDir: SortDir = params.dir === "asc" ? "asc" : params.dir === "desc" ? "desc" : SORT_COLUMNS[sortKey].defaultDir;
  const orderBy: SQL = sortDir === "asc" ? asc(SORT_COLUMNS[sortKey].column) : desc(SORT_COLUMNS[sortKey].column);

  const [projects, devRows] = await Promise.all([
    getProjects(),
    db
      .selectDistinct({ dev: tickets.dev })
      .from(tickets)
      .where(isNotNull(tickets.dev)),
  ]);
  const systems = projects.map((p) => p.name);
  const devs = dedupeDevNames(devRows.map((r) => r.dev).filter((d): d is string => d !== null));

  const whereClause = buildTicketWhereClause(params, systems);

  const [rows, [{ count: totalCount }]] = await Promise.all([
    db
      .select()
      .from(tickets)
      .where(whereClause)
      .orderBy(orderBy)
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

      {params.recurring === "1" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtered by recurring failures</span>
          <Link href="/tickets" className="text-primary hover:underline">
            Clear
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <ExportTicketsButton
          params={{
            q: params.q,
            company: params.company,
            status: params.status,
            system: params.system,
            issue_type: params.issue_type,
            dev: params.dev,
            recurring: params.recurring,
            from: params.from,
            to: params.to,
            field: params.field,
          }}
        />
        <PageSizeSelect pageSize={pageSize} />
      </div>

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              {(
                [
                  ["title", "Title"],
                  ["company", "Company"],
                  ["system", "System / Module"],
                  ["issue_type", "Issue Type"],
                  ["status", "Status"],
                  ["tester", "Tester"],
                  ["dev", "Dev"],
                  ["recurring", "Recurring"],
                  ["created", "Created"],
                  ["updated", "Updated"],
                ] as const
              ).map(([key, label]) => (
                <SortableTableHead
                  key={key}
                  label={label}
                  href={buildSortHref("/tickets", params, key, SORT_COLUMNS[key].defaultDir)}
                  active={sortKey === key}
                  dir={sortDir}
                />
              ))}
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
