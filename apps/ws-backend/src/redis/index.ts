import { createClient, RedisClientType } from "redis";

const redisPub: RedisClientType = createClient({
  socket: {
    host: "localhost",
    port: 6888,
  }
});
const redisSub: RedisClientType = redisPub.duplicate();

const connectRedis = async () => {
  try {
    await redisPub.connect();
    await redisSub.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Redis Connection Error:", error);
  }
};

// Ensure Redis connects when the app starts
connectRedis();

export { redisPub, redisSub };
