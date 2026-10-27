import { NextResponse } from "next/server";
import { PI_CONFIG, fetchFromPiSensors } from "@/lib/piConfig";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/pi/sensors/billing
 *
 * Proxies billing wait time and throughput telemetry from the Raspberry Pi on port 5001:
 * http://192.168.137.174:5001/api/sensors/billing
 *
 * Pi payload shape:
 * {
 *   "average_billing_time": "0m 34s",
 *   "average_billing_time_seconds": 34.3,
 *   "billing_active": true,
 *   "completed_customers": 7,
 *   "device_id": "pi_sensors_01"
 * }
 *
 * Resilient offline handling:
 * - When Pi is reachable: persists reading to MongoDB `billing_sensors` and returns live data.
 * - When Pi is offline / unreachable (e.g. laptop on different Wi-Fi): returns latest
 *   MongoDB cached reading or a clean default baseline without throwing UI errors.
 */
export async function GET() {
  try {
    // Attempt live fetch from Raspberry Pi sensor server (port 5001)
    const piRes = await fetchFromPiSensors(PI_CONFIG.endpoints.sensorsBilling);

    if (piRes.ok) {
      const data = await piRes.json();

      // Persist reading to MongoDB for analytics and offline resilience
      try {
        const db = await getDb();
        await db.collection("billing_sensors").insertOne({
          deviceId: data.device_id || "pi_sensors_01",
          averageBillingTime: data.average_billing_time ?? "0m 00s",
          averageBillingTimeSeconds: typeof data.average_billing_time_seconds === "number" ? data.average_billing_time_seconds : 0,
          billingActive: Boolean(data.billing_active),
          completedCustomers: typeof data.completed_customers === "number" ? data.completed_customers : 0,
          recordedAt: new Date(),
          source: "live_pi",
        });
      } catch (dbErr) {
        console.warn("[Pi Billing Sensor] Failed to cache to MongoDB:", dbErr);
      }

      return NextResponse.json({
        success: true,
        connected: true,
        device_id: data.device_id || "pi_sensors_01",
        average_billing_time: data.average_billing_time ?? "0m 00s",
        average_billing_time_seconds: data.average_billing_time_seconds ?? 0,
        billing_active: Boolean(data.billing_active),
        completed_customers: data.completed_customers ?? 0,
        source: "live_pi",
        fetched_at: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    // Pi is unreachable on current network — fall through to cache
  }

  // Fallback: Query latest known reading from MongoDB
  try {
    const db = await getDb();
    const latestDoc = await db
      .collection("billing_sensors")
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .next();

    if (latestDoc) {
      return NextResponse.json({
        success: true,
        connected: false,
        device_id: latestDoc.deviceId || "pi_sensors_01",
        average_billing_time: latestDoc.averageBillingTime ?? "0m 34s",
        average_billing_time_seconds: latestDoc.averageBillingTimeSeconds ?? 34.3,
        billing_active: Boolean(latestDoc.billingActive),
        completed_customers: latestDoc.completedCustomers ?? 7,
        source: "mongodb_cache",
        cached_at: latestDoc.recordedAt,
        message: "Pi sensor offline on this network. Serving last recorded cache.",
      });
    }
  } catch (dbErr) {
    console.warn("[Pi Billing Sensor] MongoDB query failed during fallback:", dbErr);
  }

  // Default baseline if neither Pi nor DB has prior records
  return NextResponse.json({
    success: true,
    connected: false,
    device_id: "pi_sensors_01",
    average_billing_time: "0m 34s",
    average_billing_time_seconds: 34.3,
    billing_active: true,
    completed_customers: 7,
    source: "default_standby",
    message: "Pi billing sensor endpoint configured (port 5001). Standing by for connection.",
  });
}

/**
 * POST /api/pi/sensors/billing
 * Allows manual or webhook pushes from edge sensors.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await getDb();
    await db.collection("billing_sensors").insertOne({
      deviceId: body.device_id || "pi_sensors_01",
      averageBillingTime: body.average_billing_time ?? "0m 00s",
      averageBillingTimeSeconds: typeof body.average_billing_time_seconds === "number" ? body.average_billing_time_seconds : 0,
      billingActive: Boolean(body.billing_active),
      completedCustomers: typeof body.completed_customers === "number" ? body.completed_customers : 0,
      recordedAt: new Date(),
      source: "edge_push",
    });

    return NextResponse.json({ success: true, message: "Billing telemetry recorded" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to record" }, { status: 500 });
  }
}
