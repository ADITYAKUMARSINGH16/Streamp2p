import { Socket } from "socket.io-client";
import {
  ControlMessage,
  ManifestFileItem,
  PeerTransferState,
  BINARY_HEADER_SIZE,
  CHUNK_SIZE,
  BUFFERED_AMOUNT_LOW_THRESHOLD,
  BUFFERED_AMOUNT_HIGH_WATERMARK,
} from "@/types/protocol";
import { getRtcConfiguration, fetchRtcConfiguration, detectConnectionMode } from "./iceConfig";
import { generateSalt, verifyHmac } from "./crypto";

interface PeerSession {
  peerId: string;
  pc: RTCPeerConnection;
  controlChannel: RTCDataChannel;
  dataChannel: RTCDataChannel;
  state: PeerTransferState;
  salt: string;
  authenticated: boolean;
  isStreaming: boolean;
  activeFileIndex: number;
  currentByteOffset: number;
  lastBytesCount: number;
  lastTimeSample: number;
  pendingCandidates: RTCIceCandidateInit[];
  statsInterval?: any;
}

export interface WebRtcHostCallbacks {
  onPeerUpdate: (peers: PeerTransferState[]) => void;
  onRoomReady?: (roomId: string, shortCode: string) => void;
  onError?: (err: string) => void;
}

export class WebRtcHostEngine {
  private files: File[];
  private pin?: string;
  private roomId: string;
  private shortCode: string;
  private socket: Socket;
  private peers: Map<string, PeerSession> = new Map();
  private callbacks: WebRtcHostCallbacks;
  private isDestroyed: boolean = false;
  private totalTransferBytes: number = 0;

  constructor(
    files: File[],
    roomId: string,
    shortCode: string,
    socket: Socket,
    callbacks: WebRtcHostCallbacks,
    pin?: string
  ) {
    this.files = files;
    this.roomId = roomId;
    this.shortCode = shortCode;
    this.socket = socket;
    this.callbacks = callbacks;
    this.pin = pin && pin.trim().length > 0 ? pin.trim() : undefined;
    this.totalTransferBytes = files.reduce((acc, f) => acc + f.size, 0);
  }

  public init() {
    this.setupSignaling();
    
    const sendCreate = () => {
      console.log(`[Host] Emitting create-room for room: ${this.roomId}`);
      this.socket.emit(
        "create-room",
        { roomId: this.roomId, shortCode: this.shortCode },
        (res: { success: boolean; error?: string }) => {
          if (!res.success) {
            this.callbacks.onError?.(res.error || "Failed to create room on server");
          } else {
            this.callbacks.onRoomReady?.(this.roomId, this.shortCode);
          }
        }
      );
    };

    if (this.socket.connected) {
      sendCreate();
    } else {
      this.socket.once("connect", () => {
        sendCreate();
      });
    }
  }

