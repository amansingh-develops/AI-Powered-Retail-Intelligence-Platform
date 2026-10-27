# Product Requirements Document (PRD)
## AI-Powered Retail Intelligence Platform — Unified Dashboard Application

**Version:** 1.0
**Status:** Draft for build kickoff
**Owner:** [Your name]
**Last updated:** September 2026

---

## 1. Overview

### 1.1 Problem Statement
Retailers across Tier-2/3 India face stock-outs, shrinkage, long billing queues, poor shelf replenishment visibility, and limited insight into shopper behavior — often while operating on constrained or intermittent internet connectivity.

### 1.2 Solution Summary
A unified web application that ingests structured data from store-deployed Raspberry Pi devices (running on-device CV models) and centrally-processed camera feeds, stores it in MongoDB, and presents real-time and historical retail intelligence — shopper analytics, inventory monitoring, and queue management — through a single role-based dashboard used by Store Staff, Store Managers, and Admin/IT.

### 1.3 Goals
- Single unified app (not separate apps per role) — role-gated views instead
- Real-time visibility into footfall, shelf stock, and queue congestion
- Human-in-the-loop shelf annotation workflow (store staff/manager label shelf regions from Pi-captured images)
- Reliable operation despite store-side connectivity gaps (local buffering on Pi, no dependency on a message broker)
- Centralized multi-store view for Admin/IT and regional roles

### 1.4 Non-Goals (v1)
- No MQTT/broker infrastructure — REST-based communication only
- No raw video storage on backend (except transient frames for heatmap processing and shelf annotation snapshots)
- No POS/ERP integration in v1 (planned for later phase)
- No mobile native app in v1 (responsive web only)

---

## 2. Users & Roles

**Prototype scope: single master role.** Rather than gating routes/UI by Staff/Manager/Admin, every logged-in user has full access to all modules — task actions (acknowledge/resolve alerts), full analytics, shelf annotation, device/fleet health, reports, and settings. This removes the need for a permissions layer during the prototype phase and keeps the build simple: one flat navigation, no conditional rendering by role, no route-level access gating.

| Role | Description | Scope |
|---|---|---|
| **Master User** | Full access to all app capabilities — alerts/tasks, analytics, shelf annotation, device fleet, reports, settings | All stores, all modules |

Role-based access control (Staff / Manager / Admin split, as previously scoped) is deferred to a post-prototype phase once the core pipeline and dashboard are validated — see §9 Build Roadmap.

---

## 3. System Architecture

### 3.1 High-Level Data Flow

```
STORE SIDE (Raspberry Pi, per store)
├── Camera 1 (Shelf/Inventory)
│     └── On-device CV model → shelf status per labeled region
│         → POST /api/events/shelf-status → MongoDB
│
├── Camera 1 (on-demand snapshot for annotation)
│     └── App requests snapshot → Pi uploads image
│         → Manager draws bounding boxes + labels in-app
│         → App saves config → Pi polls and pulls config
│
├── Entry/Exit Sensors
│     └── Raw in/out counts → POST /api/events/footfall → MongoDB
│
├── Camera 2 + Queue Sensors (via local host app at store)
│     └── Queue length / wait time → POST /api/events/queue → MongoDB
│
└── Camera 3 (Heatmap) — raw feed sent directly to backend
      (no on-device inference for this feed)

BACKEND (centralized)
├── Next.js API routes — ingest events, serve dashboard data
├── Heatmap processing service — runs human-detection model on
│   Camera 3 feed, generates heatmap grid/points
├── MongoDB — single data store for all events, config, and metadata
└── WebSocket layer — pushes live updates to dashboard UI (alerts,
    queue length, new shelf status) — Pi-to-app stays REST only

FRONTEND
└── Next.js + shadcn/ui — role-gated dashboard, React Query for
    server state, WebSocket for live push, canvas-based annotation tool
```

### 3.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Communication protocol | REST only (no MQTT) | Simpler to build/debug/deploy; Pi buffers locally (SQLite) and retries on reconnect, covering offline resilience without broker overhead |
| Pi → App direction | Pi always initiates (push on data, poll for config) | Pi is behind store WiFi/NAT; app cannot reliably reach into store network |
| Database | MongoDB | Flexible schema fits mixed event shapes (nested shelf regions, varying payloads); avoids running a second time-series DB at this stage |
| Heatmap inference location | Backend (not Pi) | Per your design — Camera 3 raw feed streamed directly to backend for centralized processing |
| Live dashboard updates | WebSocket (app-to-browser only) | Not used for Pi communication — keeps edge communication simple and REST-based |
| Shelf annotation | Human-in-the-loop, request/response via REST | On-demand, not streaming — doesn't need a persistent connection |

