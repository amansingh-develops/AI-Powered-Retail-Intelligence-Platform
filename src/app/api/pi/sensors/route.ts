import { NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPiSensors } from "@/lib/piConfig";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/pi/sensors
 *
 * Proxies sensor telemetry from the Raspberry Pi on port 5001:
 * http://192.168.137.174:5001/api/sensors/store
 *
 * Pi payload shape:
 * {
 *   "device_id": "pi_sensors_01",
 *   "last_event": {
 *     "people_inside": 0,
 *     "timestamp": 1788586101.86187,
 *     "type": "EXIT"
 *   },
 *   "people_inside": 0
 * }
 *
 * Seamless offline handling:
 * - If Pi is reachable: persists latest reading to MongoDB `store_sensors` and returns it.
 * - If Pi is offline / unreachable (e.g. laptop on different Wi-Fi): falls back to latest
 *   MongoDB cached reading or zero count gracefully without throwing errors.
 */
export async function GET() {
  try {
    // Attempt live fetch from Raspberry Pi sensor server (port 5001)
    const piRes = await fetchFromPiSensors();

    if (piRes.ok) {
      const data = await piRes.json();

      // Persist reading to MongoDB for caching and analytics
      try {
        const db = await getDb();
        await db.collection("store_sensors").insertOne({
          deviceId: data.device_id || "pi_sensors_01",
          peopleInside: typeof data.people_inside === "number" ? data.people_inside : 0,
          lastEvent: data.last_event || null,
          recordedAt: new Date(),
          source: "live_pi",
        });
      } catch (dbErr) {
        console.warn("[Pi Sensors] Failed to cache to MongoDB:", dbErr);
      }

      return NextResponse.json({
        success: true,
        connected: true,
        device_id: data.device_id || "pi_sensors_01",
        people_inside: typeof data.people_inside === "number" ? data.people_inside : 0,
        last_event: data.last_event || null,
        source: "live_pi",
        fetched_at: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    // Pi is unreachable or timed out (expected when user is on a different Wi-Fi)
    // console.info("[Pi Sensors] Live sensor offline, falling back to cache:", err?.message);
  }

  // Fallback: Query latest known reading from MongoDB
  try {
    const db = await getDb();
    const latestDoc = await db
      .collection("store_sensors")
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .next();

    if (latestDoc) {
      return NextResponse.json({
        success: true,
        connected: false,
        device_id: latestDoc.deviceId || "pi_sensors_01",
        people_inside: typeof latestDoc.peopleInside === "number" ? latestDoc.peopleInside : 0,
        last_event: latestDoc.lastEvent || null,
        source: "mongodb_cache",
        cached_at: latestDoc.recordedAt,
        message: "Pi sensor offline on this network. Serving last recorded cache.",
      });
    }
  } catch (dbErr) {
    console.warn("[Pi Sensors] MongoDB query failed during fallback:", dbErr);
  }

  // Default baseline if neither Pi nor DB has prior records
  return NextResponse.json({
    success: true,
    connected: false,
    device_id: "pi_sensors_01",
    people_inside: 0,
    last_event: null,
    source: "default_standby",
    message: "Pi sensor endpoint configured (port 5001). Standing by for connection.",
  });
}

/**
 * POST /api/pi/sensors
 * Allows manual or webhook pushes from edge sensors.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await getDb();
    await db.collection("store_sensors").insertOne({
      deviceId: body.device_id || "pi_sensors_01",
      peopleInside: typeof body.people_inside === "number" ? body.people_inside : 0,
      lastEvent: body.last_event || null,
      recordedAt: new Date(),
      source: "edge_push",
    });

    return NextResponse.json({ success: true, message: "Sensor telemetry recorded" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to record" }, { status: 500 });
  }
}
