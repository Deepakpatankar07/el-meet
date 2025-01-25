import { createClient } from "redis";

export async function getPubSubClients() {
  try {
    const pubClient = createClient();
    const subClient = createClient();

    await pubClient.connect();
    await subClient.connect();

    console.log("Connected to Redis Pub/Sub");
    return [pubClient, subClient];
  } catch (error) {
    console.error("Failed to connect to Redis", error);
    throw error;
  }
}