### 3.3 Explicit Trade-off to Document
Camera 3's raw video feed is sent directly to the backend for heatmap processing, rather than being inferred on-device like the shelf/entry-exit data. This means:
- Bandwidth usage for that camera is higher than the "edge-first" pitch implies
- Raw video briefly transits the network and touches the backend before being discarded post-inference
- This should be called out in any documentation/pitch materials so the privacy/bandwidth claims stay accurate — heatmap generation is the one component that is backend-inferred, not edge-inferred

---

## 4. Functional Requirements

### 4.1 Shopper Analytics
- Display entry/exit counts, filterable by day/week/month and store zone
- Footfall trend charts (hourly/daily/weekly)
- Heatmap visualization overlaid on store floor plan, generated from Camera 3 backend processing
- Dwell-time leaderboard by zone (if dwell data available from sensors/CV)

### 4.2 Inventory Monitoring
- **Shelf annotation workflow (manager-only):**
  1. Manager selects a shelf camera and requests a snapshot
  2. App requests image from Pi via `POST /api/devices/:id/snapshot`
  3. Pi captures and uploads the frame
  4. Manager draws bounding boxes over shelf regions using an in-app canvas tool and labels each region (item name/SKU)
  5. App saves the annotation config to MongoDB and to the Pi's pending-config queue
  6. Pi polls `GET /api/devices/:id/config`, retrieves the new config, and applies it to its local CV model
  7. Future shelf-status events from that Pi report status per labeled region
- Live shelf status grid (per store/zone/region): in-stock / low / out-of-stock
- Replenishment alert generation when a region reports low/OOS status
- Historical OOS frequency report per shelf region/SKU

### 4.3 Queue Intelligence
- Live queue length and wait-time display per counter (from queue camera + sensors via local host app)
- Simple congestion prediction (e.g., trend-based on recent queue growth rate)
- Threshold-based "recommend opening counter" alert
- Historical average wait/service time by hour/day

### 4.4 Entry/Exit
- Raw sensor counts ingested from Pi, aggregated into footfall metrics feeding Shopper Analytics module

### 4.5 Alerts Center
- Unified feed across shelf, queue, and device-health alerts
- Fields: type, store, zone, severity, message, status (open/acknowledged/resolved), timestamps
- Staff can acknowledge/resolve; manager/admin see full history

### 4.6 Device & Fleet Health (Admin/IT)
- List of all Pi devices per store: last-heartbeat, online/offline/degraded status, camera role
- Ability to trigger a manual snapshot request or push a config update
- Visibility into sync lag (useful given offline-buffering design)

### 4.7 Reports
- Daily/weekly summary export (PDF/CSV) covering footfall, inventory health %, queue performance
- Multi-store comparison view (Admin/IT and regional roles)

### 4.8 Settings
- User management (create/edit roles)
- Store onboarding and configuration
- Alert threshold configuration (e.g., queue length that triggers "open counter" recommendation)

---

## 5. Data Model (MongoDB — draft collections)

```js
stores: { _id, name, address, timezone }

devices: { _id, store_id, camera_role[shelf|queue|entry_exit|heatmap], ip, last_seen, status }

shelf_config: { _id, device_id, shelf_id, regions: [{ bbox, label, sku_id }], updated_at }

shelf_status_events: { _id, store_id, shelf_id, region_label, sku_id, status[ok|low|oos], timestamp }

footfall_events: { _id, store_id, direction[in|out], timestamp }

queue_events: { _id, store_id, counter_id, queue_length, avg_wait_sec, timestamp }

heatmap_points: { _id, store_id, camera_id, x, y, timestamp }
// aggregated on read, or pre-aggregated into:
heatmap_grid: { _id, store_id, camera_id, date, grid: [[intensity, ...]], zone_map }

alerts: { _id, store_id, type, severity, ref_id, message, status, created_at, resolved_at }

tasks: { _id, alert_id, assigned_to, status, created_at, completed_at }

users: { _id, name, role["master"], store_id, email, password_hash }
// role field kept as a string (not hardcoded logic) so RBAC can be
// reintroduced later without a schema change
```

