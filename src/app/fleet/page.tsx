"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusDot } from "@/components/ui/StatusDot";
import { Button } from "@/components/ui/Button";
import { globalStore } from "@/lib/store";
import { Device } from "@/lib/types";
import { Server, RefreshCw, Cpu, Database, Activity, Wifi } from "lucide-react";

export default function FleetPage() {
  const [devices, setDevices] = useState<Device[]>(globalStore.devices);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const handlePing = async (id: string) => {
    setActiveActionId(`ping-${id}`);
    try {
      await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id, action: "ping" }),
      });
      globalStore.pingDevice(id);
      setDevices([...globalStore.devices]);
    } catch {
      // Handled
    } finally {
      setTimeout(() => setActiveActionId(null), 600);
    }
  };

  const handleFlushBuffer = async (id: string) => {
    setActiveActionId(`flush-${id}`);
    try {
      await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id, action: "flush" }),
      });
      globalStore.flushDeviceBuffer(id);
      setDevices([...globalStore.devices]);
    } catch {
      // Handled
    } finally {
      setTimeout(() => setActiveActionId(null), 600);
    }
  };

  const total = devices.length;
  const online = devices.filter((d) => d.status === "online").length;
  const degraded = devices.filter((d) => d.status === "degraded").length;
  const totalBuffered = devices.reduce((sum, d) => sum + d.bufferedEvents, 0);

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E1DC]">
          <div>
            <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight flex items-center gap-2">
              <Server className="w-5 h-5 text-[#3B3358]" /> Raspberry Pi Edge Fleet Health
            </h1>
            <p className="text-xs text-[#6B6B72]">
              On-store hardware nodes running edge inference models and local SQLite buffering
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-data">
            <span className="px-2 py-1 bg-white border border-[#E3E1DC] rounded">
              <span className="text-[#2E7D4F] font-semibold">{online} Online</span>
            </span>
            {degraded > 0 && (
              <span className="px-2 py-1 bg-white border border-[#B07A1E] rounded">
                <span className="text-[#B07A1E] font-semibold">{degraded} Sync Lagging</span>
              </span>
            )}
          </div>
        </div>

        {/* Fleet Architecture Overview Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[5px] bg-[#EDEAF2] text-[#3B3358] flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B6B72]">Edge Compute Topology</div>
              <div className="text-base font-semibold text-[#1B1B1F] font-mono-data">
                {total} Nodes Deployed
              </div>
              <div className="text-[11px] text-[#6B6B72]">Pi 4B & Pi 5 (Hailo-8L / NPU)</div>
            </div>
          </div>

          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[5px] bg-[#EDEAF2] text-[#3B3358] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B6B72]">Offline SQLite Buffer</div>
              <div className="text-base font-semibold text-[#1B1B1F] font-mono-data">
                {totalBuffered} Events Buffered
              </div>
              <div className="text-[11px] text-[#6B6B72]">Resilient to intermittent store WiFi</div>
            </div>
          </div>

          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[5px] bg-[#EDEAF2] text-[#3B3358] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#6B6B72]">REST Polling Cycle</div>
              <div className="text-base font-semibold text-[#1B1B1F] font-mono-data">
                10s Config Poll
              </div>
              <div className="text-[11px] text-[#6B6B72]">No inbound port forwarding needed</div>
            </div>
          </div>
        </div>

        {/* Fleet Hardware Table (Compact 36px row height per Design §1.3) */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] overflow-hidden">
          <div className="p-3 border-b border-[#E3E1DC] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#3B3358]" />
              <h2 className="text-xs font-semibold text-[#1B1B1F] uppercase tracking-wide">
                Store Pi Nodes & Camera Endpoints
              </h2>
            </div>
            <span className="text-xs font-mono-data text-[#6B6B72]">
              All nodes push via REST POST /api/events/*
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E1DC] bg-[#F6F5F2] text-[#6B6B72] font-medium h-9">
                  <th className="px-3 py-2">Device ID</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Mount Location / Description</th>
                  <th className="px-3 py-2">Hardware Model</th>
                  <th className="px-3 py-2">Local IP</th>
                  <th className="px-3 py-2">Sync Lag</th>
                  <th className="px-3 py-2 text-right">Buffered</th>
                  <th className="px-3 py-2">Heartbeat</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E1DC]">
                {devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-[#F6F5F2]/80 h-9 transition-colors">
                    <td className="px-3 py-2 font-mono-data text-[#3B3358] font-semibold tracking-wide">
                      {dev.id}
                    </td>

                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#F6F5F2] border border-[#E3E1DC] text-[10px] font-mono-data uppercase text-[#1B1B1F]">
                        {dev.cameraRole}
                      </span>
                    </td>

                    <td className="px-3 py-2 font-medium text-[#1B1B1F] whitespace-nowrap">
                      {dev.name}
                    </td>

                    <td className="px-3 py-2 text-[#6B6B72] whitespace-nowrap">
                      {dev.deviceModel}
                    </td>

                    <td className="px-3 py-2 font-mono-data text-[#6B6B72] whitespace-nowrap">
                      {dev.ip}
                    </td>

                    <td className="px-3 py-2 font-mono-data">
                      <span
                        className={
                          dev.syncLagSec > 60
                            ? "text-[#B07A1E] font-semibold"
                            : "text-[#2E7D4F]"
                        }
                      >
                        {dev.syncLagSec}s
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-mono-data">
                      <span
                        className={
                          dev.bufferedEvents > 0
                            ? "text-[#B07A1E] font-semibold"
                            : "text-[#6B6B72]"
                        }
                      >
                        {dev.bufferedEvents}
                      </span>
                    </td>

                    <td className="px-3 py-2 font-mono-data text-[#6B6B72]">
                      {dev.lastSeen}
                    </td>

                    <td className="px-3 py-2">
                      <StatusDot
                        status={
                          dev.status === "online"
                            ? "good"
                            : dev.status === "degraded"
                            ? "warn"
                            : "bad"
                        }
                        label={
                          dev.status === "online"
                            ? "Online"
                            : dev.status === "degraded"
                            ? "Lagging"
                            : "Offline"
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handlePing(dev.id)}
                          disabled={activeActionId === `ping-${dev.id}`}
                          className="px-2 py-1 text-[11px] font-mono-data text-[#1B1B1F] bg-[#F6F5F2] hover:bg-[#EDEAF2] border border-[#E3E1DC] rounded transition-colors"
                        >
                          {activeActionId === `ping-${dev.id}` ? "Pinging..." : "Ping"}
                        </button>

                        {dev.bufferedEvents > 0 && (
                          <button
                            onClick={() => handleFlushBuffer(dev.id)}
                            disabled={activeActionId === `flush-${dev.id}`}
                            className="px-2 py-1 text-[11px] font-mono-data text-[#B07A1E] bg-[#B07A1E]/10 hover:bg-[#B07A1E]/20 border border-[#B07A1E]/30 rounded transition-colors"
                          >
                            {activeActionId === `flush-${dev.id}` ? "Flushing..." : "Flush Buffer"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
