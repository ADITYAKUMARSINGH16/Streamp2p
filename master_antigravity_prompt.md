# Master System Prompt for Antigravity (Flash 3.8)

Copy and paste the entire prompt block below into Antigravity to generate the complete codebase:

---

Act as a Principal Full-Stack & WebRTC Systems Architect. Build a complete, production-ready, zero-server-storage Peer-to-Peer (P2P) real-time file streaming web application where files stay strictly in the sender's browser disk and stream directly to one or many receivers via URL, 6-digit room code, or QR Code.

Follow the accompanying `idea.md`, `architecture.md`, `protocol.md`, and `deployment.md` specifications strictly. Do NOT write placeholder comments (`// TODO`, `// implement later`) or truncated snippets. Generate the full, working codebase across both the Signaling Server and the Next.js Frontend.

## 1. TECH STACK & ARCHITECTURE REQUIREMENTS
- **Frontend:** Next.js 14+ (App Router, TypeScript), Tailwind CSS, Lucide Icons, `qrcode.react` (for QR generation), `fflate` (for optional streaming zip).
- **WebRTC Engine:** Native `RTCPeerConnection` and `RTCDataChannel` (do NOT use PeerJS so we maintain strict control over SCTP backpressure, multi-peer state, and byte-offset streaming).
- **NAT Traversal:** Configure ICE servers to support both public STUN (`stun:stun.l.google.com:19302`) and configurable TURN server credentials (`process.env.NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`) for 100% connectivity behind symmetric NATs/firewalls.
- **Signaling Server:** Node.js + TypeScript + `socket.io` (lightweight, stateless in-memory room & peer routing; zero file storage).
- **Direct-to-Disk Receiver Streaming:**
  - Primary: HTML5 **File System Access API** (`window.showSaveFilePicker` -> `FileSystemWritableFileStream`) for zero-RAM direct disk writing including random-access `seek()` on resume.
  - Fallback: Service Worker `ReadableStream` / `StreamSaver` fallback for mobile/Safari/Firefox compatibility so 10GB+ files never crash browser RAM.

## 2. CORE ENGINEERING RULES
1. **1-to-Many Swarm Hub (Sender):**
   - Maintain a `Map<peerId, PeerTransferState>` allowing multiple receivers to download simultaneously.
   - Each peer state tracks its own `fileIndex`, `byteOffset`, `status`, `bytesPerSecond`, and `connectionType` (`p2p` | `relay`).
2. **Strict SCTP Backpressure Control:**
   - Slice files in **64 KB (`65536` bytes)** chunks using `file.slice(offset, offset + 65536).arrayBuffer()`.
   - Set `dataChannel.bufferedAmountLowThreshold = 65536` and pause chunk pumping whenever `dataChannel.bufferedAmount >= 262144` (256 KB). Resume automatically inside `dataChannel.onbufferedamountlow`.
3. **Dual-Channel Protocol (`control` + `data`):**
   - `control` channel (JSON): Handles HMAC PIN Challenge-Response, File Manifest exchange, pull-based `START_OR_RESUME` (with `fileIndex` and `byteOffset`), `PAUSE`, `FILE_EOF`, and `TRANSFER_COMPLETE`.
   - `data` channel (`ArrayBuffer`): Streams binary chunks prefixed with an 8-byte header (`Uint32 fileIndex` + `Uint32 chunkLength`) or synchronized with the active stream state.
4. **Hardware & UX Safeguards:**
   - Request Screen Wake Lock (`navigator.wakeLock.request('screen')`) during active transfers.
   - Bind `beforeunload` warning when hosting or downloading.

## 3. DELIVERABLES & GENERATION ORDER
Generate the full codebase systematically in this exact order:
1. **`signaling-server/`**:
   - `package.json`, `tsconfig.json`, and `src/index.ts` (Socket.io server with UUID + 6-digit code room mapping, peer join/leave events, and SDP/ICE relay).
2. **`web-app/src/lib/` (Core Engines)**:
   - `crypto.ts`: Web Crypto API (`SubtleCrypto`) HMAC-SHA256 challenge-response for PIN verification.
   - `wakeLock.ts`: Screen Wake Lock manager.
   - `diskStreamer.ts`: Direct-to-disk writer wrapping `showSaveFilePicker` with a stream fallback and `.seek(offset)` support.
   - `webrtcHost.ts`: 1-to-Many Sender engine with 64KB chunking, backpressure loop, per-peer telemetry, and ICE candidate inspection (to detect Direct P2P vs TURN Relay).
   - `webrtcClient.ts`: Receiver engine with PIN response, pull-based offset requests, speed calculation, and auto-resume.
3. **`web-app/src/app/` (Frontend UI)**:
   - `/` (Home / Sender Page): Drag-and-drop multi-file uploader, PIN lock toggle, QR Code + 6-Digit Code Share Card, and Multi-Peer Live Telemetry Dashboard.
   - `/r/[roomId]` (Receiver Page): Room lookup, PIN entry modal, File Manifest preview, disk save trigger, real-time progress/ETA card, and Pause/Resume controls.