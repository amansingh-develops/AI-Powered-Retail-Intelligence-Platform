import { NextRequest, NextResponse } from "next/server";
import { globalStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const type = searchParams.get("type") || "all";

  const alerts = globalStore.getAlerts(status, type);
  return NextResponse.json({ alerts });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    let updatedAlert;
    if (action === "acknowledge") {
      updatedAlert = globalStore.acknowledgeAlert(id);
    } else if (action === "resolve") {
      updatedAlert = globalStore.resolveAlert(id);
    }

    if (!updatedAlert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert: updatedAlert });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
