import {
  MOCK_STORES,
  MOCK_DEVICES,
  MOCK_SHELVES,
  MOCK_QUEUES,
  MOCK_ALERTS,
  MOCK_HEATMAP_ZONES,
  MOCK_HOURLY_FOOTFALL,
  MOCK_DAILY_INVENTORY,
} from "./mockData";
import { Alert, CounterQueue, Device, Shelf, ShelfRegion, PiConfig, PiZone, PiShelfCountPayload } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a stock status from raw count vs target capacity */
function deriveStatus(count: number, capacity: number): "ok" | "low" | "oos" {
  if (count === 0) return "oos";
  if (count / capacity < 0.25) return "low";
  return "ok";
}

// ---------------------------------------------------------------------------
// Real Pi Edge Shelf & Zone Definitions (100% Real Hardware Data)
// ---------------------------------------------------------------------------

export const REAL_PI_ZONES: PiZone[] = [
  { name: "ITEM 1", x1: 2, y1: 1, x2: 503, y2: 971 },
  { name: "ITEM 2", x1: 508, y1: 2, x2: 1188, y2: 383 },
  { name: "ITEM 3", x1: 508, y1: 390, x2: 1188, y2: 971 },
  { name: "ITEM 4", x1: 1195, y1: 2, x2: 1880, y2: 480 },
  { name: "ITEM 5", x1: 1195, y1: 490, x2: 1880, y2: 971 },
];

export const REAL_PI_SHELF: Shelf = {
  id: "shelf-pi-01",
  storeId: "str-104",
  deviceId: "pi_shelf_01",
  name: "Pi Edge Camera Shelf 01",
  aisle: "Bay 01 (Pi Camera Live)",
  category: "Smart Shelf Bay",
  snapshotUrl: "/api/pi/latest-image",
  updatedAt: "Live",
  regions: [
    {
      id: "reg-pi-1",
      label: "ITEM 1",
      sku: "SKU-ITEM-01",
      bbox: { x: 0.1, y: 0.1, width: 19.3, height: 49.9 },
      status: "ok",
      currentStock: 17,
      capacity: 20,
      lastChecked: "Live Pi inference",
    },
    {
      id: "reg-pi-2",
      label: "ITEM 2",
      sku: "SKU-ITEM-02",
      bbox: { x: 19.6, y: 0.1, width: 26.2, height: 19.6 },
      status: "ok",
      currentStock: 8,
      capacity: 20,
      lastChecked: "Live Pi inference",
    },
    {
      id: "reg-pi-3",
      label: "ITEM 3",
      sku: "SKU-ITEM-03",
      bbox: { x: 19.6, y: 20.1, width: 26.2, height: 29.9 },
      status: "ok",
      currentStock: 14,
      capacity: 20,
      lastChecked: "Live Pi inference",
    },
    {
      id: "reg-pi-4",
      label: "ITEM 4",
      sku: "SKU-ITEM-04",
      bbox: { x: 46.1, y: 0.1, width: 26.4, height: 24.6 },
      status: "low",
      currentStock: 3,
      capacity: 20,
      lastChecked: "Live Pi inference",
    },
    {
      id: "reg-pi-5",
      label: "ITEM 5",
      sku: "SKU-ITEM-05",
      bbox: { x: 46.1, y: 25.2, width: 26.4, height: 24.7 },
      status: "ok",
      currentStock: 11,
      capacity: 20,
      lastChecked: "Live Pi inference",
    },
  ],
};

// In-memory runtime state for prototype
class RetailDataStore {
  stores = [...MOCK_STORES];
  devices = [...MOCK_DEVICES];
  // 100% Real data: Inventory uses the real Raspberry Pi shelf
  shelves: Shelf[] = [{ ...REAL_PI_SHELF, regions: REAL_PI_SHELF.regions.map(r => ({ ...r })) }];
  queues = [...MOCK_QUEUES];
  alerts = [...MOCK_ALERTS];
  heatmapZones = [...MOCK_HEATMAP_ZONES];
  footfall = [...MOCK_HOURLY_FOOTFALL];
  inventoryMetrics = [...MOCK_DAILY_INVENTORY];

  selectedStoreId = "str-104";

  /**
   * Stores the latest Pi zone config per device ID.
   * Key: device_id (e.g. "pi_shelf_01" or internal "pi-cam-01")
   * Value: PiConfig shape ready to serve to the Pi on GET /api/devices/:id/config
   */
  piConfigs: Map<string, PiConfig> = new Map([
    ["pi_shelf_01", { configuration_version: 3, zones: [...REAL_PI_ZONES] }],
    ["pi-cam-01", { configuration_version: 3, zones: [...REAL_PI_ZONES] }],
  ]);

