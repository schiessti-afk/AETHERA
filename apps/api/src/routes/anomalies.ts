import type { FastifyPluginAsync } from "fastify";
import type { Anomaly, AnomalySeverity, AnomalyType } from "@aethera/types";
import { KEYS, type RedisClient } from "../modules/redis";

const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

interface AnomalyQuery {
  severity?: string;
  type?: string;
  limit?: string;
}

export const anomalyRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  app.get<{ Querystring: AnomalyQuery }>("/api/anomalies", async (request) => {
    // Newest first. The feed holds everything inside the retention window, active or
    // resolved — at a ~90s poll most kinematic detections resolve within one cycle, so
    // an active-only feed would empty faster than anyone could read it (§18.4).
    const ids = await opts.redis.zRange(KEYS.anomaliesRecent, 0, -1, { REV: true });
    if (ids.length === 0) {
      return { anomalies: [], active: 0, total: 0 };
    }

    const raw = await opts.redis.hmGet(KEYS.anomaliesStore, ids);
    let anomalies: Anomaly[] = [];
    for (const value of raw) {
      if (!value) continue;
      try {
        anomalies.push(JSON.parse(value) as Anomaly);
      } catch {
        // skip unreadable entries
      }
    }

    const total = anomalies.length;
    // Only state conditions can be "active". A kinematic detection is a point-in-time
    // observation with no lifecycle — counting those as active would report every
    // steep climb in the retention window as an ongoing situation.
    const active = anomalies.filter((a) => a.kind === "state" && !a.resolvedAt).length;

    const severities = request.query.severity
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) as AnomalySeverity[] | undefined;
    if (severities?.length) {
      anomalies = anomalies.filter((a) => severities.includes(a.severity));
    }

    const types = request.query.type
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) as AnomalyType[] | undefined;
    if (types?.length) {
      anomalies = anomalies.filter((a) => types.includes(a.type));
    }

    // Conditions still holding are pinned above one-off observations, then severity,
    // then recency — so a live 7700 stays at the top of the feed regardless of how much
    // routine kinematic traffic came in after it (§26.3: severity does the ranking).
    const stillOpen = (a: Anomaly) => a.kind === "state" && !a.resolvedAt;
    anomalies.sort((a, b) => {
      const openness = Number(stillOpen(b)) - Number(stillOpen(a));
      if (openness !== 0) return openness;
      const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (severity !== 0) return severity;
      return Date.parse(b.detectedAt) - Date.parse(a.detectedAt);
    });

    const limit = Math.min(Number(request.query.limit ?? 200), 500);
    return { anomalies: anomalies.slice(0, limit), active, total };
  });
};
