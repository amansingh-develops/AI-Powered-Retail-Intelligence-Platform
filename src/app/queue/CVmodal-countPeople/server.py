"""
Queue People Counter — Local Inference Server
==============================================
Runs on port 5001. Receives a webcam frame (JPEG),
runs the ONNX person-detection model, and returns
the number of people inside the user-defined bounding box (zone).

Start:  python src/app/queue/CVmodal-countPeople/server.py
"""

import io
import os
import sys
import time
import json
import base64
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.onnx")
INPUT_SIZE = 640           # 640x640 is the native YOLOv8 resolution (~26ms)
DEFAULT_CONF_THR = 0.15    # 0.15 detects all people cleanly even with motion/lighting variations
IOU_THRESHOLD = 0.45       # NMS overlap threshold
PORT = int(os.environ.get("QUEUE_INFERENCE_PORT", 5001))

# ---------------------------------------------------------------------------
# Load model once at startup
# ---------------------------------------------------------------------------
print(f"[queue-counter] Loading ONNX model from {MODEL_PATH} ...")
session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
print(f"[queue-counter] Model loaded. Input: {input_name}  shape: dynamic [B,3,H,W]")

# ---------------------------------------------------------------------------
# Preprocessing (YOLOv8 letterbox keeping RGB order)
# ---------------------------------------------------------------------------

def letterbox(img: np.ndarray, new_shape=(640, 640)):
    """Resize + pad to square (letterbox), preserving aspect ratio."""
    h, w = img.shape[:2]
    r = min(new_shape[0] / h, new_shape[1] / w)
    new_unpad = (int(round(w * r)), int(round(h * r)))
    dw = (new_shape[1] - new_unpad[0]) / 2
    dh = (new_shape[0] - new_unpad[1]) / 2

    resized = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    padded = cv2.copyMakeBorder(
        resized, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )
    return padded, r, (dw, dh)


def preprocess(img: np.ndarray):
    """
    Prepare image for YOLO inference.
    img is RGB uint8 from PIL -> letterbox -> transpose to CHW -> float32 [0..1]
    Note: Keep RGB! Do NOT invert to BGR.
    """
    padded, ratio, (dw, dh) = letterbox(img, (INPUT_SIZE, INPUT_SIZE))
    blob = padded.transpose(2, 0, 1)  # HWC -> CHW (RGB)
    blob = np.ascontiguousarray(blob, dtype=np.float32) / 255.0
    blob = np.expand_dims(blob, 0)     # Add batch dimension [1, 3, H, W]
    return blob, ratio, dw, dh


def postprocess_and_nms(output, ratio, dw, dh, orig_h, orig_w, conf_thr=DEFAULT_CONF_THR):
    """
    Parse YOLOv8 output [1, 5, N] -> apply confidence filter + OpenCV C++ NMS.
    Returns list of { x1, y1, x2, y2, confidence }.
    """
    preds = output[0][0].T  # shape [N, 5] -> columns: cx, cy, w, h, score

    confs = preds[:, 4]
    valid_mask = confs >= conf_thr
    filtered_preds = preds[valid_mask]

    if len(filtered_preds) == 0:
        return []

    boxes = []
    scores = []
    raw_coords = []

    for det in filtered_preds:
        cx, cy, w, h, conf = det[:5]
        # Undo letterbox transform
        cx = (cx - dw) / ratio
        cy = (cy - dh) / ratio
        w = w / ratio
        h = h / ratio

        x1 = max(0.0, float(cx - w / 2))
        y1 = max(0.0, float(cy - h / 2))
        x2 = min(float(orig_w), float(cx + w / 2))
        y2 = min(float(orig_h), float(cy + h / 2))

        box_w = max(1.0, x2 - x1)
        box_h = max(1.0, y2 - y1)

        boxes.append([int(round(x1)), int(round(y1)), int(round(box_w)), int(round(box_h))])
        scores.append(float(conf))
        raw_coords.append({
            "x1": round(x1, 1),
            "y1": round(y1, 1),
            "x2": round(x2, 1),
            "y2": round(y2, 1),
            "confidence": round(float(conf), 2),
        })

    # OpenCV C++ NMS
    indices = cv2.dnn.NMSBoxes(boxes, scores, score_threshold=conf_thr, nms_threshold=IOU_THRESHOLD)
    if len(indices) == 0:
        return []

    indices = np.array(indices).flatten()
    return [raw_coords[i] for i in indices]


def is_in_zone(det, zone):
    """
    Check if detection center or significant overlap falls inside the user-defined queue zone.
    """
    cx = (det["x1"] + det["x2"]) / 2
    cy = (det["y1"] + det["y2"]) / 2

    # Center is inside zone
    if (zone["x1"] <= cx <= zone["x2"]) and (zone["y1"] <= cy <= zone["y2"]):
        return True

    # Or at least 25% of the person's detected area overlaps with the zone
    ix1 = max(det["x1"], zone["x1"])
    iy1 = max(det["y1"], zone["y1"])
    ix2 = min(det["x2"], zone["x2"])
    iy2 = min(det["y2"], zone["y2"])

    if ix2 > ix1 and iy2 > iy1:
        inter_area = (ix2 - ix1) * (iy2 - iy1)
        det_area = max(1.0, (det["x2"] - det["x1"]) * (det["y2"] - det["y1"]))
        if (inter_area / det_area) >= 0.25:
            return True

    return False


# ---------------------------------------------------------------------------
# Flask App
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH, "port": PORT, "resolution": INPUT_SIZE})


@app.route("/detect", methods=["POST"])
def detect():
    """
    POST /detect
    Body (JSON):
    {
      "image": "<base64 JPEG>",
      "conf_threshold": 0.20,             // optional custom threshold
      "zone": { "x1": 10, "y1": 20, "x2": 500, "y2": 400 } // optional zone
    }
    """
    t0 = time.time()

    data = request.get_json(force=True)
    img_b64 = data.get("image", "")
    zone = data.get("zone", None)
    conf_thr = float(data.get("conf_threshold", DEFAULT_CONF_THR))

    if not img_b64:
        return jsonify({"error": "No image provided"}), 400

    # Decode image
    try:
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(img_b64)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img = np.array(pil_img)
    except Exception as e:
        return jsonify({"error": f"Image decode failed: {str(e)}"}), 400

    orig_h, orig_w = img.shape[:2]

    # Preprocess & Run ONNX Inference
    blob, ratio, dw, dh = preprocess(img)
    outputs = session.run(None, {input_name: blob})

    # Postprocess + NMS
    detections = postprocess_and_nms(outputs, ratio, dw, dh, orig_h, orig_w, conf_thr=conf_thr)

    # Tag detections with in_zone flag
    zone_count = 0
    for d in detections:
        if zone:
            in_z = is_in_zone(d, zone)
            d["in_zone"] = in_z
            if in_z:
                zone_count += 1
        else:
            d["in_zone"] = True
            zone_count += 1

    elapsed_ms = round((time.time() - t0) * 1000)

    return jsonify({
        "count": len(detections),
        "zone_count": zone_count,
        "detections": detections,
        "image_size": {"width": orig_w, "height": orig_h},
        "elapsed_ms": elapsed_ms,
        "conf_threshold": conf_thr,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


if __name__ == "__main__":
    print(f"[queue-counter] Starting inference server on port {PORT}...")
    app.run(host="0.0.0.0", port=PORT, debug=False)
