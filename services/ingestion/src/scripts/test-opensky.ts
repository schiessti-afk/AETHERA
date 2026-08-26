import { config } from "../config";
import { OpenSkyProvider } from "../providers/opensky";

async function main() {
  const enabled = Boolean(config.openskyClientId && config.openskyClientSecret);
  console.log(
    JSON.stringify({
      clientIdSet: Boolean(config.openskyClientId),
      secretSet: Boolean(config.openskyClientSecret),
      secretLength: config.openskyClientSecret.length,
      oauthEnabled: enabled,
    }),
  );

  const provider = new OpenSkyProvider(config.openskyClientId, config.openskyClientSecret);
  const snapshot = await provider.fetchSnapshot();
  const sample = snapshot.states.slice(0, 3).map((state) => ({
    icao24: state.icao24,
    callsign: state.callsign ?? null,
    lat: Number(state.latitude.toFixed(3)),
    lon: Number(state.longitude.toFixed(3)),
  }));

  console.log(
    JSON.stringify({
      ok: true,
      sourceTime: snapshot.sourceTime,
      observed: snapshot.states.length,
      sample,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
