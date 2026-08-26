/**
 * Imports the OpenSky aircraft registry into the `aircraft` table.
 *
 * This is metadata, not telemetry (PRODUCT_SPEC §24.4): if it is missing or stale,
 * every live feature still works and the UI simply shows the identity fields as
 * unavailable. Nothing here is on the live path.
 *
 * It reads the published CSV dataset rather than OpenSky's per-aircraft REST metadata
 * endpoint on purpose. The dataset is a plain S3 download that costs no API credits,
 * whereas querying metadata per aircraft would spend the same 4,000/day budget the live
 * map depends on — exactly the pattern §24.5 forbids.
 *
 * Usage:  pnpm --filter @aethera/ingestion import:registry
 */
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Pool } from "pg";
import { config } from "../config";

const DATASET_URL =
  process.env.AIRCRAFT_REGISTRY_URL ??
  "https://opensky-network.org/datasets/metadata/aircraftDatabase.csv";

const BATCH_SIZE = 1_000;

/** Splits one CSV line, honouring quoted fields containing commas. */
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

interface RegistryRow {
  icao24: string;
  registration: string | null;
  typeCode: string | null;
  operator: string | null;
}

async function flush(pool: Pool, rows: RegistryRow[]): Promise<void> {
  if (rows.length === 0) return;

  // The dataset contains repeated icao24 entries. Postgres refuses an ON CONFLICT DO
  // UPDATE that would touch the same row twice in one statement, so collapse duplicates
  // within the batch first, keeping the last occurrence.
  const deduped = new Map<string, RegistryRow>();
  for (const row of rows) deduped.set(row.icao24, row);
  rows = Array.from(deduped.values());

  const values: unknown[] = [];
  const tuples = rows.map((row, index) => {
    const base = index * 4;
    values.push(row.icao24, row.registration, row.typeCode, row.operator);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, now())`;
  });

  await pool.query(
    `INSERT INTO aircraft (icao24, registration, type_code, operator, updated_at)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (icao24) DO UPDATE SET
       registration = EXCLUDED.registration,
       type_code    = EXCLUDED.type_code,
       operator     = EXCLUDED.operator,
       updated_at   = EXCLUDED.updated_at`,
    values,
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });

  console.log(`registry: downloading ${DATASET_URL}`);
  const response = await fetch(DATASET_URL);
  if (!response.ok || !response.body) {
    throw new Error(`registry download failed: ${response.status} ${response.statusText}`);
  }

  const lines = createInterface({
    input: Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;
  let columns: Record<string, number> = {};
  let batch: RegistryRow[] = [];
  let imported = 0;
  let skipped = 0;

  for await (const line of lines) {
    if (!line.trim()) continue;

    if (!header) {
      header = parseCsvLine(line).map((h) => h.replace(/"/g, "").trim().toLowerCase());
      columns = Object.fromEntries(header.map((name, index) => [name, index]));
      for (const required of ["icao24", "registration", "typecode", "operator"]) {
        if (!(required in columns)) {
          throw new Error(`registry CSV is missing the "${required}" column`);
        }
      }
      continue;
    }

    const fields = parseCsvLine(line);
    const value = (name: string): string | null => {
      const raw = fields[columns[name]]?.replace(/"/g, "").trim();
      return raw ? raw : null;
    };

    const icao24 = value("icao24")?.toLowerCase();
    if (!icao24) {
      skipped += 1;
      continue;
    }

    // A row with no usable identity is not worth a table row.
    const registration = value("registration");
    const typeCode = value("typecode");
    const operator = value("operator") ?? value("owner");
    if (!registration && !typeCode && !operator) {
      skipped += 1;
      continue;
    }

    batch.push({ icao24, registration, typeCode, operator });

    if (batch.length >= BATCH_SIZE) {
      await flush(pool, batch);
      imported += batch.length;
      batch = [];
      if (imported % 50_000 === 0) console.log(`registry: ${imported} rows`);
    }
  }

  await flush(pool, batch);
  imported += batch.length;

  console.log(`registry: imported ${imported} aircraft (${skipped} rows skipped)`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
