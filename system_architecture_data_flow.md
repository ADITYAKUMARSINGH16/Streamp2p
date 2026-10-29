# System Architecture & Technical Design

## 1. High-Level Topology

```
                     ┌──────────────────────────────────────┐
                     │     Signaling Server (Socket.io)     │
                     │  (Stateless Room & SDP/ICE Matchmaker)│
                     └──────────┬────────────────┬──────────┘
                                │                │
                 1. Register    │                │ 2. Lookup Room ID /
                 Room & Code    │                │    6-Digit Code &
                 (WebSockets)   │                │    Exchange SDP/ICE
                                ▼                ▼
┌──────────────────────────────────┐          ┌──────────────────────────────────┐
│      SENDER BROWSER (Host)       │          │    RECEIVER BROWSER (Client 1)   │
│                                  │          │                                  │
│  ┌────────────────────────────┐  │          │  ┌────────────────────────────┐  │
│  │ Local Disk File Reference  │  │          │  │ File System Access API /   │  │
│  │ (HTML5 File[] / Blob API)  │  │          │  │ ServiceWorker Disk Stream  │  │
│  └─────────────┬──────────────┘  │          │  └─────────────▲──────────────┘  │
│                │                 │          │                │                 │
│       file.slice(offset, +64KB)  │          │       writable.write(chunk)      │
│                ▼                 │          │                │                 │
│  ┌────────────────────────────┐  │  WebRTC  │  ┌─────────────┴──────────────┐  │
│  │ PeerSession Manager (Map)  │◄─┼──────────┼─►│ Dual RTCDataChannel Engine │  │
│  │ - Peer 1: Offset 450 MB    │  │  P2P or  │  │ - control (JSON state)     │  │
│  │ - Peer 2: Offset 120 MB    │  │   TURN   │  │ - data (Binary 64KB)       │  │
│  └────────────────────────────┘  │          │  └────────────────────────────┘  │
└──────────────────────────────────┘          └──────────────────────────────────┘
```

## 2. Proposed Repository File Tree

```text
p2p-file-streamer/
├── docker-compose.yml               # Orchestrates Signaling Server, Next.js, and Coturn
├── turnserver.conf                  # Production Coturn TURN configuration
├── idea.md
├── prompt.md
├── architecture.md
├── protocol.md
├── deployment.md
│
├── signaling-server/                # Lightweight WebSocket Matchmaker
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                 # Room registry, 6-digit code map, SDP/ICE relay
│
└── web-app/                         # Next.js 14+ App Router Frontend
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── public/
    │   └── sw-stream.js             # Service Worker fallback for non-Chromium disk streaming
    └── src/
        ├── types/
        │   └── protocol.ts          # Shared TypeScript interfaces for Signaling & DataChannel
        ├── lib/
        │   ├── signaling.ts         # Socket.io singleton client wrapper
        │   ├── iceConfig.ts         # STUN + TURN server configuration builder
        │   ├── crypto.ts            # Web Crypto API HMAC-SHA256 PIN challenge/response
        │   ├── diskStreamer.ts      # File System Access API + ServiceWorker stream writer
        │   ├── wakeLock.ts          # Screen Wake Lock & beforeunload lifecycle helper
        │   ├── webrtcHost.ts        # 1-to-Many Sender Engine (Chunking + Backpressure)
        │   └── webrtcClient.ts      # Receiver Engine (Offset tracking + Pause/Resume)
        ├── components/
        │   ├── FileDropzone.tsx     # Drag & drop files/folders + manifest queue list
        │   ├── ShareCard.tsx        # QR Code, Copy URL, 6-digit code, PIN config
        │   ├── PeerTelemetryList.tsx# Live speed, progress, P2P/TURN badge per receiver
        │   └── PinModal.tsx         # Receiver PIN entry dialog
        └── app/
            ├── layout.tsx
            ├── page.tsx             # Sender Host View + "Join via 6-Digit Code" input
            └── r/
                └── [roomId]/
                    └── page.tsx     # Receiver Download View
```

## 3. Memory Management Guarantees
1. **Sender RAM Ceiling (< 32 MB per active peer):**
   - At no point is `FileReader.readAsArrayBuffer(entireFile)` ever called.
   - The sender reads `const chunk = await file.slice(offset, offset + 65536).arrayBuffer()`.
   - If `dataChannel.bufferedAmount >= 262144` (256 KB), the `while` loop exits immediately and waits for the native `bufferedamountlow` event before reading the next 64 KB from disk.
2. **Receiver RAM Ceiling (< 50 MB):**
   - On Chromium browsers (Chrome, Edge, Brave, Opera), `window.showSaveFilePicker()` opens an OS file handle. Incoming `ArrayBuffer` chunks are piped directly to `FileSystemWritableFileStream.write()`.
   - If paused or disconnected, `FileSystemWritableFileStream.seek(receivedBytes)` guarantees exact byte resumption on disk.