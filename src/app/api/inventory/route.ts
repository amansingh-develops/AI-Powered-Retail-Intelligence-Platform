import { NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory
 *
 * Returns current inventory state by:
 * 1. Polling Pi's /api/shelf-data for live detection counts
 * 2. Merging with MongoDB zone metadata (capacity, threshold)
 * 3. Computing stock status (ok / low / oos)
 *
 * Falls back to last MongoDB cached reading when Pi is offline.
 */
export async function GET() {
  const db = await getDb();

  let piConnected = false;
  let piShelfData: any = null;

  // Try to get live data from Pi
  if (PI_CONFIG.isOnline) {
    try {
      const res = await fetchFromPi("/api/shelf-data");
      if (res.ok) {
        piShelfData = await res.json();
        piConnected = true;

        // Store reading in MongoDB
        if (piShelfData?.device_id) {
          await db.collection("shelf_readings").insertOne({
            ...piShelfData,
            storedAt: new Date(),
          });
        }
      }
    } catch {
      piConnected = false;
    }
  }

  // Fallback to MongoDB cache
  if (!piShelfData) {
    const cached = await db
      .collection("shelf_readings")
      .findOne({ device_id: "pi_shelf_01" }, { sort: { storedAt: -1 } });
    if (cached) {
      piShelfData = cached;
    }
  }

  // Get zone metadata from MongoDB
  const zonesDoc = await db
    .collection("zones")
    .findOne({ deviceId: "pi_shelf_01" }, { sort: { savedAt: -1 } });

  const zoneMeta: Record<string, any> = {};
  if (zonesDoc?.zones) {
    for (const z of zonesDoc.zones) {
      zoneMeta[z.name.toLowerCase()] = z;
    }
  }

  // Merge
  const shelves = (piShelfData?.shelves || []).map((s: any) => {
    const meta = zoneMeta[s.shelf_id.toLowerCase()];
    const capacity = meta?.capacity ?? 20;
    const threshold = meta?.threshold ?? 25;
    const count = s.count ?? 0;
    const fillPercent = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
    let status: string = "ok";
    if (count === 0) status = "oos";
    else if (fillPercent < threshold) status = "low";

    return {
      shelf_id: s.shelf_id,
      count,
      label: meta?.label || s.shelf_id,
      sku: meta?.sku || "",
      capacity,
      threshold,
      status,
      fillPercent,
    };
  });

  return NextResponse.json({
    piConnected,
    device_id: piShelfData?.device_id || "pi_shelf_01",
    configuration_version: piShelfData?.configuration_version ?? 0,
    timestamp: piShelfData?.timestamp || null,
    shelves,
    outside_zones: piShelfData?.outside_zones ?? 0,
    total_detected: piShelfData?.total_detected ?? 0,
    source: piConnected ? "pi_live" : "mongodb_cached",
    fetchedAt: new Date().toISOString(),
  });
}
