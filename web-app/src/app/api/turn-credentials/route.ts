import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.METERED_API_KEY || process.env.NEXT_PUBLIC_METERED_API_KEY;
  const appDomain = process.env.METERED_APP_DOMAIN; // e.g. "myapp.metered.live"

  // 1. If Metered API Key is configured, fetch live ephemeral credentials
  if (apiKey) {
    try {
      const endpoint = appDomain
        ? `https://${appDomain}/api/v1/turn/credentials?apiKey=${apiKey}`
        : `https://turn.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`;

      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) {
        const iceServers = await res.json();
        return NextResponse.json({ success: true, iceServers });
      }
    } catch (err) {
      console.warn("[TURN API] Failed to fetch ephemeral credentials from Metered:", err);
    }
  }

  // 2. Static TURN fallback from env vars (e.g. Coturn, ExpressTURN, Cloudflare)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  const iceServers: RTCIceServer[] = [
    {
      urls: [
        process.env.NEXT_PUBLIC_STUN_URL || "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun.cloudflare.com:3478",
      ],
    },
  ];

  if (
    turnUrl &&
    !turnUrl.includes("localhost") &&
    !turnUrl.includes("127.0.0.1") &&
    turnUsername &&
    turnCredential
  ) {
    const raw = turnUrl.trim();
    const base = raw.startsWith("turn:") || raw.startsWith("turns:") ? raw : `turn:${raw}`;
    const urls = raw.includes("metered.ca")
      ? [
          "turn:global.relay.metered.ca:80",
          "turn:global.relay.metered.ca:80?transport=tcp",
          "turn:global.relay.metered.ca:443",
          "turns:global.relay.metered.ca:443?transport=tcp",
        ]
      : base.includes("?")
      ? [base]
      : [base, `${base}?transport=tcp`];

    iceServers.push({
      urls,
      username: turnUsername.trim(),
      credential: turnCredential.trim(),
    });
  }

  return NextResponse.json({ success: true, iceServers });
}

