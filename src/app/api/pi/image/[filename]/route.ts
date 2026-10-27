import { NextRequest, NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";

/**
 * GET /api/pi/image/[filename]
 *
 * Proxies the Pi Flask endpoint:
 *   GET http://192.168.137.33:5000/image/<filename>
 *
 * Usage: /api/pi/image/shelf_20260904_153012.jpg
 *
 * When PI_ONLINE=false:
 *   Returns 404 JSON with a hint.
 *
 * When PI_ONLINE=true:
 *   Streams the JPEG image bytes from Pi to the browser.
 *   Used for the annotation tool's historical snapshot selection.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename) {
    return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
  }

  // --- OFFLINE / MOCK MODE ---
  if (!PI_CONFIG.isOnline) {
    return NextResponse.json(
      {
        connected: false,
        message: "Pi not reachable — set PI_ONLINE=true in .env.local when on store WiFi",
        requestedFile: filename,
        piUrl: `${PI_CONFIG.baseUrl}${PI_CONFIG.endpoints.image(filename)}`,
      },
      { status: 503 }
    );
  }

  // --- LIVE MODE ---
  try {
    const piRes = await fetchFromPi(PI_CONFIG.endpoints.image(filename));

    if (piRes.status === 404) {
      return NextResponse.json(
        { error: `Image '${filename}' not found on Pi`, connected: true },
        { status: 404 }
      );
    }

    if (!piRes.ok) {
      return NextResponse.json(
        { error: `Pi returned ${piRes.status}: ${piRes.statusText}` },
        { status: 502 }
      );
    }

    const contentType = piRes.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await piRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",   // Historical — can cache
        "X-Pi-Source": PI_CONFIG.baseUrl,
        "X-Filename": filename,
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return NextResponse.json(
      {
        connected: false,
        error: isTimeout
          ? `Pi request timed out after ${PI_CONFIG.timeoutMs}ms`
          : `Failed to reach Pi: ${err?.message}`,
      },
      { status: 503 }
    );
  }
}