  private setupSignaling() {
    this.socket.on("peer-joined", async ({ peerId }: { peerId: string }) => {
      console.log(`[Host] Peer joined signaling room: ${peerId}`);
      await this.initiatePeerConnection(peerId);
    });

    this.socket.on(
      "signal",
      async ({
        senderId,
        signalData,
      }: {
        senderId: string;
        signalData: RTCSessionDescriptionInit | RTCIceCandidateInit;
      }) => {
        const session = this.peers.get(senderId);
        if (!session) return;

        try {
          if ("sdp" in signalData) {
            await session.pc.setRemoteDescription(new RTCSessionDescription(signalData));
            // Flush any ICE candidates received before remote description was set
            while (session.pendingCandidates.length > 0) {
              const cand = session.pendingCandidates.shift();
              if (cand) {
                try {
                  await session.pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (ce) {
                  console.warn(`[Host] Error adding buffered ICE candidate from ${senderId}:`, ce);
                }
              }
            }
          } else if ("candidate" in signalData) {
            if (session.pc.remoteDescription) {
              await session.pc.addIceCandidate(new RTCIceCandidate(signalData));
            } else {
              session.pendingCandidates.push(signalData);
            }
          }
        } catch (err) {
          console.error(`[Host] Error handling signal from ${senderId}:`, err);
        }
      }
    );

    this.socket.on("peer-left", ({ peerId }: { peerId: string }) => {
      this.cleanupPeer(peerId);
    });
  }

  private async initiatePeerConnection(peerId: string) {
    if (this.peers.has(peerId)) {
      this.cleanupPeer(peerId);
    }

    const config = await fetchRtcConfiguration();
    const pc = new RTCPeerConnection(config);

    // Create Dual Channels
    const controlChannel = pc.createDataChannel("control", { ordered: true });
    const dataChannel = pc.createDataChannel("data", { ordered: true });
    dataChannel.binaryType = "arraybuffer";
    dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;

    const initialFileName = this.files.length > 0 ? this.files[0].name : "None";
    const session: PeerSession = {
      peerId,
      pc,
      controlChannel,
      dataChannel,
      salt: generateSalt(16),
      authenticated: !this.pin, // Pre-authenticated if no PIN set
      isStreaming: false,
      activeFileIndex: 0,
      currentByteOffset: 0,
      lastBytesCount: 0,
      lastTimeSample: Date.now(),
      pendingCandidates: [],
      state: {
        peerId,
        status: "connecting",
        connectionType: "unknown",
        fileIndex: 0,
        byteOffset: 0,
        bytesPerSecond: 0,
        progress: 0,
        totalBytes: this.totalTransferBytes,
        currentFileName: initialFileName,
        lastActive: Date.now(),
      },
    };

    this.peers.set(peerId, session);
    this.broadcastPeersUpdate();

    // ICE Candidate routing & Resilient State Monitoring
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[Host] Generated ICE candidate: [${event.candidate.type || "unknown"}] via ${event.candidate.protocol || "udp"}`);
        this.socket.emit("signal", {
          targetId: peerId,
          signalData: event.candidate.toJSON(),
        });
      }
    };

    let disconnectTimeout: NodeJS.Timeout | null = null;
    pc.oniceconnectionstatechange = () => {
      console.log(`[Host] Peer ${peerId} ICE State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        if (disconnectTimeout) {
          clearTimeout(disconnectTimeout);
          disconnectTimeout = null;
        }
      } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        if (disconnectTimeout) clearTimeout(disconnectTimeout);
        this.cleanupPeer(peerId);
      } else if (pc.iceConnectionState === "disconnected") {
        if (!disconnectTimeout) {
          disconnectTimeout = setTimeout(() => {
            if (pc.iceConnectionState === "disconnected") {
              console.log(`[Host] Cleaning up peer ${peerId} after disconnected grace period`);
              this.cleanupPeer(peerId);
            }
          }, 10000);
        }
      }
    };

    // Periodic connection mode & telemetry monitor
    session.statsInterval = setInterval(async () => {
      if (this.isDestroyed || !this.peers.has(peerId)) return;
      const mode = await detectConnectionMode(pc);
      if (session.state.connectionType !== mode && mode !== "unknown") {
        session.state.connectionType = mode;
        this.broadcastPeersUpdate();
      }
      this.calculatePeerSpeed(session);
    }, 1000);

    // Wire up Control Channel
    this.setupControlChannel(session);

    // Create and send SDP Offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("signal", {
        targetId: peerId,
        signalData: pc.localDescription,
      });
    } catch (err) {
      console.error(`[Host] Failed to create offer for ${peerId}:`, err);
      this.cleanupPeer(peerId);
    }
  }

  private setupControlChannel(session: PeerSession) {
    const { controlChannel, peerId } = session;

    controlChannel.onopen = () => {
      console.log(`[Host] Control channel OPEN with peer: ${peerId}`);
      session.state.status = this.pin ? "authenticating" : "ready";
      this.broadcastPeersUpdate();

      // Send Auth Challenge
      const challengeMsg: ControlMessage = {
        type: "AUTH_CHALLENGE",
        salt: session.salt,
        pinRequired: Boolean(this.pin),
      };
      this.sendControlMessage(session, challengeMsg);

      // If no PIN required, immediately advertise manifest
      if (!this.pin) {
        this.sendManifest(session);
      }
    };

    controlChannel.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as ControlMessage;
        session.state.lastActive = Date.now();

        switch (msg.type) {
          case "AUTH_RESPONSE": {
            if (!this.pin) {
              session.authenticated = true;
              this.sendManifest(session);
              break;
            }

            const isValid = await verifyHmac(this.pin, session.salt, msg.hmacHex);
            if (isValid) {
              session.authenticated = true;
              session.state.status = "ready";
              this.sendControlMessage(session, {
                type: "AUTH_RESULT",
                success: true,
              });
              this.sendManifest(session);
            } else {
              this.sendControlMessage(session, {
                type: "AUTH_RESULT",
                success: false,
                message: "Incorrect PIN entered.",
              });
              session.state.status = "error";
              session.state.error = "Authentication failed";
            }
            this.broadcastPeersUpdate();
            break;
          }

          case "REQUEST_STREAM": {
            if (!session.authenticated) {
              this.sendControlMessage(session, {
                type: "AUTH_RESULT",
                success: false,
                message: "Unauthorized",
              });
              return;
            }

            const { fileIndex, byteOffset } = msg;
            if (fileIndex >= 0 && fileIndex < this.files.length) {
              this.startStreamingToFile(session, fileIndex, byteOffset);
            }
            break;
          }

          case "PAUSE_STREAM": {
            session.isStreaming = false;
            session.state.status = "paused";
            this.sendControlMessage(session, { type: "HOST_PAUSED" });
            this.broadcastPeersUpdate();
            break;
          }
        }
      } catch (err) {
        console.error(`[Host] Failed to parse control message from ${peerId}:`, err);
      }
    };

    controlChannel.onerror = (err) => {
      console.warn(`[Host] Control channel error with ${peerId}:`, err);
    };

    controlChannel.onclose = () => {
      console.log(`[Host] Control channel closed with ${peerId}`);
      this.cleanupPeer(peerId);
    };
  }

  private sendControlMessage(session: PeerSession, msg: ControlMessage) {
    if (session.controlChannel.readyState === "open") {
      session.controlChannel.send(JSON.stringify(msg));
    }
  }

  private sendManifest(session: PeerSession) {
    const manifestFiles: ManifestFileItem[] = this.files.map((file, idx) => ({
      index: idx,
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      relativePath: (file as any).webkitRelativePath || file.name,
    }));

    const manifestMsg: ControlMessage = {
      type: "MANIFEST_META",
      transferId: this.roomId,
      totalSize: this.totalTransferBytes,
      files: manifestFiles,
    };

    this.sendControlMessage(session, manifestMsg);
  }

  private async startStreamingToFile(
    session: PeerSession,
    fileIndex: number,
    startOffset: number
  ) {
    session.isStreaming = true;
    session.activeFileIndex = fileIndex;
    session.currentByteOffset = startOffset;
    session.state.status = "transferring";
    session.state.fileIndex = fileIndex;
    session.state.currentFileName = this.files[fileIndex].name;
    this.broadcastPeersUpdate();

    const file = this.files[fileIndex];
    let offset = startOffset;

    try {
      while (offset < file.size && session.isStreaming && !this.isDestroyed) {
        const { dataChannel } = session;

        if (dataChannel.readyState !== "open") {
          console.warn(`[Host] Data channel not open for peer ${session.peerId}`);
          break;
        }

        // Strict SCTP Backpressure: Pause loop when buffer is full
        if (dataChannel.bufferedAmount >= BUFFERED_AMOUNT_HIGH_WATERMARK) {
          await new Promise<void>((resolve) => {
            const onBufferedAmountLow = () => {
              dataChannel.removeEventListener(
                "bufferedamountlow",
                onBufferedAmountLow
              );
              resolve();
            };
            dataChannel.addEventListener("bufferedamountlow", onBufferedAmountLow);
          });
        }

        if (!session.isStreaming || this.isDestroyed) {
          break;
        }

        // Slice strictly 64 KB chunk
        const sliceEnd = Math.min(offset + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(offset, sliceEnd);
        const chunkArrayBuffer = await chunkBlob.arrayBuffer();

        // Binary Frame Layout:
        // Bytes 0..3: Uint32 fileIndex
        // Bytes 4..11: Float64 byteOffset
        // Bytes 12..N: Raw File Chunk Payload (<= 64 KB)
        const frameBuffer = new ArrayBuffer(
          BINARY_HEADER_SIZE + chunkArrayBuffer.byteLength
        );
        const view = new DataView(frameBuffer);
        view.setUint32(0, fileIndex, true);
        view.setFloat64(4, offset, true);

        new Uint8Array(frameBuffer, BINARY_HEADER_SIZE).set(
          new Uint8Array(chunkArrayBuffer)
        );

        dataChannel.send(frameBuffer);

        offset += chunkArrayBuffer.byteLength;
        session.currentByteOffset = offset;
        session.state.byteOffset = offset;

        // Cumulative progress across all files
        let completedPriorBytes = 0;
        for (let i = 0; i < fileIndex; i++) {
          completedPriorBytes += this.files[i].size;
        }
        const totalProgressBytes = completedPriorBytes + offset;
        session.state.progress =
          this.totalTransferBytes > 0
            ? Math.min(100, (totalProgressBytes / this.totalTransferBytes) * 100)
            : 100;
      }

      // Check if this file finished
      if (offset >= file.size && session.isStreaming) {
        this.sendControlMessage(session, {
          type: "FILE_EOF",
          fileIndex,
          totalBytesSent: file.size,
        });

        const isLastFile = fileIndex === this.files.length - 1;
        if (isLastFile) {
          session.isStreaming = false;
          session.state.status = "completed";
          session.state.progress = 100;
          this.sendControlMessage(session, { type: "TRANSFER_COMPLETE" });
        }
        this.broadcastPeersUpdate();
      }
    } catch (err) {
      console.error(`[Host] Error during chunk streaming to ${session.peerId}:`, err);
      session.isStreaming = false;
      session.state.status = "error";
      session.state.error = "Streaming interrupted";
      this.broadcastPeersUpdate();
    }
  }

  private calculatePeerSpeed(session: PeerSession) {
    const now = Date.now();
    const timeDeltaSeconds = (now - session.lastTimeSample) / 1000;
    if (timeDeltaSeconds >= 0.8) {
      // Calculate bytes transferred across all files up to current offset
      let totalTransferred = 0;
      for (let i = 0; i < session.activeFileIndex; i++) {
        totalTransferred += this.files[i].size;
      }
      totalTransferred += session.currentByteOffset;

      const bytesDelta = Math.max(0, totalTransferred - session.lastBytesCount);
      const instantSpeed = bytesDelta / timeDeltaSeconds;

      // Exponential moving average for smooth display
      session.state.bytesPerSecond = Math.round(
        session.state.bytesPerSecond * 0.3 + instantSpeed * 0.7
      );

      session.lastBytesCount = totalTransferred;
      session.lastTimeSample = now;
      this.broadcastPeersUpdate();
    }
  }

  public pausePeer(peerId: string) {
    const session = this.peers.get(peerId);
    if (session) {
      session.isStreaming = false;
      session.state.status = "paused";
      this.sendControlMessage(session, { type: "HOST_PAUSED" });
      this.broadcastPeersUpdate();
    }
  }

  public resumePeer(peerId: string) {
    const session = this.peers.get(peerId);
    if (session && session.state.status === "paused") {
      this.sendControlMessage(session, { type: "HOST_RESUMED" });
      this.startStreamingToFile(
        session,
        session.activeFileIndex,
        session.currentByteOffset
      );
    }
  }

  public kickPeer(peerId: string) {
    this.cleanupPeer(peerId);
  }

  private cleanupPeer(peerId: string) {
    const session = this.peers.get(peerId);
    if (session) {
      session.isStreaming = false;
      if (session.statsInterval) clearInterval(session.statsInterval);
      try {
        session.controlChannel.close();
      } catch (e) {}
      try {
        session.dataChannel.close();
      } catch (e) {}
      try {
        session.pc.close();
      } catch (e) {}
      this.peers.delete(peerId);
      this.broadcastPeersUpdate();
    }
  }

  private broadcastPeersUpdate() {
    const peerStates = Array.from(this.peers.values()).map((p) => ({
      ...p.state,
    }));
    this.callbacks.onPeerUpdate(peerStates);
  }

  public destroy() {
    this.isDestroyed = true;
    for (const peerId of Array.from(this.peers.keys())) {
      this.cleanupPeer(peerId);
    }
    this.socket.off("peer-joined");
    this.socket.off("signal");
    this.socket.off("peer-left");
  }
}

