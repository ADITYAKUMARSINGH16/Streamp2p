// Shared Protocol Types for WebRTC Signaling & DataChannels

export interface ManifestFileItem {
  index: number;
  name: string;
  size: number;
  mimeType: string;
  relativePath: string;
}

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
      files: ManifestFileItem[];
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

export type PeerConnectionMode = "p2p" | "relay" | "unknown";

export type PeerTransferStatus =
  | "connecting"
  | "authenticating"
  | "ready"
  | "transferring"
  | "paused"
  | "completed"
  | "error";

export interface PeerTransferState {
  peerId: string;
  status: PeerTransferStatus;
  connectionType: PeerConnectionMode;
  fileIndex: number;
  byteOffset: number;
  bytesPerSecond: number;
  progress: number; // 0 to 100
  totalBytes: number;
  currentFileName: string;
  error?: string;
  lastActive: number;
}

// Binary layout constants
export const BINARY_HEADER_SIZE = 12; // 4 bytes (Uint32 fileIndex) + 8 bytes (Float64 byteOffset)
export const CHUNK_SIZE = 65536; // 64 KB
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 65536; // 64 KB
export const BUFFERED_AMOUNT_HIGH_WATERMARK = 262144; // 256 KB

