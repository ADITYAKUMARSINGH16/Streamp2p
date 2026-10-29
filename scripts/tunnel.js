/**
 * Resilient Tunnel Runner with Multi-Provider Support
 * Supports:
 *   1. Pinggy (Recommended for WebRTC & Next.js - Zero chunk drops, zero splash screens)
 *   2. Localtunnel (HTTP fallback with keepalive heartbeats)
 */

const { spawn } = require("child_process");
const localtunnel = require("localtunnel");
const http = require("http");
const https = require("https");

const PORT = parseInt(process.env.PORT || "3000", 10);
const args = process.argv.slice(2);
const providerArg = args.find((a) => a.startsWith("--provider="))?.split("=")[1]?.toLowerCase();

let currentTunnel = null;
let keepAliveTimer = null;
let isShuttingDown = false;

function startPinggy() {
  console.log(`\n=================================================================`);
  console.log(`🚀 LAUNCHING PINGGY HIGH-SPEED TUNNEL FOR PORT ${PORT}`);
  console.log(`   * Zero "Friendly Reminder" splash screens`);
  console.log(`   * Native WebSocket support for WebRTC signaling`);
  console.log(`   * Zero chunk load timeouts`);
  console.log(`=================================================================\n`);

  const sshArgs = [
    "-p", "443",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=30",
    `-R0:127.0.0.1:${PORT}`,
    "a.pinggy.io",
  ];

  const sshProcess = spawn("ssh", sshArgs, { stdio: "inherit", shell: true });

  sshProcess.on("close", (code) => {
    if (!isShuttingDown) {
      console.log(`\n⚠️  [Pinggy] Disconnected (code ${code}). Reconnecting in 3s...`);
      setTimeout(startPinggy, 3000);
    }
  });

  process.on("SIGINT", () => {
    isShuttingDown = true;
    sshProcess.kill();
    process.exit(0);
  });
}

function pingTunnel(url) {
  if (!url || isShuttingDown) return;
  try {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { timeout: 10000, headers: { "bypass-tunnel-reminder": "true" } }, (res) => {
        res.resume();
      })
      .on("error", () => {});
  } catch (e) {}
}

async function startLocaltunnel() {
  if (isShuttingDown) return;

  console.log(`\n📡 [Localtunnel] Establishing public tunnel for port ${PORT}...`);

  try {
    const tunnel = await localtunnel({
      port: PORT,
    });

    currentTunnel = tunnel;

    console.log(`\n=================================================================`);
    console.log(`🚀 LOCALTUNNEL READY!`);
    console.log(`🔗 Public URL: \x1b[36m\x1b[1m${tunnel.url}\x1b[0m`);
    console.log(`   Share this URL with receivers across the internet.`);
    console.log(`   (Note: If localtunnel shows an IP challenge or 502, use 'npm run tunnel:pinggy')`);
    console.log(`=================================================================\n`);

    if (keepAliveTimer) clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(() => {
      pingTunnel(tunnel.url);
    }, 20000);

    tunnel.on("close", () => {
      if (!isShuttingDown) {
        console.warn("\n⚠️  [Tunnel] Connection closed by remote server. Reconnecting in 3s...");
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        setTimeout(startLocaltunnel, 3000);
      }
    });

    tunnel.on("error", (err) => {
      console.warn(`\n⚠️  [Tunnel] Error: ${err.message}. Reconnecting in 5s...`);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      try {
        tunnel.close();
      } catch (e) {}
      setTimeout(startLocaltunnel, 5000);
    });
  } catch (err) {
    console.error(`\n❌ [Tunnel] Connection failed: ${err.message}. Retrying in 5s...`);
    setTimeout(startLocaltunnel, 5000);
  }
}

process.on("SIGINT", () => {
  console.log("\n[Tunnel] Shutting down tunnel gracefully...");
  isShuttingDown = true;
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  if (currentTunnel) currentTunnel.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  isShuttingDown = true;
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  if (currentTunnel) currentTunnel.close();
  process.exit(0);
});

// Route based on CLI parameter
if (providerArg === "pinggy") {
  startPinggy();
} else if (providerArg === "localtunnel" || providerArg === "lt") {
  startLocaltunnel();
} else {
  // Default to Pinggy as primary with notice
  startPinggy();
}
