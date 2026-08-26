import type { FastifyPluginAsync } from "fastify";
import type { BoundingBox, FlightState } from "@aethera/types";
import { inBoundingBox, viewportSubscribeSchema } from "@aethera/validation";
import { KEYS, type RedisClient } from "../modules/redis";

interface SocketState {
  bounds: BoundingBox | null;
}

export const websocketRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  const subscriber = opts.redis.duplicate();
  await subscriber.connect();
  const sockets = new Set<{ send: (payload: string) => void; state: SocketState }>();

  async function currentAircraft(): Promise<FlightState[]> {
    const raw = await opts.redis.hGetAll(KEYS.state);
    return Object.values(raw).map((value) => JSON.parse(value) as FlightState);
  }

  function visibleFor(aircraft: FlightState[], bounds: BoundingBox | null): FlightState[] {
    return bounds
      ? aircraft.filter((flight) => inBoundingBox(flight.latitude, flight.longitude, bounds))
      : aircraft;
  }

  function sendSnapshot(
    socket: { send: (payload: string) => void; state: SocketState },
    aircraft: FlightState[],
  ): void {
    const visible = visibleFor(aircraft, socket.state.bounds);
    socket.send(
      JSON.stringify({
        type: "flight.updated",
        timestamp: new Date().toISOString(),
        data: { aircraft: visible, count: visible.length },
      }),
    );
  }

  await subscriber.subscribe(KEYS.events, async () => {
    const aircraft = await currentAircraft();
    for (const socket of sockets) {
      sendSnapshot(socket, aircraft);
    }
  });

  app.get("/ws", { websocket: true }, (socket) => {
    const client = {
      state: { bounds: null } as SocketState,
      send(payload: string) {
        if (socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      },
    };
    sockets.add(client);

    // Don't leave a new connection staring at an empty map for up to a full poll cycle.
    void currentAircraft().then((aircraft) => sendSnapshot(client, aircraft));

    socket.on("message", (raw: Buffer | string) => {
      try {
        const parsed = viewportSubscribeSchema.safeParse(JSON.parse(String(raw)));
        if (parsed.success) {
          client.state.bounds = parsed.data.bounds;
          void currentAircraft().then((aircraft) => sendSnapshot(client, aircraft));
        }
      } catch {
        // ignore malformed client messages
      }
    });

    socket.on("close", () => {
      sockets.delete(client);
    });
  });
};
