const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

export class OpenSkyAuth {
  private token: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  get enabled(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  invalidate(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.enabled) return null;
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }

    const body = new URLSearchParams({ grant_type: "client_credentials" });
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    let response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (response.status === 401) {
      response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenSky token request failed: ${response.status} ${detail}`);
    }

    const payload = (await response.json()) as TokenResponse;
    this.token = payload.access_token;
    const expiresInMs = (payload.expires_in ?? 1800) * 1000;
    this.expiresAt = Date.now() + Math.max(expiresInMs - 60_000, 30_000);
    return this.token;
  }
}
