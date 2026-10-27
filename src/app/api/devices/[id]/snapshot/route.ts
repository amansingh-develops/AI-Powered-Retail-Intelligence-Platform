import { NextRequest, NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";

/**
 * POST /api/devices/[id]/snapshot
 *
 * Triggers a shelf snapshot capture for the annotation workflow (PRD §4.2).
 *
 * Behaviour:
 *  - PI_ONLINE=false → returns mock metadata pointing to /shelf-sample.jpg
 *  - PI_ONLINE=true  → calls Pi's /latest-image, captures the frame, returns
 *    a proxied URL (/api/pi/latest-image) that the annotation canvas loads
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // --- OFFLINE / MOCK MODE ---
  if (!PI_CONFIG.isOnline) {
    return NextResponse.json({
      success: true,
      connected: false,
      deviceId: id,
      // The annotation tool will load this image URL on the canvas
      snapshotUrl: "/shelf-sample.jpg",
      // Also expose the proxied Pi URL so the frontend can switch when live
      piProxyUrl: "/api/pi/latest-image",
      piDirectUrl: `${PI_CONFIG.baseUrl}${PI_CONFIG.endpoints.latestImage}`,
      capturedAt: new Date().toISOString(),
      resolution: "1920×1080 (mock)",
      message: "Running on mock data — set PI_ONLINE=true in .env.local when on store WiFi",
    });
  }

  // --- LIVE MODE: trigger Pi capture via /latest-image ---
  try {
    // We just request the latest image — the Pi captures continuously,
    // so /latest-image always gives the most recent frame.
    const piRes = await fetchFromPi(PI_CONFIG.endpoints.latestImage);

    if (!piRes.ok) {
      return NextResponse.json(
        {
          success: false,
          connected: true,
          error: `Pi camera returned ${piRes.status}: ${piRes.statusText}`,
        },
        { status: 502 }
      );
    }

    // We don't buffer the image here — the annotation canvas loads it
    // via /api/pi/latest-image which streams it directly.
    const contentType = piRes.headers.get("content-type") || "image/jpeg";

    return NextResponse.json({
      success: true,
      connected: true,
      deviceId: id,
      // Annotation tool loads this URL in the canvas <img>
      snapshotUrl: "/api/pi/latest-image",
      piDirectUrl: `${PI_CONFIG.baseUrl}${PI_CONFIG.endpoints.latestImage}`,
      capturedAt: new Date().toISOString(),
      contentType,
      message: "Live frame retrieved from Raspberry Pi shelf camera",
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: isTimeout
          ? `Pi camera timed out after ${PI_CONFIG.timeoutMs}ms`
          : `Cannot reach Pi: ${err?.message}`,
        fallbackSnapshotUrl: "/shelf-sample.jpg",
      },
      { status: 503 }
    );
  }
}
