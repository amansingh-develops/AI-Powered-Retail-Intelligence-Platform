import { NextRequest, NextResponse } from "next/server";
import { globalStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { counter_number, queue_length, avg_wait_sec } = body;

    const counter = globalStore.queues.find((q) => q.counterNumber === counter_number);
    if (counter) {
      counter.queueLength = queue_length;
      counter.avgWaitSec = avg_wait_sec;
      counter.status = queue_length > 6 ? "congested" : queue_length === 0 ? "open" : "open";

      // If queue exceeds 7, trigger automated alert
      if (queue_length >= 7) {
        const existing = globalStore.alerts.find(
          (a) => a.type === "queue" && a.message.includes(`Counter ${counter_number}`) && a.status === "open"
        );
        if (!existing) {
          globalStore.alerts.unshift({
            id: `alt-${Date.now()}`,
            refCode: `ALT-QUE-${Math.floor(100 + Math.random() * 900)}`,
            storeId: "str-104",
            storeName: "Store #104 — Indiranagar",
            type: "queue",
            severity: "warning",
            zone: `Front Checkout Counter ${counter_number}`,
            message: `Queue threshold exceeded (${queue_length} shoppers, avg wait ${(avg_wait_sec / 60).toFixed(1)} min). Recommend opening next counter.`,
            status: "open",
            createdAt: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          });
        }
      }
    }

    return NextResponse.json({
      received: true,
      timestamp: new Date().toISOString(),
      counter,
    });
  } catch {
    return NextResponse.json({ error: "Invalid queue event payload" }, { status: 400 });
  }
}
