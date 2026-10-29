const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const isProd =
  process.env.NODE_ENV === "production" ||
  process.argv.some((a) => a.includes("--prod") || a.includes("-p"));
if (isProd) {
  process.env.NODE_ENV = "production";
}
const dev = !isProd;
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

// In-memory signaling state registries
const rooms = new Map();
const shortCodeMap = new Map();
const socketMetaMap = new Map();

function normalizeCode(code) {
  return String(code || "").replace(/\D/g, "").trim();
}

function registerSignaling(io) {
  io.on("connection", (socket) => {
    console.log(`[Signaling] Socket connected: ${socket.id}`);

    // 1. Host registers room & numeric shortcode
    socket.on("create-room", (payload, callback) => {
      try {
        const { roomId, shortCode } = payload || {};
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

        const newRoom = {
          roomId,
          shortCode: cleanCode,
          hostSocketId: socket.id,
          peers: new Set(),
          createdAt: Date.now(),
        };

        rooms.set(roomId, newRoom);
        shortCodeMap.set(cleanCode, roomId);
        socketMetaMap.set(socket.id, { roomId, role: "host" });

        socket.join(roomId);
        console.log(`[Signaling] Room created: ${roomId} (Code: ${cleanCode}) by Host: ${socket.id}`);

        callback?.({ success: true });
        socket.emit("room-created", { roomId, shortCode: cleanCode });
      } catch (err) {
        console.error("[Signaling] Error in create-room:", err);
        callback?.({ success: false, error: "Internal server error" });
      }
    });

    // 2. Client resolves 6-digit shortcode
    socket.on("resolve-code", (payload, callback) => {
      try {
        const cleanCode = normalizeCode(payload?.shortCode);
        const roomId = shortCodeMap.get(cleanCode);

        if (!roomId) {
          const err = "No active transfer found with this code";
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
    });

    // 3. Client joins room
    socket.on("join-room", (payload, callback) => {
      try {
        const { roomId } = payload || {};
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

        // Notify Host
        io.to(room.hostSocketId).emit("peer-joined", { peerId: socket.id });

        // Confirm to client
        callback?.({ success: true, hostId: room.hostSocketId });
        socket.emit("joined-room", { success: true, roomId, hostId: room.hostSocketId });
      } catch (err) {
        console.error("[Signaling] Error in join-room:", err);
        callback?.({ success: false, error: "Failed to join room" });
      }
    });

    // 4. Relay SDP / ICE signals
    socket.on("signal", (payload) => {
      try {
        const { targetId, signalData } = payload || {};
        if (!targetId || !signalData) return;

        io.to(targetId).emit("signal", {
          senderId: socket.id,
          signalData,
        });
      } catch (err) {
        console.error("[Signaling] Error forwarding signal:", err);
      }
    });

    // 5. Clean up on disconnect
    socket.on("disconnect", (reason) => {
      console.log(`[Signaling] Socket disconnected: ${socket.id} (reason: ${reason})`);
      const meta = socketMetaMap.get(socket.id);
      if (!meta) return;

      socketMetaMap.delete(socket.id);
      const room = rooms.get(meta.roomId);
      if (!room) return;

      if (meta.role === "host") {
        console.log(`[Signaling] Host ${socket.id} closed room ${room.roomId}`);
        io.to(room.roomId).emit("host-disconnected", { roomId: room.roomId });
        shortCodeMap.delete(room.shortCode);
        rooms.delete(room.roomId);
      } else {
        // Client disconnected: remove from room and notify host
        room.peers.delete(socket.id);
        io.to(room.hostSocketId).emit("peer-left", { peerId: socket.id });
        console.log(`[Signaling] Client ${socket.id} left room ${room.roomId}`);
      }
    });
  });
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    pingInterval: 10000,
    pingTimeout: 30000,
    maxHttpBufferSize: 1e6,
  });

  registerSignaling(io);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`=================================================`);
    console.log(`🚀 StreamP2P Unified Server running on port ${port}`);
    console.log(`   Mode: ${dev ? "Development (On-demand compilation)" : "Production (Pre-compiled optimized)"}`);
    console.log(`   Listening on all interfaces (IPv4 127.0.0.1, IPv6 ::1, LAN)`);
    console.log(`   Frontend & Signaling both unified on port ${port}!`);
    console.log(`=================================================`);
  });
});

