# AETHERA — Architecture

**Product:** AETHERA  
**Tagline:** Live Airspace Intelligence  
**Document:** Architecture  
**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-08-26

---

## 1. Architecture Goals

AETHERA is a real-time 3D airspace intelligence platform built around live ADS-B data.

The architecture must prioritize:

- Real-time flight updates
- Smooth map rendering
- Scalable WebSocket connections
- Efficient OpenSky API usage within the Standard **4,000 `/states` credits per day** budget
- Clear separation between ingestion, processing, and presentation
- Redis for ephemeral real-time state
- PostgreSQL for persistent data
- Docker-first development and deployment
- Extensibility for additional data providers
- A visually sophisticated frontend without coupling business logic to the map
- Graceful degradation when external data is unavailable

The system should be capable of starting as a single-server application while providing a clean path toward horizontal scaling.

---

## 2. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │      OpenSky         │
                         │   ADS-B Data Source  │
                         └──────────┬───────────┘
                                    │
                              HTTP / API
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │      AETHERA Ingestion       │
                    │                              │
                    │  Polling / Normalization     │
                    │  Deduplication               │
                    │  Validation                  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │      Redis       │
                         │                  │
                         │ Current Flights  │
                         │ Pub/Sub          │
                         │ Caches           │
                         │ Sessions         │
                         └───────┬──────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌──────────────────┐       ┌──────────────────┐
          │ Anomaly Engine   │       │ Realtime Gateway │
          │                  │       │                  │
          │ Squawks          │       │ WebSockets       │
          │ Sink rates       │       │ Subscriptions    │
          │ Position changes │       │ Filtering        │
          └────────┬─────────┘       └────────┬─────────┘
                   │                          │
                   ▼                          ▼
          ┌──────────────────┐       ┌──────────────────┐
          │   PostgreSQL     │       │    Web Clients   │
          │                  │       │                  │
          │ Flights          │       │ React            │
          │ Aircraft         │       │ MapLibre+Deck.gl │
          │ Events           │       │ Three.js         │
          │ Anomalies        │       │ WebSocket        │
          └──────────────────┘       └──────────────────┘
```

---

## 3. Core Architectural Principle

AETHERA follows a data pipeline architecture:

```text
SOURCE
  ↓
INGEST
  ↓
NORMALIZE
  ↓
STORE
  ↓
ANALYZE
  ↓
DISTRIBUTE
  ↓
VISUALIZE
```

Each stage should have a clearly defined responsibility.

The frontend must never depend directly on OpenSky.

Instead:

```text
Browser
   ↓
AETHERA API
   ↓
AETHERA realtime state
   ↓
