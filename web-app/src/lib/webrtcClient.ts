import { Socket } from "socket.io-client";
import {
  ControlMessage,
  ManifestFileItem,
  PeerConnectionMode,
  BINARY_HEADER_SIZE,
} from "@/types/protocol";
import { getRtcConfiguration, fetchRtcConfiguration, detectConnectionMode } from "./iceConfig";
import { computeHmac } from "./crypto";
import { createOptimalStreamWriter, StreamWriteTarget } from "./diskStreamer";

export interface ReceiverProgressInfo {
  fileIndex: number;
  fileName: string;
  fileBytesReceived: number;
  fileTotalBytes: number;
  totalBytesReceived: number;
  totalSize: number;
  bytesPerSecond: number;
  etaSeconds: number;
  overallProgress: number; // 0 to 100
}

export interface WebRtcClientCallbacks {
  onStatusChange: (status: string) => void;
  onConnectionMode: (mode: PeerConnectionMode) => void;
  onPinRequired: (salt: string) => void;
  onAuthResult: (success: boolean, message?: string) => void;
  onManifestReceived: (files: ManifestFileItem[], totalSize: number) => void;
  onProgress: (info: ReceiverProgressInfo) => void;
  onFileCompleted: (fileIndex: number, fileName: string) => void;
  onTransferComplete: () => void;
  onHostDisconnected: () => void;
  onError: (err: string) => void;
}

export class WebRtcClientEngine {
  private roomId: string;
  private socket: Socket;
  private callbacks: WebRtcClientCallbacks;
  private pc: RTCPeerConnection | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private writer: StreamWriteTarget | null = null;

  private files: ManifestFileItem[] = [];
  private totalSize: number = 0;
  private salt: string = "";
  private currentFileIndex: number = 0;
  private isDownloading: boolean = false;
  private isPaused: boolean = false;
  private isDestroyed: boolean = false;

