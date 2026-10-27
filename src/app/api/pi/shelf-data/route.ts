import { NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/pi/shelf-data
 *
 * 1. Polls Pi's GET http://192.168.137.33:5000/api/shelf-data
 * 2. Stores the result in MongoDB collection "shelf_readings"
 * 3. Merges Pi counts with our saved zone metadata (capacity, threshold)
 *    from MongoDB collection "zones"
 * 4. Returns the merged result to the frontend
 *
 * When Pi is offline, returns the last stored reading from MongoDB.
 *
 * Response shape:
 * {
 *   piConnected: boolean,
 *   device_id: string,
 *   configuration_version: number,
 *   timestamp: string,
 *   shelves: [{ shelf_id, count, label, capacity, threshold, status, fillPercent }],
 *   outside_zones: number,
 *   total_detected: number,
 *   source: "pi_live" | "mongodb_cached"
 * }
 */
export async function GET() {
  const db = await getDb();

  // Try to fetch live data from Pi
  let piData: PiShelfDataResponse | null = null;
  let piConnected = false;

  if (PI_CONFIG.isOnline) {
    try {
      const res = await fetchFromPi("/api/shelf-data");
      if (res.ok) {
        piData = await res.json();
        piConnected = true;

        // Store in MongoDB (upsert by device_id, keep latest + append to history)
        if (piData && piData.device_id) {
          await db.collection("shelf_readings").insertOne({
            ...piData,
            storedAt: new Date(),
          });
        }
      }
    } catch {
      piConnected = false;
    }
  }

  // If Pi is offline, get last cached reading from MongoDB
  if (!piData) {
    const cached = await db
      .collection("shelf_readings")
      .findOne(
        { device_id: "pi_shelf_01" },
        { sort: { storedAt: -1 } }
      );

    if (cached) {
      piData = {
        device_id: cached.device_id,
        configuration_version: cached.configuration_version,
        timestamp: cached.timestamp,
        shelves: cached.shelves || [],
        outside_zones: cached.outside_zones ?? 0,
        total_detected: cached.total_detected ?? 0,
      };
    }
  }

  // Get our zone metadata from MongoDB (capacity, threshold, label per zone)
  const zonesDoc = await db
    .collection("zones")
    .findOne(
      { deviceId: "pi_shelf_01" },
      { sort: { savedAt: -1 } }
    );

  const zonesMeta: Record<string, ZoneMeta> = {};
  if (zonesDoc?.zones) {
    for (const z of zonesDoc.zones) {
      zonesMeta[z.name.toLowerCase()] = {
        label: z.label || z.name,
        sku: z.sku || "",
        capacity: z.capacity ?? 20,
        threshold: z.threshold ?? 25,
      };
    }
  }

  // Merge Pi counts with our zone metadata
  const mergedShelves = (piData?.shelves || []).map((s: PiShelfItem) => {
    const meta = zonesMeta[s.shelf_id.toLowerCase()];
    const capacity = meta?.capacity ?? 20;
    const threshold = meta?.threshold ?? 25;
    const count = s.count ?? 0;
    const fillPercent = capacity > 0 ? Math.round((count / capacity) * 100) : 0;

    let status: "ok" | "low" | "oos" = "ok";
    if (count === 0) status = "oos";
    else if (fillPercent < threshold) status = "low";

    return {
      shelf_id: s.shelf_id,
      count,
      label: meta?.label || s.shelf_id,
      sku: meta?.sku || `SKU-${s.shelf_id.replace(/\s+/g, "-").toUpperCase()}`,
      capacity,
      threshold,
      status,
      fillPercent,
    };
  });

  return NextResponse.json({
    piConnected,
    device_id: piData?.device_id || "pi_shelf_01",
    configuration_version: piData?.configuration_version ?? 0,
    timestamp: piData?.timestamp || null,
    shelves: mergedShelves,
    outside_zones: piData?.outside_zones ?? 0,
    total_detected: piData?.total_detected ?? 0,
    source: piConnected ? "pi_live" : "mongodb_cached",
    fetchedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Types (local to this route)
// ---------------------------------------------------------------------------

interface PiShelfItem {
  shelf_id: string;
  count: number;
}

interface PiShelfDataResponse {
  device_id: string;
  configuration_version: number;
  timestamp: string;
  shelves: PiShelfItem[];
  outside_zones: number;
  total_detected: number;
}

interface ZoneMeta {
  label: string;
  sku: string;
  capacity: number;
  threshold: number;
}
