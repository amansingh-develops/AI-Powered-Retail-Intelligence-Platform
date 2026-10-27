"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import {
  Users,
  Camera,
  Square,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Video,
  VideoOff,
  Loader2,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  in_zone?: boolean;
}

interface QueueZone {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bboxPercent: { x: number; y: number; width: number; height: number };
}

interface DetectionResult {
  count: number;
  zone_count: number;
  detections: Detection[];
  elapsed_ms: number;
  timestamp: string;
  image_size: { width: number; height: number };
}

interface BillingSensorData {
  average_billing_time: string;
  average_billing_time_seconds: number;
  billing_active: boolean;
  completed_customers: number;
  device_id: string;
  connected?: boolean;
  source?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function QueuePage() {
  // Webcam state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Zone drawing state
  const [zone, setZone] = useState<QueueZone | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Detection state
  const [inferenceConnected, setInferenceConnected] = useState<boolean | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [lastResult, setLastResult] = useState<DetectionResult | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<{ time: string; count: number }[]>([]);
  const [autoDetect, setAutoDetect] = useState(false);
  const [confThreshold, setConfThreshold] = useState(0.15);

  // Live Pi Billing Sensor State (Port 5001: /api/sensors/billing)
  const [billingData, setBillingData] = useState<BillingSensorData | null>({
    average_billing_time: "0m 34s",
    average_billing_time_seconds: 34.3,
    billing_active: true,
    completed_customers: 7,
    device_id: "pi_sensors_01",
  });
  const [billingConnected, setBillingConnected] = useState<boolean | null>(null);

  const fetchBillingTelemetry = useCallback(async () => {
    try {
      const res = await fetch("/api/sensors/billing");
      if (res.ok) {
        const data = await res.json();
        setBillingData(data);
        setBillingConnected(Boolean(data.connected));
      }
    } catch {
      // Graceful offline fallback
    }
  }, []);

  // Zone save status
  const [zoneSaveMsg, setZoneSaveMsg] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Check inference server health & poll billing sensor
  // -----------------------------------------------------------------------
  useEffect(() => {
    fetch("/api/queue/detect")
      .then((r) => r.json())
      .then((d) => setInferenceConnected(d.connected ?? false))
      .catch(() => setInferenceConnected(false));

    fetchBillingTelemetry();
    const billingTimer = setInterval(fetchBillingTelemetry, 4000);
    return () => clearInterval(billingTimer);
  }, [fetchBillingTelemetry]);

  // -----------------------------------------------------------------------
  // Load saved zone from MongoDB
  // -----------------------------------------------------------------------
  useEffect(() => {
    fetch("/api/queue/zones")
      .then((r) => r.json())
      .then((d) => {
        if (d.zone) setZone(d.zone);
      })
      .catch(() => {});
  }, []);

  // -----------------------------------------------------------------------
  // Start/stop webcam
  // -----------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setAutoDetect(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      setCameraError(null);

      // Stop any existing tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        try {
          await video.play();
          setCameraActive(true);
        } catch (playErr: unknown) {
          // If play was aborted due to quick reload or new request, ignore
          if (playErr instanceof Error && playErr.name === "AbortError") {
            return;
          }
          throw playErr;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg);
      setCameraActive(false);
    } finally {
      isStartingRef.current = false;
    }
  }, []);

  // Auto-start camera on mount with cleanup
  useEffect(() => {
    let unmounted = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((precheckStream) => {
        // Stop the precheck stream
        precheckStream.getTracks().forEach((t) => t.stop());
        if (!unmounted) {
          startCamera();
        }
      })
      .catch(() => {
        if (!unmounted) {
          startCamera();
        }
      });

    return () => {
      unmounted = true;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const isDetectingRef = useRef(false);
  const queueLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // -----------------------------------------------------------------------
  // Capture frame & run detection (with mutex guard)
  // -----------------------------------------------------------------------
  const captureAndDetect = useCallback(async (): Promise<number> => {
    if (!videoRef.current || !cameraActive || isDetectingRef.current) return 0;
    isDetectingRef.current = true;
    setDetecting(true);
    const t0 = Date.now();

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      isDetectingRef.current = false;
      setDetecting(false);
      return 0;
    }
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

    // Build zone in pixel coords if we have one
    let pixelZone: { x1: number; y1: number; x2: number; y2: number } | undefined;
    if (zone) {
      pixelZone = {
        x1: Math.round((zone.bboxPercent.x / 100) * video.videoWidth),
        y1: Math.round((zone.bboxPercent.y / 100) * video.videoHeight),
        x2: Math.round(((zone.bboxPercent.x + zone.bboxPercent.width) / 100) * video.videoWidth),
        y2: Math.round(((zone.bboxPercent.y + zone.bboxPercent.height) / 100) * video.videoHeight),
      };
    }

    try {
      const res = await fetch("/api/queue/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          zone: pixelZone || undefined,
          conf_threshold: confThreshold,
        }),
      });

      const totalElapsed = Date.now() - t0;

      if (res.ok) {
        const result: DetectionResult = await res.json();
        setLastResult(result);
        setDetectionHistory((prev) => {
          const entry = {
            time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
            count: zone ? result.zone_count : result.count,
          };
          return [...prev.slice(-29), entry]; // keep last 30
        });
      }
      return totalElapsed;
    } catch (err) {
      console.warn("Detection failed:", err);
      return Date.now() - t0;
    } finally {
      isDetectingRef.current = false;
      setDetecting(false);
    }
  }, [cameraActive, zone, confThreshold]);

  // -----------------------------------------------------------------------
  // Sequential Auto-detect loop (strictly non-overlapping with safety buffer)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!autoDetect || !cameraActive) {
      if (queueLoopTimeoutRef.current) clearTimeout(queueLoopTimeoutRef.current);
      return;
    }

    let isSubscribed = true;

    const runSequentialQueueLoop = async () => {
      if (!isSubscribed) return;

      const duration = await captureAndDetect();
      if (!isSubscribed) return;

      // Ensure at least 3 seconds cooldown AFTER completion, target ~10s total cycle
      const cooldownMs = Math.max(3000, 10000 - duration + 2500);

      queueLoopTimeoutRef.current = setTimeout(() => {
        if (isSubscribed) {
          runSequentialQueueLoop();
        }
      }, cooldownMs);
    };

    runSequentialQueueLoop();

    return () => {
      isSubscribed = false;
      if (queueLoopTimeoutRef.current) clearTimeout(queueLoopTimeoutRef.current);
    };
  }, [autoDetect, cameraActive, captureAndDetect]);

  // -----------------------------------------------------------------------
  // Zone drawing handlers
  // -----------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawMode || !containerRef.current) return;
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

  const handleMouseUp = async () => {
    if (!isDrawing || !currentBox || currentBox.w < 3 || currentBox.h < 3) {
      setIsDrawing(false);
      setCurrentBox(null);
      return;
    }

    const video = videoRef.current;
    const vw = video?.videoWidth || 1280;
    const vh = video?.videoHeight || 720;

    const newZone: QueueZone = {
      x1: Math.round((currentBox.x / 100) * vw),
      y1: Math.round((currentBox.y / 100) * vh),
      x2: Math.round(((currentBox.x + currentBox.w) / 100) * vw),
      y2: Math.round(((currentBox.y + currentBox.h) / 100) * vh),
      bboxPercent: {
        x: Math.round(currentBox.x * 10) / 10,
        y: Math.round(currentBox.y * 10) / 10,
        width: Math.round(currentBox.w * 10) / 10,
        height: Math.round(currentBox.h * 10) / 10,
      },
    };

    setZone(newZone);
    setIsDrawing(false);
    setCurrentBox(null);
    setDrawMode(false);

    // Save to MongoDB
    try {
      await fetch("/api/queue/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: newZone }),
      });
      setZoneSaveMsg("Queue zone saved!");
      setTimeout(() => setZoneSaveMsg(null), 2000);
    } catch {
      setZoneSaveMsg("Failed to save zone");
    }
  };

  const clearZone = async () => {
    setZone(null);
    setLastResult(null);
    try {
      await fetch("/api/queue/zones", { method: "DELETE" });
      setZoneSaveMsg("Queue zone cleared");
      setTimeout(() => setZoneSaveMsg(null), 2000);
    } catch {
      // ignore
    }
  };

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------
  const peopleCount = lastResult
    ? zone
      ? lastResult.zone_count
      : lastResult.count
    : 0;

  const avgCount =
    detectionHistory.length > 0
      ? Math.round(
          detectionHistory.reduce((a, h) => a + h.count, 0) / detectionHistory.length
        )
      : 0;

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E1DC]">
          <div>
            <h1 className="text-[22px] font-semibold text-[#1B1B1F] leading-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-[#3B3358]" /> Queue Intelligence
            </h1>
            <p className="text-xs text-[#6B6B72]">
              Real-time people counting from local camera using ONNX model inference
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Inference server status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E3E1DC] rounded-[5px] text-xs">
              {inferenceConnected === null ? (
                <span className="font-mono-data text-[#6B6B72]">Checking model server...</span>
              ) : inferenceConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
                  <span className="font-mono-data text-[#2E7D4F] font-medium">Model Server Online (port 5001)</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B23A2E]" />
                  <span className="font-mono-data text-[#B23A2E]">Model Server Offline</span>
                </>
              )}
            </div>

            {/* Billing sensor status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E3E1DC] rounded-[5px] text-xs">
              {billingConnected === null ? (
                <span className="font-mono-data text-[#6B6B72]">Checking billing sensor...</span>
              ) : billingConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
                  <span className="font-mono-data text-[#2E7D4F] font-medium">Billing Sensor Live (port 5001)</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B07A1E]" />
                  <span className="font-mono-data text-[#6B6B72]">Billing Standby / Cached</span>
                </>
              )}
            </div>

            {/* Camera toggle */}
            <Button
              variant="secondary"
              size="sm"
              onClick={cameraActive ? stopCamera : startCamera}
              className="flex items-center gap-1.5"
            >
              {cameraActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              {cameraActive ? "Stop Camera" : "Start Camera"}
            </Button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="Total Shoppers in Queue"
            value={peopleCount}
            subtext={zone ? "Inside drawn queue zone" : "All detected people in frame"}
            trend={peopleCount > 5 ? "up" : "neutral"}
            trendValue={
              lastResult
                ? `${lastResult.elapsed_ms}ms inference`
                : "Local ONNX Model"
            }
          />
          <StatTile
            label="Avg Wait / Billing Time"
            value={billingData?.average_billing_time || "0m 34s"}
            subtext={
              billingData?.average_billing_time_seconds
                ? `${billingData.average_billing_time_seconds}s avg per customer`
                : "Pi billing sensor (port 5001)"
            }
            trend={billingConnected ? "down" : "neutral"}
            trendValue={billingConnected ? "Live Sensor" : "Pi Sensor (5001)"}
          />
          <StatTile
            label="Completed Customers"
            value={billingData?.completed_customers ?? 7}
            subtext={
              billingData?.billing_active
                ? "Billing counter actively processing"
                : "Billing desk idle / waiting"
            }
            trend={billingData?.billing_active ? "up" : "neutral"}
            trendValue={billingData?.billing_active ? "Active Serving" : "Standby"}
          />
          <StatTile
            label="Total Detected in Frame"
            value={lastResult?.count ?? 0}
            subtext={zone ? `${peopleCount} in queue • ${(lastResult?.count ?? 0) - peopleCount} outside` : "Full camera frame count"}
            trend="neutral"
            trendValue={autoDetect ? "Auto (10s)" : "Manual mode"}
          />
        </div>

        {/* Billing Counter Live Telemetry Bar */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${billingData?.billing_active ? "bg-[#2E7D4F] animate-pulse" : "bg-[#6B6B72]"}`} />
            <span className="font-medium text-[#1B1B1F]">Billing Desk ({billingData?.device_id || "pi_sensors_01"})</span>
            <span className="text-[#E3E1DC]">|</span>
            <span className="text-[#6B6B72]">
              Status: <strong className={billingData?.billing_active ? "text-[#2E7D4F]" : "text-[#6B6B72]"}>{billingData?.billing_active ? "Actively Serving Customer" : "Idle"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[#6B6B72] font-mono-data">
            <span>Avg Wait: <strong className="text-[#1B1B1F]">{billingData?.average_billing_time || "0m 34s"}</strong> ({billingData?.average_billing_time_seconds ?? 34.3}s)</span>
            <span>Completed: <strong className="text-[#1B1B1F]">{billingData?.completed_customers ?? 7}</strong> shoppers</span>
            <button
              onClick={fetchBillingTelemetry}
              className="p-1 text-[#6B6B72] hover:text-[#1B1B1F] rounded hover:bg-[#F6F5F2] transition-colors"
              title="Refresh billing sensor telemetry"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Camera Error */}
        {cameraError && (
          <div className="flex items-center gap-2 p-2.5 rounded bg-[#B23A2E]/10 border border-[#B23A2E]/30 text-xs text-[#B23A2E]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Camera error: {cameraError}</span>
          </div>
        )}

        {/* Inference server offline warning */}
        {inferenceConnected === false && (
          <div className="flex items-center gap-2 p-2.5 rounded bg-[#B07A1E]/10 border border-[#B07A1E]/30 text-xs text-[#B07A1E]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Inference server not running. Open a terminal and run:{" "}
              <code className="font-mono-data bg-[#B07A1E]/10 px-1 rounded">
                python src/app/queue/CVmodal-countPeople/server.py
              </code>
            </span>
          </div>
        )}

        {/* Camera View + Detection Canvas */}
        <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E1DC]">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#3B3358]" />
              <h2 className="text-sm font-semibold text-[#1B1B1F]">
                Live Camera &amp; People Detection
              </h2>
              {cameraActive && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-data bg-[#2E7D4F]/10 text-[#2E7D4F] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F] animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Sensitivity Slider */}
              <div className="flex items-center gap-2 px-2.5 py-1 bg-[#F5F4F0] rounded-[5px] border border-[#E3E1DC] text-xs">
                <span className="text-[#6B6B72] text-[11px]">Sensitivity:</span>
                <input
                  type="range"
                  min="0.08"
                  max="0.40"
                  step="0.01"
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                  className="w-16 sm:w-20 cursor-pointer accent-[#3B3358]"
                  title={`Confidence threshold: ${Math.round(confThreshold * 100)}%`}
                />
                <span className="font-mono-data text-[#1B1B1F] text-[11px] w-6 text-right font-medium">
                  {Math.round(confThreshold * 100)}%
                </span>
              </div>

              {/* Draw Zone button */}
              <Button
                variant={drawMode ? "primary" : "secondary"}
                size="sm"
                onClick={() => setDrawMode(!drawMode)}
                className="flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" />
                {drawMode ? "Drawing... (drag on view)" : "Draw Queue Zone"}
              </Button>

              {zone && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearZone}
                  className="flex items-center gap-1.5 text-[#B23A2E]"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Zone
                </Button>
              )}

              {/* Single detect */}
              <Button
                variant="secondary"
                size="sm"
                onClick={captureAndDetect}
                disabled={detecting || !cameraActive || !inferenceConnected}
                className="flex items-center gap-1.5"
              >
                {detecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {detecting ? "Running..." : "Detect Once"}
              </Button>

              {/* Auto detect toggle */}
              <Button
                variant={autoDetect ? "danger" : "primary"}
                size="sm"
                onClick={() => setAutoDetect(!autoDetect)}
                disabled={!cameraActive || !inferenceConnected}
                className="flex items-center gap-1.5"
              >
                {autoDetect ? "⏹ Stop Auto" : "▶ Auto Detect (10s)"}
              </Button>
            </div>
          </div>

          {/* Queue area guide & legend */}
          <div className="mb-3 px-3 py-2 rounded-[5px] bg-[#FAF9F5] border border-[#E3E1DC] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6B72]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#1B1B1F]">Zone Mode:</span>
              {zone ? (
                <span>
                  Counting people inside your drawn queue zone. Draw a wide box to cover everyone waiting in line.
                </span>
              ) : (
                <span>
                  No queue zone drawn — counting all people detected in frame. Click <strong>Draw Queue Zone</strong> to isolate the queue.
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono-data text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" /> In Queue Zone:{" "}
                <strong className="text-[#1B1B1F]">{lastResult?.zone_count ?? 0}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2E7D4F]" /> Total In Frame:{" "}
                <strong className="text-[#1B1B1F]">{lastResult?.count ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Zone save feedback */}
          {zoneSaveMsg && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-[#2E7D4F] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> {zoneSaveMsg}
            </div>
          )}

          {/* Video Container */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`relative w-full aspect-video bg-[#1B1B1F] rounded-[5px] overflow-hidden border border-[#E3E1DC] ${
              drawMode ? "cursor-crosshair" : ""
            }`}
          >
            {/* Video element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Hidden capture canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Existing zone overlay */}
            {zone && (
              <div
                className="absolute border-2 border-[#3B3358] bg-[#3B3358]/15 z-10 pointer-events-none"
                style={{
                  left: `${zone.bboxPercent.x}%`,
                  top: `${zone.bboxPercent.y}%`,
                  width: `${zone.bboxPercent.width}%`,
                  height: `${zone.bboxPercent.height}%`,
                }}
              >
                <div className="absolute top-0 left-0 bg-[#3B3358] text-white text-[10px] font-mono-data px-1.5 py-0.5 rounded-br font-medium">
                  QUEUE ZONE • {peopleCount} people
                </div>
              </div>
            )}

            {/* Detection overlays */}
            {lastResult?.detections.map((det, idx) => {
              if (!lastResult.image_size) return null;
              const { width: imgW, height: imgH } = lastResult.image_size;
              const leftPct = (det.x1 / imgW) * 100;
              const topPct = (det.y1 / imgH) * 100;
              const widthPct = ((det.x2 - det.x1) / imgW) * 100;
              const heightPct = ((det.y2 - det.y1) / imgH) * 100;

              const isInQueue = det.in_zone !== false && (zone !== null ? det.in_zone === true : true);
              const borderColor = isInQueue ? "border-[#8B5CF6]" : "border-[#2E7D4F]";
              const bgColor = isInQueue ? "bg-[#8B5CF6]/15" : "bg-[#2E7D4F]/10";
              const badgeBg = isInQueue ? "bg-[#8B5CF6]" : "bg-[#2E7D4F]";
              const label = isInQueue ? "IN QUEUE" : "PERSON";

              return (
                <div
                  key={idx}
                  className={`absolute border-2 ${borderColor} ${bgColor} pointer-events-none z-5 transition-all`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                >
                  <div
                    className={`absolute top-0 left-0 ${badgeBg} text-white text-[9px] font-mono-data px-1.5 py-0.5 rounded-br font-medium shadow-sm`}
                  >
                    {label} • {(det.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}

            {/* Drawing overlay */}
            {isDrawing && currentBox && (
              <div
                className="absolute border-2 border-dashed border-[#3B3358] bg-[#3B3358]/20 pointer-events-none z-20"
                style={{
                  left: `${currentBox.x}%`,
                  top: `${currentBox.y}%`,
                  width: `${currentBox.w}%`,
                  height: `${currentBox.h}%`,
                }}
              />
            )}

            {/* Camera off state */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <VideoOff className="w-10 h-10 text-[#6B6B72]" />
                <span className="text-sm text-[#6B6B72]">Camera is off</span>
                <Button size="sm" onClick={startCamera}>
                  Start Camera
                </Button>
              </div>
            )}

            {/* Detecting spinner overlay */}
            {detecting && (
              <div className="absolute top-2 right-2 bg-[#1B1B1F]/80 text-white text-[11px] font-mono-data px-2.5 py-1 rounded flex items-center gap-2 z-30">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running ONNX inference...
              </div>
            )}

            {/* Bottom info bar */}
            {cameraActive && (
              <div className="absolute bottom-2 left-2 bg-[#1B1B1F]/80 text-white text-[11px] font-mono-data px-2.5 py-1 rounded flex items-center gap-3 z-10">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F] animate-pulse" />
                  LIVE
                </span>
                {autoDetect && <span>Auto-detect: every 10s</span>}
                {lastResult && (
                  <span>
                    Last: {lastResult.count} people ({lastResult.elapsed_ms}ms)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detection History */}
        {detectionHistory.length > 0 && (
          <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4">
            <h3 className="text-xs font-semibold text-[#1B1B1F] uppercase tracking-wide mb-3">
              Detection History (Last {detectionHistory.length} readings)
            </h3>
            <div className="flex items-end gap-1 h-[80px]">
              {detectionHistory.map((entry, idx) => {
                const maxCount = Math.max(1, ...detectionHistory.map((h) => h.count));
                const heightPct = (entry.count / maxCount) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-[#3B3358] rounded-t-[2px] transition-all relative group"
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                    title={`${entry.time}: ${entry.count} people`}
                  >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono-data text-[#6B6B72] opacity-0 group-hover:opacity-100 whitespace-nowrap">
                      {entry.count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono-data text-[#6B6B72] mt-1">
              <span>{detectionHistory[0]?.time}</span>
              <span>{detectionHistory[detectionHistory.length - 1]?.time}</span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
