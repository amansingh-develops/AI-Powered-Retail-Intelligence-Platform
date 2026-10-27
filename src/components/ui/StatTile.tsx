import React from "react";

interface StatTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  isWarning?: boolean;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtext,
  trend,
  trendValue,
  isWarning = false,
}) => {
  return (
    <div
      className={`bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex flex-col justify-between transition-colors ${
        isWarning ? "border-[#B07A1E]" : ""
      }`}
    >
      <div className="flex items-center justify-between text-[13px] font-medium text-[#6B6B72] tracking-wide uppercase">
        <span>{label}</span>
        {trendValue && (
          <span
            className={`font-mono-data text-xs ${
              trend === "up"
                ? "text-[#2E7D4F]"
                : trend === "down"
                ? "text-[#B23A2E]"
                : "text-[#6B6B72]"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-[32px] font-medium leading-[1.1] text-[#1B1B1F] font-mono-data tracking-tight">
          {value}
        </div>
      </div>

      {subtext && (
        <div className="mt-2 text-xs text-[#6B6B72] font-mono-data border-t border-[#E3E1DC] pt-1.5 flex items-center justify-between">
          <span>{subtext}</span>
        </div>
      )}
    </div>
  );
};
