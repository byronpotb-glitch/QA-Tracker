"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  PASSED: "#16a34a",
  FAILED: "#dc2626",
  IN_PROGRESS: "#2563eb",
  PENDING: "#71717a",
  ON_HOLD: "#d97706",
  NOT_TESTED: "#a1a1aa",
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
}: {
  data: { status: string; count: number }[];
}) {
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
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#a1a1aa"} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
