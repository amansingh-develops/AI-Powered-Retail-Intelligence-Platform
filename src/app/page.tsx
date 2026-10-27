"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatTile } from "@/components/ui/StatTile";
import { FloorPlanHeatmap } from "@/components/dashboard/FloorPlanHeatmap";
import { LiveAlertsWidget } from "@/components/dashboard/LiveAlertsWidget";
import { LiveQueueDisplay } from "@/components/dashboard/LiveQueueDisplay";
import { TrendCharts } from "@/components/dashboard/TrendCharts";
import { globalStore } from "@/lib/store";
import { HeatmapZone, HourlyFootfall, DailyInventoryMetric, Alert, CounterQueue } from "@/lib/types";
import { RefreshCw, Radio } from "lucide-react";

export default function OverviewPage() {
  const [kpis, setKpis] = useState(globalStore.getOverviewKpis());
  const [heatmapZones, setHeatmapZones] = useState<HeatmapZone[]>(globalStore.heatmapZones);
  const [alerts, setAlerts] = useState<Alert[]>(globalStore.alerts);
  const [queues, setQueues] = useState<CounterQueue[]>(globalStore.queues);
  const [footfall, setFootfall] = useState<HourlyFootfall[]>(globalStore.footfall);
  const [inventory, setInventory] = useState<DailyInventoryMetric[]>(globalStore.inventoryMetrics);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live Raspberry Pi Footfall Sensor State (Port 5001: /api/sensors/store)
  const [peopleInside, setPeopleInside] = useState<number | null>(null);
  const [sensorInfo, setSensorInfo] = useState<{
    connected: boolean;
    deviceId: string;
    source: string;
    lastEvent: { people_inside: number; timestamp: number; type: string } | null;
  }>({
    connected: false,
    deviceId: "pi_sensors_01",
    source: "standby",
    lastEvent: null,
  });

  // Live Raspberry Pi Billing Sensor State (Port 5001: /api/sensors/billing)
  const [billingInfo, setBillingInfo] = useState<{
    avgBillingTime: string;
    avgBillingSeconds: number;
    billingActive: boolean;
    completedCustomers: number;
    connected: boolean;
  }>({
    avgBillingTime: "0m 34s",
    avgBillingSeconds: 34.3,
    billingActive: true,
    completedCustomers: 7,
    connected: false,
  });

  const fetchSensors = async () => {
    // 1. Fetch footfall sensor
    try {
      const res = await fetch("/api/sensors/store");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.people_inside === "number") {
          setPeopleInside(data.people_inside);
          setSensorInfo({
            connected: Boolean(data.connected),
            deviceId: data.device_id || "pi_sensors_01",
            source: data.source || "live_pi",
            lastEvent: data.last_event || null,
          });
        }
      }
    } catch {
      // Offline / network failure handled gracefully
    }

    // 2. Fetch billing wait time sensor
    try {
      const res = await fetch("/api/sensors/billing");
      if (res.ok) {
        const data = await res.json();
        setBillingInfo({
          avgBillingTime: data.average_billing_time || "0m 34s",
          avgBillingSeconds: data.average_billing_time_seconds ?? 34.3,
          billingActive: Boolean(data.billing_active),
          completedCustomers: data.completed_customers ?? 7,
          connected: Boolean(data.connected),
        });
      }
    } catch {
      // Offline fallback
    }
  };

  const refreshData = () => {
    setIsRefreshing(true);
    fetchSensors();
    setKpis(globalStore.getOverviewKpis());
    setHeatmapZones([...globalStore.heatmapZones]);
    setAlerts([...globalStore.alerts]);
    setQueues([...globalStore.queues]);
    setFootfall([...globalStore.footfall]);
    setInventory([...globalStore.inventoryMetrics]);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    // Initial fetch of sensor telemetry
    fetchSensors();

    const sensorTimer = setInterval(() => {
      fetchSensors();
    }, 5000);

    const timer = setInterval(() => {
      setKpis(globalStore.getOverviewKpis());
      setAlerts([...globalStore.alerts]);
      setQueues([...globalStore.queues]);
    }, 3000);

    return () => {
      clearInterval(sensorTimer);
      clearInterval(timer);
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* Page Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-[#E3E1DC]">
          <div>
            <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight">
              Operational Intelligence — Overview
            </h1>
            <p className="text-xs text-[#6B6B72]">
              Live telemetry ingested from on-store Raspberry Pi edge CV models and entry sensors
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-[#E3E1DC] text-xs font-mono-data text-[#1B1B1F]">
              <Radio className="w-3.5 h-3.5 text-[#2E7D4F] animate-pulse" /> Live Telemetry
            </span>
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="p-1.5 rounded bg-white border border-[#E3E1DC] text-[#6B6B72] hover:text-[#1B1B1F] hover:bg-[#EDEAF2] transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Departure Board KPI Stat Strip (Design §1.2 & §3.1) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="Footfall Flow"
            value={peopleInside !== null ? peopleInside.toLocaleString() : "0"}
            subtext={
              sensorInfo.connected
                ? `People inside: ${peopleInside ?? 0} (Pi Sensors 5001)`
                : sensorInfo.lastEvent
                ? `Last event: ${sensorInfo.lastEvent.type} • ${peopleInside ?? 0} inside`
                : "Live sensor endpoint (:5001/api/sensors/store)"
            }
            trend={sensorInfo.connected ? "up" : "neutral"}
            trendValue={sensorInfo.connected ? "Live Sensor" : "Standby (Port 5001)"}
          />
          <StatTile
            label="Avg Queue Wait"
            value={billingInfo.avgBillingTime || `${kpis.avgWaitMin} min`}
            subtext={
              billingInfo.connected
                ? `${billingInfo.avgBillingSeconds}s avg checkout (${billingInfo.completedCustomers} served)`
                : `Across active checkout counters • ${billingInfo.completedCustomers} served`
            }
            trend="down"
            trendValue={billingInfo.connected ? "Live Billing (5001)" : "Standby (Port 5001)"}
          />
          <StatTile
            label="On-Shelf Stock Health"
            value={`${kpis.stockHealthPercent}%`}
            subtext="Monitored FMCG shelf items"
            trend="neutral"
            trendValue="Target 90%+"
          />
          <StatTile
            label="Active Alert Queue"
            value={kpis.openAlertsCount}
            subtext="Requires floor / staff action"
            isWarning={kpis.openAlertsCount > 0}
            trend={kpis.openAlertsCount > 0 ? "down" : "up"}
            trendValue={kpis.openAlertsCount > 0 ? "Action needed" : "All resolved"}
          />
        </div>

        {/* Middle Section: Store Heatmap & Live Alerts Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <FloorPlanHeatmap zones={heatmapZones} />
          </div>
          <div className="lg:col-span-5">
            <LiveAlertsWidget initialAlerts={alerts} />
          </div>
        </div>

        {/* Queue Intelligence Live Gauges */}
        <LiveQueueDisplay
          queues={queues}
          onToggleCounter={() => {
            setQueues([...globalStore.queues]);
            setKpis(globalStore.getOverviewKpis());
          }}
        />

        {/* Bottom Section: Trend Visualizations */}
        <TrendCharts footfall={footfall} inventory={inventory} />
      </div>
    </AppShell>
  );
}