  /**
   * Monotonically increasing configuration version.
   */
  private nextConfigVersion = 4;

  getSelectedStore() {
    return this.stores.find((s) => s.id === this.selectedStoreId) || this.stores[0];
  }

  setSelectedStore(storeId: string) {
    this.selectedStoreId = storeId;
  }

  getOverviewKpis() {
    const totalFootfall = this.footfall.reduce((acc, curr) => acc + curr.inCount, 0);
    const openQueues = this.queues.filter((q) => q.status !== "closed");
    const avgWaitSec =
      openQueues.length > 0
        ? openQueues.reduce((acc, q) => acc + q.avgWaitSec, 0) / openQueues.length
        : 0;
    const avgWaitMin = (avgWaitSec / 60).toFixed(1);

    const activeShelves = this.shelves.filter((s) => s.storeId === this.selectedStoreId);
    let totalRegions = 0;
    let okRegions = 0;
    activeShelves.forEach((s) => {
      s.regions.forEach((r) => {
        totalRegions++;
        if (r.status === "ok") okRegions++;
      });
    });

    const stockHealthPercent = totalRegions > 0 ? Math.round((okRegions / totalRegions) * 100) : 94;
    const openAlertsCount = this.alerts.filter((a) => a.status === "open").length;

    return {
      totalFootfall,
      avgWaitMin,
      stockHealthPercent,
      openAlertsCount,
    };
  }

