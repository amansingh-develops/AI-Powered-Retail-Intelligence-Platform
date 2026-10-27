import { NextRequest, NextResponse } from "next/server";
import { globalStore } from "@/lib/store";
import { PiZone } from "@/lib/types";

/**
 * GET /api/devices/[id]/config
 *
 * The Pi polls this endpoint to retrieve its current annotation config.
 * Returns the exact format the Pi expects:
 *
 * {
 *   "configuration_version": 3,
 *   "zones": [
 *     { "name": "ITEM 1", "x1": 2,   "y1": 1,   "x2": 503,  "y2": 971 },
 *     { "name": "ITEM 2", "x1": 508, "y1": 2,   "x2": 1188, "y2": 383 }
 *   ]
 * }
 *
 * If no config has been saved via POST yet, returns the mock regions
 * converted to Pi format as a default bootstrap config.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check if we have a saved Pi-format config for this device
  const savedConfig = globalStore.getPiConfig(id);
  if (savedConfig) {
    return NextResponse.json(savedConfig);
  }

  // Fall back: convert our mock shelf regions to Pi zone format
  // (bootstrap config so the Pi has something to start with)
  const shelf = globalStore.shelves.find((s) => s.deviceId === id);
  if (!shelf) {
    return NextResponse.json(
      {
        error: `No configuration found for device '${id}'`,
        hint: "POST to this endpoint from the annotation tool first, or check device_id",
      },
      { status: 404 }
    );
  }

  // Convert from our internal % bbox to pixel coords (matching 2592×1944 Pi camera resolution)
  const DEFAULT_WIDTH = 2592;
  const DEFAULT_HEIGHT = 1944;

  const zones: PiZone[] = shelf.regions.map((r) => ({
    name: r.label,
    x1: Math.round((r.bbox.x / 100) * DEFAULT_WIDTH),
    y1: Math.round((r.bbox.y / 100) * DEFAULT_HEIGHT),
    x2: Math.round(((r.bbox.x + r.bbox.width) / 100) * DEFAULT_WIDTH),
    y2: Math.round(((r.bbox.y + r.bbox.height) / 100) * DEFAULT_HEIGHT),
  }));

  return NextResponse.json({
    configuration_version: 3, // default bootstrap version
    zones,
    _note: "Bootstrap config derived from dashboard mock data. Use the annotation tool to set real bounding boxes.",
  });
}

/**
 * POST /api/devices/[id]/config
 *
 * Called by the annotation tool after the user draws bounding boxes.
 * Accepts zones in Pi wire format (absolute pixel coordinates):
 *
 * {
 *   "zones": [
 *     { "name": "ITEM 1", "x1": 2,   "y1": 1,   "x2": 503,  "y2": 971 },
 *     { "name": "ITEM 2", "x1": 508, "y1": 2,   "x2": 1188, "y2": 383 }
 *   ],
 *   // Internal fields (used to update the dashboard shelf view, not sent to Pi):
 *   "shelfId": "shelf-aisle-4",
 *   "regions": [...]   // optional — dashboard internal ShelfRegion array
 * }
 *
 * The saved config is returned on the next GET (Pi poll), triggering model re-init.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Accept Pi-format zones directly
    const zones: PiZone[] | undefined = body.zones;

    // Also accept our internal regions and convert to Pi zones
    // (sent from ShelfAnnotationModal when using the canvas tool)
    let piZones: PiZone[];

    if (zones && Array.isArray(zones) && zones.length > 0) {
      // Pi-format already — validate shape
      piZones = zones.map((z: any) => ({
        name: String(z.name),
        x1: Number(z.x1),
        y1: Number(z.y1),
        x2: Number(z.x2),
        y2: Number(z.y2),
      }));
    } else if (body.regions && Array.isArray(body.regions)) {
      // Internal ShelfRegion[] format — convert % bbox to absolute pixels
      const imgW: number = body.imageWidth ?? 1920;
      const imgH: number = body.imageHeight ?? 1080;

      piZones = body.regions.map((r: any) => ({
        name: r.label || r.sku || "Unknown",
        x1: Math.round((r.bbox.x / 100) * imgW),
        y1: Math.round((r.bbox.y / 100) * imgH),
        x2: Math.round(((r.bbox.x + r.bbox.width) / 100) * imgW),
        y2: Math.round(((r.bbox.y + r.bbox.height) / 100) * imgH),
      }));
    } else {
      return NextResponse.json(
        {
          error: "Request must include either 'zones' (Pi format) or 'regions' (dashboard internal format)",
          pi_format_example: {
            zones: [
              { name: "ITEM 1", x1: 2, y1: 1, x2: 503, y2: 971 },
              { name: "ITEM 2", x1: 508, y1: 2, x2: 1188, y2: 383 },
            ],
          },
        },
        { status: 400 }
      );
    }

    // Save as Pi-ready config (returned on next Pi poll)
    const savedConfig = globalStore.setPiConfig(id, piZones);

    // Also update dashboard internal shelf view (if shelfId provided)
    if (body.shelfId) {
      const shelf = globalStore.shelves.find((s) => s.id === body.shelfId);
      if (shelf && body.regions) {
        globalStore.updateShelfRegions(body.shelfId, body.regions);
      }
    }

    return NextResponse.json({
      success: true,
      device_id: id,
      config_saved: savedConfig,
      message: `Config v${savedConfig.configuration_version} staged. Pi will receive it on next poll of GET /api/devices/${id}/config`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        detail: err?.message,
      },
      { status: 400 }
    );
  }
}
