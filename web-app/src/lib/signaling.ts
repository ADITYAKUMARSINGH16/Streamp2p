import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

function resolveSignalingUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:3000";
  }

  const configured = process.env.NEXT_PUBLIC_SIGNALING_URL;

  // If a full custom public URL was explicitly provided and does not point to localhost, use it
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured;
  }

  // Connect directly to the same origin (same domain & port, whether localhost, LAN IP, or tunnel)
  return window.location.origin;
}

export function getSignalingSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("Signaling socket can only be initialized in the browser");
  }

  if (!socketInstance) {
    const signalingUrl = resolveSignalingUrl();
    console.log(`[Signaling Client] Initializing socket connection to: ${signalingUrl}`);

    socketInstance = io(signalingUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      upgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on("connect", () => {
      console.log("[Signaling Client] Connected successfully with ID:", socketInstance?.id);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("[Signaling Client] Connection error:", err.message);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[Signaling Client] Disconnected:", reason);
    });
  }

  return socketInstance;
}

export function closeSignalingSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