OpenSky
```

This protects the external API, allows caching, enables anomaly processing, and gives AETHERA control over the user experience.

---

## 4. Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- MapLibre GL JS
- Deck.gl
- Tailwind CSS
- WebSocket

**Responsibilities:**

- Application UI
- 2D/3D map
- Flight visualization
- Aircraft interaction
- Search
- Filters
- Dashboard
- Anomaly visualization
- Real-time state synchronization

### Backend

Recommended:

- Node.js
- TypeScript
- Fastify
- WebSocket

**Responsibilities:**

- REST API
- WebSocket gateway
- Authentication
- Request validation
- Flight queries
- Geographic filtering
- Realtime subscriptions

### Data Ingestion

- Node.js
- TypeScript
- OpenSky API

**Responsibilities:**

- Poll OpenSky
- Fetch aircraft state vectors
- Normalize data
- Detect changes
- Update Redis
- Publish realtime events

### Realtime State

**Redis** is the primary store for short-lived operational state.

Examples:

- Current aircraft positions
- Current velocity
- Current altitude
- Current track
- Current squawk
- Active anomalies
- Realtime subscriptions
- Temporary caches

### Persistent Storage

**PostgreSQL** stores information that needs to survive process restarts.

Examples:

- Aircraft metadata
- Airports
- Flight records
- Flight events
- Anomaly history
- User preferences
- Saved searches
- System configuration

PostGIS may be introduced for advanced geographic queries.

### Infrastructure

- Docker
- Docker Compose
- Nginx
- PostgreSQL
- Redis

Production infrastructure should be containerized.

---

## 5. Repository Architecture

Recommended project structure:

```text
aethera/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── public/
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   ├── routes/
│       │   ├── websocket/
│       │   ├── middleware/
│       │   └── server.ts
│       │
│       └── tests/
│
├── packages/
│   │
│   ├── types/
│   ├── validation/
│   ├── flight-engine/
│   ├── anomaly-engine/
│   └── ui/
│
├── services/
│   │
│   └── ingestion/
│       ├── src/
│       │   ├── providers/
│       │   ├── normalizer/
│       │   ├── polling/
│       │   └── publisher/
│       └── tests/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── docker/
│   ├── nginx/
│   └── postgres/
│
├── docs/
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile
├── package.json
└── README.md
```

---

## 6. Service Architecture

AETHERA should conceptually consist of five major services.

```text
┌───────────────────────────────────────────┐
│                  AETHERA                  │
│                                           │
│  ┌─────────┐ ┌─────────┐ ┌────────────┐   │
│  │   Web   │ │   API   │ │ Ingestion  │   │
│  └────┬────┘ └────┬────┘ └──────┬─────┘   │
│       │           │             │          │
│       └───────────┼─────────────┘          │
│                   │                        │
│          ┌────────┴────────┐               │
│          │                 │               │
│       Redis           PostgreSQL           │
│                                           │
└───────────────────────────────────────────┘
```

---

## 7. Web Application

The web application is responsible exclusively for presentation and user interaction.

It should not contain the core flight-processing logic.

### Main areas

- Dashboard
- Map
- Flight details
- Aircraft details
- Anomaly center
- Airport view
- Search
- Settings

### Map Architecture

The map is the centerpiece of AETHERA.

```text
MapLibre
   +
Deck.gl
   +
React
```

**MapLibre** handles:

- Base map (OpenFreeMap / OSM vector tiles, no API key)
- Geographic projection
- Navigation
- Terrain
- Styling

**Deck.gl** handles:

- Aircraft layers
- Flight trails
- 3D visualization
- Large-scale rendering
- GPU-accelerated visualization

---

## 8. Flight Rendering Pipeline

Flight data received by the browser:

```json
{
  "icao24": "3c4a12",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "altitude": 10668,
  "velocity": 235,
  "heading": 92,
  "verticalRate": -2.1
}
```

The rendering pipeline becomes:

```text
WebSocket
   ↓
Flight State Store
   ↓
Interpolation Engine
   ↓
Deck.gl Layer
   ↓
GPU
```

The browser should not simply jump the aircraft from one API position to another.

Instead:

```text
Position T0
     ↓
Velocity + Heading
     ↓
Predicted position
     ↓
Position T1
     ↓
Correction
```

This produces smooth movement between ADS-B updates.

---

## 9. Realtime Architecture

WebSockets provide the primary realtime communication mechanism.

```text
                    ┌─────────────┐
                    │    Redis    │
                    └──────┬──────┘
                           │
                       Pub/Sub
                           │
                           ▼
                  ┌─────────────────┐
                  │ WebSocket API   │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Client A     Client B     Client C
