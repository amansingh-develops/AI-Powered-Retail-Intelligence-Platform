import { NextRequest, NextResponse } from "next/server";
import { globalStore } from "@/lib/store";
import { PiShelfCountPayload } from "@/lib/types";

/**
 * POST /api/events/shelf-status
 *
 * Accepts the exact payload format the Pi POSTs after running its shelf model:
 *
 * {
 *   "device_id": "pi_shelf_01",
 *   "configuration_version": 3,
 *   "timestamp": "2026-09-04T13:45:00",
 *   "shelves": [
 *     { "shelf_id": "ITEM 1", "count": 17 },
 *     { "shelf_id": "ITEM 2", "count": 8 },
 *     ...
 *   ]
 * }
 *
 * Matching logic:
 *   - Finds the shelf in our store whose deviceId matches device_id
 *     (also handles Pi naming convention: "pi_shelf_01" ↔ "pi-cam-01")
 *   - Maps each shelf_id → region label, updates currentStock + status
 *   - Fires new alerts if any region transitions to low or OOS
 */
export async function POST(request: NextRequest) {
  try {
    const body: PiShelfCountPayload = await request.json();

    // Validate required fields
    if (!body.device_id || !Array.isArray(body.shelves)) {
      return NextResponse.json(
        {
          received: false,
          error: "Missing required fields: device_id and shelves[]",
          expected_format: {
            device_id: "pi_shelf_01",
            configuration_version: 3,
            timestamp: "2026-09-04T13:45:00",
            shelves: [{ shelf_id: "ITEM 1", count: 17 }],
          },
        },
        { status: 400 }
      );
    }

    const result = globalStore.ingestPiShelfCounts(body);

    return NextResponse.json({
      received: true,
      device_id: body.device_id,
      configuration_version: body.configuration_version,
      timestamp: body.timestamp,
      items_processed: body.shelves.length,
      regions_updated: result.updated,
      alerts_fired: result.alerts,
      server_time: new Date().toISOString(),
      ack: result.updated > 0
        ? `Updated ${result.updated} shelf region(s). ${result.alerts} new alert(s) generated.`
        : `No matching regions found for device_id '${body.device_id}' — check annotation config.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        received: false,
        error: "Invalid JSON payload",
        detail: err?.message,
      },
      { status: 400 }
    );
  }
}
