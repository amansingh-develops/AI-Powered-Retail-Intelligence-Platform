import React from "react";
import { AlertSeverity } from "@/lib/types";

export const SeverityBar: React.FC<{ severity: AlertSeverity; className?: string }> = ({
  severity,
  className = "",
}) => {
  const color = {
    critical: "bg-[#B23A2E]",
    warning: "bg-[#B07A1E]",
    info: "bg-[#3B3358]",
  }[severity];

  return <div className={`w-[3px] shrink-0 self-stretch rounded-l-sm ${color} ${className}`} />;
};
