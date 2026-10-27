import { NextResponse } from "next/server";
import { globalStore } from "@/lib/store";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const store = globalStore.getSelectedStore();
  const kpis = globalStore.getOverviewKpis();
  const liveAlerts = globalStore.getAlerts().slice(0, 4);
  const heatmapZones = globalStore.heatmapZones;
  const footfall = globalStore.footfall;
  const inventoryMetrics = globalStore.inventoryMetrics;
  const queues = globalStore.queues;

  let sensorTelemetry = null;
  let billingTelemetry = null;
  try {
    const db = await getDb();
    const doc = await db.collection("store_sensors").find({}).sort({ _id: -1 }).limit(1).next();
    if (doc) {
      sensorTelemetry = {
        deviceId: doc.deviceId,
        peopleInside: doc.peopleInside,
        lastEvent: doc.lastEvent,
        recordedAt: doc.recordedAt,
      };
    }
    const billingDoc = await db.collection("billing_sensors").find({}).sort({ _id: -1 }).limit(1).next();
    if (billingDoc) {
      billingTelemetry = {
        deviceId: billingDoc.deviceId,
        averageBillingTime: billingDoc.averageBillingTime,
        averageBillingTimeSeconds: billingDoc.averageBillingTimeSeconds,
        billingActive: billingDoc.billingActive,
        completedCustomers: billingDoc.completedCustomers,
        recordedAt: billingDoc.recordedAt,
      };
    }
  } catch {
    // Gracefully bypass if MongoDB is offline
  }

  return NextResponse.json({
    store,
    kpis,
    sensorTelemetry,
    billingTelemetry,
    liveAlerts,
    heatmapZones,
    footfall,
    inventoryMetrics,
    queues,
  });
}
