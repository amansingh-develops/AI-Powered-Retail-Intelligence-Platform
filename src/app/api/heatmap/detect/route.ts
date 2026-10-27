import { NextRequest, NextResponse } from "next/server";

const QUEUE_INFERENCE_URL =
  process.env.QUEUE_INFERENCE_URL || "http://localhost:5001";

/**
 * POST /api/heatmap/detect
 *
 * Proxies room camera frame to the local Python ONNX inference server.
 * Body: { image: "<base64>", conf_threshold: 0.15, device_label?: string }
 * Returns: { count, detections, elapsed_ms, timestamp, image_size }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${QUEUE_INFERENCE_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: body.image,
        conf_threshold: body.conf_threshold ?? 0.15,
      }),
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
        db.collection("heatmap_readings").insertOne({
          count: data.count,
          detections: data.detections,
          elapsed_ms: data.elapsed_ms,
          device_label: body.device_label || "usb_room_camera",
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
        hint: "Ensure python src/app/queue/CVmodal-countPeople/server.py is running",
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/heatmap/detect
 * Health check
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
    return NextResponse.json({ connected: false }, { status: 503 });
  }
}
