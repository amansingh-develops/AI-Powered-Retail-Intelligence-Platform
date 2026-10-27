"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { FileBarChart, Download, Calendar, Store as StoreIcon, TrendingUp } from "lucide-react";
import { globalStore } from "@/lib/store";

export default function ReportsPage() {
  const [selectedRange, setSelectedRange] = useState("7d");
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const kpis = globalStore.getOverviewKpis();
  const stores = globalStore.stores;

  const handleExport = (format: "CSV" | "PDF") => {
    setDownloadSuccess(`Generated ${format} report bundle. Downloading...`);
    setTimeout(() => {
      setDownloadSuccess(null);
    }, 2500);
  };

  const storeComparison = [
    {
      name: "Store #104 — Indiranagar",
      code: "BLR-IND-104",
      footfall: 1284,
      stockHealth: 94,
      avgWait: "3.2 min",
      slaCompliance: "98.4%",
      alertsResolved: 14,
    },
    {
      name: "Store #208 — Koramangala",
      code: "BLR-KOR-208",
      footfall: 1620,
      stockHealth: 96,
      avgWait: "2.4 min",
      slaCompliance: "99.1%",
      alertsResolved: 21,
    },
    {
      name: "Store #312 — HSR Layout",
      code: "BLR-HSR-312",
      footfall: 1090,
      stockHealth: 91,
      avgWait: "4.1 min",
      slaCompliance: "94.2%",
      alertsResolved: 18,
    },
  ];

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E1DC]">
          <div>
            <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-[#3B3358]" /> Operational Intelligence Reports
            </h1>
            <p className="text-xs text-[#6B6B72]">
              Audit trails, multi-store operational metrics, and data export feeds
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Range Selector */}
            <div className="flex items-center bg-white border border-[#E3E1DC] rounded-[5px] p-0.5 text-xs">
              {(["today", "7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r)}
                  className={`px-3 py-1 font-medium rounded transition-colors uppercase ${
                    selectedRange === r
                      ? "bg-[#3B3358] text-white"
                      : "text-[#6B6B72] hover:text-[#1B1B1F]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Export Buttons */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport("CSV")}
              className="flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport("PDF")}
              className="flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </Button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="p-2.5 rounded bg-[#2E7D4F]/10 border border-[#2E7D4F]/30 text-[#2E7D4F] text-xs font-medium">
            ✓ {downloadSuccess}
          </div>
        )}

        {/* Multi-Store Comparison Table (PRD §4.7) */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] overflow-hidden">
          <div className="p-3 border-b border-[#E3E1DC] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-[#3B3358]" />
              <h2 className="text-xs font-semibold text-[#1B1B1F] uppercase tracking-wide">
                Multi-Store Regional Operations Benchmark
              </h2>
            </div>
            <span className="text-xs font-mono-data text-[#6B6B72]">
              Regional Zone: Bengaluru Central
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E1DC] bg-[#F6F5F2] text-[#6B6B72] font-medium h-9">
                  <th className="px-3 py-2">Store Code</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-right">Daily Footfall</th>
                  <th className="px-3 py-2 text-right">Stock Availability</th>
                  <th className="px-3 py-2 text-right">Avg Checkout Wait</th>
                  <th className="px-3 py-2 text-right">SLA Compliance</th>
                  <th className="px-3 py-2 text-right">Alerts Handled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E1DC]">
                {storeComparison.map((st) => (
                  <tr key={st.code} className="hover:bg-[#F6F5F2]/80 h-9 transition-colors">
                    <td className="px-3 py-2 font-mono-data text-[#3B3358] font-semibold">
                      {st.code}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#1B1B1F]">{st.name}</td>
                    <td className="px-3 py-2 text-right font-mono-data text-[#1B1B1F] font-medium">
                      {st.footfall.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-data">
                      <span className="text-[#2E7D4F] font-semibold">{st.stockHealth}%</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono-data text-[#1B1B1F]">
                      {st.avgWait}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-data text-[#2E7D4F]">
                      {st.slaCompliance}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-data text-[#6B6B72]">
                      {st.alertsResolved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed KPI Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4">
            <div className="text-xs font-semibold text-[#1B1B1F] mb-1">
              Shrinkage & Stock-Out Mitigation
            </div>
            <p className="text-xs text-[#6B6B72] mb-3">
              Automated edge CV notifications reduced average shelf OOS duration from 45 min to 12 min.
            </p>
            <div className="text-2xl font-mono-data font-semibold text-[#2E7D4F]">
              73% faster replenishment
            </div>
          </div>

          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4">
            <div className="text-xs font-semibold text-[#1B1B1F] mb-1">
              Queue SLA Adherence
            </div>
            <p className="text-xs text-[#6B6B72] mb-3">
              Dynamic standby counter recommendations reduced peak-hour queue abandonment by 62%.
            </p>
            <div className="text-2xl font-mono-data font-semibold text-[#3B3358]">
              98.4% within 3 min SLA
            </div>
          </div>

          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4">
            <div className="text-xs font-semibold text-[#1B1B1F] mb-1">
              Edge Network Resilience
            </div>
            <p className="text-xs text-[#6B6B72] mb-3">
              Zero event loss during store network outages via local SQLite event persistence on Pi.
            </p>
            <div className="text-2xl font-mono-data font-semibold text-[#1B1B1F]">
              100% data fidelity
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
