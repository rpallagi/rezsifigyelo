"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function TenantHomeChart({
  data,
  barClass,
}: {
  data: number[];
  color?: string;
  barClass: string;
}) {
  if (data.length < 2) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  // Map tailwind-ish bar class to actual hex for recharts (since recharts needs colors)
  const colorMap: Record<string, string> = {
    "bg-amber-500": "#f59e0b",
    "bg-sky-500": "#0ea5e9",
    "bg-rose-500": "#f43f5e",
    "bg-emerald-500": "#10b981",
    "bg-violet-500": "#8b5cf6",
  };
  const strokeColor = colorMap[barClass] ?? "#6366f1";
  const gradientId = `spark-${barClass}`;

  return (
    <div className="-mx-1 h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
