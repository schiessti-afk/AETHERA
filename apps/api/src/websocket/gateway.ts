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

  await subscriber.subscribe(KEYS.events, async () => {
    const raw = await opts.redis.hGetAll(KEYS.state);
    const aircraft = Object.values(raw).map((value) => JSON.parse(value) as FlightState);
    for (const socket of sockets) {
      const visible = socket.state.bounds
        ? aircraft.filter((flight) =>
            inBoundingBox(flight.latitude, flight.longitude, socket.state.bounds!),
          )
        : aircraft;
      socket.send(
        JSON.stringify({
          type: "flight.updated",
          timestamp: new Date().toISOString(),
          data: { aircraft: visible, count: visible.length },
        }),
      );
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

    socket.on("message", (raw: Buffer | string) => {
      try {
        const parsed = viewportSubscribeSchema.safeParse(JSON.parse(String(raw)));
        if (parsed.success) {
          client.state.bounds = parsed.data.bounds;
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
