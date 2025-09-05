import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

// Data model
export type PieData = {
  name: string;
  value: number;
};

// Sample data
const data: PieData[] = [
  { name: "Sales", value: 4200 },
  { name: "Users", value: 3100 },
  { name: "Marketing", value: 1900 },
  { name: "Operations", value: 1200 },
];

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"];

export const SimplePieChart: React.FC = () => {
  return (
    <div style={{ width: "100%", height: 380 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#0b1222", border: "1px solid #1e293b" }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimplePieChart;