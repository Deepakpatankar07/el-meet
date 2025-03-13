import { createClient, RedisClientType } from "redis";

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options: any) => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      return new Error("Redis connection refused");
    }
    return Math.min(options.attempt * 100, 3000); // Retry with increasing delay
  },
};

const redisPub: RedisClientType = createClient(redisConfig);
const redisSub: RedisClientType = redisPub.duplicate();

const connectRedis = async () => {
  try {
    await redisPub.connect();
    await redisSub.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Redis Connection Error:", error);
    process.exit(1); // Exit to let Docker/PM2 restart
  }
};

connectRedis();

export { redisPub, redisSub };

/* import { createClient, RedisClientType } from "redis";

const redisPub: RedisClientType = createClient({
  socket: {
    host: "localhost",
    port: 6379,
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
 */