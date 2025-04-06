import express from "express";
import http from "http";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import * as mediasoup from "mediasoup";
import { Server, Socket } from "socket.io";
import config from "./config";
import Room from "./Room";
import Peer from "./Peer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import prisma from "@repo/db/client";

// Load environment variables
dotenv.config();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET;

// Rate limiting for Socket.IO events
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_EVENTS_PER_WINDOW = 50; // Max 50 events per minute per socket
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

// Input validation schemas
const CreateRoomSchema = z.object({
  room_id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .min(1)
    .max(50),
});

const JoinRoomSchema = z.object({
  room_id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .min(1)
    .max(50),
  email: z.string().email().max(100),
});

const app = express();

// Configure rate limiting for Express routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all Express routes
app.use(limiter);

// Apply Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
    xssFilter: true,
    frameguard: { action: "deny" },
  })
);

// Restrict CORS to your frontend domain in production
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  pingInterval: 25000, // Send ping every 25 seconds
  pingTimeout: 5000, // If no pong response within 5 seconds, consider disconnected
});

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "WRTC Backend is running" });
});

// All mediasoup workers
let workers: mediasoup.types.Worker[] = [];
let nextMediasoupWorkerIdx = 0;

// Map to store rooms
let roomList: Map<string, Room> = new Map();

interface CustomSocket extends Socket {
  room_id?: string | null;
  userId?: number;
}

// Socket.IO rate limiting function
function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const socketLimit = rateLimitMap.get(socketId);

  if (!socketLimit || now - socketLimit.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(socketId, { count: 1, timestamp: now });
    return true;
  }

  if (socketLimit.count >= MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  socketLimit.count += 1;
  rateLimitMap.set(socketId, socketLimit);
  return true;
}

// Socket.IO authentication middleware
io.use((socket: CustomSocket, next) => {
  // console.log('Socket connection:', socket);
  const token = socket.handshake.auth.token;
  console.log("Socket connection token:", socket.handshake.auth.token);

  if (!token || typeof token !== "string" || JWT_SECRET === undefined) {
    return next(
      new Error("Authentication error: No token provided or invalid token type")
    );
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    socket.userId = decoded.userId;
    next();
  } catch (error: any) {
    return next(new Error(`Authentication error: ${error.message}`));
  }
});

// Initialize mediasoup workers
(async () => {
  try {
    await createWorkers();
    console.info(`Mediasoup workers initialized: ${workers.length}`);
  } catch (error) {
    console.error("Failed to initialize mediasoup workers", { error });
    process.exit(1);
  }
})();

async function createWorkers(): Promise<void> {
  const { numWorkers } = config.mediasoup;

  for (let i = 0; i < numWorkers; i++) {
    try {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker
          .logLevel as mediasoup.types.WorkerLogLevel,
        logTags: config.mediasoup.worker
          .logTags as mediasoup.types.WorkerLogTag[],
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      });

      worker.on("died", () => {
        console.error(
          "Mediasoup worker died, exiting in 2 seconds... [pid:%d]",
          worker.pid
        );
        setTimeout(() => process.exit(1), 2000);
      });

      workers.push(worker);
    } catch (error) {
      console.error("Failed to create mediasoup worker:", error);
      throw error;
    }
  }
}

// Get next mediasoup worker
function getMediasoupWorker(): mediasoup.types.Worker {
  if (workers.length === 0) throw new Error("No mediasoup workers available");
  const worker = workers[nextMediasoupWorkerIdx];
  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
  if (!worker) throw new Error("No mediasoup worker available");
  return worker;
}

