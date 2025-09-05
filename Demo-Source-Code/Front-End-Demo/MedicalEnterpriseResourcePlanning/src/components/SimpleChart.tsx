import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Data model
export type DataPoint = {
  month: string;
  sales: number; // dollars
  users: number; // signups
};

// Sample data (12 months)
const data: DataPoint[] = [
  { month: "Jan", sales: 1200, users: 310 },
  { month: "Feb", sales: 980, users: 280 },
  { month: "Mar", sales: 1420, users: 360 },
  { month: "Apr", sales: 1600, users: 390 },
  { month: "May", sales: 1520, users: 370 },
  { month: "Jun", sales: 1710, users: 410 },
  { month: "Jul", sales: 1850, users: 460 },
  { month: "Aug", sales: 1760, users: 450 },
  { month: "Sep", sales: 1900, users: 470 },
  { month: "Oct", sales: 2050, users: 520 },
  { month: "Nov", sales: 2120, users: 540 },
  { month: "Dec", sales: 2380, users: 620 },
];

type Props = {
  chartType?: "line" | "bar";
  metric?: "sales" | "users";
  locale?: string;
  fractionDigits?: number;
};

export const SimpleChart: React.FC<Props> = ({
  chartType = "line",
  metric = "sales",
  locale,
  fractionDigits = 0,
}) => {
  const formatNumber = (n: number) =>
    n.toLocaleString(locale, { maximumFractionDigits: fractionDigits });

  const currency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: fractionDigits,
    }).format(n);

  const yDomain = useMemo(() => {
    const values = data.map((d) => d[metric]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.ceil((max - min) * 0.1);
    return [Math.max(0, min - pad), max + pad];
  }, [metric]);

  const primaryColor = "#6366f1"; // indigo-500
  const gridColor = "#e5e7eb"; // gray-200

  return (
    <div style={{ width: "100%,", height: 380 }}>
      <ResponsiveContainer>
        {chartType === "line" ? (
          <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#cbd5e1" />
            <YAxis
              domain={yDomain as [number, number]}
              stroke="#cbd5e1"
              tickFormatter={(v) => (metric === "sales" ? currency(v) : formatNumber(v))}
            />
            <Tooltip
              contentStyle={{ background: "#0b1222", border: "1px solid #1e293b" }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: any) => (metric === "sales" ? currency(value) : formatNumber(value))}
            />
            <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            <Line
              type="monotone"
              dataKey={metric}
              name={metric === "sales" ? "Sales" : "Users"}
              stroke={primaryColor}
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 1, stroke: primaryColor }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#cbd5e1" />
            <YAxis
              domain={yDomain as [number, number]}
              stroke="#cbd5e1"
              tickFormatter={(v) => (metric === "sales" ? currency(v) : formatNumber(v))}
            />
            <Tooltip
              contentStyle={{ background: "#0b1222", border: "1px solid #1e293b" }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: any) => (metric === "sales" ? currency(value) : formatNumber(value))}
            />
            <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            <Bar
              dataKey={metric}
              name={metric === "sales" ? "Sales" : "Users"}
              fill={primaryColor}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleChart;