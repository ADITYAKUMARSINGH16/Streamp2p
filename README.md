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
    <img src="https://img.shields.io/badge/Design_System-Antigravity_Flash_3.8-00F0FF?style=flat-square" alt="Antigravity Flash 3.8" />
    <img src="https://img.shields.io/badge/SCTP_Valve-256KB_Backpressure-indigo?style=flat-square" alt="SCTP Backpressure" />
    <img src="https://img.shields.io/badge/RAM_Guard-%3C_50_MB-emerald?style=flat-square" alt="RAM Guard" />
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
4. **UI/UX:** High-contrast aerospace telemetry cockpit featuring Deep Obsidian styling, frosted carbon glassmorphism, HUD scanner reticles, split-flap room codes, and real-time SCTP backpressure valve meters.

---

## 🚀 Key Features

* **Design System:**
  * Root canvas in Deep Obsidian (`#06070A`) with masked radial dot-matrix grid and ambient top glow.
  * Frosted carbon glassmorphism (`bg-[#0F121A]/75 backdrop-blur-xl border border-white/[0.08]`).
  * `Space Grotesk` (UI/Headings) and `JetBrains Mono` (Telemetry) loaded via `next/font/google`.
  * Strict `tabular-nums` formatting to eliminate horizontal number jitter during live transmission.

* **Telemetry Cockpit Header (`Navbar.tsx`):**
  * Live signaling network indicator pill (`ONLINE`, `CONNECTING`, `OFFLINE`).
  * **RAM Invariant Guard:** Real-time Chromium `performance.memory` heap telemetry (`< 50 MB RAM GUARD`).
  * **Chunk Engine Badge:** `64 KB SLICER // 12B FRAME`.
  * **Reactive Screen Wake Lock Indicator:** Shows `WAKE LOCK: ENGAGED` vs. `STANDBY` in real-time.

* **Magnetic Zero-G Staging Dock (`FileDropzone.tsx`):**
  * Drag & drop with full directory tree scanning (`webkitGetAsEntry`) without buffering file data into RAM.
  * Reactive "Zero-G warp" drag state with Hyper-Cyan (`#00F0FF`) edge glow and expanding orbital ring.
  * Live 64 KB protocol math summary: total payload, chunk slice count, 12-byte header overhead, and `< 256 KB` SCTP buffer guarantee.
  * Tactile hardware manifest cards with zero-based `[SLOT 00]` byte indexing and per-file slice metrics.

* **Dual-Horizon Dispatch Radar (`ShareCard.tsx`):**
  * Segmented mode switcher:
    * **Tier 1 (Local Wi-Fi Direct):** Direct LAN IP (`192.168.x.x`) with **200–300 MB/s speed** and zero internet reliance.
    * **Tier 2/3 (Global WAN / Tunnel):** Public STUN / TURN 443 relay routing for cross-internet transfers.
  * QR Code framed in an orbital HUD scanner reticle with active-tier corner brackets.
  * Split-flap 6-digit room code with one-click copy and tactile `COPIED TO CLIPBOARD` micro-feedback.
  * Direct streaming link with native mobile Web Share API (`navigator.share`) trigger.
  * HMAC-SHA256 Airlock Shield status display with PIN reveal and copy controls.

* **Zero-Knowledge Vault Airlock (`PinModal.tsx`):**
  * 6-digit auto-advancing cryptographic keypad supporting typing, arrow keys, backspace navigation, and clipboard paste.
  * Local Web Crypto HMAC-SHA256 challenge-response verification with zero plaintext PIN exposure.
  * Smooth horizontal shake animation on invalid verification attempts.

* **Real-Time Swarm Telemetry & SCTP Backpressure (`PeerTelemetryList.tsx`):**
  * **3-Tier NAT Traversal Badges:** Automatically inspects candidate pairs to surface `TIER 1 // LAN DIRECT` (`#00F0FF`), `TIER 2 // STUN P2P` (`#10B981`), or `TIER 3 // TURN 5G RELAY` (`#F59E0B`).
  * **Live SCTP Valve Visualizer:** Live micro-meter (`0 KB -> 256 KB`) displaying `dataChannel.bufferedAmount` with 64 KB low and 256 KB high watermark threshold lines.
  * **Pumping vs. Valve Paused Telemetry:** Visually communicates flow control states (`PUMPING (64KB SLICE)` vs. `VALVE PAUSED (DRAINING BUFFER)`).
  * **Oscilloscope Speedometer:** Lightweight SVG throughput sparkline waveform running on throttled UI ticks.

* **1-to-Many Swarm Hub & 10s ICE Grace Period:**
  * Broadcast to multiple peers simultaneously; each recipient streams independently over SCTP.
  * 10-second grace period on momentary `iceConnectionState === "disconnected"` with calm recovery banner (`RE-BINDING ICE / TURN RELAY (10s GRACE)...`) to survive cellular/Wi-Fi handoffs without aborting in-flight chunks.