io.on("connection", (socket: CustomSocket) => {
  console.log("New connection:", socket.id);

  socket.on(
    "createRoom",
    async (
      { room_id }: { room_id: string },
      callback: (response: string | { error: string }) => void
    ) => {
      try {
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          return callback({ error: "Rate limit exceeded" });
        }

        // Input validation
        const parsed = CreateRoomSchema.safeParse({ room_id });
        if (!parsed.success) {
          return callback({ error: "Invalid room_id" });
        }

        if (roomList.has(room_id)) {
          callback("already exists");
        } else {
          const worker = getMediasoupWorker();
          roomList.set(room_id, new Room(room_id, worker, io));
          console.log("Created room:", { room_id });
          callback(room_id);
        }
      } catch (error: any) {
        console.error("Error creating room:", error);
        callback({ error: "Failed to create room" });
      }
    }
  );

  socket.on(
    "join",
    async (
      { room_id, email }: { room_id: string; email: string },
      callback: (response: any) => void
    ) => {
      try {
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          return callback({ error: "Rate limit exceeded" });
        }

        // Input validation
        const parsed = JoinRoomSchema.safeParse({ room_id, email });
        if (!parsed.success) {
          return callback({ error: "Invalid room_id or email" });
        }

        // Verify user is a participant (requires Prisma setup)
        const roomExists = await prisma.room.findFirst({
          where: { name: room_id },
          include: { participants: true },
        });
        console.log("Room exists:", roomExists);
        console.log(
          "Room participants:",
          roomExists?.participants,
          "socket id:",
          socket.userId
        );
        if(!roomExists) {
          return callback({ error: "Room does not exist" });
        }
        const isAuthorized =
        roomExists.hostId === socket.userId ||
        roomExists.participants.some((p: any) => p.userId === socket.userId);
        if (!isAuthorized) {
          return callback({ error: "Not authorized to join this room" });
        }

        console.log("User joined:", { room_id, email });

        if (!roomList.has(room_id)) {
          return callback({ error: "Room does not exist" });
        }

        const room = roomList.get(room_id);
        if (!room) {
          return callback({ error: "Room not found" });
        }

        room.addPeer(new Peer(socket.id, email));
        socket.room_id = room_id;

        callback(room.toJson());
      } catch (error: any) {
        console.error("Error joining room:", error);
        callback({ error: "Failed to join room" });
      }
    }
  );

  socket.on("getProducers", () => {
    try {
      if (!checkRateLimit(socket.id)) {
        return socket.emit("error", { error: "Rate limit exceeded" });
      }

      if (!socket.room_id || !roomList.has(socket.room_id)) return;

      const room = roomList.get(socket.room_id);
      if (!room) return;

      const peer = room.getPeers().get(socket.id);
      if (!peer) return;

      console.log("Get producers:", { email: peer.email });

      const producerList = room.getProducerListForPeer();
      socket.emit("newProducers", producerList);
    } catch (error: any) {
      console.error("Error getting producers:", error);
    }
  });

  socket.on(
    "getRouterRtpCapabilities",
    (_, callback: (response: any) => void) => {
      try {
        if (!checkRateLimit(socket.id)) {
          return callback({ error: "Rate limit exceeded" });
        }

        if (!socket.room_id || !roomList.has(socket.room_id)) {
          return callback({ error: "Room not found" });
        }

        const room = roomList.get(socket.room_id);
        if (!room) {
          return callback({ error: "Room not found" });
        }

        const peer = room.getPeers().get(socket.id);
        if (!peer) {
          return callback({ error: "Peer not found" });
        }

        console.log("Get RouterRtpCapabilities:", { email: peer.email });

        const rtpCapabilities = room.getRtpCapabilities();
        callback(rtpCapabilities);
      } catch (error: any) {
        console.error("Error getting router RTP capabilities:", error);
        callback({ error: error.message });
      }
    }
  );

  socket.on(
    "createWebRtcTransport",
    async (_, callback: (response: any) => void) => {
      try {
        if (!checkRateLimit(socket.id)) {
          return callback({ error: "Rate limit exceeded" });
        }

        if (!socket.room_id || !roomList.has(socket.room_id)) {
          return callback({ error: "Room not found" });
        }

        const room = roomList.get(socket.room_id);
        if (!room) {
          return callback({ error: "Room not found" });
        }

        const peer = room.getPeers().get(socket.id);
        if (!peer) {
          return callback({ error: "Peer not found" });
        }

        console.log("Create WebRTC transport:", { email: peer.email });

        const { params } = await room.createWebRtcTransport(socket.id);
        callback(params);
      } catch (error: any) {
        console.error("Error creating WebRTC transport:", error);
        callback({ error: error.message });
      }
    }
  );

  socket.on(
    "connectTransport",
    async (
      {
        transport_id,
        dtlsParameters,
      }: {
        transport_id: string;
        dtlsParameters: mediasoup.types.DtlsParameters;
      },
      callback: (response: string) => void
    ) => {
      try {
        if (!checkRateLimit(socket.id)) {
          return callback("Rate limit exceeded");
        }

        if (!socket.room_id || !roomList.has(socket.room_id)) {
          return callback("Room not found");
        }

        const room = roomList.get(socket.room_id);
        if (!room) {
          return callback("Room not found");
        }

        const peer = room.getPeers().get(socket.id);
        if (!peer) {
          return callback("Peer not found");
        }

        console.log("Connect transport:", { email: peer.email });

        await room.connectPeerTransport(
          socket.id,
          transport_id,
          dtlsParameters
        );
        callback("success");
      } catch (error: any) {
        console.error("Error connecting transport:", error);
        callback("Failed to connect transport");
      }
    }
  );

  socket.on(
    "produce",
    async (
      {
        kind,
        rtpParameters,
        producerTransportId,
      }: {
        kind: string;
        rtpParameters: mediasoup.types.RtpParameters;
        producerTransportId: string;
      },
      callback: (response: any) => void
    ) => {
      try {
        if (!checkRateLimit(socket.id)) {
          return callback({ error: "Rate limit exceeded" });
        }

        if (!socket.room_id || !roomList.has(socket.room_id)) {
          return callback({ error: "Not in a room" });
        }

        const room = roomList.get(socket.room_id);
        if (!room) {
          return callback({ error: "Room not found" });
        }

        const producer_id = await room.produce(
          socket.id,
          producerTransportId,
          rtpParameters,
          kind
        );

        console.log("Produce:", {
          type: kind,
          email: room.getPeers().get(socket.id)?.email,
          id: producer_id,
        });

        callback({ producer_id });
      } catch (error: any) {
        console.error("Error producing:", error);
        callback({ error: error.message });
      }
    }
  );

  socket.on(
    "consume",
    async (
      {
        consumerTransportId,
        producerId,
        rtpCapabilities,
      }: {
        consumerTransportId: string;
        producerId: string;
        rtpCapabilities: mediasoup.types.RtpCapabilities;
      },
      callback: (response: any) => void
    ) => {
      try {
        if (!checkRateLimit(socket.id)) {
          return callback({ error: "Rate limit exceeded" });
        }

        if (!socket.room_id || !roomList.has(socket.room_id)) {
          return callback({ error: "Room not found" });
        }

        const room = roomList.get(socket.room_id);
        if (!room) {
          return callback({ error: "Room not found" });
        }

        const params = await room.consume(
          socket.id,
          consumerTransportId,
          producerId,
          rtpCapabilities
        );

        if (!params) {
          return callback({ error: "Failed to consume" });
        }

        console.log("Consuming:", {
          email: room.getPeers().get(socket.id)?.email,
          producer_id: producerId,
          consumer_id: params.id,
        });

        callback(params);
      } catch (error: any) {
        console.error("Error consuming:", error);
        callback({ error: error.message });
      }
    }
  );

  socket.on("resume", async (_, callback: () => void) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit("error", { error: "Rate limit exceeded" });
        return callback();
      }
      // TODO: Implement consumer resume logic
      callback();
    } catch (error: any) {
      console.error("Error resuming consumer:", error);
      callback();
    }
  });

  socket.on("getMyRoomInfo", (_, callback: (response: any) => void) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return callback({ error: "Rate limit exceeded" });
      }

      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: "Room not found" });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      callback(room.toJson());
    } catch (error: any) {
      console.error("Error getting room info:", error);
      callback({ error: error.message });
    }
  });

  socket.on("disconnect", (reason) => {
    try {
      if (reason === "ping timeout") {
        console.warn(`Socket ${socket.id} disconnected due to ping timeout`);
      }
      if (!socket.room_id) {
        throw new Error("Socket room id not present !!");
      }
      console.log("Disconnect:", {
        email: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.email,
      });

      const room = roomList.get(socket.room_id);
      if (!room) return;

      room.removePeer(socket.id);
      rateLimitMap.delete(socket.id); // Clean up rate limit data
    } catch (error: any) {
      console.error("Error handling disconnect:", error);
    }
  });

  socket.on("producerClosed", ({ producer_id }: { producer_id: string }) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return socket.emit("error", { error: "Rate limit exceeded" });
      }

      if (!socket.room_id) {
        throw new Error("Socket room id not present !!");
      }
      console.log("Producer close:", {
        email: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.email,
      });

      if (!socket.room_id) return;

      const room = roomList.get(socket.room_id);
      if (!room) return;

      room.closeProducer(socket.id, producer_id);
    } catch (error: any) {
      console.error("Error closing producer:", error);
    }
  });

  socket.on("exitRoom", async (_, callback: (response: any) => void) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return callback({ error: "Rate limit exceeded" });
      }

      if (!socket.room_id) {
        throw new Error("Socket room id not present !!");
      }
      console.log("Exit room:", {
        email: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.email,
      });

      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: "Not currently in a room" });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      await room.removePeer(socket.id);

      if (room.getPeers().size === 0) {
        roomList.delete(socket.room_id);
      }

      socket.room_id = null;
      callback("successfully exited room");
    } catch (error: any) {
      console.error("Error exiting room:", error);
      callback({ error: error.message });
    }
  });
});

server
  .listen(config.listenPort, config.listenIp, () => {
    console.log(
      `Server running on http://${config.listenIp}:${config.listenPort}`
    );
  })
  .on("error", (err) => {
    console.error("Server startup error:", err);
    process.exit(1);
  });