  getAlerts(filterStatus?: string, filterType?: string) {
    return this.alerts.filter((a) => {
      if (filterStatus && filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterType && filterType !== "all" && a.type !== filterType) return false;
      return true;
    });
  }

  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && alert.status === "open") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = new Date().toLocaleTimeString("en-GB", { hour12: false });
    }
    return alert;
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.status = "resolved";
      alert.resolvedAt = new Date().toLocaleTimeString("en-GB", { hour12: false });
    }
    return alert;
  }

  updateShelfRegions(shelfId: string, regions: ShelfRegion[]) {
    const shelf = this.shelves.find((s) => s.id === shelfId);
    if (shelf) {
      shelf.regions = regions;
      shelf.updatedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    }
    return shelf;
  }

  // ---------------------------------------------------------------------------
  // Pi Config — what the Pi polls on GET /api/devices/:id/config
  // ---------------------------------------------------------------------------

  /**
   * Save a Pi-format zone config (absolute pixel coordinates).
   * deviceId: the Pi's own device_id string OR our internal pi-cam-XX id.
   */
  setPiConfig(deviceId: string, zones: PiConfig["zones"]): PiConfig {
    const version = this.nextConfigVersion++;
    const config: PiConfig = { configuration_version: version, zones };
    this.piConfigs.set(deviceId, config);
    // Mirror to alternative device ID format (underscore vs hyphen)
    this.piConfigs.set(deviceId.replace(/-/g, "_"), config);
    this.piConfigs.set(deviceId.replace(/_/g, "-"), config);

    // Also synchronize the primary shelf's regions
    const shelf = this.shelves.find((s) => s.id === "shelf-pi-01") || this.shelves[0];
    if (shelf) {
      // Map Pi pixel zones to % bboxes (assume standard 2592×1944 camera resolution if not specified)
      const w = 2592;
      const h = 1944;
      shelf.regions = zones.map((z, idx) => {
        const existing = shelf.regions.find((r) => r.label.toLowerCase() === z.name.toLowerCase());
        const xPct = Math.round((z.x1 / w) * 1000) / 10;
        const yPct = Math.round((z.y1 / h) * 1000) / 10;
        const wPct = Math.round(((z.x2 - z.x1) / w) * 1000) / 10;
        const hPct = Math.round(((z.y2 - z.y1) / h) * 1000) / 10;
        return {
          id: existing?.id || `reg-pi-${idx + 1}`,
          label: z.name,
          sku: existing?.sku || `SKU-${z.name.replace(/\s+/g, "-").toUpperCase()}`,
          bbox: { x: xPct, y: yPct, width: wPct, height: hPct },
          status: existing?.status || "ok",
          currentStock: existing?.currentStock ?? 15,
          capacity: existing?.capacity ?? 20,
          lastChecked: existing?.lastChecked || "Configured",
        };
      });
      shelf.updatedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    }

    return config;
  }

  /**
   * Retrieve the current Pi config for a device.
   * Returns null if no config has been saved yet (Pi will use its own defaults).
   */
  getPiConfig(deviceId: string): PiConfig | null {
    return (
      this.piConfigs.get(deviceId) ??
      this.piConfigs.get(deviceId.replace(/-/g, "_")) ??
      this.piConfigs.get(deviceId.replace(/_/g, "-")) ??
      null
    );
  }

  // ---------------------------------------------------------------------------
  // Pi Shelf-Count Ingestion — maps Pi's { shelf_id, count } to shelf regions
  // ---------------------------------------------------------------------------

  /**
   * Accept a shelf-count payload from the Pi and update the matching shelf
   * regions in the dashboard store.
   *
   * Matching strategy:
   *   1. Find the shelf whose deviceId matches the Pi's device_id
   *   2. For each item in payload.shelves, update or dynamically create region
   *   3. Fire alerts for any newly OOS or Low regions
   */
  ingestPiShelfCounts(payload: PiShelfCountPayload): { updated: number; alerts: number } {
    const shelf =
      this.shelves.find(
        (s) =>
          s.deviceId === payload.device_id ||
          s.deviceId.replace(/-/g, "_") === payload.device_id ||
          s.deviceId.replace(/_/g, "-") === payload.device_id ||
          s.id === "shelf-pi-01"
      ) || this.shelves[0];

    if (!shelf) return { updated: 0, alerts: 0 };

    let updatedCount = 0;
    let alertCount = 0;
    const now = new Date().toLocaleTimeString("en-GB", { hour12: false });

    for (const item of payload.shelves) {
      let region = shelf.regions.find(
        (r) =>
          r.label.toLowerCase() === item.shelf_id.toLowerCase() ||
          r.id.toLowerCase() === item.shelf_id.toLowerCase() ||
          r.sku.toLowerCase() === item.shelf_id.toLowerCase()
      );

      if (!region) {
        // Dynamically add the region if Pi detected an item not yet labeled
        const newRegId = `reg-pi-${Date.now()}-${shelf.regions.length + 1}`;
        region = {
          id: newRegId,
          label: item.shelf_id,
          sku: `SKU-${item.shelf_id.replace(/\s+/g, "-").toUpperCase()}`,
          bbox: {
            x: 5 + ((shelf.regions.length * 20) % 75),
            y: 10 + Math.floor(shelf.regions.length / 4) * 35,
            width: 20,
            height: 30,
          },
          status: deriveStatus(item.count, 20),
          currentStock: item.count,
          capacity: 20,
          lastChecked: "Just now",
        };
        shelf.regions.push(region);
        updatedCount++;
        continue;
      }

      const prevStatus = region.status;
      region.currentStock = item.count;
      region.status = deriveStatus(item.count, region.capacity);
      region.lastChecked = "Just now";
      updatedCount++;

      // Only fire new alerts when status worsens
      if (prevStatus === "ok" && (region.status === "low" || region.status === "oos")) {
        const severity = region.status === "oos" ? "critical" : "warning";
        const message = region.status === "oos"
          ? `${region.label} is out of stock (Pi count: 0)`
          : `${region.label} stock dropped to ${item.count} units (Pi count, below 25% threshold)`;

        this.alerts.unshift({
          id: `alt-pi-${Date.now()}-${region.id}`,
          refCode: `ALT-SKU-${region.sku.slice(-3)}`,
          storeId: shelf.storeId,
          storeName: "Store #104 — Indiranagar",
          type: "shelf",
          severity,
          zone: `${shelf.aisle} — ${shelf.name}`,
          message,
          status: "open",
          createdAt: now,
        });
        alertCount++;
      }
    }

    // Update shelf timestamp
    if (updatedCount > 0) {
      shelf.updatedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    }

    return { updated: updatedCount, alerts: alertCount };
  }

  toggleCounterStatus(counterId: string) {
    const counter = this.queues.find((c) => c.id === counterId);
    if (counter) {
      if (counter.status === "closed") {
        counter.status = "open";
        counter.operatorName = "Assigned (Support)";
        counter.queueLength = 1;
        counter.avgWaitSec = 45;
      } else {
        counter.status = "closed";
        counter.operatorName = "Unassigned";
        counter.queueLength = 0;
        counter.avgWaitSec = 0;
      }
    }
    return counter;
  }

  pingDevice(deviceId: string) {
    const device = this.devices.find((d) => d.id === deviceId);
    if (device) {
      device.lastSeen = "Just now";
      device.syncLagSec = 1;
      device.status = "online";
    }
    return device;
  }

  flushDeviceBuffer(deviceId: string) {
    const device = this.devices.find((d) => d.id === deviceId);
    if (device) {
      device.bufferedEvents = 0;
      device.syncLagSec = 1;
      device.status = "online";
    }
    return device;
  }
}

// Singleton for development
export const globalStore = new RetailDataStore();
