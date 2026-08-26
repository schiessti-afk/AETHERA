/**
 * Imports the OurAirports directory into the `airports` table.
 *
 * Reference data, like the aircraft registry: a plain CSV download that costs no
 * OpenSky credits. AETHERA never asks a provider for airport metadata on the live path.
 *
 * The dataset carries ~80,000 rows, the large majority of which are heliports, closed
 * strips and private fields. Those are kept out entirely: PRODUCT_SPEC §19.3 requires
 * airport markers to stay secondary to aircraft, and §19.1 frames airports as anchors
 * for traffic — a search that returns four hundred grass strips before Heathrow fails
 * both. Only airports with an ICAO-style identifier that are large/medium, or small with
 * scheduled service, are imported.
 *
 * Usage:  pnpm --filter @aethera/ingestion import:airports
 */
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Pool } from "pg";
import { config } from "../config";

const DATASET_URL =
  process.env.AIRPORTS_DATASET_URL ??
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

const BATCH_SIZE = 500;
const FT_TO_M = 0.3048;

const KEPT_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

interface AirportRow {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  type: string;
  scheduledService: boolean;
}

async function flush(pool: Pool, rows: AirportRow[]): Promise<void> {
  if (rows.length === 0) return;

  const deduped = new Map<string, AirportRow>();
  for (const row of rows) deduped.set(row.icao, row);
  const unique = Array.from(deduped.values());

  const values: unknown[] = [];
  const tuples = unique.map((row, index) => {
    const base = index * 10;
    values.push(
      row.icao,
      row.iata,
      row.name,
      row.city,
      row.country,
      row.latitude,
      row.longitude,
      row.elevationM,
      row.type,
      row.scheduledService,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${
      base + 6
    }, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
  });

  await pool.query(
    `INSERT INTO airports
       (icao, iata, name, city, country, latitude, longitude, elevation_m, type, scheduled_service)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (icao) DO UPDATE SET
       iata              = EXCLUDED.iata,
       name              = EXCLUDED.name,
       city              = EXCLUDED.city,
       country           = EXCLUDED.country,
       latitude          = EXCLUDED.latitude,
       longitude         = EXCLUDED.longitude,
       elevation_m       = EXCLUDED.elevation_m,
       type              = EXCLUDED.type,
       scheduled_service = EXCLUDED.scheduled_service`,
    values,
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });

  console.log(`airports: downloading ${DATASET_URL}`);
  const response = await fetch(DATASET_URL);
  if (!response.ok || !response.body) {
    throw new Error(`airports download failed: ${response.status} ${response.statusText}`);
  }

  const lines = createInterface({
    input: Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    crlfDelay: Infinity,
  });

  let columns: Record<string, number> | null = null;
  let batch: AirportRow[] = [];
  let imported = 0;
  let skipped = 0;

  for await (const line of lines) {
    if (!line.trim()) continue;

    if (!columns) {
      const header = parseCsvLine(line).map((h) =>
        h.replace(/"/g, "").trim().toLowerCase(),
      );
      columns = Object.fromEntries(header.map((name, index) => [name, index]));
      for (const required of ["ident", "type", "name", "latitude_deg", "longitude_deg"]) {
        if (!(required in columns)) {
          throw new Error(`airports CSV is missing the "${required}" column`);
        }
      }
      continue;
    }

    const fields = parseCsvLine(line);
    const value = (name: string): string | null => {
      const index = columns![name];
      if (index == null) return null;
      const raw = fields[index]?.replace(/"/g, "").trim();
      return raw ? raw : null;
    };

    const type = value("type");
    if (!type || !KEPT_TYPES.has(type)) {
      skipped += 1;
      continue;
    }

    const scheduledService = value("scheduled_service") === "yes";
    // Small fields are only worth carrying when something actually schedules into them.
    if (type === "small_airport" && !scheduledService) {
      skipped += 1;
      continue;
    }

    const name = value("name");
    // The dataset carries maintenance artefacts — rows literally named
    // "(Duplicate)YEG" that shadow a real airport. They are not places.
    if (!name || name.startsWith("(Duplicate)")) {
      skipped += 1;
      continue;
    }

    // Prefer the published ICAO code. `ident` is only an acceptable fallback when it
    // actually looks like one: for many rows it is a bookkeeping id such as "CA-1291",
    // which would otherwise end up presented to the user as an airport code.
    const identFallback = value("ident")?.toUpperCase();
    const icao =
      value("icao_code")?.toUpperCase() ??
      (identFallback && /^[A-Z]{4}$/.test(identFallback) ? identFallback : null);

    const latitude = Number(value("latitude_deg"));
    const longitude = Number(value("longitude_deg"));

    if (
      !icao ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      skipped += 1;
      continue;
    }

    const elevationFt = Number(value("elevation_ft"));

    batch.push({
      icao,
      iata: value("iata_code"),
      name,
      city: value("municipality"),
      country: value("iso_country"),
      latitude,
      longitude,
      elevationM: Number.isFinite(elevationFt) ? Math.round(elevationFt * FT_TO_M) : null,
      type,
      scheduledService,
    });

    if (batch.length >= BATCH_SIZE) {
      await flush(pool, batch);
      imported += batch.length;
      batch = [];
    }
  }

  await flush(pool, batch);
  imported += batch.length;

  console.log(`airports: imported ${imported} airports (${skipped} rows skipped)`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
