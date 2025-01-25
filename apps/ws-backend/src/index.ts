import { WebSocketServer, WebSocket } from "ws";
import { getPubSubClients } from "./mqRedis";

const wss = new WebSocketServer({ port: 8080 });
console.log("WebSocket server is listening on ws://localhost:8080");

const redisClients: Map<string, { pub: any; sub: any }> = new Map();
const channelSubscribers: Map<string, Set<WebSocket>> = new Map();

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection established");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.action === "subscribe" && typeof data.channel === "string") {
        await handleSubscription(ws, data.channel);
      } else if ( data.action === "publish" && typeof data.channel === "string" && data.content ) {
        const {channel, content} = data;
        try {
            const client = redisClients.get(channel)?.pub;
            if (!client) {
                throw new Error(`No Redis client found for channel: ${channel}`);
            }
            await client.publish(channel, JSON.stringify(content));
            console.log(`Published message to channel ${channel}: ${JSON.stringify(content)}`);
            } catch (error) {
                console.error(`Error publishing to channel ${channel}:`, error);
            }
            } else {
                ws.send(JSON.stringify({ error: "Invalid message format" }));
            }
        } catch (error) {
            console.error(`Error processing WebSocket message: %s`, error);
            ws.send(JSON.stringify({ error: "Invalid message format" }));
        }
  });

  ws.on("close", ()=> {
    console.log('WebSocket connection closed');

    channelSubscribers.forEach((subscribers, channel)=>{
        subscribers.delete(ws);

        if (subscribers.size === 0) {
            redisClients.get(channel)?.sub.unsubscribe(channel);
            redisClients.get(channel)?.pub.quit();
            redisClients.get(channel)?.sub.quit();
            redisClients.delete(channel);
            channelSubscribers.delete(channel);
            console.log(`No more subscribers; unsubscribed and cleaned up Redis for channel: ${channel}`);
        }
    })
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});
});

const handleSubscription = async ( ws: WebSocket , channel: string ) => {
    try {
        // Check for Redis clients for this channel exist
        if(!redisClients.has(channel)){
            const [pubClient, subClient] = await getPubSubClients();
            
            redisClients.set(channel, { pub: pubClient , sub: subClient });

            await subClient.subscribe(channel, (message: string) => {
                console.log(`Message received on channel ${channel}: ${message}`);
                channelSubscribers.get(channel)?.forEach( client => {
                    if(client.readyState === ws.OPEN) {
                        client.send(JSON.stringify({channel, message}))
                    }
                })
            })
        }
        // Add WebSocket client to the channel
        if(!channelSubscribers.has(channel)){
            channelSubscribers.set(channel, new Set());
        }
        channelSubscribers.get(channel)?.add(ws);
        console.log(`WebSocket subscribed to channel: ${channel}`);
    } catch (error) {
        console.error(`Error subscribing to channel ${channel}: %s`, error);
        ws.send(JSON.stringify({ error : `Failed to subscribe to channel ${channel}` }));
    }
};