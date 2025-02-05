import { WebSocket, WebSocketServer } from "ws";
import { getPubSubClients } from "./mqRedis";

const wss = new WebSocketServer({ port: 8080 });
console.log("WebSocket server is listening on ws://localhost:8080");

const redisClients: Map<string, { pub: any; sub: any }> = new Map();
const channelSubscribers: Map<string, Set<WebSocket>> = new Map();
const peerRoles: Map<WebSocket, { channel: string; role: string }> = new Map();

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection established");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.action === "subscribe" && typeof message.channel === "string") {
        await handleSubscription(ws, message.channel);
      } else if (
        message.action === "publish" &&
        typeof message.channel === "string" &&
        message.content
      ) {
        await handlePublish(ws, message.channel, message.content);
      } else if (
        message.action === "webrtc-signal" &&
        typeof message.channel === "string" &&
        message.signal
      ) {
        await handleWebRTCSignal(ws, message.channel, message.signal, message.role);
      } else {
        ws.send(JSON.stringify({ error: "Invalid message format" }));
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
      ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    cleanupOnClose(ws);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

// Handle WebRTC signaling
const handleWebRTCSignal = async (
  ws: WebSocket,
  channel: string,
  signal: any,
  role: string
) => {
  if (!channelSubscribers.has(channel)) {
    console.error(`Channel ${channel} not found for WebRTC signaling`);
    return;
  }

  // Register the peer role
  peerRoles.set(ws, { channel, role });

  const peers = channelSubscribers.get(channel);
  if (peers) {
    peers.forEach((peer) => {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) {
        peer.send(
          JSON.stringify({
            action: "webrtc-signal",
            channel,
            role,
            signal,
          })
        );
      }
    });
    console.log(`Forwarded WebRTC signal for channel: ${channel}`);
  }
};

// Handle message publication to Redis
const handlePublish = async (ws: WebSocket, channel: string, content: any) => {
  try {
    const client = redisClients.get(channel)?.pub;
    if (!client) {
      throw new Error(`No Redis client found for channel: ${channel}`);
    }
    await client.publish(channel, JSON.stringify(content));
    console.log(
      `Published message to channel ${channel}: ${JSON.stringify(content)}`
    );
  } catch (error) {
    console.error(`Error publishing to channel ${channel}:`, error);
  }
};

// Handle subscriptions
const handleSubscription = async (ws: WebSocket, channel: string) => {
  try {
    if (!redisClients.has(channel)) {
      const [pubClient, subClient] = await getPubSubClients();
      redisClients.set(channel, { pub: pubClient, sub: subClient });

      await subClient.subscribe(channel, (message: string) => {
        channelSubscribers.get(channel)?.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ channel, message }));
          }
        });
      });
    }

    if (!channelSubscribers.has(channel)) {
      channelSubscribers.set(channel, new Set());
    }
    channelSubscribers.get(channel)?.add(ws);
    console.log(`WebSocket subscribed to channel: ${channel}`);
  } catch (error) {
    console.error(`Error subscribing to channel ${channel}:`, error);
    ws.send(
      JSON.stringify({ error: `Failed to subscribe to channel ${channel}` })
    );
  }
};

// Cleanup on close
const cleanupOnClose = (ws: WebSocket) => {
  console.log("WebSocket connection closed");

  const peerInfo = peerRoles.get(ws);
  if (peerInfo) {
    console.log(
      `Removing peer role for channel: ${peerInfo.channel}, role: ${peerInfo.role}`
    );
    peerRoles.delete(ws);
  }

  channelSubscribers.forEach((subscribers, channel) => {
    subscribers.delete(ws);

    if (subscribers.size === 0) {
      redisClients.get(channel)?.sub.unsubscribe(channel);
      redisClients.get(channel)?.pub.quit();
      redisClients.get(channel)?.sub.quit();
      redisClients.delete(channel);
      channelSubscribers.delete(channel);
      console.log(`Cleaned up Redis and subscribers for channel: ${channel}`);
    }
  });
};




//  {
//     "action": "webrtc-signal",
//     "channel": "channel-name",
//     "role": "sender",
//     "signal": {
//       "type": "offer/answer/candidate",
//       "sdp": "...",
//       "candidate": "..."
//     }
//   }
  

//  {
//     "action": "publish",
//     "channel": "channel-name",
//     "content": { "text": "Hello, world!", "sender": "user1" }
//   }
  









