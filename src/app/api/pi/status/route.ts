import { NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";

/**
 * GET /api/pi/status
 *
 * Proxies: GET http://192.168.137.33:5000/status
 *
 * Actual Pi response shape:
 * {
 *   "latest_image": "photo_2026-09-03_01-36-59.jpg",
 *   "latest_image_time": "2026-09-03T01:36:59.721187",
 *   "status": "online"
 * }
 */
export async function GET() {
  const deviceId = "pi-cam-01";
  const piUrl = `${PI_CONFIG.baseUrl}${PI_CONFIG.endpoints.status}`;

  // --- OFFLINE / MOCK MODE ---
  if (!PI_CONFIG.isOnline) {
    return NextResponse.json({
      connected: false,
      deviceId,
      piUrl,
      message: "Not connected to store WiFi — set PI_ONLINE=true in .env.local",
      piAddress: PI_CONFIG.baseUrl,
      mockStatus: {
        status: "offline_from_dashboard",
        latest_image: null,
        latest_image_time: null,
      },
    });
  }

  // --- LIVE MODE ---
  try {
    const piRes = await fetchFromPi(PI_CONFIG.endpoints.status);

    if (!piRes.ok) {
      return NextResponse.json(
        {
          connected: false,
          deviceId,
          error: `Pi status endpoint returned ${piRes.status}: ${piRes.statusText}`,
        },
        { status: 502 }
      );
    }

    // Pi status shape:
    // { "status": "online", "latest_image": "photo_....jpg", "latest_image_time": "..." }
    const piStatus = await piRes.json();

    return NextResponse.json({
      connected: piStatus.status === "online",
      deviceId,
      piAddress: PI_CONFIG.baseUrl,
      piStatus,
      // Convenient top-level fields for the inventory/fleet pages
      latestImage: piStatus.latest_image ?? null,
      latestImageTime: piStatus.latest_image_time ?? null,
      // Direct URL to fetch that historical image via our proxy
      latestImageProxyUrl: piStatus.latest_image
        ? `/api/pi/image/${encodeURIComponent(piStatus.latest_image)}`
        : "/api/pi/latest-image",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return NextResponse.json(
      {
        connected: false,
        deviceId,
        error: isTimeout
          ? `Pi timed out after ${PI_CONFIG.timeoutMs}ms — device may be offline or on a different network`
          : `Failed to reach Pi: ${err?.message}`,
        piAddress: PI_CONFIG.baseUrl,
      },
      { status: 503 }
    );
  }
}