```

The server publishes flight updates as events.

Example:

```json
{
  "type": "flight.update",
  "timestamp": 1787750000,
  "data": {
    "icao24": "3c4a12",
    "latitude": 48.8567,
    "longitude": 2.3541,
    "altitude": 10710,
    "heading": 93
  }
}
```

---

## 10. Geographic Subscriptions

AETHERA should not send every aircraft in the world to every browser.

Clients subscribe to a geographic area.

Example:

```json
{
  "type": "viewport.subscribe",
  "bounds": {
    "west": -10,
    "south": 35,
    "east": 30,
    "north": 60
  }
}
```

The backend determines which aircraft belong to that viewport.

This dramatically reduces:

- Bandwidth
- CPU usage
- Browser memory
- WebSocket traffic

---

## 11. Zoom-Level Optimization

Different levels of zoom require different levels of detail.

### World view

Show:

- Aircraft icon
- Altitude
- Heading
- Basic identification

### Regional view

Show:

- Aircraft
- Flight number
- Altitude
- Speed
- Airline
- Trail

### Close view

Show:

- Aircraft
- Callsign
- Registration
- Altitude
- IAS/TAS where available
- Vertical rate
- Heading
- Origin
- Destination
- Squawk
- Aircraft type
- Trail
- Anomalies

This is critical for maintaining performance.

---

## 12. Data Flow

### Initial Load

```text
Browser
   ↓
GET /api/aircraft
   ↓
API
   ↓
Redis
   ↓
Current aircraft state
   ↓
Browser
```

Immediately afterward:

```text
Browser
   ↓
WebSocket connect
   ↓
Subscribe to viewport
   ↓
Receive realtime updates
```

---

## 13. OpenSky Data Flow

```text
OpenSky
   │
   │ periodic request
   ▼
Ingestion Service
   │
   ├── Validate
   ├── Normalize
   ├── Deduplicate
   └── Enrich
   │
   ▼
Redis
   │
   ├──────────────┐
   ▼              ▼
Anomaly Engine   WebSocket
   │              │
   ▼              ▼
PostgreSQL      Browser
```

The ingestion service is intentionally isolated from the API server.

This prevents API traffic from interfering with data collection.

OpenSky is polled on a **credit budget**, not as fast as the map can render. Default: one global snapshot about every **90 seconds**. See §25.

---

## 14. Provider Abstraction

AETHERA should not permanently couple itself to OpenSky.

Define a provider interface:

```ts
interface FlightDataProvider {
  getStates(bounds?: BoundingBox): Promise<FlightState[]>;
}
```

OpenSky becomes:

```ts
class OpenSkyProvider implements FlightDataProvider {
  async getStates(bounds?: BoundingBox) {
    // OpenSky implementation
  }
}
```

Future providers can implement the same interface:

- OpenSky
- ADS-B Exchange
- FlightAware
- Other licensed providers
- Own receivers
- Satellite ADS-B

This makes AETHERA a flight-data platform, rather than an OpenSky wrapper.

---

## 15. Normalized Flight Model

External provider formats must never leak directly into the application.

```text
Provider data
      ↓
Normalizer
      ↓
AETHERA FlightState
      ↓
Application
```

Example:

```ts
interface FlightState {
  icao24: string;

  callsign?: string;

  latitude: number;
  longitude: number;

  altitude?: number;

  velocity?: number;

  heading?: number;

  verticalRate?: number;

  squawk?: string;

  onGround: boolean;

  lastSeen: Date;
}
```

All internal systems consume this normalized representation.

---

## 16. Anomaly Architecture

Anomaly detection operates on normalized flight states.

```text
Flight Update
     ↓
Anomaly Engine
     │
     ├── Emergency Squawk
     ├── Extreme Sink Rate
     ├── Extreme Climb Rate
     ├── Sudden Heading Change
     ├── Sudden Altitude Change
     └── Lost Signal
     │
     ▼
Anomaly Event
```

The anomaly engine should be deterministic initially.

AI/ML should not be required for the MVP.

---

## 17. Event Architecture

AETHERA should use event-based communication internally.

Examples:

- `flight.updated`
- `flight.created`
- `flight.removed`
- `anomaly.detected`
- `anomaly.resolved`
- `aircraft.updated`

Example:

```json
{
  "type": "anomaly.detected",
  "timestamp": "2026-08-26T16:00:00Z",
  "aircraft": "3c4a12",
  "anomaly": {
    "type": "EMERGENCY_SQUAWK",
    "severity": "critical",
    "value": "7700"
  }
}
```

---

## 18. PostgreSQL Responsibilities

PostgreSQL should not be used as the primary high-frequency realtime state store.

Avoid writing every aircraft position directly to PostgreSQL.

**Bad:**

```text
Aircraft
 ↓
