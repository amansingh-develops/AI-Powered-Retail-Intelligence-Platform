import { NextRequest, NextResponse } from "next/server";
import { globalStore } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    devices: globalStore.devices,
    totalDevices: globalStore.devices.length,
    onlineDevices: globalStore.devices.filter((d) => d.status === "online").length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    if (action === "ping") {
      const dev = globalStore.pingDevice(deviceId);
      return NextResponse.json({ success: true, device: dev });
    } else if (action === "flush") {
      const dev = globalStore.flushDeviceBuffer(deviceId);
      return NextResponse.json({ success: true, device: dev });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
