#!/usr/bin/env node
/**
 * Clone-to-run bootstrap.
 *
 *   node scripts/setup.mjs          # full install (pnpm, deps, .env, Docker, migrate)
 *   node scripts/setup.mjs --infra  # .env + Postgres/Redis + migrate (used by `pnpm dev`)
 */

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = resolve(root, ".env.example");
const envFile = resolve(root, ".env");
const composeFile = "docker-compose.dev.yml";
const infraOnly = process.argv.includes("--infra");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageManager = pkg.packageManager ?? "pnpm@9.15.4";
const minNodeMajor = Number(/\d+/.exec(String(pkg.engines?.node ?? "20"))?.[0] ?? 20);

process.chdir(root);

function log(message) {
  console.log(message);
}

function ok(message) {
  console.log(`  ok  ${message}`);
}

function fail(message) {
  console.error(`\nERROR  ${message}\n`);
  process.exit(1);
}

function quote(arg) {
  const str = String(arg);
  if (process.platform === "win32") {
    if (!/[\s"]/.test(str)) return str;
    return `"${str.replace(/"/g, '""')}"`;
  }
  if (/^[A-Za-z0-9_./:=-]+$/.test(str)) return str;
  return `'${str.replace(/'/g, `'\\''`)}'`;
}

function cmdline(command, args) {
  return [command, ...args.map(quote)].join(" ");
}

function run(command, args) {
  const line = cmdline(command, args);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(line, {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${line} exited with code ${code}`));
    });
  });
}

function capture(command, args) {
  const result = spawnSync(cmdline(command, args), {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function commandExists(name) {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [name] : ["-v", name];
  return capture(probe, args).status === 0;
}

function nodeMajor() {
  return Number(process.versions.node.split(".")[0]);
}

function ensureNode() {
  const major = nodeMajor();
  if (Number.isNaN(major) || major < minNodeMajor) {
    fail(
      `Node.js ${minNodeMajor}+ is required (found ${process.versions.node}). Install it from https://nodejs.org`,
    );
  }
  ok(`Node.js ${process.versions.node}`);
}

function ensureEnv() {
  if (!existsSync(envExample)) {
    fail("Missing .env.example — are you in the AETHERA repo root?");
  }
  if (!existsSync(envFile)) {
    copyFileSync(envExample, envFile);
    ok("Created .env from .env.example");
    return;
  }
  ok(".env already exists");
}

function envHasOpenSky() {
  if (!existsSync(envFile)) return false;
  const text = readFileSync(envFile, "utf8");
  const id = /^OPENSKY_CLIENT_ID=(.*)$/m.exec(text)?.[1]?.trim() ?? "";
  const secret = /^OPENSKY_CLIENT_SECRET=(.*)$/m.exec(text)?.[1]?.trim() ?? "";
  return Boolean(id && secret);
}

function ensureDocker() {
  if (!commandExists("docker")) {
    fail("Docker is not installed. Install Docker Desktop from https://docs.docker.com/get-docker/");
  }
  const info = capture("docker", ["ps"]);
  if (info.status !== 0) {
    fail("Docker is installed but the daemon is not running. Start Docker Desktop and re-run this command.");
  }
  const compose = capture("docker", ["compose", "version"]);
  if (compose.status !== 0) {
    fail("Docker Compose v2 is required (`docker compose`). Update Docker Desktop and retry.");
  }
  ok("Docker");
}

async function ensurePnpm() {
  if (commandExists("pnpm")) {
    const version = capture("pnpm", ["--version"]);
    ok(`pnpm ${version.stdout || "found"}`);
    return;
  }
  if (!commandExists("corepack")) {
    fail(
      "pnpm is not installed. Enable it with Node.js Corepack (`corepack enable`) or see https://pnpm.io/installation",
    );
  }
  log("  -> enabling pnpm via Corepack");
  try {
    await run("corepack", ["enable"]);
    await run("corepack", ["prepare", packageManager, "--activate"]);
  } catch {
    fail(
      `Could not activate ${packageManager}. Run \`corepack enable\` then retry, or install pnpm from https://pnpm.io/installation`,
    );
  }
  if (!commandExists("pnpm")) {
    fail("pnpm was activated but this shell cannot find it. Close the terminal, open a new one, and run `node scripts/setup.mjs` again.");
  }
  ok(`pnpm (${packageManager})`);
}

async function installDeps() {
  log("  -> pnpm install");
  try {
    await run("pnpm", ["install"]);
  } catch {
    fail("pnpm install failed. Check the output above.");
  }
  ok("Dependencies installed");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function containerHealth(name) {
  const result = capture("docker", [
    "inspect",
    "--format",
    "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
    name,
  ]);
  return result.stdout;
}

async function waitHealthy(name, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (containerHealth(name) === "healthy") return;
    await sleep(2000);
  }
  fail(
    `${name} did not become healthy. Check Docker Desktop, then run:\n    docker compose -f ${composeFile} logs`,
  );
}

async function startInfra() {
  log("  -> starting PostgreSQL and Redis");
  try {
    await run("docker", [
      "compose",
      "-f",
      composeFile,
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "180",
    ]);
  } catch {
    try {
      await run("docker", ["compose", "-f", composeFile, "up", "-d"]);
    } catch {
      fail("Could not start PostgreSQL and Redis. Is Docker Desktop running?");
    }
    await waitHealthy("aethera-postgres", 180_000);
    await waitHealthy("aethera-redis", 180_000);
  }
  ok("PostgreSQL (localhost:55432) and Redis (localhost:6380)");
}

async function migrate() {
  log("  -> applying database migrations");
  try {
    await run("pnpm", ["migrate"]);
  } catch {
    fail("Database migration failed. Is Postgres up? Try: docker compose -f docker-compose.dev.yml logs postgres");
  }
  ok("Database schema");
}

function printNextSteps() {
  console.log(`
AETHERA is ready.

  pnpm dev

    Web     http://localhost:3000
    API     http://localhost:3001/health
`);

  if (!envHasOpenSky()) {
    console.log(`  Live aircraft need OpenSky credentials in .env:
    OPENSKY_CLIENT_ID
    OPENSKY_CLIENT_SECRET
    Create an account at https://opensky-network.org then restart \`pnpm dev\`.
    Without them, ingestion runs anonymously and is usually rate-limited.
`);
  }
}

async function main() {
  console.log(infraOnly ? "\nAETHERA infra\n" : "\nAETHERA setup\n");

  ensureNode();
  ensureDocker();
  ensureEnv();

  if (!infraOnly) {
    await ensurePnpm();
    await installDeps();
  } else if (!commandExists("pnpm")) {
    fail("pnpm is not on PATH. Run `node scripts/setup.mjs` once from the repo root.");
  }

  await startInfra();
  await migrate();
  if (!infraOnly) {
    printNextSteps();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
