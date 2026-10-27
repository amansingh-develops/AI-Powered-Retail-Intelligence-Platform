"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { HeatmapZone } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import {
  Users,
  Camera,
  Video,
  VideoOff,
  RefreshCw,
  Eye,
  EyeOff,
  Radio,
  Clock,
  Flame,
  AlertCircle,
  Loader2,
  Grid,
} from "lucide-react";

interface FloorPlanHeatmapProps {
  zones?: HeatmapZone[];
}

interface DetectedPerson {
  id: number;
  svgX: number;
  svgY: number;
  camXPct: number;
  camYPct: number;
  confidence: number;
  zoneName: string;
  rawBox: { x1: number; y1: number; x2: number; y2: number };
}

interface HeatPoint {
  x: number;
  y: number;
  intensity: number;
  timestamp: number;
}

// Single-Room Functional Sections
const ROOM_SECTIONS = [
  { id: "rear", name: "Rear Wall / Shelves", x: 60, y: 60, width: 880, height: 130 },
  { id: "left", name: "Left Section / Bay", x: 60, y: 210, width: 250, height: 270 },
  { id: "center", name: "Center Open Space", x: 330, y: 210, width: 340, height: 270 },
  { id: "right", name: "Right Section / Bay", x: 690, y: 210, width: 250, height: 270 },
  { id: "front", name: "Foreground / Entry", x: 120, y: 500, width: 760, height: 85 },
];

function getSectionForCoord(x: number, y: number): string {
  for (const s of ROOM_SECTIONS) {
    if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
      return s.name;
    }
  }
  return "Open Floor";
}

