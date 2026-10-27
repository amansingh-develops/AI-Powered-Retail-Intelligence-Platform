export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  timezone: string;
  sqft: number;
}

// ---------------------------------------------------------------------------
// Pi Wire-Format Types — exact shapes the Pi sends and expects
// ---------------------------------------------------------------------------

/** Shape Pi POSTs to /api/events/shelf-status after running model inference */
export interface PiShelfCountPayload {
  device_id: string;
  configuration_version: number;
  timestamp: string; // ISO-8601
  shelves: PiShelfItem[];
}

export interface PiShelfItem {
  shelf_id: string; // matches zone name set during annotation
  count: number;    // current detected item count
}

/** Shape Pi expects when it polls GET /api/devices/:id/config */
export interface PiConfig {
  configuration_version: number;
  zones: PiZone[];
}

/** A single labeled bounding-box zone in absolute image pixels */
export interface PiZone {
  name: string; // human label ("ITEM 1", SKU name, etc.)
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type CameraRole = "shelf" | "queue" | "entry_exit" | "heatmap";
export type DeviceStatus = "online" | "degraded" | "offline";

export interface Device {
  id: string;
  storeId: string;
  deviceModel: string;
  name: string;
  cameraRole: CameraRole;
  ip: string;
  lastSeen: string;
  status: DeviceStatus;
  syncLagSec: number;
  bufferedEvents: number;
  firmwareVersion: string;
}

export interface ShelfRegion {
  id: string;
  label: string;
  sku: string;
  bbox: { x: number; y: number; width: number; height: number }; // normalized 0-100%
  status: "ok" | "low" | "oos";
  currentStock: number;
  capacity: number;
  lastChecked: string;
}

export interface Shelf {
  id: string;
  storeId: string;
  deviceId: string;
  name: string;
  aisle: string;
  category: string;
  snapshotUrl: string;
  regions: ShelfRegion[];
  updatedAt: string;
}

export interface CounterQueue {
  id: string;
  counterNumber: number;
  operatorName: string;
  status: "open" | "closed" | "congested";
  queueLength: number;
  avgWaitSec: number;
  processedPerHour: number;
  trend: "rising" | "stable" | "falling";
}

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type AlertType = "shelf" | "queue" | "device";

export interface Alert {
  id: string;
  refCode: string;
  storeId: string;
  storeName: string;
  type: AlertType;
  severity: AlertSeverity;
  zone: string;
  message: string;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface HeatmapZone {
  id: string;
  name: string;
  poly: { x: number; y: number }[]; // polygon coords in %
  intensity: number; // 0 to 1
  dwellTimeMin: number;
  visitorCount: number;
  status: "high" | "medium" | "low";
}

export interface HourlyFootfall {
  hour: string;
  inCount: number;
  outCount: number;
  netOccupancy: number;
}

export interface DailyInventoryMetric {
  date: string;
  healthPercent: number;
  oosIncidents: number;
  replenishmentTimeMin: number;
}
