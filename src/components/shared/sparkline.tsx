"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
}

export function Sparkline({ data, color, height = 48 }: SparklineProps) {
  if (data.length < 2) return null;

  const chartData = data.map((value, i) => ({ i, v: value }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace("#", "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
