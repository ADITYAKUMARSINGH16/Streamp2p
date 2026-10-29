<div align="center">
  <img src="web-app/src/app/icon.svg" width="80" height="80" alt="StreamP2P Logo" />
  <h1>StreamP2P</h1>
  <p><strong>Zero-Storage Real-Time Peer-to-Peer File Streamer</strong></p>
  <p>
    Stream gigabytes or terabytes directly between browsers at wire speed.<br />
    No intermediate cloud storage. No file size limits. 100% private.
  </p>

  <p>
    <img src="https://img.shields.io/badge/WebRTC-DataChannel-blue?style=flat-square" alt="WebRTC" />
    <img src="https://img.shields.io/badge/Next.js-14_App_Router-black?style=flat-square" alt="Next.js" />
    <img src="https://img.shields.io/badge/Socket.io-Signaling-orange?style=flat-square" alt="Socket.io" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Direct--to--Disk-Streaming-emerald?style=flat-square" alt="Direct to Disk" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</div>

---

## ⚡ Why StreamP2P?

Traditional file transfer services (WeTransfer, Google Drive, Dropbox) require you to upload your files to their servers first, wait for the upload to complete, and have the recipient download them later.

**StreamP2P is fundamentally different:**
1. **Zero Intermediate Storage:** Files stream in 64 KB slices directly from the sender's local hard drive to the recipient's local hard drive via an encrypted **WebRTC Data Channel (`RTCDataChannel`)**.
2. **Infinite Privacy:** Your data never touches a server, database, or disk outside your personal devices. Once the host tab closes, the session ceases to exist.
3. **No File Size Caps (10 GB+ / 100 GB+):** By combining sender chunk slicing (`Blob.slice()`) with recipient native disk streaming (`window.showSaveFilePicker` $\rightarrow$ `FileSystemWritableFileStream`), browser RAM usage stays **below 50 MB** regardless of file size.

---

## 🚀 Key Features

* **1-to-Many Swarm Hub:** One host can broadcast to multiple recipients simultaneously. Each peer downloads at its own independent network speed and disk offset.
* **Smart Network Traversal (Hierarchy of Speed):**
  * **Local Wi-Fi / LAN:** Ultra-fast direct link over local IP (`192.168.x.x`) in ~50ms with **200–300 MB/s transfer speeds**.
  * **Public STUN:** Google & Cloudflare STUN for cross-network full cone / restricted cone NAT traversal.
  * **TURN Relay Fallback (Metered / Coturn):** Seamless relay for strict symmetric NATs and mobile cellular firewalls (**5G/LTE/CGNAT**).
* **Strict SCTP Backpressure:** Pumping pauses automatically when `bufferedAmount >= 256 KB` and resumes on `bufferedamountlow` to eliminate buffer bloat and packet drops.
* **Cryptographic PIN Authentication:** Optional HMAC-SHA256 challenge-response verification where plaintext PIN is never transmitted over signaling or WebRTC.
* **Pull-Based Pause & Resume:** Receivers track disk offsets and can seamlessly pause, resume, or recover from brief network disconnects without restarting.
* **Hardware Safeguards:** Automatically acquires the Screen Wake Lock API and attaches tab-close (`beforeunload`) guards while transfers are active.

---

## 📂 Repository Structure

```text
.
├── .gitignore                      # Monorepo ignore rules (protects credentials & build artifacts)
├── docker-compose.yml              # Self-hosted Coturn & multi-container orchestration
├── turnserver.conf                 # Coturn STUN/TURN configuration
├── start-prod.bat / .ps1           # 1-Click high-speed production runner (Windows)
├── start-dev.bat / .ps1            # 1-Click development runner (Windows)
├── scripts/
│   └── tunnel.js                   # Multi-tunnel engine (Pinggy + Localtunnel)
│
├── signaling-server/               # Standalone Socket.io matchmaker (optional / Docker)
│   ├── Dockerfile
│   └── src/index.ts
│
└── web-app/                        # Next.js 14+ App Router & Unified Server
    ├── server.js                   # Unified HTTP + Next.js + Socket.io Server (Dual-stack IPv4/IPv6)
    ├── package.json
    ├── .env.local                  # Environment credentials (git-ignored)
    ├── .env.example                # Example template
    ├── public/
    │   ├── favicon.ico
    │   └── sw-stream.js            # Service Worker direct stream interceptor fallback
    └── src/
        ├── types/protocol.ts       # Binary frame headers & JSON control messages
        ├── lib/
        │   ├── signaling.ts        # Socket.io client wrapper (Direct WebSocket first)
        │   ├── iceConfig.ts        # Dynamic & static STUN/TURN configuration
        │   ├── crypto.ts           # Web Crypto HMAC-SHA256 challenge-response
        │   ├── diskStreamer.ts     # File System Access API stream writer
        │   ├── webrtcHost.ts       # 1-to-Many sender engine & SCTP flow control
        │   └── webrtcClient.ts     # Receiver engine & telemetry tracking
        ├── components/
        │   ├── FileDropzone.tsx    # Drag-and-drop file & folder selector
        │   ├── ShareCard.tsx       # QR code, 6-digit code & link switcher (Wi-Fi / Public)
        │   └── PeerTelemetryList.tsx
        └── app/
            ├── api/
            │   ├── network-info/   # Discovers host LAN IPv4 for direct local transfers
            │   └── turn-credentials/ # Dynamic TURN token distributor
            ├── layout.tsx
            ├── page.tsx            # Host broadcast & sender view
            └── r/[roomId]/
                ├── page.tsx        # Receiver direct-to-disk streaming view
                └── error.tsx       # Network recovery error boundary
```

