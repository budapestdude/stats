import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
}

export async function getCached(key: string): Promise<string | null> {
  return await redisClient.get(key);
}

export async function setCached(key: string, value: string, expireSeconds?: number): Promise<void> {
  if (expireSeconds) {
    await redisClient.setEx(key, expireSeconds, value);
  } else {
    await redisClient.set(key, value);
  }
}

export async function deleteCached(key: string): Promise<void> {
  await redisClient.del(key);
}

export default redisClient;