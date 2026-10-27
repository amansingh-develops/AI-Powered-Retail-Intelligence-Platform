/**
 * Raspberry Pi Edge Camera Configuration
 * -----------------------------------------
 * Store-side Flask server running on the Pi's local network.
 * These endpoints are reached via the Next.js API proxy layer
 * (/api/pi/*) so the browser never calls the Pi directly.
 *
 * To switch between mock and live:
 *   - PI_ONLINE=false (default): API routes return mock data
 *   - PI_ONLINE=true: API routes proxy to PI_BASE_URL
 *
 * Set PI_ONLINE=true in .env.local when connected to the store WiFi.
 */

export const PI_CONFIG = {
  // Pi Flask server base URL — change if IP changes
  baseUrl: process.env.PI_BASE_URL || "http://192.168.137.174:5000",

  // Pi Sensors server base URL (Port 5001)
  sensorsUrl: process.env.PI_SENSORS_URL || "http://192.168.137.174:5001",

  // Set PI_ONLINE=true in .env.local when on store WiFi
  isOnline: process.env.PI_ONLINE === "true",

  // Timeout in ms for Pi requests (image is ~1.1MB, store WiFi can be slow)
  timeoutMs: 15000,
  sensorTimeoutMs: 3000,

  endpoints: {
    latestImage: "/api/latest-image",              // GET  → returns JPEG image
    image: (filename: string) => `/api/image/${filename}`,  // GET → historical JPEG
    status: "/api/status",                          // GET  → JSON Pi health info
    sensorsStore: "/api/sensors/store",            // GET  → Store footfall & people_inside count
    sensorsBilling: "/api/sensors/billing",        // GET  → Billing counter wait time & throughput
  },
} as const;

/**
 * Fetch from the Pi with a configurable timeout.
 * Throws if unreachable — callers handle fallback.
 */
export async function fetchFromPi(
  endpoint: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${PI_CONFIG.baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PI_CONFIG.timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Avoid caching — these are live feeds
      cache: "no-store",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch sensor telemetry from the Pi on port 5001.
 * Default endpoint: /api/sensors/store
 */
export async function fetchFromPiSensors(
  endpoint: string = PI_CONFIG.endpoints.sensorsStore,
  init?: RequestInit
): Promise<Response> {
  const url = `${PI_CONFIG.sensorsUrl}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PI_CONFIG.sensorTimeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
