import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
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
import type { Company, TicketStatus } from "@/lib/validations";

const COMPANIES: readonly Company[] = ["POTB", "GLADEX"];
const STATUSES: readonly TicketStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filters = [];
  if (params.company && COMPANIES.includes(params.company as Company)) {
    filters.push(eq(tickets.company, params.company as Company));
  }
  if (params.status && STATUSES.includes(params.status as TicketStatus)) {
    filters.push(eq(tickets.ticketStatus, params.status as TicketStatus));
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
        <Button render={<Link href="/tickets/new" />}>New Ticket</Button>
      </div>

      <TicketFilters company={params.company} status={params.status} />

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
              <TableHead>Failed</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
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
