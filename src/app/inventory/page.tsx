"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusDot } from "@/components/ui/StatusDot";
import { Button } from "@/components/ui/Button";
import { ShelfAnnotationModal } from "@/components/annotation/ShelfAnnotationModal";
import { Shelf } from "@/lib/types";
import {
  Package,
  Camera,
  Wifi,
  WifiOff,
  Layers,
  RefreshCw,
  AlertCircle,
  Clock,
  BarChart3,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types for merged shelf-data response from /api/pi/shelf-data
// ---------------------------------------------------------------------------
interface MergedShelfItem {
  shelf_id: string;
  count: number;
  label: string;
  sku: string;
  capacity: number;
  threshold: number;
  status: "ok" | "low" | "oos";
  fillPercent: number;
}

interface ShelfDataResponse {
  piConnected: boolean;
  device_id: string;
  configuration_version: number;
  timestamp: string | null;
  shelves: MergedShelfItem[];
  outside_zones: number;
  total_detected: number;
  source: "pi_live" | "mongodb_cached";
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const [data, setData] = useState<ShelfDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string>("");

  // Dummy shelf object for the annotation modal
  const piShelf: Shelf = {
    id: "shelf-pi-01",
    storeId: "str-104",
    deviceId: "pi_shelf_01",
    name: "Pi Edge Camera Shelf",
    aisle: "Bay 01",
    category: "Smart Shelf Bay",
    snapshotUrl: "/api/pi/latest-image",
    updatedAt: data?.timestamp || "",
    regions: [],
  };

  // -------------------------------------------------------------------------
  // Poll /api/pi/shelf-data every 5 seconds
  // -------------------------------------------------------------------------
  const fetchShelfData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch("/api/pi/shelf-data", { cache: "no-store" });
      if (res.ok) {
        const json: ShelfDataResponse = await res.json();
        setData(json);
        setLastPollTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
      }
    } catch (err) {
      console.warn("Shelf data poll failed:", err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShelfData(true);
    const interval = setInterval(() => fetchShelfData(false), 5000);
    return () => clearInterval(interval);
  }, [fetchShelfData]);

  const handleAnnotationSaved = () => {
    // Refetch after annotation — Pi may take a few seconds to re-run model
    setTimeout(() => fetchShelfData(true), 2000);
  };

  // -------------------------------------------------------------------------
  // Computed stats
  // -------------------------------------------------------------------------
  const shelves = data?.shelves || [];
  const okCount = shelves.filter((s) => s.status === "ok").length;
  const lowCount = shelves.filter((s) => s.status === "low").length;
  const oosCount = shelves.filter((s) => s.status === "oos").length;
  const totalStock = shelves.reduce((a, s) => a + s.count, 0);
  const totalCapacity = shelves.reduce((a, s) => a + s.capacity, 0);
  const fillRate = totalCapacity > 0 ? Math.round((totalStock / totalCapacity) * 100) : 0;
  const piConnected = data?.piConnected ?? false;
  const configVersion = data?.configuration_version ?? 0;
  const piTimestamp = data?.timestamp || null;

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E1DC]">
          <div>
            <div className="text-xs text-[#6B6B72] font-mono-data mb-0.5">
              Inventory &amp; Shelf Telemetry › Pi Shelf Bay
            </div>
            <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-[#3B3358]" /> Inventory Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Manual Sync Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchShelfData(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Polling..." : "Refresh"}
            </Button>

            {/* Pi Connectivity Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E3E1DC] rounded-[5px] text-xs">
              {piConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[#2E7D4F]" />
                  <span className="font-mono-data text-[#2E7D4F] font-medium">Pi Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-[#B07A1E]" />
                  <span className="font-mono-data text-[#B07A1E]">Pi Offline</span>
                </>
              )}
            </div>

            {/* Request Snapshot & Annotate */}
            <Button
              onClick={() => setIsAnnotationOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              Request snapshot &amp; annotate
            </Button>
          </div>
        </div>

        {/* ─── Config & Detection Info Strip ─── */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-[#1B1B1F]">Zone Health:</span>
            <StatusDot status="good" label={`In stock (${okCount})`} />
            <StatusDot status="warn" label={`Low stock (${lowCount})`} />
            <StatusDot status="bad" label={`Out of stock (${oosCount})`} />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono-data text-[#6B6B72]">
            <span className="text-[#1B1B1F] font-medium">
              {totalStock} / {totalCapacity} units ({fillRate}%)
            </span>
            <span className="border-l border-[#E3E1DC] pl-3">
              Config v{configVersion}
            </span>
            <span className="border-l border-[#E3E1DC] pl-3 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {piTimestamp
                ? new Date(piTimestamp).toLocaleString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    day: "2-digit",
                    month: "short",
                    hour12: false,
                  })
                : "No data yet"}
            </span>
            <span className="border-l border-[#E3E1DC] pl-3">
              Source: {data?.source === "pi_live" ? "🟢 Live Pi" : "📦 MongoDB Cache"}
            </span>
            {data?.total_detected !== undefined && (
              <span className="border-l border-[#E3E1DC] pl-3 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                {data.total_detected} total detected
              </span>
            )}
          </div>
        </div>

        {/* ─── No Zones Empty State ─── */}
        {shelves.length === 0 && !isLoading && (
          <div className="bg-white border border-[#E3E1DC] border-dashed rounded-[6px] p-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#EDEAF2] flex items-center justify-center">
              <Layers className="w-6 h-6 text-[#3B3358]" />
            </div>
            <h3 className="text-sm font-semibold text-[#1B1B1F] mb-1">No zones configured</h3>
            <p className="text-xs text-[#6B6B72] mb-4 max-w-md mx-auto">
              Click &quot;Request snapshot &amp; annotate&quot; to take a shelf photo, draw bounding boxes,
              and set capacity &amp; threshold for each zone. The Pi will start detecting items once zones are pushed.
            </p>
            <Button onClick={() => setIsAnnotationOpen(true)} className="mx-auto">
              <Camera className="w-4 h-4 mr-1.5" /> Set up shelf zones
            </Button>
          </div>
        )}

        {/* ─── Shelf Zone Cards ─── */}
        {shelves.length > 0 && (
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3B3358]" />
                <h2 className="text-sm font-semibold text-[#1B1B1F]">
                  Monitored Shelf Zones &amp; Pi Detection Counts
                </h2>
              </div>
              <span className="text-xs font-mono-data text-[#6B6B72]">
                {shelves.length} active zones • Device: {data?.device_id || "pi_shelf_01"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {shelves.map((item) => {
                const statusType =
                  item.status === "ok" ? "good" : item.status === "low" ? "warn" : "bad";
                const barColor =
                  item.status === "ok"
                    ? "bg-[#2E7D4F]"
                    : item.status === "low"
                    ? "bg-[#B07A1E]"
                    : "bg-[#B23A2E]";
                const borderColor =
                  item.status === "oos"
                    ? "border-[#B23A2E]"
                    : item.status === "low"
                    ? "border-[#B07A1E]"
                    : "border-[#E3E1DC]";
                const bgColor = item.status === "oos" ? "bg-[#F6F5F2]" : "bg-white";

                return (
                  <div
                    key={item.shelf_id}
                    className={`p-3.5 rounded-[5px] border transition-all flex flex-col justify-between ${bgColor} ${borderColor}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono-data text-[11px] text-[#6B6B72] tracking-wider font-semibold">
                          {item.sku}
                        </span>
                        <StatusDot
                          status={statusType}
                          label={
                            item.status === "ok"
                              ? "In stock"
                              : item.status === "low"
                              ? "Low stock"
                              : "OOS"
                          }
                        />
                      </div>
                      <div className="text-sm font-semibold text-[#1B1B1F] line-clamp-1">
                        {item.label}
                      </div>
                      <div className="text-[10px] font-mono-data text-[#6B6B72] mt-0.5">
                        Zone: {item.shelf_id}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#E3E1DC]">
                      <div className="flex justify-between items-baseline text-xs font-mono-data">
                        <span className="text-[#6B6B72]">Pi Count:</span>
                        <span className="text-[#1B1B1F] font-bold text-sm">
                          {item.count}{" "}
                          <span className="text-xs font-normal text-[#6B6B72]">/ {item.capacity}</span>
                        </span>
                      </div>

                      <div className="w-full bg-[#E3E1DC] h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(100, item.fillPercent)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono-data mt-2">
                        <span className="text-[#6B6B72]">
                          Threshold: {item.threshold}%
                        </span>
                        <span
                          className={
                            item.status === "ok"
                              ? "text-[#2E7D4F] font-medium"
                              : item.status === "low"
                              ? "text-[#B07A1E] font-medium"
                              : "text-[#B23A2E] font-medium"
                          }
                        >
                          {item.fillPercent}% filled
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Detailed Zone Table ─── */}
        {shelves.length > 0 && (
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] overflow-hidden">
            <div className="p-3 border-b border-[#E3E1DC] flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#1B1B1F] uppercase tracking-wide">
                Zone Detection Log &amp; Replenishment Targets
              </h3>
              <span className="text-xs font-mono-data text-[#6B6B72]">
                Last poll: {lastPollTime || "—"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E1DC] bg-[#F6F5F2] text-[#6B6B72] font-medium h-9">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Zone / Label</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Pi Count</th>
                    <th className="px-3 py-2 text-right">Capacity</th>
                    <th className="px-3 py-2 text-right">Fill %</th>
                    <th className="px-3 py-2 text-right">Threshold</th>
                    <th className="px-3 py-2">Pi Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E1DC]">
                  {shelves.map((item) => (
                    <tr key={item.shelf_id} className="hover:bg-[#F6F5F2]/80 h-9 transition-colors">
                      <td className="px-3 py-2 font-mono-data text-[#3B3358] font-semibold">
                        {item.sku}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-[#1B1B1F]">{item.label}</div>
                        <div className="text-[10px] text-[#6B6B72] font-mono-data">{item.shelf_id}</div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusDot
                          status={
                            item.status === "ok" ? "good" : item.status === "low" ? "warn" : "bad"
                          }
                          label={
                            item.status === "ok"
                              ? "In stock"
                              : item.status === "low"
                              ? "Low stock"
                              : "Out of stock"
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono-data font-bold text-[#1B1B1F]">
                        {item.count}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-data text-[#6B6B72]">
                        {item.capacity}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-data font-semibold text-[#1B1B1F]">
                        {item.fillPercent}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono-data text-[#6B6B72]">
                        &lt;{item.threshold}% = Low
                      </td>
                      <td className="px-3 py-2 font-mono-data text-[#6B6B72]">
                        {piTimestamp
                          ? new Date(piTimestamp).toLocaleTimeString("en-GB", { hour12: false })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Outside zones / total detected info ─── */}
        {data && data.total_detected > 0 && (
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-3 flex items-center gap-4 text-xs font-mono-data text-[#6B6B72]">
            <AlertCircle className="w-4 h-4 text-[#3B3358] shrink-0" />
            <span>
              Pi detected <strong className="text-[#1B1B1F]">{data.total_detected}</strong> total objects
              {data.outside_zones > 0 && (
                <> · <strong className="text-[#B07A1E]">{data.outside_zones}</strong> outside defined zones</>
              )}
            </span>
          </div>
        )}

        {/* ─── Annotation Modal ─── */}
        <ShelfAnnotationModal
          shelf={piShelf}
          isOpen={isAnnotationOpen}
          piConnected={piConnected}
          onClose={() => setIsAnnotationOpen(false)}
          onSaved={handleAnnotationSaved}
        />
      </div>
    </AppShell>
  );
}
