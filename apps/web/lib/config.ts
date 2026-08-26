export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";

/** Free MapLibre style. OpenFreeMap requires no account, token, or payment. */
export const mapStyleUrl =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/dark";
