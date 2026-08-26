const EARTH_RADIUS_KM = 6_371;
const RAD = Math.PI / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A latitude/longitude box that contains everything within `radiusKm` of a point.
 * Used to cheaply reject the bulk of a global snapshot before doing real distance
 * maths on what is left.
 */
export function boundingBoxAround(
  latitude: number,
  longitude: number,
  radiusKm: number,
): { west: number; south: number; east: number; north: number } {
  const latDelta = radiusKm / 111.32;
  // Longitude degrees shrink toward the poles; guard against the cosine collapsing.
  const cos = Math.max(0.01, Math.cos(latitude * RAD));
  const lonDelta = radiusKm / (111.32 * cos);

  return {
    south: latitude - latDelta,
    north: latitude + latDelta,
    west: longitude - lonDelta,
    east: longitude + lonDelta,
  };
}
