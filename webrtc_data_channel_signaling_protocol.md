# Wire Protocol Specification (`control` & `data` Channels)

## 1. WebSocket Signaling Protocol (Server <-> Browser)

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `create-room` | Host -> Server | `{ roomId: string, shortCode: string }` | Registers a new active transfer room and its 6-digit numeric alias. |
| `resolve-code` | Client -> Server | `{ shortCode: string }` | Resolves a 6-digit code (`849201`) into its full `roomId`. |
| `join-room` | Client -> Server | `{ roomId: string }` | Notifies the host that a new receiver wants to establish a WebRTC connection. |
| `peer-joined` | Server -> Host | `{ peerId: string }` | Triggers the Host to create a new `RTCPeerConnection` and send an SDP Offer. |
| `signal` | Bidirectional | `{ targetId: string, senderId?: string, signalData: RTCSessionDescriptionInit \| RTCIceCandidateInit }` | Relays WebRTC SDP Offers, Answers, and ICE candidates between Host and Client. |
| `host-disconnected` | Server -> Clients | `{ roomId: string }` | Broadcasts if the sender closes their browser tab. |

---

## 2. WebRTC Dual-Channel Specification

The Host creates two ordered `RTCDataChannel` instances per peer:
1. **`control`**: `ordered: true` (JSON UTF-8 messages)
2. **`data`**: `ordered: true`, `binaryType: "arraybuffer"` (Raw binary chunks)

### A. `control` Channel JSON Message Types

```typescript
export type ControlMessage =
  // 1. Authentication (If Host enabled a PIN)
  | { type: "AUTH_CHALLENGE"; salt: string; pinRequired: boolean }
  | { type: "AUTH_RESPONSE"; hmacHex: string }
  | { type: "AUTH_RESULT"; success: boolean; message?: string }

  // 2. File Manifest Advertisement (Sent after auth succeeds)
  | {
      type: "MANIFEST_META";
      transferId: string;
      totalSize: number;
      files: Array<{
        index: number;
        name: string;
        size: number;
        mimeType: string;
        relativePath: string;
      }>;
    }

  // 3. Pull-Based Stream Control (Receiver -> Sender)
  | {
      type: "REQUEST_STREAM";
      fileIndex: number;
      byteOffset: number; // 0 for new file, >0 for resuming interrupted transfer
    }
  | { type: "PAUSE_STREAM"; reason?: "user" | "disk_busy" }

  // 4. Stream Lifecycle Notifications (Sender -> Receiver)
  | { type: "HOST_PAUSED" }
  | { type: "HOST_RESUMED" }
  | { type: "FILE_EOF"; fileIndex: number; totalBytesSent: number }
  | { type: "TRANSFER_COMPLETE" };
```

### B. `data` Channel Binary Frame Layout

To prevent race conditions when switching between multiple files or resuming from a new byte offset, every binary message sent over the `data` channel is **64 KB + 12 Bytes Header**:

```
┌──────────────────────┬──────────────────────┬────────────────────────────────────┐
│ Bytes 0..3 (Uint32)  │ Bytes 4..11 (Float64)│ Bytes 12..N (Uint8Array)           │
│      fileIndex       │      byteOffset      │ Raw File Chunk Payload (<= 64 KB)  │
└──────────────────────┴──────────────────────┴────────────────────────────────────┘
```

* **Why include `fileIndex` and `byteOffset` in every binary packet?**
  If a receiver clicks "Pause" and then "Resume", a few in-flight packets from before the pause might still arrive in the SCTP buffer. By inspecting the 12-byte header (`DataView`), the receiver guarantees chunks are written in strict sequential order without corrupting the file on disk.

---

## 3. Cryptographic PIN Verification Flow (Zero Plaintext PINs)

1. Host generates a random 16-byte hex `salt` per peer and sends `{ type: "AUTH_CHALLENGE", salt, pinRequired: true }`.
2. Receiver prompts user for PIN, computes `HMAC-SHA256(key = PIN, data = salt)` using `window.crypto.subtle`, and sends `{ type: "AUTH_RESPONSE", hmacHex }`.
3. Host computes the expected `HMAC-SHA256` locally and compares. The plaintext PIN is never transmitted over the network.