Position update
 ↓
PostgreSQL
 ↓
Position update
 ↓
PostgreSQL
 ↓
...
```

**Instead:**

```text
Aircraft
 ↓
Redis
 ↓
Realtime clients
```

Persist only useful historical events.

For example:

- Flight started
- Flight ended
- Anomaly detected
- Anomaly resolved
- Aircraft metadata changed

Historical track storage can be introduced later.

---

## 19. Redis Responsibilities

Redis contains rapidly changing information.

Example logical structures:

- `flights:{icao24}`
- `flights:active`
- `anomalies:active`
- `aircraft:{icao24}`

Redis Pub/Sub or Streams can distribute events.

For the initial architecture:

```text
Redis
 ├── Current state
 ├── Cache
 └── Pub/Sub
```

Later:

- Redis Streams
- Kafka
- NATS

can be introduced if the system requires higher throughput.

---

## 20. Caching Strategy

AETHERA should use several cache levels.

### L1 — Browser

Stores:

- Current flight state
- Map configuration
- User preferences

### L2 — Redis

Stores:

- Current global state
- API responses
- Aircraft metadata
- Anomaly state

### L3 — PostgreSQL

Stores persistent information.

---

## 21. API Architecture

REST endpoints should provide non-realtime operations.

Example:

```http
GET /api/aircraft
GET /api/aircraft/:icao24
GET /api/flights/:id
GET /api/airports
GET /api/anomalies
GET /api/search
```

Realtime:

```http
/ws
```

---

## 22. API Filtering

Aircraft queries should support:

- bounding box
- altitude
- speed
- heading
- callsign
- airline
- aircraft type
- squawk
- anomaly

Example:

```http
GET /api/aircraft
  ?west=-10
  &south=35
  &east=30
  &north=60
```

---

## 23. Search Architecture

Search should eventually support:

- Flight number
- Callsign
- ICAO24
- Registration
- Airport
- Airline
- Aircraft type

Architecture:

```text
Search UI
   ↓
Search API
   ↓
PostgreSQL / Redis
   ↓
Results
```

For larger datasets, PostgreSQL full-text search or Elasticsearch/OpenSearch can be introduced later.

---

## 24. Security

The backend must protect:

- OpenSky credentials
- Database credentials
- Redis credentials
- Application secrets

Secrets must never be committed.

Use:

- `.env`
- `.env.local`
- Docker secrets
- Production environment variables

The browser should never receive private API credentials.

---

## 25. Rate-Limit Protection

OpenSky access is centralized.

```text
                ┌─────────────┐
                │   OpenSky   │
                └──────┬──────┘
                       │
                       ▼
                Ingestion only
                       │
                       ▼
                    Redis
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
          User 1     User 2     User 3