---

## 🛠️ Quickstart

### 1. Run the App

#### ⚡ Option A: Production Mode (Recommended — Fast & Reliable)
Pre-compiles all static bundles for instant route loading and zero chunk timeouts:
* **Command Prompt (Double Click):** `start-prod.bat`
* **PowerShell:** `.\start-prod.ps1`
* **Or via npm:**
  ```bash
  npm run prod
  ```

#### 🛠️ Option B: Development Mode (For Code Editing)
* **Command Prompt:** `start-dev.bat`
* **PowerShell:** `.\start-dev.ps1`
* **Or via npm:**
  ```bash
  npm run dev
  ```

Both the **Next.js Web App** and the **WebRTC Matchmaker** run unified on port **3000**:
* **Local Browser:** `http://localhost:3000`
* **Local Wi-Fi Network:** `http://<your-lan-ip>:3000`

---

### 2. Expose to the Public Internet (Tunnels)

To share files across the internet, run a persistent tunnel in a second terminal:

#### 🚀 Pinggy (Recommended — Zero Splash Screens, Full WebSockets)
```bash
npm run tunnel
# Or: npm run tunnel:pinggy
```

#### 📡 Localtunnel (Fallback)
```bash
npm run tunnel:lt
```

---

## 🌐 Network Traversal & 5G/Cellular Setup

WebRTC connections operate on three tiers depending on where your devices are located:

### 1. Local Wi-Fi Direct Transfer (No Cloud Needed)
If the sender and receiver are in the same home or office:
1. Connect both devices to the same Wi-Fi.
2. In the sender's **Share Card**, select the **`Wi-Fi / LAN IP`** tab (e.g. `http://192.168.x.x:3000`).
3. Scan the QR code.
> Transfers stream directly over your local router at **200–300 MB/s** with zero third-party relays.

### 2. Mobile 5G / Cellular / Cross-Network Transfer (TURN Relay)
Mobile networks (Jio, Airtel, T-Mobile, etc.) use **Symmetric NAT / Carrier-Grade NAT (CGNAT)** that blocks direct incoming UDP packets. When direct P2P is blocked, StreamP2P automatically routes through a TURN relay.

#### Free Relay via Metered.ca (20 GB/Month Free):
1. Sign up at [Metered.ca Open Relay](https://www.metered.ca/tools/openrelay/).
2. Add your credentials to `web-app/.env.local`:
   ```env
   # Public STUN Server
   NEXT_PUBLIC_STUN_URL=stun:stun.relay.metered.ca:80

   # Metered TURN Credentials (Relays over ports 80 & 443 to bypass cellular firewalls)
   NEXT_PUBLIC_TURN_URL=turn:global.relay.metered.ca:443
   NEXT_PUBLIC_TURN_USERNAME=your_username
   NEXT_PUBLIC_TURN_CREDENTIAL=your_password
   ```
3. Run `npm run prod`. The app automatically loads UDP and TCP relay transports!

#### Or Self-Host with Docker (Unlimited & Private):
Run the included Coturn container on any cloud VPS:
```bash
docker compose up -d coturn
```

---

## 📡 Protocol Details

### Binary Data Frame Layout (12-Byte Header)
Every binary chunk sent over `RTCDataChannel("data")` is formatted with a binary header:
```text
┌──────────────────────┬──────────────────────┬───────────────────────────────────┐
│ Bytes 0..3 (Uint32)  │ Bytes 4..11 (Float64)│ Bytes 12..N (Uint8Array)          │
│      fileIndex       │      byteOffset      │ Raw Chunk Payload (<= 64 KB)      │
└──────────────────────┴──────────────────────┴───────────────────────────────────┘
```
This guarantees that in-flight chunks do not corrupt disk writes when pausing, resuming, or downloading multiple files concurrently.

---

## 📄 License
MIT © [singh](https://github.com/)
