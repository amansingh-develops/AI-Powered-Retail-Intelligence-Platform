import { NextRequest, NextResponse } from "next/server";

const QUEUE_INFERENCE_URL =
  process.env.QUEUE_INFERENCE_URL || "http://localhost:5001";

/**
 * POST /api/queue/detect
 *
 * Proxies to the local Python inference server.
 * Body: { image: "<base64>", zone: { x1, y1, x2, y2 } }
 * Returns: { count, zone_count, detections, elapsed_ms, timestamp }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${QUEUE_INFERENCE_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Inference server returned ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Persist reading in MongoDB asynchronously
    import("@/lib/mongodb")
      .then(({ getDb }) => getDb())
      .then((db) =>
        db.collection("queue_readings").insertOne({
          count: data.count,
          zone_count: data.zone_count,
          elapsed_ms: data.elapsed_ms,
          timestamp: new Date(),
        })
      )
      .catch(() => {});

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Cannot reach inference server at ${QUEUE_INFERENCE_URL}: ${message}`,
        hint: "Run: python src/app/queue/CVmodal-countPeople/server.py",
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/queue/detect
 *
 * Health check — checks if inference server is reachable.
 */
export async function GET() {
  try {
    const res = await fetch(`${QUEUE_INFERENCE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ connected: true, ...data });
    }
    return NextResponse.json({ connected: false }, { status: 502 });
  } catch {
    return NextResponse.json(
      {
        connected: false,
        hint: "Run: python src/app/queue/CVmodal-countPeople/server.py",
      },
      { status: 503 }
    );
  }
}
