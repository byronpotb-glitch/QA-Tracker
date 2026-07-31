"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Sourced from the design system's status palette (good/warning/critical) plus
// categorical slot 1 (blue) for the non-status "active" state and the muted/
// baseline ink tokens for the two "nothing has happened yet" states — never
// an eyeballed hex. See the dataviz skill's palette.md.
const STATUS_COLORS: Record<string, string> = {
  PASSED: "#0ca30c",
  FAILED: "#d03b3b",
  ON_HOLD: "#fab219",
  IN_PROGRESS: "#2a78d6",
  PENDING: "#898781",
  NOT_TESTED: "#c3c2b7",
};

const STATUS_LABELS: Record<string, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
  ON_HOLD: "On Hold",
  NOT_TESTED: "Not Tested",
};

export function StatusBarChart({
  data,
  linkBase,
}: {
  data: { status: string; count: number }[];
  /** When provided (e.g. "/tickets?status="), bars become clickable links to `${linkBase}${status}`. */
  linkBase?: string;
}) {
  const router = useRouter();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const getHref = (status: string) => (linkBase ? `${linkBase}${status}` : undefined);

  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.status] ?? d.status,
  }));
  const maxCount = Math.max(1, ...chartData.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={chartData.length * 40 + 16}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide domain={[0, maxCount]} />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--popover-foreground)" }}
        />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          background={{ fill: "var(--muted)", radius: 4 }}
          onMouseEnter={(_, index) => setHoverIndex(index)}
          onMouseLeave={() => setHoverIndex(null)}
          onClick={(entry) => {
            const status = entry.payload?.status as string | undefined;
            const href = status ? getHref?.(status) : undefined;
            if (href) router.push(href);
          }}
        >
          {chartData.map((entry, index) => {
            const href = getHref?.(entry.status);
            return (
              <Cell
                key={entry.status}
                fill={STATUS_COLORS[entry.status] ?? "#a1a1aa"}
                fillOpacity={hoverIndex === index ? 0.8 : 1}
                cursor={href ? "pointer" : undefined}
              />
            );
          })}
          <LabelList
            dataKey="count"
            position="right"
            style={{
              fill: "var(--foreground)",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
