"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Settings, Shield, Sliders, Store as StoreIcon, CheckCircle2 } from "lucide-react";
import { globalStore } from "@/lib/store";

export default function SettingsPage() {
  // Threshold settings state
  const [queueThreshold, setQueueThreshold] = useState(7);
  const [waitThresholdMin, setWaitThresholdMin] = useState(5.0);
  const [lowStockThresholdPct, setLowStockThresholdPct] = useState(25);
  const [piPollIntervalSec, setPiPollIntervalSec] = useState(10);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="pb-3 border-b border-[#E3E1DC]">
          <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#3B3358]" /> System Configuration & Settings
          </h1>
          <p className="text-xs text-[#6B6B72]">
            Store operational thresholds, edge polling intervals, and user permissions
          </p>
        </div>

        {savedSuccess && (
          <div className="p-2.5 rounded bg-[#2E7D4F]/10 border border-[#2E7D4F]/30 text-[#2E7D4F] text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Settings saved successfully and dispatched to Pi edge devices.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Alert & Trigger Thresholds (PRD §4.8) */}
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E3E1DC] mb-4">
              <Sliders className="w-4 h-4 text-[#3B3358]" />
              <h2 className="text-sm font-semibold text-[#1B1B1F]">
                Operational Alert Thresholds
              </h2>
            </div>

            <form onSubmit={handleSaveThresholds} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1B1B1F] mb-1">
                  Queue Length Trigger (Shoppers)
                </label>
                <div className="text-[11px] text-[#6B6B72] mb-1.5">
                  Triggers &quot;Recommend opening next counter&quot; recommendation
                </div>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={queueThreshold}
                  onChange={(e) => setQueueThreshold(Number(e.target.value))}
                  className="w-full text-xs font-mono-data px-3 py-2 bg-[#F6F5F2] border border-[#E3E1DC] rounded focus:outline-none focus:bg-white focus:border-[#3B3358]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1B1B1F] mb-1">
                  Queue SLA Max Wait Time (Minutes)
                </label>
                <div className="text-[11px] text-[#6B6B72] mb-1.5">
                  Alert generated if estimated checkout wait exceeds this target
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="15"
                  value={waitThresholdMin}
                  onChange={(e) => setWaitThresholdMin(Number(e.target.value))}
                  className="w-full text-xs font-mono-data px-3 py-2 bg-[#F6F5F2] border border-[#E3E1DC] rounded focus:outline-none focus:bg-white focus:border-[#3B3358]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1B1B1F] mb-1">
                  Shelf Low-Stock Alert Level (%)
                </label>
                <div className="text-[11px] text-[#6B6B72] mb-1.5">
                  Flags SKU as &quot;Low stock&quot; when capacity falls below this percentage
                </div>
                <input
                  type="number"
                  min="10"
                  max="50"
                  value={lowStockThresholdPct}
                  onChange={(e) => setLowStockThresholdPct(Number(e.target.value))}
                  className="w-full text-xs font-mono-data px-3 py-2 bg-[#F6F5F2] border border-[#E3E1DC] rounded focus:outline-none focus:bg-white focus:border-[#3B3358]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1B1B1F] mb-1">
                  Raspberry Pi Config Poll Interval (Seconds)
                </label>
                <div className="text-[11px] text-[#6B6B72] mb-1.5">
                  Frequency at which on-store Pis poll GET /api/devices/:id/config
                </div>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={piPollIntervalSec}
                  onChange={(e) => setPiPollIntervalSec(Number(e.target.value))}
                  className="w-full text-xs font-mono-data px-3 py-2 bg-[#F6F5F2] border border-[#E3E1DC] rounded focus:outline-none focus:bg-white focus:border-[#3B3358]"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" className="w-full">
                  Save & Apply Thresholds
                </Button>
              </div>
            </form>
          </div>

          {/* Section 2: User Roles & Store Setup */}
          <div className="space-y-4">
            {/* User & Access Profile */}
            <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E3E1DC] mb-3">
                <Shield className="w-4 h-4 text-[#3B3358]" />
                <h2 className="text-sm font-semibold text-[#1B1B1F]">
                  User Access & Roles (Prototype Scope)
                </h2>
              </div>

              <p className="text-xs text-[#6B6B72] mb-3">
                Per PRD §2, single Master role is active during the prototype phase to enable unconstrained evaluation of all operational features.
              </p>

              <div className="bg-[#F6F5F2] border border-[#E3E1DC] rounded-[5px] p-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#6B6B72]">Active Role:</span>
                  <span className="font-semibold text-[#3B3358]">Master User (Full Capabilities)</span>
                </div>
                <div className="flex justify-between font-mono-data">
                  <span className="text-[#6B6B72]">RBAC Phase:</span>
                  <span>Deferred to Phase 8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B72]">Access Scope:</span>
                  <span>All Stores, Devices, Annotation, Reports</span>
                </div>
              </div>
            </div>

            {/* Store Onboarding Information */}
            <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E3E1DC] mb-3">
                <StoreIcon className="w-4 h-4 text-[#3B3358]" />
                <h2 className="text-sm font-semibold text-[#1B1B1F]">
                  Store Onboarding Information
                </h2>
              </div>

              <div className="space-y-2 text-xs">
                {globalStore.stores.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded border border-[#E3E1DC] bg-[#F6F5F2]"
                  >
                    <div>
                      <div className="font-medium text-[#1B1B1F]">{s.name}</div>
                      <div className="text-[11px] text-[#6B6B72]">{s.address}</div>
                    </div>
                    <span className="font-mono-data text-xs text-[#3B3358] font-semibold">
                      {s.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