---

## 📂 Repository Structure

```text
.
├── PROJECT_CONTEXT.md              # Single Source of Truth (AI & Developer context)
├── README.md                       # User-facing documentation & quickstart
├── .gitignore                      # Secrets & build outputs exclusion
├── docker-compose.yml              # Coturn container orchestration
├── turnserver.conf                 # Coturn STUN/TURN configuration
├── start-prod.bat / .ps1           # 1-Click production mode startup
├── start-dev.bat / .ps1            # 1-Click development mode startup
│
├── scripts/
│   └── tunnel.js                   # Persistent tunnel runner (Pinggy default)
│
├── signaling-server/               # Standalone signaling server (Docker alternative)
│
└── web-app/                        # Next.js 14 frontend & unified backend
    ├── server.js                   # Unified server (Next.js + Socket.io matchmaker)
    ├── package.json
    ├── tailwind.config.ts          # color & font tokens
    ├── .env.local                  # Private credentials (Metered / Coturn TURN)
    ├── .env.example                # Public environment template
    ├── public/
    │   ├── favicon.ico             # Static site favicon
    │   └── sw-stream.js            # Service Worker direct stream fallback
    └── src/
        ├── types/
        │   └── protocol.ts         # Binary headers, 3-tier NAT types, & JSON messages
        ├── lib/
        │   ├── signaling.ts        # Client Socket.io wrapper (transports: ["websocket", "polling"])
        │   ├── iceConfig.ts        # STUN/TURN servers & detectConnectionTier()
        │   ├── crypto.ts           # Web Crypto HMAC-SHA256 challenge-response
        │   ├── wakeLock.ts         # Screen Wake Lock manager + useWakeLockStatus() hook
        │   ├── diskStreamer.ts     # Native File System Access API stream writer
        │   ├── webrtcHost.ts       # 1-to-Many sender engine & SCTP backpressure valve
        │   ├── webrtcClient.ts     # Receiver engine & 10s ICE disconnect recovery
        │   └── formatters.ts       # Human-readable bytes/sec, durations & ETA math
        ├── components/
        │   ├── Navbar.tsx          # Floating Telemetry Cockpit (RAM guard, signaling pill, wake lock)
        │   ├── FileDropzone.tsx    # Magnetic Zero-G Staging Dock (directory trees & 64 KB math)
        │   ├── ShareCard.tsx       # Dual-Horizon Dispatch Radar (HUD scanner & split-flap code)
        │   ├── PinModal.tsx        # Zero-Knowledge Vault Airlock (6-digit keypad & shake animation)
        │   └── PeerTelemetryList.tsx # Live SCTP Valve Visualizer & Oscilloscope Speedometer
        └── app/
            ├── api/
            │   ├── network-info/   # Discovers host LAN IPv4 for direct local transfers
            │   └── turn-credentials/ # Dynamic TURN token distributor
            ├── layout.tsx          # Root layout (Space Grotesk & JetBrains Mono Google Fonts)
            ├── globals.css         # Deep Obsidian canvas, frosted carbon, and tabular-nums
            ├── page.tsx            # Host broadcast mission control 2-column view
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

## 🌐 3-Tier Network Traversal Architecture

WebRTC connections operate across three distinct speed tiers depending on device placement:

| Tier | Connection Type | Candidate Type | Speed / Latency | Typical Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **LAN Direct** | `host` | **200–300 MB/s** (50ms setup) | Devices on the same home or office Wi-Fi router (Zero internet needed) |
| **Tier 2** | **STUN P2P** | `srflx` / `prflx` | Full Wire WAN Speed | Cross-network peers on standard full/restricted cone NATs |
| **Tier 3** | **TURN 5G Relay** | `relay` (Ports 80/443 TCP/UDP) | Carrier Throughput | Mobile cellular networks (**5G/LTE/CGNAT**) and symmetric corporate firewalls |

### Mobile 5G / Cellular / Cross-Network Setup (TURN Relay)
Mobile networks (Jio, Airtel, T-Mobile, etc.) use **Symmetric NAT / Carrier-Grade NAT (CGNAT)** that blocks direct incoming UDP hole-punching. When direct P2P is blocked, StreamP2P automatically routes through a TURN relay.

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
- **Byte 0–3 (`Uint32`):** Zero-based index of the file in the session manifest (`[SLOT #00]`).
- **Byte 4–11 (`Float64`):** Absolute byte offset of this chunk in the target file.
- **Byte 12..End:** Chunk payload (typically 64 KB).

This guarantees that in-flight chunks do not corrupt disk writes when pausing, resuming, or downloading multiple files concurrently.

---

## 📄 License
MIT © [Aditya Kumar singh](https://github.com/)
