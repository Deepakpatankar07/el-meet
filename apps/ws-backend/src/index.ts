import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

server.listen(8080, () => console.log("Server running on port 8080"));

const clients = new Map<
  string,
  {
    host: { ws: WebSocket; name: string };
    participants: { ws: WebSocket; name: string }[];
  }
>();

const redisPub = createClient();
const redisSub = redisPub.duplicate();

redisPub.connect();
redisSub.connect();

redisSub.pSubscribe("room:*", (message, channel) => {
    const [, room] = channel.split(":");
    const parsedMessage = JSON.parse(message);

    const clientData = clients.get(room);
    if (!clientData) return;

    switch (parsedMessage.event) {
        case "roomCreated":
          clientData.host.ws.send(message);
          break;
    
          case "roomJoined":
            [clientData.host, ...clientData.participants].forEach(({ ws }) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
              }
            });
            break;
          
          case "message":
            [clientData.host, ...clientData.participants].forEach(({ ws }) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
              }
            });
            break;

          case "participants":
            [clientData.host, ...clientData.participants].forEach(({ ws }) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
              }
            });
            break;
    }          
})

wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (data: string) => {
        const message = JSON.parse(data.toString());
        const { action, room, name, content } = message;

        switch (action) {
            case "create":
                if (clients.has(room)) {
                    ws.send(JSON.stringify({ event: "error", error: "Room already exists" }));
                    return;
                }
                clients.set(room, { host: {ws,name}, participants: [] });
                
                redisPub.publish(`room:${room}`, JSON.stringify({ event: "roomCreated", room, name, content: "You created the room !!" }));

                updateParticipants(room);
                break;

            case "join":
                const clientData = clients.get(room);
            
                if (!clientData) {
                    ws.send(JSON.stringify({ event: "error", error: "Room not found" }));
                    return;
                }
            
                const isAlreadyInRoom = clientData.participants.some((p) => p.name === name);
            
                if (isAlreadyInRoom) {
                    ws.send(JSON.stringify({ event: "error", error: "You are already in this room" }));
                    return;
                }
            
                clientData.participants.push({ ws, name });
            
                redisPub.publish(`room:${room}`, JSON.stringify({ event: "roomJoined", room, name, content: `participant ${name} joined` }));

                updateParticipants(room);
                break;
        
            case "message":
                const client = clients.get(room);

                if (!client) {
                    ws.send(JSON.stringify({ event: "error", error: "Room not found" }));
                    return;
                }

                redisPub.publish(`room:${room}`, JSON.stringify({ event: "message", room, name, content }));
                break;
        }
    });

    ws.on("close", () => {
        for (const [room, clientData] of clients.entries()) {
          if (clientData.host.ws === ws) {
              clients.delete(room);
              redisPub.publish(`room:${room}`, JSON.stringify({ event: "roomDeleted", room , content: `Deleted the Room: ${room}` }));
          } else {
            clientData.participants = clientData.participants.filter((p) => p.ws !== ws);
            updateParticipants(room);
          }
        }
    });
});

function updateParticipants(room: string) {
  const clientData = clients.get(room);
  if (!clientData) return;

  const participantsList = [
    ...clientData.participants.map((p) => p.name),
    clientData.host.name,
  ];

  redisPub.publish(
    `room:${room}`,
    JSON.stringify({ event: "participants", room, participants: participantsList })
  );
}