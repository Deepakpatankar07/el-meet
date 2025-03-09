import prisma from "@repo/db/client";
import { JWT_PASSWORD } from "../config";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { redisPub, redisSub } from "../redis";
import z from "zod";

interface User {
  ws: WebSocket;
  userId: number;
}

const MessageSchema = z.object({
  email: z.string(),
    content: z.string(),
    timestamp: z.number(),
    messageId: z.number(),
});

export const users = new Map<string, User[]>();

function checkUser(token: string): number | null {
  try {
    const decoded = jwt.verify(token, JWT_PASSWORD);
    if (typeof decoded === "object" && decoded.userId) {
      return decoded.userId;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/* --------------- Redis Subscription --------------- */
redisSub.pSubscribe("room:*", (message, channel) => {
  try {
    const [, roomId] = channel.split(":"); // Extract roomId
    if (!roomId) {
      console.log("Room ID missing in Redis message");
      return;
    }

    const parsedMessage = JSON.parse(message);
    console.log(`Redis message received for room ${roomId}:`, parsedMessage);

    const clients = users.get(roomId);
    if (!clients || clients.length === 0) {
      console.log("No active clients in room:", roomId);
      return;
    }
    clients.forEach(({ ws }) => {
      console.log(
        `Checking ws for user in room ${roomId}, state: ${ws.readyState}`
      );
      if (ws.readyState === WebSocket.OPEN) {
        console.log("Sending message to user", ws.OPEN);
        ws.send(JSON.stringify(parsedMessage));
      } else {
        console.log("WebSocket not open, skipping...");
      }
    });
  } catch (error) {
    console.error("Error handling Redis message:", error);
  }
});

/* --------------- WebSocket Setup --------------- */
export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async function connection(ws, request) {
    const url = request.url; // ws://localhost:8080?roomId=xyz&token=123123
    if (!url) {
      ws.close();
      return;
    }
    console.log("connected to ws");

    // Parse URL parameters
    const rawUrl = url.startsWith("/") ? url.slice(1) : url;
    const queryParams = new URLSearchParams(rawUrl.split("?")[1] || "");
    const token = queryParams.get("token") || "";
    const roomId = queryParams.get("roomId") || ""; // Getting roomId from the URL
    const userId = checkUser(token);

    if (!userId || !roomId) {
      console.log("Invalid WebSocket request: missing userId or roomId");
      ws.close();
      return;
    }

    // Verify room exists
    const room = await prisma.room.findFirst({
      where: { name: roomId },
      include: { participants: true },
    });

    if (!room) {
      console.log("Room not found:", roomId);
      ws.close();
      return;
    }

    // Fetch the user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      console.log("User not found:", userId);
      ws.close();
      return;
    }

    console.log(`User ${userId} (${user.email}) joined room ${roomId}`);

    // Initialize room in users map if it doesn't exist
    if (!users.has(roomId)) {
      users.set(roomId, []);
    }

    // Replace existing WebSocket for this userId, if it exists
    const roomUsers = users.get(roomId)!;
    const existingUserIndex = roomUsers.findIndex((u) => u.userId === userId);
    if (existingUserIndex !== -1) {
      // Replace the old WebSocket with the new one
      roomUsers[existingUserIndex] = { ws, userId };
      console.log(`Replaced WebSocket for user ${userId} in room ${roomId}`);
    } else {
      // Add new user
      roomUsers.push({ ws, userId });
      console.log(`Added new WebSocket for user ${userId} in room ${roomId}`);
    }

    // Broadcast "online" status to all participants
    const statusMessage = JSON.stringify({
      event: "status",
      email: user.email,
      status: "online",
    });
    redisPub.publish(`room:${roomId}`, statusMessage);

    /* --------------- Handle Incoming Messages --------------- */
    ws.on("message", async function message(data) {
      ws.send(JSON.stringify({ event: "hello", messages:"--------hello--------"}));
      try {
        const parsedData = JSON.parse(data.toString());
        
        console.log("Received message:", parsedData);

        const { action, room, email, content, cursor, limit } = parsedData;
        if(action === "ping" && ws.readyState === WebSocket.OPEN && users.has(room)) {
          ws.send(JSON.stringify({ event: "pong", messages:"--------pong--------"}));
          return;
        } else if (action === "message") {
          if (!users.has(room)) {
            ws.send(
              JSON.stringify({ event: "error", error: "Room not found" })
            );
            return;
          }
            const messageData = await addChatMessage(room, email, content);
            const redisPublishMessage = JSON.stringify({
                event: "message",
                ...messageData,
            });
            redisPub.publish(`room:${room}`, redisPublishMessage);
        } else if (action === "getHistory") {
            const history = await getChatHistory(room, userId, cursor, limit);
            ws.send(JSON.stringify({ event: "history", messages: history }));
        } else if (action === "endmeeting") {
            console.log("Received endmeeting request:");
          if (!userId || !room) {
            console.log("Invalid leave request: missing userId or roomId");
            return;
          }

          const roomData = await prisma.room.findFirst({
            where: { name: room },
            include: { host: true },
          });

          if (!roomData) {
            console.log("Room not found:", room);
            return;
          }

          // Broadcast "offline" status to all participants
          const statusMessage = JSON.stringify({
            event: "status",
            email: parsedData.email,
            status: "offline",
          });
          redisPub.publish(`room:${room}`, statusMessage);

          // Handle host/participant-specific cleanup
          if (roomData.hostId === userId) {
            // Host is leaving: delete the room and all participants
            await prisma.roomParticipant.deleteMany({
              where: { roomId: roomData.id },
            });
            await prisma.room.delete({ where: { id: roomData.id } });
            const leaveMessage = JSON.stringify({
              event: "endmeeting",
              email: parsedData.email,
              room,
            });
            redisPub.publish(`room:${room}`, leaveMessage);
            users.delete(room);
            console.log(`Room ${room} deleted by host ${email}`);
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    /* --------------- Handle Disconnection --------------- */
    ws.on("close", () => {
      console.log(`User ${userId} disconnected from room ${roomId}`);

      // Remove the user from the room
      const roomUsers = users.get(roomId) || [];
      const updatedUsers = roomUsers.filter((user) => user.ws !== ws);

      if (updatedUsers.length > 0) {
        users.set(roomId, updatedUsers);
      }
       else {
        users.delete(roomId); // Remove room if no users left
      }

      // Broadcast "offline" status to all participants
      const statusMessage = JSON.stringify({
        event: "status",
        email: user.email,
        status: "offline",
      });
      redisPub.publish(`room:${roomId}`, statusMessage);
    });
  });
}

async function getUserJoinTime(
  userId: number,
  roomId: string
): Promise<Date | null> {
  const room = await prisma.room.findFirst({
    where: { name: roomId },
    include: { participants: true },
  });
  if (!room) return null;

  if (room.hostId === userId) {
    return room.createdAt;
  }

  const participant = room.participants.find((p) => p.userId === userId);
  if (participant) {
    return participant.joinedAt;
  }
  return null;
}
async function addChatMessage(roomId: string, email: string, content: string) {
  const timestamp = Date.now();
  const messageId = await redisPub.incr(`chat:${roomId}:id`);
  const score = timestamp * 1000000 + messageId;
  const message = { email, content, timestamp, messageId };
  await redisPub.zAdd(`chat:${roomId}:messages`,{ score, value:JSON.stringify(message)});
  return message;
}

async function getChatHistory(roomId: string, userId: number, cursor: number, limit: number): Promise<any[]> {
  try {
    const userJoinTime = await getUserJoinTime(userId, roomId);
    if (!userJoinTime) {
      return []; 
    }

    const minScore = userJoinTime.getTime() * 1000000;
    console.log(
      `Fetching history for room: ${roomId}, startTime: ${minScore}, cursor: ${cursor}, limit: ${limit}`
    );

    const history = (await redisPub.sendCommand([
      "ZREVRANGEBYSCORE",
      `chat:${roomId}:messages`,
      cursor.toString(), // Max score (cursor)
      minScore.toString(), // Min score (user join time)
      "WITHSCORES",
      "LIMIT",
      "0",
      limit.toString(),
    ])) as string[];

    console.log("Fetched raw chat history:", history);

    const parsedHistory: any[] = [];
    for (let i = 0; i < history.length; i += 2) {
      const rawMessage = history[i]; // Message (string)
      const rawScore = history[i + 1]; // Score (string)

      if (!rawMessage || !rawScore) continue; // Skip if undefined

      try {
        const message = JSON.parse(rawMessage); // Parse JSON string
        const score = Number(rawScore); // Convert score to number
        parsedHistory.push({ ...MessageSchema.parse(message), score });
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    }

    return parsedHistory.reverse();
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
}