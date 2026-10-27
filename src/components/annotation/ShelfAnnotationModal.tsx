"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Shelf, ShelfRegion } from "@/lib/types";
import { X, Trash2, CheckCircle2, Cpu, Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnnotationZone {
  /** Unique local id for react key */
  id: string;
  /** Zone name sent to Pi — e.g. "ITEM 1" */
  name: string;
  /** Human-readable product label */
  label: string;
  /** SKU code */
  sku: string;
  /** Max items that fit in this shelf zone */
  capacity: number;
  /** Low-stock threshold in % — below this = "Low stock" warning */
  threshold: number;
  /** Bounding box in % of canvas (for UI rendering) */
  bboxPercent: { x: number; y: number; width: number; height: number };
  /** Absolute pixel coords (for sending to Pi) */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ShelfAnnotationModalProps {
  shelf: Shelf;
  isOpen: boolean;
  piConnected?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ShelfAnnotationModal: React.FC<ShelfAnnotationModalProps> = ({
  shelf,
  isOpen,
  piConnected = false,
  onClose,
  onSaved,
}) => {
  const [zones, setZones] = useState<AnnotationZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string>("");

  // Edit form state for selected zone
  const [activeName, setActiveName] = useState("");
  const [activeLabel, setActiveLabel] = useState("");
  const [activeSku, setActiveSku] = useState("");
  const [activeCapacity, setActiveCapacity] = useState(20);
  const [activeThreshold, setActiveThreshold] = useState(25);

  // Image natural dimensions — measured from Pi camera (2592×1944)
  const [imageNaturalWidth, setImageNaturalWidth] = useState(2592);
  const [imageNaturalHeight, setImageNaturalHeight] = useState(1944);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  // -------------------------------------------------------------------------
  // Fetch snapshot when modal opens
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingSnapshot(true);
    setSnapshotLoaded(false);
    setSaveSuccess(false);
    setSaveError(null);

    // Fetch a fresh snapshot from the Pi via our proxy
    const url = `/api/pi/latest-image?t=${Date.now()}`;
    setSnapshotUrl(url);

    // Also load existing zones from MongoDB
    fetch(`/api/zones?deviceId=${shelf.deviceId || "pi_shelf_01"}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.zones && data.zones.length > 0) {
          setZones(
            data.zones.map((z: any, idx: number) => ({
              id: `zone-${idx}-${Date.now()}`,
              name: z.name || `ITEM ${idx + 1}`,
              label: z.label || z.name || "",
              sku: z.sku || "",
              capacity: z.capacity ?? 20,
              threshold: z.threshold ?? 25,
              bboxPercent: z.bboxPercent || { x: 0, y: 0, width: 10, height: 10 },
              x1: z.x1 ?? 0,
              y1: z.y1 ?? 0,
              x2: z.x2 ?? 100,
              y2: z.y2 ?? 100,
            }))
          );
        }
      })
      .catch(() => {});
  }, [isOpen, shelf.deviceId]);

  // Sync edit form when selection changes
  useEffect(() => {
    if (selectedZone) {
      setActiveName(selectedZone.name);
      setActiveLabel(selectedZone.label);
      setActiveSku(selectedZone.sku);
      setActiveCapacity(selectedZone.capacity);
      setActiveThreshold(selectedZone.threshold);
    }
  }, [selectedZoneId, selectedZone]);

  // -------------------------------------------------------------------------
  // Canvas drawing handlers
  // -------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setDrawStart({ x: xPct, y: yPct });
    setCurrentBox({ x: xPct, y: yPct, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setCurrentBox({
      x: Math.min(drawStart.x, xPct),
      y: Math.min(drawStart.y, yPct),
      w: Math.abs(xPct - drawStart.x),
      h: Math.abs(yPct - drawStart.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox || currentBox.w < 2 || currentBox.h < 2) {
      setIsDrawing(false);
      setCurrentBox(null);
      return;
    }

    const newZoneId = `zone-${Date.now()}`;
    const zoneIndex = zones.length + 1;

    // Convert % bbox to absolute pixel coords
    const x1 = Math.round((currentBox.x / 100) * imageNaturalWidth);
    const y1 = Math.round((currentBox.y / 100) * imageNaturalHeight);
    const x2 = Math.round(((currentBox.x + currentBox.w) / 100) * imageNaturalWidth);
    const y2 = Math.round(((currentBox.y + currentBox.h) / 100) * imageNaturalHeight);

    const newZone: AnnotationZone = {
      id: newZoneId,
      name: `ITEM ${zoneIndex}`,
      label: `New Shelf Zone ${zoneIndex}`,
      sku: `SKU-ZONE-${String(zoneIndex).padStart(2, "0")}`,
      capacity: 20,
      threshold: 25,
      bboxPercent: {
        x: Math.round(currentBox.x * 10) / 10,
        y: Math.round(currentBox.y * 10) / 10,
        width: Math.round(currentBox.w * 10) / 10,
        height: Math.round(currentBox.h * 10) / 10,
      },
      x1,
      y1,
      x2,
      y2,
    };

    setZones((prev) => [...prev, newZone]);
    setSelectedZoneId(newZoneId);
    setIsDrawing(false);
    setCurrentBox(null);
  };

  // -------------------------------------------------------------------------
  // Zone editing
  // -------------------------------------------------------------------------
  const handleUpdateZoneForm = useCallback(() => {
    if (!selectedZoneId) return;
    setZones((prev) =>
      prev.map((z) =>
        z.id === selectedZoneId
          ? {
              ...z,
              name: activeName,
              label: activeLabel,
              sku: activeSku,
              capacity: Number(activeCapacity) || 20,
              threshold: Number(activeThreshold) || 25,
            }
          : z
      )
    );
  }, [selectedZoneId, activeName, activeLabel, activeSku, activeCapacity, activeThreshold]);

  const handleDeleteZone = (id: string) => {
    const remaining = zones.filter((z) => z.id !== id);
    setZones(remaining);
    if (selectedZoneId === id) {
      setSelectedZoneId(remaining[0]?.id || null);
    }
  };

  // -------------------------------------------------------------------------
  // Save & push to Pi
  // -------------------------------------------------------------------------
  const handleSaveAndApply = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Step 1: Get current Pi configuration version
      let currentVersion = 0;
      try {
        const configRes = await fetch("/api/pi/configuration");
        if (configRes.ok) {
          const configData = await configRes.json();
          currentVersion = configData.configuration_version ?? 0;
        }
      } catch {
        // If Pi unreachable, we still save to MongoDB
      }

      const newVersion = currentVersion + 1;

      // Build Pi-format zones (only name + pixel coords)
      const piZones = zones.map((z) => ({
        name: z.name,
        x1: z.x1,
        y1: z.y1,
        x2: z.x2,
        y2: z.y2,
      }));

      // Build full zones for MongoDB (includes capacity, threshold, label, sku)
      const mongoZones = zones.map((z) => ({
        name: z.name,
        label: z.label,
        sku: z.sku,
        capacity: z.capacity,
        threshold: z.threshold,
        x1: z.x1,
        y1: z.y1,
        x2: z.x2,
        y2: z.y2,
        bboxPercent: z.bboxPercent,
      }));

      // Step 2: Save to MongoDB (our internal store with capacity + threshold)
      const mongoRes = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: shelf.deviceId || "pi_shelf_01",
          configurationVersion: newVersion,
          zones: mongoZones,
        }),
      });

      if (!mongoRes.ok) {
        const err = await mongoRes.json();
        throw new Error(err.error || "Failed to save zones to database");
      }

      // Step 3: Push zone config to Pi (only name + pixel coords + version)
      try {
        const piRes = await fetch("/api/pi/configuration", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            configuration_version: newVersion,
            zones: piZones,
          }),
        });

        if (!piRes.ok) {
          const piErr = await piRes.json().catch(() => ({}));
          setSaveError(`Saved to DB but Pi rejected config: ${(piErr as any).error || piRes.statusText}`);
        }
      } catch {
        setSaveError("Saved to DB but could not reach Pi — it will pick up config when reconnected");
      }

      setSaveSuccess(true);
      onSaved();

      // Close modal after brief success feedback
      setTimeout(() => {
        setSaveSuccess(false);
        setSaveError(null);
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B1B1F]/60 backdrop-blur-[2px]">
      <div className="bg-white border border-[#E3E1DC] rounded-[10px] w-full max-w-6xl h-[90vh] flex flex-col modal-elevated overflow-hidden m-4">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#E3E1DC] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[5px] bg-[#EDEAF2] text-[#3B3358] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1B1B1F]">
                Annotate shelf zones — {shelf.name || "Pi Shelf"}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6B6B72] font-mono-data flex-wrap">
                <span>Device: {shelf.deviceId || "pi_shelf_01"}</span>
                {piConnected ? (
                  <span className="flex items-center gap-1 text-[#2E7D4F] font-medium">
                    <Wifi className="w-3 h-3" /> Pi Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#B07A1E]">
                    <WifiOff className="w-3 h-3" /> Pi Offline
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#6B6B72] hover:text-[#1B1B1F] hover:bg-[#F6F5F2] rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Visual Canvas Area */}
          <div className="flex-1 bg-[#1B1B1F] p-4 flex flex-col items-center justify-center overflow-auto relative select-none">
            <div className="text-xs text-[#E3E1DC] mb-2 font-mono-data flex items-center gap-2">
              <span>Draw bounding boxes on the shelf snapshot. Set name, capacity & threshold per zone.</span>
              <span className="px-1.5 py-0.5 bg-[#3B3358] rounded text-[11px]">
                {zones.length} Zones
              </span>
            </div>

            {/* Canvas Frame — Pi snapshot loaded once */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative w-full max-w-[800px] aspect-[4/3] bg-[#2A2930] rounded border border-white/20 overflow-hidden cursor-crosshair shadow-inner"
            >
              {/* Pi snapshot — only rendered when URL is available */}
              {snapshotUrl ? (
                <>                
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={snapshotUrl}
                  alt="Pi shelf snapshot"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setImageNaturalWidth(img.naturalWidth);
                      setImageNaturalHeight(img.naturalHeight);
                    }
                    setIsLoadingSnapshot(false);
                    setSnapshotLoaded(true);
                  }}
                  onError={() => {
                    setIsLoadingSnapshot(false);
                    setSnapshotLoaded(true);
                  }}
                />
                </>
              ) : null}

              {/* Loading spinner */}
              {isLoadingSnapshot && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#EDEAF2] animate-spin" />
                  <span className="ml-2 text-[#EDEAF2] text-xs font-mono-data">Fetching snapshot from Pi...</span>
                </div>
              )}

              {/* Existing bounding boxes */}
              {snapshotLoaded &&
                zones.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  return (
                    <div
                      key={zone.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedZoneId(zone.id);
                      }}
                      className={`absolute transition-all cursor-pointer ${
                        isSelected
                          ? "border-2 border-[#EDEAF2] bg-[#3B3358]/40 z-20 shadow-[0_0_0_1px_#3B3358]"
                          : "border border-[#EDEAF2]/70 bg-[#3B3358]/20 hover:bg-[#3B3358]/30 z-10"
                      }`}
                      style={{
                        left: `${zone.bboxPercent.x}%`,
                        top: `${zone.bboxPercent.y}%`,
                        width: `${zone.bboxPercent.width}%`,
                        height: `${zone.bboxPercent.height}%`,
                      }}
                    >
                      <div className="absolute top-0 left-0 bg-[#3B3358] text-[#EDEAF2] text-[10px] font-mono-data px-1.5 py-0.5 rounded-br truncate max-w-full font-medium">
                        {zone.name}
                      </div>
                    </div>
                  );
                })}

              {/* In-progress drawn box */}
              {isDrawing && currentBox && (
                <div
                  className="absolute border-2 border-[#EDEAF2] bg-[#EDEAF2]/20 pointer-events-none z-30"
                  style={{
                    left: `${currentBox.x}%`,
                    top: `${currentBox.y}%`,
                    width: `${currentBox.w}%`,
                    height: `${currentBox.h}%`,
                  }}
                />
              )}
            </div>

            {/* Image dimensions badge */}
            {snapshotLoaded && (
              <div className="mt-2 text-[11px] font-mono-data text-[#8B8B92]">
                Image: {imageNaturalWidth} × {imageNaturalHeight} px
              </div>
            )}
          </div>

          {/* Right Inspector & Zones Panel */}
          <div className="w-80 border-l border-[#E3E1DC] bg-[#F6F5F2] flex flex-col justify-between p-4 overflow-y-auto shrink-0">
            <div>
              <div className="text-xs font-semibold text-[#1B1B1F] tracking-wide uppercase mb-2">
                Zone Config ({zones.length})
              </div>

              {/* Zone Selector Pills */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto mb-4 pr-1">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={`p-2 rounded border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      zone.id === selectedZoneId
                        ? "bg-white border-[#3B3358] text-[#1B1B1F] font-medium"
                        : "bg-white/60 border-[#E3E1DC] text-[#6B6B72] hover:bg-white"
                    }`}
                  >
                    <div className="truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3B3358]" />
                      <span className="truncate">{zone.name}</span>
                    </div>
                    <span className="font-mono-data text-[10px] text-[#6B6B72] shrink-0">
                      Cap: {zone.capacity}
                    </span>
                  </div>
                ))}
              </div>

              {/* Zone Details Form */}
              {selectedZone ? (
                <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-3 space-y-2.5">
                  <div className="text-xs font-semibold text-[#1B1B1F]">
                    Edit Zone Details
                  </div>

                  {/* Zone Name (sent to Pi) */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B6B72] mb-0.5">
                      Zone Name <span className="text-[#B07A1E]">(sent to Pi)</span>
                    </label>
                    <input
                      type="text"
                      value={activeName}
                      onChange={(e) => setActiveName(e.target.value)}
                      onBlur={handleUpdateZoneForm}
                      className="w-full text-xs px-2 py-1.5 border border-[#E3E1DC] rounded focus:outline-none focus:border-[#3B3358] font-mono-data"
                      placeholder="ITEM 1"
                    />
                  </div>

                  {/* Product Label */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B6B72] mb-0.5">
                      Product Label
                    </label>
                    <input
                      type="text"
                      value={activeLabel}
                      onChange={(e) => setActiveLabel(e.target.value)}
                      onBlur={handleUpdateZoneForm}
                      className="w-full text-xs px-2 py-1.5 border border-[#E3E1DC] rounded focus:outline-none focus:border-[#3B3358]"
                      placeholder="Lays Classic Salted 50g"
                    />
                  </div>

                  {/* SKU */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B6B72] mb-0.5">
                      SKU Code
                    </label>
                    <input
                      type="text"
                      value={activeSku}
                      onChange={(e) => setActiveSku(e.target.value)}
                      onBlur={handleUpdateZoneForm}
                      className="w-full text-xs font-mono-data px-2 py-1.5 border border-[#E3E1DC] rounded focus:outline-none focus:border-[#3B3358]"
                      placeholder="SKU-LAY-001"
                    />
                  </div>

                  {/* Capacity & Threshold side-by-side */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#6B6B72] mb-0.5">
                        Capacity (units)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={activeCapacity}
                        onChange={(e) => setActiveCapacity(Number(e.target.value))}
                        onBlur={handleUpdateZoneForm}
                        className="w-full text-xs font-mono-data px-2 py-1.5 border border-[#E3E1DC] rounded focus:outline-none focus:border-[#3B3358]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#6B6B72] mb-0.5">
                        Threshold (%)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={activeThreshold}
                        onChange={(e) => setActiveThreshold(Number(e.target.value))}
                        onBlur={handleUpdateZoneForm}
                        className="w-full text-xs font-mono-data px-2 py-1.5 border border-[#E3E1DC] rounded focus:outline-none focus:border-[#3B3358]"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-[#6B6B72]">
                    Low stock alert triggers when count &lt; {Math.ceil(activeCapacity * (activeThreshold / 100))} units ({activeThreshold}% of {activeCapacity})
                  </div>

                  {/* Pixel coords readout */}
                  <div className="pt-2 border-t border-[#E3E1DC] flex justify-between items-center">
                    <button
                      onClick={() => handleDeleteZone(selectedZone.id)}
                      className="text-xs text-[#B23A2E] hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                    <span className="text-[10px] font-mono-data text-[#6B6B72]">
                      px: ({selectedZone.x1},{selectedZone.y1})→({selectedZone.x2},{selectedZone.y2})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[#6B6B72] bg-white border border-[#E3E1DC] rounded">
                  Draw a bounding box on the snapshot or select an existing zone above.
                </div>
              )}
            </div>

            {/* Save Action */}
            <div className="mt-4 pt-3 border-t border-[#E3E1DC] space-y-2">
              {saveError && (
                <div className="p-2 rounded bg-[#B07A1E]/10 border border-[#B07A1E]/30 text-[#B07A1E] text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess ? (
                <div className="p-2.5 rounded bg-[#2E7D4F]/10 border border-[#2E7D4F]/30 text-[#2E7D4F] text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Saved to DB & pushed to Pi. Model updating...</span>
                </div>
              ) : (
                <Button
                  onClick={handleSaveAndApply}
                  disabled={isSaving || zones.length === 0}
                  className="w-full"
                >
                  {isSaving ? "Saving..." : `Save & Apply (${zones.length} zones)`}
                </Button>
              )}
              <div className="text-[11px] text-[#6B6B72] text-center font-mono-data space-y-0.5">
                <div>Zones → MongoDB (capacity + threshold)</div>
                <div>Coords → Pi PUT /api/configuration (version+1)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
