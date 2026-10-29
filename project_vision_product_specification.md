# Project Vision: Zero-Storage Real-Time P2P File Streamer

## 1. Executive Summary
A real-time, zero-server-storage Peer-to-Peer (P2P) file transfer web application. Files selected by the sender never upload to any cloud storage or intermediate database; they stay strictly on the sender's local disk/browser and stream directly to one or multiple receivers in real time via WebRTC Data Channels. Sharing is instantaneous via a unique URL, scannable QR code, or a 6-digit short room code.

## 2. Core Value Proposition
* **Zero Cloud Storage & Infinite Privacy:** Files are never stored on a server. Once the sender closes their browser tab, the file is no longer accessible anywhere online.
* **Unlimited File Sizes (10GB+):** By combining chunked disk slicing (`Blob.slice()`) on the sender side with direct-to-disk streaming (`File System Access API` & Service Worker streams) on the receiver side, memory usage stays below 50 MB regardless of whether the file is 10 MB or 50 GB.
* **1-to-Many Broadcast Swarm:** A single sender can share a QR code on a projector or group chat, and multiple receivers can download the files simultaneously at independent speeds and byte offsets.
* **Enterprise-Grade Connectivity:** Uses STUN for direct P2P local/internet connections (~82% of cases) and automatically falls back to a self-hosted or Cloudflare TURN relay for strict symmetric NATs and corporate firewalls (~18% of cases).

## 3. Target User Flows

### Flow A: The Sender (Host)
1. **Select:** User drags and drops single files, multiple files, or entire folders into the browser.
2. **Configure (Optional):** User toggles a 4–6 digit PIN lock or chooses between "Sequential Multi-File Queue" and "On-the-Fly `.zip` Stream".
3. **Share:** The app immediately connects to the lightweight Signaling Server and generates:
   * A high-contrast **QR Code** for mobile scanning.
   * A copyable **Share Link** (`https://domain.com/r/x8k9-m2p4`).
   * A **6-Digit Room Code** (`849-201`) for quick desktop entry.
4. **Monitor & Control:** As receivers join, the sender sees a live telemetry dashboard showing each connected peer, their connection mode (`Direct P2P` vs `TURN Relay`), real-time speed (`MB/s`), progress bar, and individual **Pause / Resume / Kick** controls.

### Flow B: The Receiver (Client)
1. **Join:** Receiver scans the QR code, clicks the URL, or types the 6-digit code on the home screen.
2. **Authenticate:** If PIN protection is enabled, the receiver is prompted to enter the PIN (verified via Web Crypto HMAC challenge-response over the WebRTC control channel).
3. **Preview & Save:** Receiver sees the manifest of files (names, sizes, types) and clicks **Download**.
4. **Stream to Disk:** The browser opens a native OS file save handle (or Service Worker download stream). Even if the receiver's mobile network drops briefly, clicking **Resume** requests the exact byte offset where the disk stream left off.

## 4. Key Feature Matrix
| Feature | Specification |
| :--- | :--- |
| **NAT Traversal** | Google STUN + `coturn` / Cloudflare TURN fallback (1B) |
| **Memory Profile** | Strict 64 KB chunk slicing + Direct-to-Disk Receiver Writer (2B) |
| **Topology** | 1-to-Many Hub-and-Spoke WebRTC Mesh (3B) |
| **Security** | DTLS-encrypted WebRTC channels + Optional Web Crypto HMAC PIN Challenge |
| **Resilience** | Pull-based byte-offset Pause/Resume + Screen Wake Lock API + Tab Close Guard |