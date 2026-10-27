import { NextRequest, NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";

/**
 * GET /api/pi/latest-image[?t=<timestamp>]
 *
 * Proxies the Pi Flask endpoint:
 *   GET http://192.168.137.33:5000/latest-image
 *
 * The ?t= query param is accepted and ignored — it's only used as a
 * cache-buster by the annotation canvas so the browser fetches a fresh frame.
 *
 * When PI_ONLINE=false:
 *   Redirects to /shelf-sample.jpg so the canvas still gets a valid image.
 *
 * When PI_ONLINE=true:
 *   Streams the JPEG bytes from the Pi directly — the canvas loads it as
 *   backgroundImage: url(/api/pi/latest-image?t=...) with no CORS issues.
 */
export async function GET(request: NextRequest) {
  // --- OFFLINE / MOCK MODE — redirect to placeholder image ---
  if (!PI_CONFIG.isOnline) {
    return NextResponse.redirect(new URL("/shelf-sample.jpg", request.url));
  }

  // --- LIVE MODE: proxy the JPEG from Pi ---
  try {
    const piRes = await fetchFromPi(PI_CONFIG.endpoints.latestImage);

    if (!piRes.ok) {
      // Pi returned an error — fall back to placeholder
      console.error(`[pi/latest-image] Pi returned ${piRes.status}: ${piRes.statusText}`);
      return NextResponse.redirect(new URL("/shelf-sample.jpg", request.url));
    }

    const contentType = piRes.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await piRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // No-store so every ?t= fetch bypasses the browser cache
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Pi-Source": PI_CONFIG.baseUrl,
        "X-Captured-At": new Date().toISOString(),
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    console.error(
      `[pi/latest-image] ${isTimeout ? "Timeout" : "Error"}: ${err?.message}`
    );
    // On any error return the placeholder image so the canvas stays functional
    return NextResponse.redirect(new URL("/shelf-sample.jpg", request.url));
  }
}
