import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT || "4000", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

interface RoomInfo {
  roomId: string;
  shortCode: string;
  hostSocketId: string;
  peers: Set<string>;
  createdAt: number;
}

interface SocketMeta {
  roomId: string;
  role: "host" | "client";
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Basic health and metric endpoints
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// In-memory state registries (zero persistent storage, pure transient routing)
const rooms = new Map<string, RoomInfo>();
const shortCodeMap = new Map<string, string>(); // cleaned numeric code -> roomId
const socketMetaMap = new Map<string, SocketMeta>();

function normalizeCode(code: string): string {
  return code.replace(/\D/g, "").trim();
}

io.on("connection", (socket: Socket) => {
  console.log(`[Signaling] Socket connected: ${socket.id}`);

  // 1. Host registers room & numeric shortcode
  socket.on(
    "create-room",
    (
      payload: { roomId: string; shortCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { roomId, shortCode } = payload;
        if (!roomId || !shortCode) {
          const err = "Invalid roomId or shortCode";
          callback?.({ success: false, error: err });
          socket.emit("create-room-error", { error: err });
          return;
        }

        const cleanCode = normalizeCode(shortCode);

        // Clean up any stale room if this socket already registered one
        const existingMeta = socketMetaMap.get(socket.id);
        if (existingMeta && existingMeta.role === "host") {
          const oldRoom = rooms.get(existingMeta.roomId);
          if (oldRoom) {
            shortCodeMap.delete(oldRoom.shortCode);
            rooms.delete(oldRoom.roomId);
          }
        }

        const newRoom: RoomInfo = {
          roomId,
          shortCode: cleanCode,
          hostSocketId: socket.id,
          peers: new Set<string>(),
          createdAt: Date.now(),
        };

        rooms.set(roomId, newRoom);
        shortCodeMap.set(cleanCode, roomId);
        socketMetaMap.set(socket.id, { roomId, role: "host" });

        socket.join(roomId);
        console.log(
          `[Signaling] Room created: ${roomId} (Code: ${cleanCode}) by Host: ${socket.id}`
        );

        callback?.({ success: true });
        socket.emit("room-created", { roomId, shortCode: cleanCode });
      } catch (err) {
        console.error("[Signaling] Error in create-room:", err);
        callback?.({ success: false, error: "Internal server error" });
      }
    }
  );

  // 2. Client resolves 6-digit shortcode to canonical roomId
  socket.on(
    "resolve-code",
    (
      payload: { shortCode: string },
      callback?: (res: { success: boolean; roomId?: string; error?: string }) => void
    ) => {
      try {
        const cleanCode = normalizeCode(payload.shortCode || "");
        const roomId = shortCodeMap.get(cleanCode);

        if (!roomId) {
          const err = "No active transfer found with this code";
          callback?.({ success: false, error: err });
          socket.emit("code-resolved", { success: false, error: err });
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          shortCodeMap.delete(cleanCode);
          const err = "Transfer host is no longer active";
          callback?.({ success: false, error: err });
          socket.emit("code-resolved", { success: false, error: err });
          return;
        }

        callback?.({ success: true, roomId });
        socket.emit("code-resolved", { success: true, roomId });
      } catch (err) {
        console.error("[Signaling] Error in resolve-code:", err);
        callback?.({ success: false, error: "Failed to resolve code" });
      }
    }
  );

  // 3. Client joins an active room
  socket.on(
    "join-room",
    (
      payload: { roomId: string },
      callback?: (res: { success: boolean; hostId?: string; error?: string }) => void
    ) => {
      try {
        const { roomId } = payload;
        const room = rooms.get(roomId);

        if (!room) {
          const err = "Room not found or Host disconnected";
          callback?.({ success: false, error: err });
          socket.emit("join-room-error", { error: err });
          return;
        }

        room.peers.add(socket.id);
        socketMetaMap.set(socket.id, { roomId, role: "client" });
        socket.join(roomId);

        console.log(`[Signaling] Client ${socket.id} joined room ${roomId}`);

        // Notify Host that a new peer joined to initiate WebRTC offer
        io.to(room.hostSocketId).emit("peer-joined", { peerId: socket.id });

        // Confirm to client
        callback?.({ success: true, hostId: room.hostSocketId });
        socket.emit("joined-room", { success: true, roomId, hostId: room.hostSocketId });
      } catch (err) {
        console.error("[Signaling] Error in join-room:", err);
        callback?.({ success: false, error: "Failed to join room" });
      }
    }
  );

  // 4. Relay SDP offers/answers and ICE candidates
  socket.on(
    "signal",
    (payload: {
      targetId: string;
      signalData: any;
    }) => {
      try {
        const { targetId, signalData } = payload;
        if (!targetId || !signalData) return;

        io.to(targetId).emit("signal", {
          senderId: socket.id,
          signalData,
        });
      } catch (err) {
        console.error("[Signaling] Error forwarding signal:", err);
      }
    }
  );

  // 5. Clean up on disconnect
  socket.on("disconnect", (reason) => {
    console.log(`[Signaling] Socket disconnected: ${socket.id} (${reason})`);
    const meta = socketMetaMap.get(socket.id);
    if (!meta) return;

    socketMetaMap.delete(socket.id);
    const room = rooms.get(meta.roomId);
    if (!room) return;

    if (meta.role === "host") {
      console.log(`[Signaling] Host ${socket.id} closed room ${room.roomId}`);
      // Notify all connected clients in the room
      io.to(room.roomId).emit("host-disconnected", { roomId: room.roomId });
      shortCodeMap.delete(room.shortCode);
      rooms.delete(room.roomId);
    } else {
      // Client disconnected
      room.peers.delete(socket.id);
      io.to(room.hostSocketId).emit("peer-left", { peerId: socket.id });
      console.log(`[Signaling] Client ${socket.id} left room ${room.roomId}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 WebRTC Signaling Server listening on port ${PORT}`);
  console.log(`   CORS Origin: ${CORS_ORIGIN}`);
  console.log(`=================================================`);
});

