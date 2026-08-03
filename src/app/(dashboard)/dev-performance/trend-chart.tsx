"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyTrendPoint } from "@/lib/dev-performance";

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function formatWeek(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function TrendChart({ data }: { data: WeeklyTrendPoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: formatWeek(d.weekStart) }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          yAxisId="rate"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          width={36}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          width={28}
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
          formatter={(value, name) =>
            name === "Pass rate" ? [`${value}%`, name] : [value, name]
          }
        />
        <Bar
          yAxisId="count"
          dataKey="recurring"
          name="Recurring failures"
          fill="#fab219"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
        />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="passRate"
          name="Pass rate"
          stroke="#0ca30c"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
