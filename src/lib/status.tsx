import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TestCaseStatus, TicketStatus } from "@/lib/validations";

type AnyStatus = TicketStatus | TestCaseStatus;

const STATUS_LABEL: Record<AnyStatus, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
  ON_HOLD: "On Hold",
  NOT_TESTED: "Not Tested",
};

const STATUS_CLASS: Record<AnyStatus, string> = {
  PASSED: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400",
  FAILED: "border-transparent bg-destructive/10 text-destructive",
  IN_PROGRESS: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PENDING: "border-transparent bg-secondary text-secondary-foreground",
  ON_HOLD: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  NOT_TESTED: "border-border text-muted-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: AnyStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const PRIORITY_CLASS: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH: "border-transparent bg-destructive/10 text-destructive",
  MEDIUM: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LOW: "border-border text-muted-foreground",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: "HIGH" | "MEDIUM" | "LOW";
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(PRIORITY_CLASS[priority], className)}>
      {priority}
    </Badge>
  );
}
