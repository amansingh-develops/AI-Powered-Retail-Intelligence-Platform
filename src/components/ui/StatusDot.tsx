import React from "react";

export type StatusType = "good" | "warn" | "bad" | "neutral";

interface StatusDotProps {
  status: StatusType;
  label: string;
  className?: string;
  monoLabel?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  className = "",
  monoLabel = false,
}) => {
  const dotColor = {
    good: "bg-[#2E7D4F]",
    warn: "bg-[#B07A1E]",
    bad: "bg-[#B23A2E]",
    neutral: "bg-[#8B8B92]",
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
        aria-hidden="true"
      />
      <span
        className={`text-[13px] text-[#1B1B1F] ${
          monoLabel ? "font-mono-data" : "font-normal"
        }`}
      >
        {label}
      </span>
    </span>
  );
};
