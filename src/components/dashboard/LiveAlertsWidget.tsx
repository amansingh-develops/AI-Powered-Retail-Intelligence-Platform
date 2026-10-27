"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Alert } from "@/lib/types";
import { SeverityBar } from "../ui/SeverityBar";
import { ArrowRight, Check } from "lucide-react";

interface LiveAlertsWidgetProps {
  initialAlerts: Alert[];
}

export const LiveAlertsWidget: React.FC<LiveAlertsWidgetProps> = ({ initialAlerts }) => {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);

  const handleAcknowledge = async (id: string) => {
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "acknowledge" }),
      });
    } catch {
      // Fallback local update
    }

    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "acknowledged" } : a))
    );
  };

  const openAlerts = alerts.filter((a) => a.status === "open").slice(0, 4);

  return (
    <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E3E1DC] mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#B23A2E] animate-pulse" />
          <h3 className="text-sm font-semibold text-[#1B1B1F]">Live Alerts</h3>
          <span className="text-xs font-mono-data text-[#6B6B72] px-1.5 py-0.5 bg-[#F6F5F2] border border-[#E3E1DC] rounded">
            {openAlerts.length} Open
          </span>
        </div>
        <Link
          href="/alerts"
          className="text-xs font-medium text-[#3B3358] hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Alerts List */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px]">
        {openAlerts.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#6B6B72]">
            No open alerts right now.
          </div>
        ) : (
          openAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-stretch bg-white border border-[#E3E1DC] rounded-[5px] overflow-hidden hover:border-[#3B3358]/40 transition-colors"
            >
              {/* 3px left severity bar */}
              <SeverityBar severity={alert.severity} />

              <div className="flex-1 p-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#1B1B1F] truncate">
                    {alert.message}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#6B6B72] mt-0.5 font-mono-data">
                    <span>{alert.zone}</span>
                    <span>•</span>
                    <span>{alert.createdAt}</span>
                    <span>•</span>
                    <span className="text-[10px] tracking-wider text-[#3B3358]">
                      {alert.refCode}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  title="Acknowledge alert"
                  className="px-2 py-1 text-[11px] font-medium text-[#1B1B1F] bg-[#F6F5F2] hover:bg-[#EDEAF2] hover:text-[#3B3358] border border-[#E3E1DC] rounded transition-colors shrink-0 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Ack
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
