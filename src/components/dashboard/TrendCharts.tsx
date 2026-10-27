"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { HourlyFootfall, DailyInventoryMetric } from "@/lib/types";

interface TrendChartsProps {
  footfall: HourlyFootfall[];
  inventory: DailyInventoryMetric[];
}

export const TrendCharts: React.FC<TrendChartsProps> = ({ footfall, inventory }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1: Hourly Footfall (Entry Traffic) */}
      <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-[#E3E1DC] mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1B1B1F]">
              Footfall Flow — Today (Hourly)
            </h3>
            <p className="text-xs text-[#6B6B72]">
              Entry sensor counts vs. real-time active store occupancy
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono-data">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#3B3358]" /> Inflow
            </span>
            <span className="flex items-center gap-1.5 text-[#6B6B72]">
              <span className="w-2.5 h-0.5 bg-[#6B6B72] opacity-50" /> Occupancy
            </span>
          </div>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={footfall} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#E3E1DC" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#6B6B72"
                fontSize={11}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                stroke="#6B6B72"
                fontSize={11}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E3E1DC",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(27,27,31,0.08)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Line
                type="monotone"
                dataKey="inCount"
                name="Inflow"
                stroke="#3B3358"
                strokeWidth={2}
                dot={{ fill: "#3B3358", r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="netOccupancy"
                name="Occupancy"
                stroke="#6B6B72"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Inventory Stock Health (7 Day) */}
      <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-[#E3E1DC] mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1B1B1F]">
              Inventory Health Trend (7-Day)
            </h3>
            <p className="text-xs text-[#6B6B72]">
              On-shelf availability index across all monitored SKUs
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono-data">
            <span className="flex items-center gap-1.5 text-[#2E7D4F]">
              <span className="w-2.5 h-0.5 bg-[#2E7D4F]" /> Target (90%+)
            </span>
          </div>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={inventory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#E3E1DC" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6B6B72"
                fontSize={11}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                domain={[85, 100]}
                stroke="#6B6B72"
                fontSize={11}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E3E1DC",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(27,27,31,0.08)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                }}
                formatter={(value: any) => [
                  `${value !== undefined ? value : 0}%`,
                  "Health Index",
                ]}
              />
              <Line
                type="monotone"
                dataKey="healthPercent"
                name="Health %"
                stroke="#3B3358"
                strokeWidth={2}
                dot={{ fill: "#3B3358", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