---

## 6. API Surface (draft)

| Endpoint | Method | Caller | Purpose |
|---|---|---|---|
| `/api/events/shelf-status` | POST | Pi | Push shelf status events |
| `/api/events/footfall` | POST | Pi | Push entry/exit counts |
| `/api/events/queue` | POST | Local host app | Push queue length/wait data |
| `/api/devices/:id/snapshot` | POST | App → Pi (request), Pi → App (upload) | Request/receive shelf snapshot for annotation |
| `/api/devices/:id/config` | GET | Pi (polls) | Pull latest shelf annotation config |
| `/api/devices/:id/config` | POST | App | Save new annotation config after manager draws BBs |
| `/api/heatmap/ingest` | POST | Backend heatmap service | Store processed heatmap points/grid |
| `/api/alerts` | GET/POST | Dashboard | List/create/update alerts |
| `/api/reports` | GET | Dashboard | Generate/export reports |
| `/api/devices` | GET | Dashboard (Admin) | Fleet health list |

---

## 7. Frontend Requirements

- **Framework:** Next.js (App Router)
- **UI Library:** shadcn/ui — `Card` (KPI tiles), `Table` (alerts/devices), `Tabs` (module nav), `Dialog`/`Sheet` (task detail, annotation tool host), `Badge` (status indicators), `Chart` (recharts wrapper for trends)
- **Annotation tool:** Canvas-based (e.g., `react-konva`) for drawing/labeling bounding boxes over shelf snapshot images
- **Server state:** TanStack Query (React Query) for fetching/caching/polling
- **Live updates:** WebSocket connection from browser to backend (alerts, queue length) with reconnect-with-backoff handling
- **Auth:** NextAuth (Auth.js), JWT-based session. Single master role in prototype — no route-level role gating needed; middleware only needs to check "logged in or not"
- **Floor-plan heatmap:** Custom SVG/Canvas component with zone polygons colorable by dwell/traffic intensity

---

## 8. Non-Functional Requirements

- **Offline resilience:** Pi buffers events locally (SQLite) during connectivity loss; flushes on reconnect. Dashboard should surface "last synced" time per device.
- **Privacy:** No raw video stored long-term; shelf/entry-exit inference stays on-device; heatmap raw frames are processed and discarded, not archived (document this trade-off per §3.3).
- **Scalability:** Data model and API should support onboarding multiple stores/devices without schema changes (store_id/device_id present on all event documents).
- **Performance:** Dashboard should load Overview KPIs within [target, e.g., 2s] and reflect live alerts within [target, e.g., 5s] of event ingestion.

---

## 9. Build Roadmap

| Phase | Scope |
|---|---|
| **Phase 1** | Auth + role-gated layout shell; MongoDB schema + seed/mock data; Overview + Alerts pages on mock data |
| **Phase 2** | Real end-to-end pipeline with one physical Raspberry Pi: footfall + shelf-status ingestion via REST, dashboard reflects live data |
| **Phase 3** | Shelf annotation workflow (snapshot request → canvas BB tool → config push back to Pi) |
| **Phase 4** | Queue Intelligence (local host app integration) + Entry/Exit refinement |
| **Phase 5** | Heatmap pipeline (Camera 3 → backend inference → heatmap visualization) |
| **Phase 6** | Device/Fleet health page, Reports/export, multi-store comparison |
| **Phase 7** | Threshold configuration, alert tuning, polish, POS/ERP integration groundwork (future) |
| **Phase 8 (post-prototype)** | Reintroduce role-based access control — split Master role into Store Staff / Store Manager / Admin-IT with route and UI gating (see §2) |

---

## 10. Open Questions (to resolve before/during build)

- What CV models are running on the Pi for shelf detection and entry/exit — confirmed output format for each event type?
- What hardware/sensor is used for queue detection alongside Camera 2 (PIR, ultrasonic, etc.), and what does its raw payload look like?
- Expected number of Pi devices per store, and total stores for initial pilot (affects fleet-health page priority and MongoDB indexing strategy)?
- Alert thresholds — are these fixed defaults or configurable per store from day one?
- Retention policy for raw event data (footfall/shelf/queue) — how long is historical data kept before aggregation/archival?
