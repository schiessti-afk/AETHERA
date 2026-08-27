import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { BoundingBox, FlightState } from "@aethera/types";
import {
  aircraftWatchSchema,
  inBoundingBox,
  viewportSubscribeSchema,
} from "@aethera/validation";
import { config } from "../config";
import { liveAircraft } from "../modules/snapshot";
import { KEYS, type RedisClient } from "../modules/redis";

interface SocketState {
  bounds: BoundingBox | null;
  watching: string | null;
}

interface Client {
  send: (payload: string) => void;
  state: SocketState;
}

/**
 * How long a declared watch stays live in Redis. Clients refresh on every snapshot they
 * receive (once per poll), so this only has to outlast a couple of cycles — and because
 * it expires on its own, a client that disconnects or crashes stops holding
 * LOST_SIGNAL scope open without needing any disconnect bookkeeping.
 */
const WATCH_TTL_MS = 5 * 60_000;

function requestOrigin(request: FastifyRequest): string | undefined {
  const header = request.headers.origin;
  if (Array.isArray(header)) return header[0];
  return header;
}

function originAllowed(origin: string | undefined): boolean {
  // Browser pages always send Origin. Non-browser clients often omit it.
  if (!origin) return true;
  return config.corsOrigins.includes(origin);
}

export const websocketRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  const subscriber = opts.redis.duplicate();
  await subscriber.connect();
  const sockets = new Set<Client>();
  const socketsByIp = new Map<string, number>();

  function admit(ip: string): boolean {
    if (sockets.size >= config.wsMaxConnections) return false;
    const current = socketsByIp.get(ip) ?? 0;
    if (current >= config.wsMaxConnectionsPerIp) return false;
    socketsByIp.set(ip, current + 1);
    return true;
  }

  function release(ip: string): void {
    const current = socketsByIp.get(ip) ?? 0;
    if (current <= 1) socketsByIp.delete(ip);
    else socketsByIp.set(ip, current - 1);
  }

  function visibleFor(aircraft: FlightState[], bounds: BoundingBox | null): FlightState[] {
    if (!bounds) return [];
    return aircraft.filter((flight) =>
      inBoundingBox(flight.latitude, flight.longitude, bounds),
    );
  }

  async function registerWatch(icao24: string | null): Promise<void> {
    if (!icao24) return;
    await opts.redis.zAdd(KEYS.watched, {
      score: Date.now() + WATCH_TTL_MS,
      value: icao24.toLowerCase(),
    });
  }

  function sendSnapshot(socket: Client, aircraft: FlightState[]): void {
    if (!socket.state.bounds) return;
    const visible = visibleFor(aircraft, socket.state.bounds);
    socket.send(
      JSON.stringify({
        type: "flight.updated",
        timestamp: new Date().toISOString(),
        data: { aircraft: visible, count: visible.length },
      }),
    );
  }

  await subscriber.subscribe(KEYS.events, async (raw) => {
    // Anomaly events share this channel with flight updates. They must be forwarded as
    // themselves rather than triggering a snapshot resend — a busy cycle raises dozens
    // of detections, and resending ~12k aircraft for each one would be pathological.
    let type: string | undefined;
    let payload: unknown;
    try {
      const parsed = JSON.parse(String(raw)) as { type?: string; data?: unknown };
      type = parsed.type;
      payload = parsed.data;
    } catch {
      return;
    }

    if (type === "anomaly.detected" || type === "anomaly.resolved") {
      const message = JSON.stringify({
        type,
        timestamp: new Date().toISOString(),
        data: payload,
      });
      for (const socket of sockets) socket.send(message);
      return;
    }

    if (type !== "flight.updated") return;

    const aircraft = await liveAircraft();
    for (const socket of sockets) {
      sendSnapshot(socket, aircraft);
    }
  });

  app.get("/ws", { websocket: true }, (socket, request) => {
    if (!originAllowed(requestOrigin(request))) {
      socket.close(1008, "origin not allowed");
      return;
    }

    const ip = request.ip;
    if (!admit(ip)) {
      socket.close(1008, "too many connections");
      return;
    }

    const client: Client = {
      state: { bounds: null, watching: null },
      send(payload: string) {
        if (socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      },
    };
    sockets.add(client);

    socket.on("message", (raw: Buffer | string) => {
      let message: unknown;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return; // ignore malformed client messages
      }

      const viewport = viewportSubscribeSchema.safeParse(message);
      if (viewport.success) {
        client.state.bounds = viewport.data.bounds;
        void liveAircraft().then((aircraft) => sendSnapshot(client, aircraft));
        return;
      }

      const watch = aircraftWatchSchema.safeParse(message);
      if (watch.success) {
        client.state.watching = watch.data.icao24;
        void registerWatch(watch.data.icao24);
      }
    });

    socket.on("close", () => {
      sockets.delete(client);
      release(ip);
    });
  });
};
