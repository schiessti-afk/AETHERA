/**
 * A single north-up aircraft glyph, tinted via deck.gl's IconLayer `getColor`.
 * SVG data URIs work directly as IconLayer textures — no sprite sheet needed
 * for a single icon.
 */
function svgIcon(fill = "#ffffff"): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <path d="M32 2 L40 26 L60 40 L60 46 L40 38 L37 56 L46 62 L46 64 L18 64 L18 62 L27 56 L24 38 L4 46 L4 40 L24 26 Z" fill="${fill}"/>
    </svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const AIRCRAFT_ICON_MAPPING = {
  aircraft: { x: 0, y: 0, width: 64, height: 64, anchorY: 32, mask: true },
};

export const AIRCRAFT_ICON_ATLAS = svgIcon("#ffffff");
