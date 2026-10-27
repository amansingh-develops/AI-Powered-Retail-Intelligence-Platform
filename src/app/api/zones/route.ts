import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/zones?deviceId=pi_shelf_01
 *
 * Returns the latest saved zone configuration from MongoDB.
 * Includes per-zone: name, label, sku, capacity, threshold, bbox coords.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId") || "pi_shelf_01";

  try {
    const db = await getDb();
    const doc = await db
      .collection("zones")
      .findOne({ deviceId }, { sort: { savedAt: -1 } });

    if (!doc) {
      return NextResponse.json({
        deviceId,
        configurationVersion: 0,
        zones: [],
        message: "No zones configured yet. Use the annotation tool to draw bounding boxes.",
      });
    }

    return NextResponse.json({
      deviceId: doc.deviceId,
      configurationVersion: doc.configurationVersion,
      savedAt: doc.savedAt,
      zones: doc.zones,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch zones: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/zones
 *
 * Saves zone configuration to MongoDB.
 * Called by the annotation modal after the user draws boxes and fills in
 * label, capacity, and threshold for each zone.
 *
 * Body:
 * {
 *   deviceId: "pi_shelf_01",
 *   configurationVersion: 4,
 *   zones: [
 *     {
 *       name: "ITEM 1",
 *       label: "Lays Classic 50g",
 *       sku: "SKU-LAY-001",
 *       capacity: 30,
 *       threshold: 25,
 *       x1: 2, y1: 1, x2: 503, y2: 971,
 *       bboxPercent: { x: 0.1, y: 0.1, width: 19.3, height: 49.9 }
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deviceId = body.deviceId || "pi_shelf_01";
    const zones = body.zones;

    if (!Array.isArray(zones) || zones.length === 0) {
      return NextResponse.json(
        { error: "zones array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate each zone has at minimum: name, x1, y1, x2, y2
    for (const z of zones) {
      if (!z.name || z.x1 === undefined || z.y1 === undefined || z.x2 === undefined || z.y2 === undefined) {
        return NextResponse.json(
          { error: `Each zone must have name, x1, y1, x2, y2. Invalid zone: ${JSON.stringify(z)}` },
          { status: 400 }
        );
      }
    }

    const configVersion = body.configurationVersion || 1;

    const db = await getDb();

    // Upsert: replace the latest zone config for this device
    const result = await db.collection("zones").updateOne(
      { deviceId },
      {
        $set: {
          deviceId,
          configurationVersion: configVersion,
          zones: zones.map((z: ZoneInput) => ({
            name: z.name,
            label: z.label || z.name,
            sku: z.sku || "",
            capacity: Number(z.capacity) || 20,
            threshold: Number(z.threshold) || 25,
            x1: Number(z.x1),
            y1: Number(z.y1),
            x2: Number(z.x2),
            y2: Number(z.y2),
            bboxPercent: z.bboxPercent || null,
          })),
          savedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      deviceId,
      configurationVersion: configVersion,
      zonesCount: zones.length,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save zones: ${message}` },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Types (local to this route)
// ---------------------------------------------------------------------------

interface ZoneInput {
  name: string;
  label?: string;
  sku?: string;
  capacity?: number;
  threshold?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bboxPercent?: { x: number; y: number; width: number; height: number } | null;
}