export const FloorPlanHeatmap: React.FC<FloorPlanHeatmapProps> = () => {
  const [viewMode, setViewMode] = useState<"live_dots" | "density" | "zones">("live_dots");

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Detection state
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [detectedPeople, setDetectedPeople] = useState<DetectedPerson[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  const [hoveredPerson, setHoveredPerson] = useState<DetectedPerson | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Enumerate USB video devices
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const listDevices = async () => {
      try {
        await navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => {
          s.getTracks().forEach((t) => t.stop());
        }).catch(() => {});

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);

        if (videoInputs.length > 0) {
          const preferred = videoInputs.length > 1 ? videoInputs[1] : videoInputs[0];
          setSelectedDeviceId(preferred.deviceId);
        }
      } catch (err) {
        console.warn("Could not enumerate camera devices:", err);
      }
    };

    listDevices();
  }, []);

  // ---------------------------------------------------------------------------
  // Camera start / stop
  // ---------------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setAutoScan(false);
  }, []);

  const startCamera = useCallback(async (deviceIdOverride?: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const targetId = deviceIdOverride || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetId
          ? { deviceId: { exact: targetId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setCameraActive(true);
        } catch (playErr) {
          if (playErr instanceof Error && playErr.name === "AbortError") return;
          throw playErr;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unable to access camera";
      setCameraError(msg);
      setCameraActive(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [selectedDeviceId]);

  // Loop synchronization & timing
  const isScanningRef = useRef(false);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [baseIntervalSec, setBaseIntervalSec] = useState<number>(5);   // Base interval: 5s
  const [safetyBufferSec, setSafetyBufferSec] = useState<number>(2.5); // 2.5s add-on safety boundary
  const [lastCycleMs, setLastCycleMs] = useState<number | null>(null); // Measured roundtrip
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [cycleState, setCycleState] = useState<"idle" | "capturing" | "waiting">("idle");

  useEffect(() => {
    return () => {
      stopCamera();
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [stopCamera]);

  // ---------------------------------------------------------------------------
  // Sequential Frame Capture & Model Inference (Guaranteed Zero Overlap)
  // ---------------------------------------------------------------------------
  const captureAndAnalyze = useCallback(async (): Promise<number> => {
    // Strict mutex: prevent sending a request while one is already running
    if (!videoRef.current || !cameraActive || isScanningRef.current) return 0;

    isScanningRef.current = true;
    setScanning(true);
    setCycleState("capturing");
    const t0 = Date.now();

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      isScanningRef.current = false;
      setScanning(false);
      setCycleState("idle");
      return 0;
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

    try {
      const res = await fetch("/api/heatmap/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          conf_threshold: 0.15,
          device_label: devices.find((d) => d.deviceId === selectedDeviceId)?.label || "USB Room Camera",
        }),
      });

      const totalTime = Date.now() - t0;
      setLastCycleMs(totalTime);

      if (res.ok) {
        const data = await res.json();
        const imgW = data.image_size?.width || canvas.width;
        const imgH = data.image_size?.height || canvas.height;

        // Map camera coordinates directly to Single-Room space (viewBox: 1000x650)
        const people: DetectedPerson[] = (data.detections || []).map((det: any, idx: number) => {
          const cx = (det.x1 + det.x2) / 2;
          const cy = det.y2 * 0.92 + det.y1 * 0.08; // Feet location on floor

          const camXPct = (cx / imgW) * 100;
          const camYPct = (cy / imgH) * 100;

          const svgX = Math.round(70 + (cx / imgW) * 860);
          const svgY = Math.round(70 + (cy / imgH) * 500);

          const boundedX = Math.max(70, Math.min(930, svgX));
          const boundedY = Math.max(70, Math.min(570, svgY));

          return {
            id: idx + 1,
            svgX: boundedX,
            svgY: boundedY,
            camXPct: Math.round(camXPct * 10) / 10,
            camYPct: Math.round(camYPct * 10) / 10,
            confidence: Math.round((det.confidence || 0) * 100),
            zoneName: getSectionForCoord(boundedX, boundedY),
            rawBox: { x1: det.x1, y1: det.y1, x2: det.x2, y2: det.y2 },
          };
        });

        setDetectedPeople(people);
        setLastElapsedMs(data.elapsed_ms);
        setLastScanTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));

        // Accumulate heat density
        const now = Date.now();
        const newPoints: HeatPoint[] = people.map((p) => ({
          x: p.svgX,
          y: p.svgY,
          intensity: p.confidence / 100,
          timestamp: now,
        }));

        setHeatPoints((prev) => {
          const filtered = prev.filter((p) => now - p.timestamp < 90000);
          return [...filtered, ...newPoints].slice(-100);
        });
      }
      return totalTime;
    } catch (err) {
      console.warn("Heatmap detection error:", err);
      return Date.now() - t0;
    } finally {
      isScanningRef.current = false;
      setScanning(false);
      setCycleState("waiting");
    }
  }, [cameraActive, devices, selectedDeviceId]);

  // ---------------------------------------------------------------------------
  // Adaptive Sequential Loop (Only triggers after previous cycle completes + buffer)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!autoScan || !cameraActive) {
      setCycleState("idle");
      setCountdownSec(null);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    let isSubscribed = true;

    const runSequentialCycle = async () => {
      if (!isSubscribed) return;

      // 1. Await full completion of model inference and response handling
      const cycleDuration = await captureAndAnalyze();
      if (!isSubscribed) return;

      // 2. Compute dynamic cooldown:
      // Minimum safety boundary (e.g. 2.5s) added on, ensuring requests never overlap
      const baseMs = baseIntervalSec * 1000;
      const bufferMs = safetyBufferSec * 1000;
      // Cooldown is remaining base interval + safety buffer, but at least safety buffer duration
      const cooldownMs = Math.max(bufferMs, baseMs - cycleDuration + bufferMs);

      let remainingSec = Math.ceil(cooldownMs / 1000);
      setCountdownSec(remainingSec);

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        remainingSec -= 1;
        if (remainingSec <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setCountdownSec(null);
        } else {
          setCountdownSec(remainingSec);
        }
      }, 1000);

      // 3. Schedule next cycle ONLY after full cooldown has elapsed
      loopTimeoutRef.current = setTimeout(() => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        if (isSubscribed) {
          runSequentialCycle();
        }
      }, cooldownMs);
    };

    runSequentialCycle();

    return () => {
      isSubscribed = false;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [autoScan, cameraActive, captureAndAnalyze, baseIntervalSec, safetyBufferSec]);

  // Calculate live section occupancies
  const sectionCounts = ROOM_SECTIONS.reduce((acc, sec) => {
    acc[sec.id] = detectedPeople.filter((p) => {
      return (
        p.svgX >= sec.x &&
        p.svgX <= sec.x + sec.width &&
        p.svgY >= sec.y &&
        p.svgY <= sec.y + sec.height
      );
    }).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex flex-col h-full relative">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E3E1DC]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#1B1B1F] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#3B3358]" /> Room Space &amp; Live Heatmap
            </h2>
            {cameraActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-data bg-[#2E7D4F]/10 text-[#2E7D4F] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F] animate-pulse" />
                CAM #2 LIVE (5s)
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B6B72] mt-0.5">
            Single-room optical field of view • Real-time 5s spatial person localization
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#F6F5F2] border border-[#E3E1DC] p-0.5 rounded-[5px] text-xs">
          <button
            onClick={() => setViewMode("live_dots")}
            className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === "live_dots"
                ? "bg-[#3B3358] text-white"
                : "text-[#6B6B72] hover:text-[#1B1B1F]"
            }`}
          >
            <Users className="w-3 h-3" /> Live Dots ({detectedPeople.length})
          </button>
          <button
            onClick={() => setViewMode("density")}
            className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === "density"
                ? "bg-[#3B3358] text-white"
                : "text-[#6B6B72] hover:text-[#1B1B1F]"
            }`}
          >
            <Flame className="w-3 h-3" /> Heat Density
          </button>
          <button
            onClick={() => setViewMode("zones")}
            className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === "zones"
                ? "bg-[#3B3358] text-white"
                : "text-[#6B6B72] hover:text-[#1B1B1F]"
            }`}
          >
            <Grid className="w-3 h-3" /> Room Zones
          </button>
        </div>
      </div>

      {/* Camera Selection & Action Toolbar */}
      <div className="my-2.5 flex flex-wrap items-center justify-between gap-2 p-2 bg-[#F6F5F2] border border-[#E3E1DC] rounded-[5px] text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#6B6B72] font-medium">Room Cam:</span>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedDeviceId(newId);
              if (cameraActive) {
                startCamera(newId);
              }
            }}
            className="px-2 py-1 bg-white border border-[#E3E1DC] rounded text-xs text-[#1B1B1F] focus:outline-none focus:ring-1 focus:ring-[#3B3358] max-w-[210px] truncate"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1} (USB Port ${i})`}
              </option>
            ))}
            {devices.length === 0 && <option value="">Default Webcam</option>}
          </select>

          <Button
            variant={cameraActive ? "danger" : "secondary"}
            size="sm"
            onClick={cameraActive ? stopCamera : () => startCamera()}
            className="flex items-center gap-1.5 py-1 px-2.5"
          >
            {cameraActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
            {cameraActive ? "Stop Cam" : "Start Cam"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-1.5 rounded border transition-colors ${
                showPreview
                  ? "bg-[#3B3358] text-white border-[#3B3358]"
                  : "bg-white text-[#6B6B72] border-[#E3E1DC] hover:text-[#1B1B1F]"
              }`}
              title={showPreview ? "Hide Camera View" : "Show Live Camera Preview"}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={captureAndAnalyze}
            disabled={scanning || !cameraActive}
            className="flex items-center gap-1.5 py-1 px-2.5"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Scan Once
          </Button>

          <Button
            variant={autoScan ? "primary" : "secondary"}
            size="sm"
            onClick={() => setAutoScan(!autoScan)}
            disabled={!cameraActive}
            className={`flex items-center gap-1.5 py-1 px-2.5 font-medium ${
              autoScan ? "bg-[#2E7D4F] hover:bg-[#256640] text-white" : ""
            }`}
          >
            {autoScan ? "⏹ Stop 5s Loop" : "▶ Auto 5s Scan"}
          </Button>
        </div>
      </div>

      {/* Loop Timing & Safety Boundary Ribbon */}
      <div className="mb-2.5 px-3 py-2 rounded-[5px] bg-[#FAF9F7] border border-[#E3E1DC] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {cycleState === "capturing" ? (
            <span className="flex items-center gap-1.5 font-medium text-[#8B5CF6]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing frame with ONNX model...
            </span>
          ) : cycleState === "waiting" && countdownSec !== null ? (
            <span className="flex items-center gap-1.5 font-medium text-[#2E7D4F]">
              <Clock className="w-3.5 h-3.5" /> Next scan in{" "}
              <strong className="font-mono-data text-[#1B1B1F] text-sm">{countdownSec}s</strong>
              <span className="text-[#6B6B72]">
                (inference cycle: {lastCycleMs ?? 0}ms + {safetyBufferSec}s safety buffer)
              </span>
            </span>
          ) : (
            <span className="text-[#6B6B72]">
              Sequential loop mode: strictly waits for inference to settle + {safetyBufferSec}s add-on buffer before next capture.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#6B6B72]">
          <div className="flex items-center gap-1">
            <span>Base:</span>
            <select
              value={baseIntervalSec}
              onChange={(e) => setBaseIntervalSec(Number(e.target.value))}
              className="px-1.5 py-0.5 bg-white border border-[#E3E1DC] rounded text-xs text-[#1B1B1F] font-mono-data"
            >
              <option value={4}>4s</option>
              <option value={5}>5s</option>
              <option value={7}>7s</option>
              <option value={10}>10s</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span>Buffer:</span>
            <select
              value={safetyBufferSec}
              onChange={(e) => setSafetyBufferSec(Number(e.target.value))}
              className="px-1.5 py-0.5 bg-white border border-[#E3E1DC] rounded text-xs text-[#1B1B1F] font-mono-data"
            >
              <option value={1.5}>+1.5s</option>
              <option value={2}>+2s</option>
              <option value={2.5}>+2.5s</option>
              <option value={3}>+3s</option>
              <option value={4}>+4s</option>
            </select>
          </div>
        </div>
      </div>

      {cameraError && (
        <div className="mb-2 flex items-center gap-2 p-2 rounded bg-[#B23A2E]/10 border border-[#B23A2E]/30 text-xs text-[#B23A2E]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Hidden processing video & canvas */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* SVG Single-Room Floorplan Canvas */}
      <div className="relative flex-1 min-h-[350px] bg-[#F6F5F2] rounded border border-[#E3E1DC] p-2 overflow-hidden flex items-center justify-center">
        {/* Live Camera Picture-in-Picture Drawer */}
        {showPreview && cameraActive && (
          <div className="absolute top-3 left-3 z-20 w-52 aspect-video bg-[#1B1B1F] rounded-[5px] border-2 border-[#3B3358] shadow-2xl overflow-hidden group">
            <video
              ref={(el) => {
                if (el && streamRef.current && el.srcObject !== streamRef.current) {
                  el.srcObject = streamRef.current;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {detectedPeople.map((p) => (
              <div
                key={p.id}
                className="absolute border border-[#10B981] bg-[#10B981]/20 pointer-events-none"
                style={{
                  left: `${(p.rawBox.x1 / 1280) * 100}%`,
                  top: `${(p.rawBox.y1 / 720) * 100}%`,
                  width: `${((p.rawBox.x2 - p.rawBox.x1) / 1280) * 100}%`,
                  height: `${((p.rawBox.y2 - p.rawBox.y1) / 720) * 100}%`,
                }}
              >
                <span className="absolute -top-3.5 left-0 bg-[#10B981] text-white text-[8px] font-mono-data px-1 rounded">
                  #{p.id}
                </span>
              </div>
            ))}
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#1B1B1F]/80 text-white text-[9px] font-mono-data rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              USB Room Cam • {detectedPeople.length} people
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-1 right-1 text-white bg-black/50 hover:bg-black px-1.5 rounded text-[10px]"
            >
              ✕
            </button>
          </div>
        )}

        <svg
          viewBox="0 0 1000 650"
          className="w-full h-full max-h-[420px] select-none"
          style={{ shapeRendering: "geometricPrecision" }}
        >
          <defs>
            {/* Soft radial heat glow */}
            <radialGradient id="roomHeatGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#3B3358" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#3B3358" stopOpacity="0" />
            </radialGradient>

            {/* Subtle floor grid pattern */}
            <pattern id="roomFloorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E3E1DC" strokeWidth="0.75" />
            </pattern>
          </defs>

          {/* ============================================================ */}
          {/* SINGLE ROOM PERIMETER WALLS                                  */}
          {/* ============================================================ */}
          <rect
            x="40"
            y="40"
            width="920"
            height="560"
            rx="10"
            fill="#FFFFFF"
            stroke="#1B1B1F"
            strokeWidth="3.5"
          />

          {/* Floor grid pattern */}
          <rect
            x="42"
            y="42"
            width="916"
            height="556"
            rx="8"
            fill="url(#roomFloorGrid)"
            opacity="0.6"
          />

          {/* Camera Visual Field of View (FOV) Projection Cone */}
          <g opacity="0.4">
            <polygon
              points="500,595 70,60 930,60"
              fill="#8B5CF6"
              fillOpacity="0.04"
            />
            <line x1="500" y1="595" x2="70" y2="60" stroke="#8B5CF6" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.3" />
            <line x1="500" y1="595" x2="930" y2="60" stroke="#8B5CF6" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.3" />
          </g>

          {/* ============================================================ */}
          {/* ROOM FUNCTIONAL SECTIONS (One cohesive room)                 */}
          {/* ============================================================ */}

          {/* Rear Wall / Shelf Display Area */}
          <g
            className="transition-opacity"
            onMouseEnter={() => setHoveredSection("rear")}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x="60"
              y="60"
              width="880"
              height="130"
              rx="6"
              fill={hoveredSection === "rear" || viewMode === "zones" ? "#EDEAF2" : "#FAF9F7"}
              stroke="#3B3358"
              strokeWidth="1.5"
              strokeDasharray={viewMode === "zones" ? "" : "4 4"}
            />
            <text x="500" y="85" textAnchor="middle" fill="#3B3358" fontSize="13" fontWeight="600" letterSpacing="0.5">
              REAR WALL &amp; PRODUCT SHELVING
            </text>
            <text x="500" y="105" textAnchor="middle" fill="#6B6B72" fontSize="11" fontFamily="monospace">
              Background Depth • {sectionCounts.rear || 0} {sectionCounts.rear === 1 ? "person" : "people"}
            </text>
          </g>

          {/* Left Bay / Shelf Unit */}
          <g
            className="transition-opacity"
            onMouseEnter={() => setHoveredSection("left")}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x="60"
              y="210"
              width="250"
              height="270"
              rx="6"
              fill={hoveredSection === "left" || viewMode === "zones" ? "#EDEAF2" : "#FAF9F7"}
              stroke="#3B3358"
              strokeWidth="1.5"
              strokeDasharray={viewMode === "zones" ? "" : "4 4"}
            />
            <text x="185" y="240" textAnchor="middle" fill="#3B3358" fontSize="12" fontWeight="600">
              LEFT SECTION
            </text>
            <text x="185" y="260" textAnchor="middle" fill="#6B6B72" fontSize="11" fontFamily="monospace">
              {sectionCounts.left || 0} active
            </text>
          </g>

          {/* Central Open Walkway Area */}
          <g
            className="transition-opacity"
            onMouseEnter={() => setHoveredSection("center")}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x="330"
              y="210"
              width="340"
              height="270"
              rx="6"
              fill={hoveredSection === "center" || viewMode === "zones" ? "#EDEAF2" : "#FFFFFF"}
              stroke="#3B3358"
              strokeWidth="1.5"
              fillOpacity={viewMode === "zones" ? 0.8 : 0.6}
            />
            <text x="500" y="240" textAnchor="middle" fill="#3B3358" fontSize="12" fontWeight="600">
              CENTER WALKWAY &amp; OPEN FLOOR
            </text>
            <text x="500" y="260" textAnchor="middle" fill="#6B6B72" fontSize="11" fontFamily="monospace">
              Main Activity Zone • {sectionCounts.center || 0} active
            </text>
          </g>

          {/* Right Bay / Shelf Unit */}
          <g
            className="transition-opacity"
            onMouseEnter={() => setHoveredSection("right")}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x="690"
              y="210"
              width="250"
              height="270"
              rx="6"
              fill={hoveredSection === "right" || viewMode === "zones" ? "#EDEAF2" : "#FAF9F7"}
              stroke="#3B3358"
              strokeWidth="1.5"
              strokeDasharray={viewMode === "zones" ? "" : "4 4"}
            />
            <text x="815" y="240" textAnchor="middle" fill="#3B3358" fontSize="12" fontWeight="600">
              RIGHT SECTION
            </text>
            <text x="815" y="260" textAnchor="middle" fill="#6B6B72" fontSize="11" fontFamily="monospace">
              {sectionCounts.right || 0} active
            </text>
          </g>

          {/* Foreground & Room Entrance */}
          <g
            className="transition-opacity"
            onMouseEnter={() => setHoveredSection("front")}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x="120"
              y="500"
              width="760"
              height="85"
              rx="6"
              fill={hoveredSection === "front" || viewMode === "zones" ? "#EDEAF2" : "#FAF9F7"}
              stroke="#3B3358"
              strokeWidth="1.5"
              strokeDasharray={viewMode === "zones" ? "" : "4 4"}
            />
            <text x="500" y="535" textAnchor="middle" fill="#3B3358" fontSize="12" fontWeight="600">
              FOREGROUND &amp; ENTRYWAY
            </text>
            <text x="500" y="555" textAnchor="middle" fill="#6B6B72" fontSize="11" fontFamily="monospace">
              Near Camera View • {sectionCounts.front || 0} active
            </text>
          </g>

          {/* Room Doorway Cutout */}
          <g>
            <rect x="430" y="594" width="140" height="12" fill="#FFFFFF" />
            <line x1="430" y1="600" x2="570" y2="600" stroke="#3B3358" strokeWidth="2" strokeDasharray="3 3" />
            <text x="500" y="622" textAnchor="middle" fill="#3B3358" fontSize="11" fontWeight="600">
              ROOM ENTRANCE / DOOR
            </text>
          </g>

          {/* Physical USB Camera Mount Marker */}
          <g>
            <circle cx="500" cy="595" r="7" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="2" />
            <text x="500" y="585" textAnchor="middle" fill="#8B5CF6" fontSize="9" fontFamily="monospace" fontWeight="bold">
              CAM #2 (USB)
            </text>
          </g>

          {/* ============================================================ */}
          {/* ACCUMULATED HEAT DENSITY BLOBS                               */}
          {/* ============================================================ */}
          {(viewMode === "density" || viewMode === "live_dots") &&
            heatPoints.map((hp, idx) => (
              <circle
                key={idx}
                cx={hp.x}
                cy={hp.y}
                r="50"
                fill="url(#roomHeatGlow)"
                pointerEvents="none"
              />
            ))}

          {/* ============================================================ */}
          {/* LIVE PERSON DOTS (Exact Ground Coordinates from Bounding Box) */}
          {/* ============================================================ */}
          {detectedPeople.map((person) => {
            const isHovered = hoveredPerson?.id === person.id;
            return (
              <g
                key={person.id}
                className="cursor-pointer transition-transform duration-300"
                onMouseEnter={() => setHoveredPerson(person)}
                onMouseLeave={() => setHoveredPerson(null)}
              >
                {/* Animated Radar Pulse Wave */}
                <circle
                  cx={person.svgX}
                  cy={person.svgY}
                  r="28"
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="2.5"
                  opacity="0.6"
                >
                  <animate
                    attributeName="r"
                    values="16;34;16"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0.1;0.9"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Secondary Ambient Halo */}
                <circle
                  cx={person.svgX}
                  cy={person.svgY}
                  r="18"
                  fill="#8B5CF6"
                  fillOpacity="0.3"
                />

                {/* Core Person Beacon Dot */}
                <circle
                  cx={person.svgX}
                  cy={person.svgY}
                  r={isHovered ? 13 : 11}
                  fill="#3B3358"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="transition-all duration-150 shadow-lg"
                />

                {/* Person Number Tag */}
                <text
                  x={person.svgX}
                  y={person.svgY + 4}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {person.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hovered Person Float Card */}
        {hoveredPerson && (
          <div
            className="absolute bg-[#1B1B1F]/90 text-white rounded-[6px] p-2.5 shadow-2xl text-xs pointer-events-none z-30 min-w-[180px]"
            style={{
              left: `${Math.min(75, (hoveredPerson.svgX / 1000) * 100)}%`,
              top: `${Math.max(8, (hoveredPerson.svgY / 650) * 100 - 15)}%`,
            }}
          >
            <div className="font-semibold flex items-center justify-between gap-2 border-b border-white/20 pb-1">
              <span>Person #{hoveredPerson.id}</span>
              <span className="font-mono-data text-[#10B981]">{hoveredPerson.confidence}% Conf</span>
            </div>
            <div className="mt-1.5 space-y-1 text-[11px] text-[#A0A0A5] font-mono-data">
              <div className="text-white font-medium">{hoveredPerson.zoneName}</div>
              <div>Camera: {hoveredPerson.camXPct}% X • {hoveredPerson.camYPct}% Y</div>
              <div>Floor Pos: ({hoveredPerson.svgX}px, {hoveredPerson.svgY}px)</div>
            </div>
          </div>
        )}

        {/* Camera Inactive Prompt */}
        {!cameraActive && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1.5px] flex flex-col items-center justify-center p-4 text-center rounded pointer-events-none">
            <div className="p-3 rounded-full bg-[#3B3358]/10 mb-2">
              <Camera className="w-6 h-6 text-[#3B3358]" />
            </div>
            <h4 className="text-sm font-semibold text-[#1B1B1F]">
              Room Camera Tracking Inactive
            </h4>
            <p className="text-xs text-[#6B6B72] max-w-sm mt-1">
              Click <strong>Start Cam</strong> above to track everyone in this room and project their exact locations onto this floor space every 5s.
            </p>
          </div>
        )}
      </div>

      {/* Room Section Occupancy Summary Strip */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {ROOM_SECTIONS.map((sec) => (
          <div
            key={sec.id}
            className={`p-2 rounded border transition-colors ${
              (sectionCounts[sec.id] || 0) > 0
                ? "bg-[#EDEAF2] border-[#3B3358]/30 text-[#3B3358]"
                : "bg-[#FAF9F7] border-[#E3E1DC] text-[#6B6B72]"
            }`}
          >
            <div className="font-medium text-[11px] truncate">{sec.name}</div>
            <div className="font-mono-data text-xs font-semibold mt-0.5">
              {sectionCounts[sec.id] || 0} {sectionCounts[sec.id] === 1 ? "person" : "people"}
            </div>
          </div>
        ))}
      </div>

      {/* Telemetry Footer */}
      <div className="mt-3 pt-2 border-t border-[#E3E1DC] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B6B72]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono-data text-[#1B1B1F] font-semibold">
            <span className={`w-2 h-2 rounded-full ${cameraActive ? "bg-[#2E7D4F] animate-pulse" : "bg-[#6B6B72]"}`} />
            Total Room Occupants: {detectedPeople.length}
          </span>
          {lastScanTime && (
            <span className="font-mono-data text-[11px] text-[#6B6B72]">
              Scanned: {lastScanTime} ({lastElapsedMs}ms)
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#3B3358] border-2 border-white shadow inline-block" />
            <span className="font-mono-data text-[11px]">Person Ground Dot</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span>Thermal Density:</span>
            <div className="w-14 h-2 rounded-full bg-gradient-to-r from-[#EDEAF2] via-[#8B5CF6] to-[#3B3358]" />
            <span className="text-[#3B3358] font-medium">High</span>
          </div>

          <span className="flex items-center gap-1 font-mono-data text-[11px]">
            <Clock className="w-3 h-3 text-[#3B3358]" /> 5s Loop
          </span>
        </div>
      </div>
    </div>
  );
};
