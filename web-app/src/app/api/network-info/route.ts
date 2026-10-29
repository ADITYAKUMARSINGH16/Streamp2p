import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const interfaces = os.networkInterfaces();
  let candidateIp = "localhost";

  // Prioritize active non-internal IPv4 addresses (Wi-Fi, Ethernet)
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;

    for (const iface of ifaceList) {
      if (
        iface.family === "IPv4" &&
        !iface.internal &&
        !iface.address.startsWith("169.254.") // Ignore APIPA / link-local
      ) {
        // Prefer standard private LAN ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (
          iface.address.startsWith("192.168.") ||
          iface.address.startsWith("10.") ||
          iface.address.startsWith("172.")
        ) {
          candidateIp = iface.address;
          break;
        } else if (candidateIp === "localhost") {
          candidateIp = iface.address;
        }
      }
    }
    if (candidateIp !== "localhost" && candidateIp.startsWith("192.168.")) {
      break;
    }
  }

  return NextResponse.json({
    localIp: candidateIp,
    port: process.env.PORT || 3000,
    networkUrl:
      candidateIp !== "localhost"
        ? `http://${candidateIp}:${process.env.PORT || 3000}`
        : null,
  });
}

