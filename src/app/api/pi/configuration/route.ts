import { NextRequest, NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPi } from "@/lib/piConfig";

/**
 * GET /api/pi/configuration
 *
 * Proxies: GET http://192.168.137.33:5000/api/configuration
 * Returns: { configuration_version: number, zones: PiZone[] }
 */
export async function GET() {
  if (!PI_CONFIG.isOnline) {
    return NextResponse.json(
      { error: "Pi offline — set PI_ONLINE=true in .env.local", configuration_version: 0, zones: [] },
      { status: 503 }
    );
  }

  try {
    const res = await fetchFromPi("/api/configuration");
    if (!res.ok) {
      return NextResponse.json(
        { error: `Pi returned ${res.status}`, configuration_version: 0, zones: [] },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach Pi: ${message}`, configuration_version: 0, zones: [] },
      { status: 503 }
    );
  }
}

/**
 * PUT /api/pi/configuration
 *
 * Proxies: PUT http://192.168.137.33:5000/api/configuration
 *
 * Body: { configuration_version: number, zones: PiZone[] }
 *
 * The caller must set configuration_version = current + 1 so the Pi
 * knows this is an update and re-initializes the detection model.
 */
export async function PUT(request: NextRequest) {
  if (!PI_CONFIG.isOnline) {
    return NextResponse.json(
      { error: "Pi offline — cannot push configuration" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    // Validate
    if (typeof body.configuration_version !== "number" || !Array.isArray(body.zones)) {
      return NextResponse.json(
        { error: "Must include configuration_version (number) and zones (array)" },
        { status: 400 }
      );
    }

    const res = await fetchFromPi("/api/configuration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        configuration_version: body.configuration_version,
        zones: body.zones,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Pi returned ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    // Pi may return JSON or just a status
    let responseData;
    try {
      responseData = await res.json();
    } catch {
      responseData = { success: true };
    }

    return NextResponse.json({
      success: true,
      sentVersion: body.configuration_version,
      zonesCount: body.zones.length,
      piResponse: responseData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to push config to Pi: ${message}` },
      { status: 503 }
    );
  }
}