```

Users never directly consume OpenSky requests.

This is one of the most important architectural decisions in AETHERA. The credit budget belongs to the **AETHERA instance**, not to each browser.

### 25.1 OpenSky credit model

AETHERA currently uses a **Standard** OpenSky account: **4,000 credits per day** for `/states/*`. Credits refill daily. `/tracks/*` and `/flights/*` have separate 4,000-credit buckets and are unused in Phase 1.

Anonymous access is 400/day. An active ADS-B feeder (≥30% monthly uptime) is 8,000/day. Licensed access is 14,400 **per hour**. `/states/own` (own receivers) costs nothing.

`GET /states/all` cost depends on bounding-box area (latitude span × longitude span, in square degrees):

| Bounding box | Credits per poll | Polls / 4,000 credits | Fastest 24h interval |
| --- | ---: | ---: | ---: |
| ≤ 25 sq° | 1 | 4,000 | ~22 s |
| 25–100 sq° | 2 | 2,000 | ~44 s |
| 100–400 sq° | 3 | 1,333 | ~65 s |
| > 400 sq° or **global** | 4 | **1,000** | **~87 s** |

A 10-second global poll would cost `8,640 × 4 = 34,560` credits/day and exhaust Standard quota in a few hours. That interval is not allowed.

Authenticated state vectors have **5-second source resolution** and up to **one hour** of lookback. Polling faster than the credit interval does not make OpenSky emit denser data; the map stays smooth through **client interpolation**.

### 25.2 AETHERA polling policy

Default operating mode:

- One ingestion poller for the whole product
- Global `/states/all` unless `OPENSKY_WEST/SOUTH/EAST/NORTH` is set
- Interval = `max(configured, floor that keeps 95% of the daily budget)`
- Default configured interval: **90 seconds** (about 960 global polls × 4 credits ≈ 3,840/day, with headroom for retries and manual tests)
- On `429`, honor `X-Rate-Limit-Retry-After-Seconds` and pause
- Persist `X-Rate-Limit-Remaining` in Redis so health/status can show budget
- Aircraft motion between snapshots is interpolated from last observed velocity and heading

Do **not**:

- Let the browser call OpenSky
- Start one poller per connected user
- Poll `/states/all` globally every few seconds
- Spend Phase 1 `/flights` or `/tracks` credits on history until History exists

To poll a region more often, shrink the box. Example: a 5° × 5° area is 25 sq° → 1 credit → ~22 s. Europe-scale boxes are often still > 400 sq° and cost the same as global.

When remaining credits cannot cover the rest of the UTC day at the current cost, ingestion must slow down or pause rather than return 429 in a loop. The UI then shows `DELAYED` / `DEGRADED` from data age, not a fake live feed.

---

## 26. Failure Handling

External APIs can fail.

AETHERA should therefore degrade gracefully.

If OpenSky becomes unavailable:

```text
OpenSky
   X
   │
   ▼
Ingestion detects failure
   │
   ▼
Redis retains latest state
   │
   ▼
Frontend continues displaying aircraft
   │
   ▼
UI shows "Data delayed"
```

The frontend should clearly communicate:

- `LIVE` — a snapshot arrived within about two poll intervals (~150 s at the default 90 s cadence)
- `DELAYED`
- `DEGRADED`
- `OFFLINE`

rather than pretending data is live. Freshness thresholds must follow the OpenSky credit-limited poll interval, not a 5–10 second dashboard assumption.

---

## 27. Health Monitoring

Every service should expose health information.

```http
GET /health
```

Example:

```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "opensky": "healthy"
  }
}
```

Also expose:

```http
GET /ready
GET /metrics
```

for production monitoring.

---

## 28. Docker Architecture

Development environment:

```text
Docker Compose
│
├── web
├── api
├── ingestion
├── postgres
├── redis
└── nginx
```

Conceptually:

```text
                    Nginx
                      │
              ┌───────┴───────┐
              ▼               ▼
             Web              API
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                  Redis             PostgreSQL
                    ▲
                    │
                Ingestion
                    │
                    ▼
                  OpenSky
```

Each service should have its own Docker container.

---

## 29. Development vs Production

### Development

Use:

- Docker Compose
- Hot reload
- Local PostgreSQL
- Local Redis
- Local OpenSky integration

### Production

Use:

- Docker
- Reverse proxy
- HTTPS
- Persistent PostgreSQL volume
- Persistent Redis configuration
- Health checks
- Logging
- Monitoring

The application should behave consistently between both environments.

---

## 30. Scalability

The initial architecture should support:

```text
1 server
↓
100 users
↓
1,000 users
```

without fundamental redesign.

API servers should be stateless.

```text
             Load Balancer
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
     API 1      API 2      API 3
       │          │          │
       └──────────┼──────────┘
                  ▼
                Redis
                  │
             PostgreSQL
```

WebSocket servers can scale horizontally using Redis Pub/Sub.

---

## 31. Future Scaling Architecture

At larger scale:

```text
                    Load Balancer
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        WebSocket Cluster        API Cluster
              │                       │
              └───────────┬───────────┘
                          ▼
                    Redis Cluster
                          │
                    Event Bus
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
             Processing        Persistence
                 │                 │
                 ▼                 ▼
             PostgreSQL       Data Warehouse
```

A message broker such as Kafka or NATS should only be introduced when the actual scale requires it.

---

## 32. Observability

AETHERA should eventually implement:

- Structured logging
- Metrics
- Tracing
- Health checks
- Error tracking

Important metrics:

- OpenSky request latency
- OpenSky request failures
- Aircraft count
- Aircraft updates/sec
- WebSocket connections
- WebSocket messages/sec
- Redis latency
- PostgreSQL latency
- Anomalies detected
- Data freshness

One particularly important metric is:

`data_age_seconds`

This tells the system how old the latest flight data is.

---

## 33. Data Freshness

Every flight state should have a timestamp.

```ts
{
  lastSeen: "...",
  receivedAt: "...",
  processedAt: "..."
}
```

The UI can calculate:

```text
Now - lastSeen
```

and display:

- `LIVE`
- `2 sec ago`
- `8 sec ago`
- `1 min ago`
- `STALE`

This is important because real-time data is only useful if the user knows how fresh it is.

OpenSky Standard credits mean snapshots may be ~90 seconds apart for a global feed. Interpolation keeps markers moving; labels must still distinguish **observed** from **interpolated**, and `LIVE` means “ingestion is on cadence,” not “OpenSky was queried this second.”

---

## 34. Frontend State Architecture

Separate state into three categories.

### Server state

- Aircraft
- Flights
- Airports
- Anomalies

### Realtime state

- Current aircraft positions
- Current anomalies
- Connection status
- Data freshness

### UI state

- Selected aircraft
- Map position
- Zoom
- Filters
- Panels
- Theme

These should not be mixed into one giant global state store.

---

## 35. UI / Map Separation

The map should be treated as a specialized rendering surface.

```text
Application State
       │
       ▼
Flight Visualization Adapter
       │
       ▼
Deck.gl
       │
       ▼
MapLibre
```

This allows the rest of the application to work without depending on MapLibre.

Potential future visualization engines:

- Deck.gl
- Three.js
- Cesium
- WebGPU

---

## 36. 3D Airspace Model

Altitude should be represented as a real third dimension.

```text
             Aircraft
                ●
               /|
              / |
             /  | altitude
            /   |
───────────●────┴────────── Ground
```

The map should support:

- 2D mode
- 3D terrain mode
- 3D airspace mode

Aircraft positions are transformed approximately into:

```text
longitude → X
latitude  → Y
altitude  → Z
```

The visualization layer handles the projection.

---

## 37. Flight Trails

Flight trails should be handled separately from current aircraft state.

```text
Current aircraft
      +
Historical positions
      ↓
Trail Layer
```

For performance:

- Limit trail length
- Simplify old points
- Use GPU rendering
- Remove inactive trails
- Load historical data only when needed

---

## 38. Event Lifecycle

A typical aircraft lifecycle:

```text
Aircraft appears
       ↓
flight.created
       ↓
flight.updated
       ↓
flight.updated
       ↓
flight.updated
       ↓
...
       ↓
No longer detected
       ↓
flight.removed
```

Anomaly lifecycle:

```text
Normal
  ↓
Condition detected
  ↓
anomaly.detected
  ↓
Active
  ↓
Condition disappears
  ↓
anomaly.resolved
  ↓
Resolved
```

This prevents repeatedly generating the same anomaly every polling cycle.

---

## 39. Architecture Principles

The project should follow these principles:

### 1. Backend owns external integrations

The browser never communicates directly with OpenSky.

### 2. Redis owns realtime state

Do not use PostgreSQL as a high-frequency position cache.

### 3. PostgreSQL owns persistence

Only persist information that provides historical or business value.

### 4. WebSockets own realtime delivery

REST is for queries; WebSockets are for live updates.

### 5. Providers are abstracted

OpenSky should be replaceable.

### 6. Frontend is presentation-focused

Business and data-processing logic belongs outside React components.

### 7. Everything is typed

Use TypeScript across the application wherever possible.

### 8. Docker-first

Every developer should be able to start AETHERA with:

```bash
docker compose up
```

### 9. Graceful degradation

External failures should not crash the entire application.

### 10. Design is part of the architecture

The rendering system must be capable of supporting AETHERA's premium visual identity from the beginning.

---

## 40. Target User Experience

The architecture ultimately exists to support this experience:

```text
                 A E T H E R A

              LIVE AIRSPACE
               INTELLIGENCE

        ┌─────────────────────────────┐
        │                             │
        │          3D WORLD           │
        │                             │
        │       ✈      ✈             │
        │            ✈                │
        │   ✈                ✈       │
        │                             │
        │          ✈                  │
        │                             │
        └─────────────────────────────┘

     12,481 AIRCRAFT       LIVE ●
```

The interface should feel closer to a professional airspace intelligence system than a conventional flight-tracking website.

The technical architecture therefore needs to support:

- High-density visualization
- Smooth aircraft animation
- 3D altitude
- Real-time events
- Intelligent filtering
- Anomaly highlighting
- Rich aircraft information
- Minimal UI latency
- Excellent visual hierarchy

---

## 41. MVP Architecture

The first implementation should remain intentionally simple:

```text
                 OpenSky
                    │
                    ▼
               Ingestion
                    │
                    ▼
                  Redis
                    │
            ┌───────┴───────┐
            ▼               ▼
      Anomaly Engine       API
            │               │
            ▼               ▼
       PostgreSQL       WebSocket
                            │
                            ▼
                           Web
                       MapLibre + Deck.gl
```

### MVP services

- `web`
- `api`
- `ingestion`
- `postgres`
- `redis`

No Kafka.

No Kubernetes.

No microservice explosion.

No unnecessary AI.

No complex distributed infrastructure.

Build the core experience first.

---

## 42. Evolution Path

### Phase 1 — Foundation

- OpenSky
- Redis
- PostgreSQL
- API
- WebSocket
- Next.js
- MapLibre
- Deck.gl
- Docker

### Phase 2 — Intelligence

- Anomaly Engine
- Flight trails
- Aircraft enrichment
- Airport intelligence
- Advanced filtering

### Phase 3 — Scale

- Multiple API instances
- Multiple WebSocket instances
- Redis Pub/Sub
- Load balancing
- Monitoring

### Phase 4 — Data Platform

- Multiple providers
- Historical flight database
- Advanced analytics
- Predictive models
- ML anomaly detection

### Phase 5 — Professional Intelligence

- Airspace analytics
- Sector analysis
- Airport congestion
- Route intelligence
- Advanced alerts
- Custom dashboards
- Enterprise APIs

---

## 43. Final Architecture

The intended long-term architecture is:

```text
                         DATA PROVIDERS
                              │
              ┌───────────────┼────────────────┐
              │               │                │
           OpenSky        Provider B        Provider C
              │               │                │
              └───────────────┼────────────────┘
                              ▼
                       DATA INGESTION
                              │
                    ┌─────────┴─────────┐
                    │                   │
                Normalize           Validate
                    │                   │
                    └─────────┬─────────┘
                              ▼
                           REDIS
                    Realtime State / Events
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
             API Layer   Anomaly Engine  WebSocket
                 │            │            │
                 │            ▼            │
                 │       PostgreSQL        │
                 │                         │
                 └────────────┬────────────┘
                              ▼
                        AETHERA WEB
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           MapLibre          Deck.gl        UI System
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    LIVE AIRSPACE
                     INTELLIGENCE
```

AETHERA should be built as a real-time data platform with a premium visualization layer—not simply as a map that displays an API response. This distinction should guide the implementation from the first commit.
