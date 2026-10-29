import { PeerConnectionMode, NatTraversalTier } from "@/types/protocol";

export function getRtcConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [];

  // 1. Redundant Fast Public STUN Servers
  const stunUrl =
    process.env.NEXT_PUBLIC_STUN_URL || "stun:stun.l.google.com:19302";
  iceServers.push({
    urls: [
      stunUrl,
      "stun:stun.relay.metered.ca:80",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:global.stun.twilio.com:3478",
    ],
  });

  // 2. TURN Server Fallback (Metered, Coturn, Cloudflare Calls, or custom)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  const isLocalhostTurn =
    turnUrl && (turnUrl.includes("localhost") || turnUrl.includes("127.0.0.1"));

  if (turnUrl && !isLocalhostTurn && turnUsername && turnCredential) {
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

  return {
    iceServers,
    iceCandidatePoolSize: 4,
    bundlePolicy: "max-bundle",
  };
}

/**
 * Asynchronously loads dynamic ICE/TURN servers from the server API route
 * (supporting Metered.ca dynamic tokens, Cloudflare Calls, or static credentials)
 */
export async function fetchRtcConfiguration(): Promise<RTCConfiguration> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/turn-credentials");
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && data.iceServers.length > 0) {
          return {
            iceServers: data.iceServers,
            iceCandidatePoolSize: 4,
            bundlePolicy: "max-bundle",
          };
        }
      }
    } catch (err) {
      console.warn("[ICE Config] Using fallback configuration:", err);
    }
  }

  return getRtcConfiguration();
}

/**
 * Inspects WebRTC active candidate pair stats to classify the active NAT traversal tier:
 * Tier 1: LAN Direct (host candidates)
 * Tier 2: STUN Hole-Punching (srflx / prflx candidates)
 * Tier 3: TURN 5G Relay (relay candidates)
 */
export async function detectConnectionTier(
  pc: RTCPeerConnection
): Promise<NatTraversalTier> {
  try {
    const stats = await pc.getStats();
    let activeCandidatePair: any = null;

    stats.forEach((report) => {
      if (
        report.type === "candidate-pair" &&
        (report.state === "succeeded" || report.nominated === true)
      ) {
        activeCandidatePair = report;
      }
    });

    if (!activeCandidatePair) {
      return "unknown";
    }

    const localCand = stats.get(activeCandidatePair.localCandidateId);
    const remoteCand = stats.get(activeCandidatePair.remoteCandidateId);

    // Tier 3: Relay (TURN 5G CGNAT traversal)
    if (
      localCand?.candidateType === "relay" ||
      remoteCand?.candidateType === "relay"
    ) {
      return "tier3_turn";
    }

    // Tier 2: STUN public hole-punching
    if (
      localCand?.candidateType === "srflx" ||
      localCand?.candidateType === "prflx" ||
      remoteCand?.candidateType === "srflx" ||
      remoteCand?.candidateType === "prflx"
    ) {
      return "tier2_stun";
    }

    // Tier 1: Direct Private LAN / Localhost
    if (
      localCand?.candidateType === "host" ||
      remoteCand?.candidateType === "host"
    ) {
      return "tier1_lan";
    }

    return "tier2_stun";
  } catch (err) {
    console.warn("Failed to inspect RTC stats:", err);
    return "unknown";
  }
}

/**
 * Inspects WebRTC active candidate pair stats to determine whether the link
 * is Direct P2P (host / srflx) or relayed through a TURN server.
 */
export async function detectConnectionMode(
  pc: RTCPeerConnection
): Promise<PeerConnectionMode> {
  const tier = await detectConnectionTier(pc);
  if (tier === "tier3_turn") return "relay";
  if (tier === "tier1_lan" || tier === "tier2_stun") return "p2p";
  return "unknown";
}
