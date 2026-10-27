import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/queue/zones
 * Returns the saved queue detection zone from MongoDB.
 */
export async function GET() {
  try {
    const db = await getDb();
    const doc = await db
      .collection("queue_zones")
      .findOne({}, { sort: { savedAt: -1 } });

    if (!doc) {
      return NextResponse.json({
        zone: null,
        message: "No queue zone configured. Draw a bounding box on the webcam view.",
      });
    }

    return NextResponse.json({
      zone: doc.zone,
      savedAt: doc.savedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/queue/zones
 * Saves/updates the queue detection zone.
 * Body: { zone: { x1, y1, x2, y2, bboxPercent: {x,y,width,height} } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zone = body.zone;

    if (!zone || zone.x1 === undefined) {
      return NextResponse.json(
        { error: "zone with x1,y1,x2,y2 required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.collection("queue_zones").updateOne(
      {},
      {
        $set: {
          zone,
          savedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, zone });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/queue/zones
 * Deletes the saved queue detection zone from MongoDB.
 */
export async function DELETE() {
  try {
    const db = await getDb();
    await db.collection("queue_zones").deleteMany({});
    return NextResponse.json({ success: true, message: "Queue zone cleared" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
