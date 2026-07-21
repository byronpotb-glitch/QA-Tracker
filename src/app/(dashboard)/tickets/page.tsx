import Link from "next/link";
import { and, desc, eq, gt, ilike, isNotNull } from "drizzle-orm";
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
  }>;
}) {
  const params = await searchParams;

  const [systemRows, devRows] = await Promise.all([
    db.selectDistinct({ system: tickets.system }).from(tickets),
    db
      .selectDistinct({ dev: tickets.dev })
      .from(tickets)
      .where(isNotNull(tickets.dev)),
  ]);
  const systems = systemRows.map((r) => r.system).sort();
  const devs = devRows
    .map((r) => r.dev)
    .filter((d): d is string => d !== null)
    .sort();

  const filters = [];
  if (params.q && params.q.trim()) {
    filters.push(ilike(tickets.title, `%${params.q.trim()}%`));
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
    filters.push(eq(tickets.dev, params.dev));
  }
  if (params.recurring === "1") {
    filters.push(gt(tickets.failedCounter, 0));
  }

  const rows = await db
    .select()
    .from(tickets)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(tickets.updatedAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Tickets</h1>
        <Button nativeButton={false} render={<Link href="/tickets/new" />}>
          New Ticket
        </Button>
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
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
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
                  {dateFormatter.format(ticket.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
