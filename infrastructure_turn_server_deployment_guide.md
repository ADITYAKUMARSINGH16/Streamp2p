# Infrastructure & Production Deployment Guide

To achieve **1B (Relayed TURN Fallback)** so transfers work across strict corporate firewalls, symmetric NATs, and cellular CGNAT networks, you can either run the included `docker-compose.yml` (self-hosted `coturn`) or plug in Cloudflare Calls TURN.

## 1. Local & Production Docker Compose (`docker-compose.yml`)

Save this in the root directory to spin up the **Signaling Server**, **Next.js Web App**, and **`coturn` TURN Server** together:

```yaml
version: "3.9"

services:
  # 1. WebSocket Signaling Server (Zero file storage)
  signaling-server:
    build: ./signaling-server
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - CORS_ORIGIN=*

  # 2. Next.js Frontend Web App
  web-app:
    build: ./web-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SIGNALING_URL=http://localhost:4000
      - NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302
      - NEXT_PUBLIC_TURN_URL=turn:localhost:3478
      - NEXT_PUBLIC_TURN_USERNAME=p2puser
      - NEXT_PUBLIC_TURN_CREDENTIAL=supersecretturnpass
    depends_on:
      - signaling-server

  # 3. Coturn STUN/TURN Relay Server (For strict firewalls)
  coturn:
    image: coturn/coturn:latest
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf:ro
```

## 2. Production `turnserver.conf` Configuration

```ini
# /etc/coturn/turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech

# Static user for quick setup (or use use-auth-secret for time-limited HMAC credentials)
user=p2puser:supersecretturnpass

realm=yourdomain.com
total-quota=100
stale-nonce=600
no-loopback-peers
no-multicast-peers
```

## 3. Environment Variables Reference (`web-app/.env.local`)

```env
# URL of the Socket.io Signaling Server
NEXT_PUBLIC_SIGNALING_URL=http://localhost:4000

# Primary Public STUN Server
NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302

# TURN Fallback Server (Coturn or Cloudflare TURN)
NEXT_PUBLIC_TURN_URL=turn:turn.yourdomain.com:3478
NEXT_PUBLIC_TURN_USERNAME=p2puser
NEXT_PUBLIC_TURN_CREDENTIAL=supersecretturnpass
```

## 4. Testing Across Devices on Local Wi-Fi
1. Start the signaling server (`npm run dev` in `signaling-server`).
2. Start Next.js bound to your LAN IP (`npm run dev -- -H 0.0.0.0` in `web-app`).
3. Open `http://<YOUR_LOCAL_IP>:3000` on your laptop, drop a file, and scan the generated QR code with your phone to watch real-time chunked streaming across devices.