# AETHERA — Phase 4 Plan

**Product:** AETHERA  
**Tagline:** Live Airspace Intelligence  
**Document:** Phase 4 Implementation Plan — Memory  
**Version:** 1.0  
**Status:** Planned, storage design validated by spike  
**Last Updated:** 2026-08-27

---

## Purpose

This document turns [Roadmap](ROADMAP.md) Phase 4 — **Memory** — into an implementable
plan.

It differs from the roadmap in three places. Each difference is backed by a measurement
taken against the running system rather than by reasoning, and each is recorded below
with the number that drove it. Where this document and the roadmap disagree on
*sequence*, the roadmap wins; where they disagree on *a fact about the data*, the
measurement wins.

Phase 4 ships **History**. The platform items the roadmap groups alongside it are
deliberately deferred, for reasons given in [Decisions](#decisions).

---

## 1. Where Phase 4 Starts

| Asset | State |
| --- | --- |
| `flights`, `flight_events` tables | Exist since Phase 1 scaffolding, **never written to** |
| Redis trails (`trail:{icao24}`) | 90 points/aircraft, 2 h TTL — the raw material, but ephemeral |
| `anomalies` | Full detected → active → resolved lifecycle persisted (Phase 2) |
| `airspace_samples` | Aggregate per poll, pruned hourly (Phase 3) |
| Provider interface | **Nominal only** — `Poller` is typed to the concrete `OpenSkyProvider` |
| Database size | 56 MB, almost entirely the aircraft registry |

Nothing durable exists for positions. History begins the day Phase 4 ships; there is no
backfill and the UI must say so rather than presenting an empty replay as a failure.

---

## 2. Evidence

All figures measured on 2026-08-27 against ~9,600 live observed aircraft and a 5.0M-point
synthetic day built from real observed positions, so spatial clustering is realistic
(Europe carried 7% of points in ~1% of the area).

### 2.1 Coverage gaps

| Measurement | Result |
| --- | --- |
| Trails containing ≥1 coverage gap | **54%** |
| Gap duration, median | 562 s (~9 min, ~6 missed polls) |
| Gap duration, p90 / max | 4,330 s / 7,081 s (~72 min / ~118 min) |
| Gaps longer than 30 min | 65 of 231 observed |
| Aircraft reporting a callsign | **98.7%** |

**Consequence.** A flight cannot be defined by an aircraft disappearing. With more than
half of all aircraft dropping out and returning, closing a record on disappearance would
shatter single real flights into many, and the `flights` table would be largely fiction.

### 2.2 Storage

Two layouts, identical source data, indexes included.

| Layout | Bytes/point | Per day | 30 days | 1 year |
| --- | --- | --- | --- | --- |
| Row-per-point | **154** | 1.43 GB | 43 GB | 523 GB |
| Packed aircraft-hour | **27.2** | 253 MB | **7.4 GB** | 90 GB |

### 2.3 Query — region + time window

Europe-wide, one hour:

| Approach | Time |
| --- | --- |
| Row-per-point, btree on time + position | 55.6 ms |
| Packed, timestamps decoded in SQL | 63.3 ms — *slower than row-per-point* |
| Packed, raw offsets returned | 51.1 ms |
| **Packed, arrays returned unexpanded** | **5.0 ms** |

Narrower region (Paris, 1 h): 34.5 ms row-per-point vs 6.9 ms packed.  
Single aircraft, full history: 0.176 ms vs 0.167 ms — effectively tied.

**Consequence.** Packing wins on query only when the arrays are *not* expanded in SQL.
Expanding them in Postgres costs more than the layout saves. The API expands instead,
which also puts far less JSON on the wire: one `hour_start` plus three arrays per
aircraft-hour rather than an object per point.

### 2.4 Timestamp encoding — a bug caught by the spike

The first packed schema stored timestamps as `REAL` epoch seconds.

`REAL` cannot represent epoch seconds. At ~1.79 × 10⁹ its resolution is roughly **3,100
seconds**: `1787786914` stores as `1787790000`.

| Encoding | Points returned for a fixed window |
| --- | --- |
| Row-per-point (ground truth) | 1132 |
| Packed, epoch as `REAL` | **1163 — 2.7% wrong** |
| Packed, seconds-offset as `REAL` | 1132 — exact |

Every replay timestamp would have been wrong by up to ~52 minutes, and the error is
silent. Time is therefore stored as **seconds offset from `hour_start`** (0–3599), a
range `REAL` represents exactly.

### 2.5 Spatial indexing and write cost

- PostgreSQL's built-in **GiST index on `box(...)` is sufficient**. It cut 175,680
  candidate rows to 1,681 in 0.5 ms. **PostGIS is not required** — this closes the
  roadmap's "PostGIS or equivalent only if geographic history queries demand it".
- Writing 10,000 aircraft-hours took **80 ms**. An hourly flush from the existing Redis
  trails is negligible.

---

## 3. Decisions

### D1 — Track points are stored packed, one row per aircraft-hour

Measured 27.2 vs 154 bytes/point, and 5.0 ms vs 55.6 ms on the region query. Time is
encoded as a seconds offset from `hour_start` (§2.4). Arrays are never expanded in SQL
(§2.3).

### D2 — Simple time-based retention; no tiering yet

At 253 MB/day, 30 days of full-fidelity history is 7.4 GB — comfortable on a single
server. The roadmap anticipated downsampling; the measurement says it is not needed at
this traffic level. Ship a retention window, defer tiering until a real figure justifies
it.

### D3 — Do not model flights by disappearance

Derive **sessions** keyed on `(icao24, callsign)` with a generous gap tolerance, and
label them as inferred. Callsign is present on 98.7% of aircraft, so it is a viable key;
disappearance is not (§2.1).

This is the one place this plan contradicts the roadmap's wording. "Durable flight
records" implies a certainty the observed data does not support. Sessions are presented
as derived, consistent with PRODUCT_SPEC §25 (observed vs derived vs estimated).

### D4 — Replay is time-and-region first, aircraft second

This is what the roadmap asks for ("pick a time range and region, then replay") and what
track points naturally support. Per-aircraft replay falls out of the same store.

### D5 — Defer the platform half of Phase 4

Deferred: horizontal API/WebSocket scaling, load balancing, authentication, saved views,
notification channels, ML-assisted scoring, light theme, public API.

The roadmap itself gates these — scale "when a single instance is no longer enough", and
no Kafka/NATS/Kubernetes "before measured load requires them". There is no measured
pressure: API endpoints do ~10 ms of real work per request. The WebSocket layer already
fans out through Redis Pub/Sub, so it is closer to horizontally scalable than the roadmap
assumes; revisit when a second instance is actually needed.

**Kept from the platform group:** making the provider interface real (W5). It is cheap,
and the roadmap's own success criterion — "a second provider can be added without
changing the browser" — is currently false.

---

## 4. Schema

```sql
-- Observed positions, packed one row per aircraft-hour.
CREATE TABLE track_hours (
  icao24      TEXT        NOT NULL,
  hour_start  TIMESTAMPTZ NOT NULL,

  -- Bounding box of this hour's points, for coarse region filtering.
  min_lat REAL NOT NULL, max_lat REAL NOT NULL,
  min_lon REAL NOT NULL, max_lon REAL NOT NULL,

  point_count INT NOT NULL,

  -- Seconds since hour_start (0..3599). NEVER epoch seconds: REAL cannot
  -- represent those to better than ~3100 s, which silently corrupts replay.
  t_off REAL[] NOT NULL,
  lats  REAL[] NOT NULL,
  lons  REAL[] NOT NULL,
  alts  REAL[],

  PRIMARY KEY (icao24, hour_start)
);

CREATE INDEX track_hours_time_idx ON track_hours (hour_start);
CREATE INDEX track_hours_box_idx  ON track_hours
  USING GIST (box(point(min_lon, min_lat), point(max_lon, max_lat)));

-- Inferred flight sessions. Derived, not observed: see D3.
CREATE TABLE flight_sessions (
  id          BIGSERIAL PRIMARY KEY,
  icao24      TEXT        NOT NULL,
  callsign    TEXT,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  point_count INT NOT NULL DEFAULT 0,
  min_lat REAL, max_lat REAL, min_lon REAL, max_lon REAL
);

CREATE INDEX flight_sessions_ac_idx   ON flight_sessions (icao24, started_at DESC);
CREATE INDEX flight_sessions_time_idx ON flight_sessions (started_at DESC);
```

The existing empty `flights` and `flight_events` tables are replaced by
`flight_sessions`; they were Phase 1 scaffolding that no code ever used, and their
"flight" framing is the one D3 rejects.

### Reference query

```sql
-- Region + time window. Arrays come back packed; the API expands them.
SELECT icao24, hour_start, point_count, t_off, lats, lons, alts
FROM track_hours
WHERE hour_start >= $1 - interval '1 hour'
  AND hour_start <= $2
  AND box(point(min_lon, min_lat), point(max_lon, max_lat))
      && box(point($3, $4), point($5, $6));
```

The one-hour lookback is required: a row is keyed by the hour it starts in, so points
belonging to the requested window can live in the preceding row.

---

## 5. Workstreams

Order: **W1 → W3 → W4** gets replay working end to end. W2 and W5 follow. W6 last.

### W1 — Track persistence

- `track_hours` schema and migration (via the `pnpm migrate` runner).
- Hourly flush promoting completed hours from Redis trails to PostgreSQL.
- Retention job on the same footing as the Phase 3 sample pruner.
- Only observed positions are stored — never interpolated ones (PRODUCT_SPEC §25).

### W2 — Sessions

- Infer `(icao24, callsign)` sessions with gap tolerance.
- Close a session on callsign change or on absence beyond the tolerance.
- Drop `flights` / `flight_events`.

### W3 — History API

- Region + time window query returning packed rows.
- Per-aircraft track query.
- Expansion in the API layer, not in SQL.
- A streaming or paged shape: a busy hour over Europe is a large payload.

### W4 — History surface

- Time range and region selection, then replay.
- Playback: play, pause, speed, scrub.
- `REPLAY` mode banner with the timestamp always visible (PRODUCT_SPEC §21.3).
- Returning to live is a single clear action.
- Same map language, same aircraft panel, same honesty about interpolated frames as
  Explore.
- Empty-history state that explains there is no backfill.

### W5 — Provider interface made real

- Type `Poller` to `FlightDataProvider`, not `OpenSkyProvider`.
- Move credit accounting behind the interface (`creditsRemaining` is an OpenSky concept
  currently leaking into the generic snapshot).
- Generalise `OpenSkyRateLimitError` into a provider-agnostic rate-limit signal.
- Success test: a second provider can be added without touching the browser.

### W6 — Minimal operations

- History write health and retention metrics in `/health`.
- No dashboards, no new infrastructure (D5).

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| A busy region-hour is a large payload for the browser | W3 designs for streaming/paging before W4 consumes it |
| History starts empty and stays thin for days | Explicit empty state; never present an empty replay as a failure |
| Session inference produces wrong boundaries | Label as inferred; validate against known long-haul flights before shipping |
| Retention window proves too short or too long in practice | Configurable, like `ANALYTICS_RETENTION_HOURS` |

Storage layout is **no longer a risk** — it was the open question and the spike closed
it.

---

## 7. Out of Scope

Carried forward from the roadmap's own exclusions:

- Claiming complete worldwide coverage.
- Replacing the visualisation product with a generic BI tool.
- Kafka, NATS, or Kubernetes before measured load requires them.
- Treating predictive models as facts in the UI.
- OpenSky `/flights` and `/tracks` for routine history. They hold **separate** 4,000
  credit/day budgets and must be budgeted deliberately; Phase 4 history comes from
  AETHERA's own live poll.

---

## 8. Relationship to Other Documents

| Document | Role |
| --- | --- |
| [Roadmap](ROADMAP.md) | Delivery sequence. Wins on ordering |
| [Product Specification](PRODUCT_SPEC.md) | §21 History and Replay, §25 observed vs derived |
| [Architecture](ARCHITECTURE.md) | §18 PostgreSQL responsibilities, §25 rate limits, §37 trails |
| [Design System](DESIGN_SYSTEM.md) | Replay must share Explore's visual language |
| [Post-Roadmap Features](POSTMVP.md) | Sits beyond this phase |

Where this plan diverges from the roadmap — D3 on flight records, D5 on deferring the
platform group — the reasoning and the measurement are recorded in §2 so the decision can
be revisited against new evidence rather than re-argued.