  // Speed and telemetry calculation
  private lastBytesSample: number = 0;
  private lastTimeSample: number = Date.now();
  private smoothedSpeed: number = 0;
  private statsInterval: any = null;
  private hostSocketId: string = "";
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    roomId: string,
    socket: Socket,
    callbacks: WebRtcClientCallbacks
  ) {
    this.roomId = roomId;
    this.socket = socket;
    this.callbacks = callbacks;
  }

  public init() {
    this.callbacks.onStatusChange("Connecting to signaling network...");
    this.setupSignaling();

    const sendJoin = () => {
      this.callbacks.onStatusChange("Joining transfer room...");
      console.log(`[Client] Emitting join-room for room: ${this.roomId}`);
      this.socket.emit(
        "join-room",
        { roomId: this.roomId },
        (res: { success: boolean; hostId?: string; error?: string }) => {
          if (!res.success) {
            this.callbacks.onError(res.error || "Room not found or Host disconnected");
            this.callbacks.onStatusChange("Host not available");
          } else {
            this.hostSocketId = res.hostId || "";
            this.callbacks.onStatusChange("Waiting for Host WebRTC handshake...");
          }
        }
      );
    };

    if (this.socket.connected) {
      sendJoin();
    } else {
      this.socket.once("connect", () => {
        sendJoin();
      });
    }
  }

  private setupSignaling() {
    this.socket.on(
      "signal",
      async ({
        senderId,
        signalData,
      }: {
        senderId: string;
        signalData: RTCSessionDescriptionInit | RTCIceCandidateInit;
      }) => {
        try {
          if (!this.pc) {
            await this.initPeerConnection(senderId);
          }

          if ("sdp" in signalData && this.pc) {
            this.callbacks.onStatusChange("Received WebRTC offer. Connecting...");
            await this.pc.setRemoteDescription(new RTCSessionDescription(signalData));

            if (signalData.type === "offer") {
              const answer = await this.pc.createAnswer();
              await this.pc.setLocalDescription(answer);
              this.socket.emit("signal", {
                targetId: senderId,
                signalData: this.pc.localDescription,
              });
              this.callbacks.onStatusChange("Handshake answered. Establishing link...");
            }

            // Flush any ICE candidates received before remote description was set
            while (this.pendingCandidates.length > 0) {
              const cand = this.pendingCandidates.shift();
              if (cand && this.pc) {
                try {
                  await this.pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (ce) {
                  console.warn("[Client] Error adding buffered ICE candidate:", ce);
                }
              }
            }
          } else if ("candidate" in signalData && this.pc) {
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(new RTCIceCandidate(signalData));
            } else {
              this.pendingCandidates.push(signalData);
            }
          }
        } catch (err) {
          console.error("[Client] Error handling signal:", err);
          this.callbacks.onError("WebRTC negotiation error: " + (err as any)?.message);
        }
      }
    );

    this.socket.on("host-disconnected", () => {
      console.warn("[Client] Host closed the transfer session");
      this.callbacks.onHostDisconnected();
      this.destroy();
    });

    this.socket.on("join-room-error", (data: { error?: string }) => {
      console.warn("[Client] Room not found or Host disconnected:", data?.error);
      this.callbacks.onError(data?.error || "Room not found or Host disconnected");
      this.callbacks.onHostDisconnected();
      this.destroy();
    });
  }

  private async initPeerConnection(targetHostId: string) {
    const config = await fetchRtcConfiguration();
    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[Client] Generated ICE candidate: [${event.candidate.type || "unknown"}] via ${event.candidate.protocol || "udp"}`);
        this.socket.emit("signal", {
          targetId: targetHostId,
          signalData: event.candidate.toJSON(),
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc) {
        console.log(`[Client] ICE Connection State: ${this.pc.iceConnectionState}`);
        if (
          this.pc.iceConnectionState === "disconnected" ||
          this.pc.iceConnectionState === "failed" ||
          this.pc.iceConnectionState === "closed"
        ) {
          this.callbacks.onStatusChange("Connection lost");
        }
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        console.log(`[Client] WebRTC Connection State: ${this.pc.connectionState}`);
        if (this.pc.connectionState === "connected") {
          this.callbacks.onStatusChange("P2P Link established! Opening data channels...");
        } else if (this.pc.connectionState === "failed") {
          this.callbacks.onStatusChange("Direct connection failed. Please check network/firewall.");
        }
      }
    };

    // Host creates the channels, Client listens via ondatachannel
    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log(`[Client] Received DataChannel: ${channel.label}`);

      if (channel.label === "control") {
        this.controlChannel = channel;
        this.setupControlChannel(channel);
      } else if (channel.label === "data") {
        this.dataChannel = channel;
        this.dataChannel.binaryType = "arraybuffer";
        this.setupDataChannel(channel);
      }
    };

    this.statsInterval = setInterval(async () => {
      if (this.isDestroyed || !this.pc) return;
      const mode = await detectConnectionMode(this.pc);
      if (mode !== "unknown") {
        this.callbacks.onConnectionMode(mode);
      }
    }, 1000);
  }

  private setupControlChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log("[Client] Control channel OPEN");
      this.callbacks.onStatusChange("Connected. Initializing transfer protocol...");
    };

    channel.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as ControlMessage;

        switch (msg.type) {
          case "AUTH_CHALLENGE": {
            this.salt = msg.salt;
            if (msg.pinRequired) {
              this.callbacks.onStatusChange("PIN authentication required");
              this.callbacks.onPinRequired(msg.salt);
            } else {
              this.callbacks.onStatusChange("Ready to download");
            }
            break;
          }

          case "AUTH_RESULT": {
            this.callbacks.onAuthResult(msg.success, msg.message);
            if (!msg.success) {
              this.callbacks.onStatusChange("Authentication failed: " + (msg.message || "Invalid PIN"));
            }
            break;
          }

          case "MANIFEST_META": {
            this.files = msg.files;
            this.totalSize = msg.totalSize;
            this.callbacks.onStatusChange("Manifest received. Ready to stream.");
            this.callbacks.onManifestReceived(this.files, this.totalSize);
            break;
          }

          case "FILE_EOF": {
            console.log(`[Client] Received FILE_EOF for file index ${msg.fileIndex}`);
            if (this.writer) {
              await this.writer.close();
              this.writer = null;
            }

            const completedFile = this.files[msg.fileIndex];
            this.callbacks.onFileCompleted(msg.fileIndex, completedFile?.name || "file");

            // Automatically proceed to next file if there is one
            const nextIdx = msg.fileIndex + 1;
            if (nextIdx < this.files.length && this.isDownloading && !this.isPaused) {
              this.currentFileIndex = nextIdx;
              await this.startStreamForFileIndex(nextIdx, 0);
            }
            break;
          }

          case "TRANSFER_COMPLETE": {
            console.log("[Client] Full Transfer Complete!");
            this.isDownloading = false;
            this.callbacks.onStatusChange("Transfer finished successfully");
            this.callbacks.onTransferComplete();
            break;
          }

          case "HOST_PAUSED": {
            this.callbacks.onStatusChange("Host paused transfer");
            break;
          }

          case "HOST_RESUMED": {
            this.callbacks.onStatusChange("Host resumed transfer");
            break;
          }
        }
      } catch (err) {
        console.error("[Client] Error parsing control message:", err);
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onmessage = async (event) => {
      try {
        const buffer = event.data as ArrayBuffer;
        if (buffer.byteLength < BINARY_HEADER_SIZE) return;

        const dv = new DataView(buffer);
        const fileIndex = dv.getUint32(0, true);
        const byteOffset = dv.getFloat64(4, true);

        const chunkBytes = new Uint8Array(buffer, BINARY_HEADER_SIZE);

        if (this.writer && fileIndex === this.currentFileIndex) {
          await this.writer.write(byteOffset, chunkBytes);
        }

        this.calculateTelemetry(fileIndex, byteOffset + chunkBytes.byteLength);
      } catch (err) {
        console.error("[Client] Error writing binary chunk to disk:", err);
      }
    };
  }

  private calculateTelemetry(fileIndex: number, currentOffset: number) {
    const now = Date.now();
    const timeDelta = (now - this.lastTimeSample) / 1000;

    // Cumulative transferred bytes across files
    let priorBytes = 0;
    for (let i = 0; i < fileIndex; i++) {
      priorBytes += this.files[i]?.size || 0;
    }
    const totalTransferred = priorBytes + currentOffset;

    if (timeDelta >= 0.5) {
      const bytesDelta = Math.max(0, totalTransferred - this.lastBytesSample);
      const instantSpeed = bytesDelta / timeDelta;
      this.smoothedSpeed = Math.round(
        this.smoothedSpeed * 0.3 + instantSpeed * 0.7
      );

      this.lastBytesSample = totalTransferred;
      this.lastTimeSample = now;
    }

    const currentFile = this.files[fileIndex];
    const remainingBytes = Math.max(0, this.totalSize - totalTransferred);
    const etaSeconds =
      this.smoothedSpeed > 0 ? Math.round(remainingBytes / this.smoothedSpeed) : 0;
    const overallProgress =
      this.totalSize > 0
        ? Math.min(100, (totalTransferred / this.totalSize) * 100)
        : 100;

    this.callbacks.onProgress({
      fileIndex,
      fileName: currentFile?.name || "Unknown",
      fileBytesReceived: currentOffset,
      fileTotalBytes: currentFile?.size || 0,
      totalBytesReceived: totalTransferred,
      totalSize: this.totalSize,
      bytesPerSecond: this.smoothedSpeed,
      etaSeconds,
      overallProgress,
    });
  }

  public async submitPin(pin: string) {
    if (!this.salt || !this.controlChannel) {
      this.callbacks.onError("Authentication channel not ready");
      return;
    }

    try {
      const hmacHex = await computeHmac(pin, this.salt);
      const responseMsg: ControlMessage = {
        type: "AUTH_RESPONSE",
        hmacHex,
      };
      this.controlChannel.send(JSON.stringify(responseMsg));
      this.callbacks.onStatusChange("Verifying PIN...");
    } catch (err) {
      this.callbacks.onError("Failed to compute HMAC");
    }
  }

  public async startDownload() {
    if (this.files.length === 0) {
      this.callbacks.onError("No files available to download");
      return;
    }

    this.isDownloading = true;
    this.isPaused = false;
    this.currentFileIndex = 0;
    await this.startStreamForFileIndex(0, 0);
  }

  private async startStreamForFileIndex(index: number, startOffset: number) {
    const file = this.files[index];
    if (!file) return;

    try {
      this.callbacks.onStatusChange(`Preparing disk writer for ${file.name}...`);
      this.writer = createOptimalStreamWriter();
      await this.writer.init(file, startOffset);

      this.callbacks.onStatusChange(`Streaming ${file.name}...`);
      const requestMsg: ControlMessage = {
        type: "REQUEST_STREAM",
        fileIndex: index,
        byteOffset: startOffset,
      };
      this.controlChannel?.send(JSON.stringify(requestMsg));
    } catch (err: any) {
      console.error("[Client] Failed to initialize disk writer:", err);
      this.callbacks.onError(
        err.name === "AbortError"
          ? "File save canceled by user"
          : `Disk initialization failed: ${err.message}`
      );
      this.isDownloading = false;
    }
  }

  public pauseDownload() {
    if (!this.isDownloading || this.isPaused) return;

    this.isPaused = true;
    const pauseMsg: ControlMessage = {
      type: "PAUSE_STREAM",
      reason: "user",
    };
    this.controlChannel?.send(JSON.stringify(pauseMsg));
    this.callbacks.onStatusChange("Transfer paused by receiver");
  }

  public async resumeDownload() {
    if (!this.isDownloading || !this.isPaused) return;

    this.isPaused = false;
    const currentOffset = this.writer ? this.writer.getCurrentOffset() : 0;
    this.callbacks.onStatusChange(
      `Resuming from offset ${(currentOffset / 1024 / 1024).toFixed(2)} MB...`
    );

    const resumeMsg: ControlMessage = {
      type: "REQUEST_STREAM",
      fileIndex: this.currentFileIndex,
      byteOffset: currentOffset,
    };
    this.controlChannel?.send(JSON.stringify(resumeMsg));
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.writer) {
      this.writer.abort("Session terminated");
      this.writer = null;
    }
    try {
      this.controlChannel?.close();
    } catch (e) {}
    try {
      this.dataChannel?.close();
    } catch (e) {}
    try {
      this.pc?.close();
    } catch (e) {}
    this.socket.off("signal");
    this.socket.off("host-disconnected");
  }
}

