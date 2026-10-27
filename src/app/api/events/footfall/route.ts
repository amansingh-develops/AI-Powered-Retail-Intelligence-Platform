import { NextRequest, NextResponse } from "next/server";
import { globalStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { direction } = body;

    const currentHour = `${new Date().getHours().toString().padStart(2, "0")}:00`;
    let hourBucket = globalStore.footfall.find((f) => f.hour === currentHour);

    if (!hourBucket) {
      hourBucket = { hour: currentHour, inCount: 0, outCount: 0, netOccupancy: 0 };
      globalStore.footfall.push(hourBucket);
    }

    if (direction === "in") {
      hourBucket.inCount += 1;
      hourBucket.netOccupancy += 1;
    } else {
      hourBucket.outCount += 1;
      hourBucket.netOccupancy = Math.max(0, hourBucket.netOccupancy - 1);
    }

    return NextResponse.json({
      received: true,
      timestamp: new Date().toISOString(),
      currentNetOccupancy: hourBucket.netOccupancy,
    });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
