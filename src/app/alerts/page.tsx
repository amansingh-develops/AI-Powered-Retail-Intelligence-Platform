"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusDot } from "@/components/ui/StatusDot";
import { SeverityBar } from "@/components/ui/SeverityBar";
import { Button } from "@/components/ui/Button";
import { globalStore } from "@/lib/store";
import { Alert, AlertStatus, AlertType } from "@/lib/types";
import { Bell, Filter, CheckCircle2, Check } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(globalStore.alerts);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const refreshAlerts = () => {
    setAlerts([...globalStore.alerts]);
  };

  const handleAcknowledge = async (id: string) => {
    globalStore.acknowledgeAlert(id);
    refreshAlerts();
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "acknowledge" }),
      });
    } catch {
      // Handled
    }
  };

  const handleResolve = async (id: string) => {
    globalStore.resolveAlert(id);
    refreshAlerts();
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "resolve" }),
      });
    } catch {
      // Handled
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (
      searchQuery &&
      !a.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.zone.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.refCode.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const openCount = alerts.filter((a) => a.status === "open").length;
  const ackCount = alerts.filter((a) => a.status === "acknowledged").length;
  const resCount = alerts.filter((a) => a.status === "resolved").length;

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* Page Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E1DC]">
          <div>
            <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#3B3358]" /> Unified Alerts Center
            </h1>
            <p className="text-xs text-[#6B6B72]">
              Real-time operational alerts across shelf inventory, checkout queues, and Pi fleet hardware
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono-data text-xs">
            <span className="px-2 py-1 bg-white border border-[#E3E1DC] rounded">
              <span className="text-[#B23A2E] font-medium">{openCount} Open</span>
            </span>
            <span className="px-2 py-1 bg-white border border-[#E3E1DC] rounded">
              <span className="text-[#B07A1E] font-medium">{ackCount} Acked</span>
            </span>
            <span className="px-2 py-1 bg-white border border-[#E3E1DC] rounded">
              <span className="text-[#2E7D4F] font-medium">{resCount} Resolved</span>
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Segmented Buttons */}
            <div className="flex items-center bg-[#F6F5F2] border border-[#E3E1DC] p-0.5 rounded-[5px] text-xs">
              {(["all", "open", "acknowledged", "resolved"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-[4px] font-medium capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-[#3B3358] text-white"
                      : "text-[#6B6B72] hover:text-[#1B1B1F]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Type Selector */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#E3E1DC]">
              <span className="text-xs text-[#6B6B72] flex items-center gap-1">
                <Filter className="w-3 h-3" /> Type:
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs bg-white border border-[#E3E1DC] rounded px-2 py-1 focus:outline-none focus:border-[#3B3358]"
              >
                <option value="all">All Types</option>
                <option value="shelf">Shelf / Inventory</option>
                <option value="queue">Queue Congestion</option>
                <option value="device">Pi Device Health</option>
              </select>
            </div>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by SKU, zone, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs px-3 py-1.5 bg-[#F6F5F2] border border-[#E3E1DC] rounded focus:outline-none focus:bg-white focus:border-[#3B3358]"
            />
          </div>
        </div>

        {/* Alerts Data Table (Compact 36px row height per Design §1.3 & §4) */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E1DC] bg-[#F6F5F2] text-[#6B6B72] font-medium h-9">
                  <th className="w-[3px] p-0" />
                  <th className="px-3 py-2">Ref Code</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Zone / Location</th>
                  <th className="px-3 py-2">Alert Detail</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E1DC]">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[#6B6B72]">
                      No alerts right now matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="hover:bg-[#F6F5F2]/80 transition-colors h-9"
                    >
                      {/* 3px severity bar */}
                      <td className="w-[3px] p-0">
                        <SeverityBar severity={alert.severity} className="h-full" />
                      </td>

                      <td className="px-3 py-2 font-mono-data text-[#6B6B72] whitespace-nowrap">
                        {alert.refCode}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap font-medium capitalize text-[#1B1B1F]">
                        {alert.type}
                      </td>

                      <td className="px-3 py-2 font-medium text-[#1B1B1F] whitespace-nowrap">
                        {alert.zone}
                      </td>

                      <td className="px-3 py-2 text-[#1B1B1F] max-w-md truncate">
                        {alert.message}
                      </td>

                      <td className="px-3 py-2 font-mono-data text-[#6B6B72] whitespace-nowrap">
                        {alert.createdAt}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <StatusDot
                          status={
                            alert.status === "open"
                              ? "bad"
                              : alert.status === "acknowledged"
                              ? "warn"
                              : "good"
                          }
                          label={
                            alert.status === "open"
                              ? "Open"
                              : alert.status === "acknowledged"
                              ? "Acknowledged"
                              : "Resolved"
                          }
                        />
                      </td>

                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {alert.status === "open" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAcknowledge(alert.id)}
                              className="text-[11px] h-7 px-2"
                            >
                              <Check className="w-3 h-3 mr-1" /> Acknowledge
                            </Button>
                          )}
                          {alert.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleResolve(alert.id)}
                              className="text-[11px] h-7 px-2"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                            </Button>
                          )}
                          {alert.status === "resolved" && (
                            <span className="text-[11px] font-mono-data text-[#2E7D4F]">
                              ✓ Done
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
