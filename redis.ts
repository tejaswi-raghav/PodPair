// utils/redis.ts
// Redis is used for:
//  1. Match queue (fast read/write, TTL expiry)
//  2. Socket room → session mapping
//  3. Rate-limit state (via express-rate-limit)

import Redis from 'ioredis';
import { logger } from './logger';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 200, 3000),
});

redis.on('error', (err) => logger.error('Redis error:', err));
redis.on('connect', () => logger.info('Redis connected'));

// ─── Queue helpers ────────────────────────────────────────────────────────────
// Key pattern: queue:{topic}:{mood}  → sorted set scored by timestamp (FIFO)
export const QUEUE_TTL_SEC = 120; // 2 min max wait before auto-remove

export const queueKey = (topic: string, mood: string) =>
  `queue:${topic}:${mood}`;

export async function enqueue(topic: string, mood: string, userId: string): Promise<void> {
  const key = queueKey(topic, mood);
  const score = Date.now();
  await redis.zadd(key, score, userId);
  // Expire the key if no one joins in 10 minutes
  await redis.expire(key, 600);
}

export async function dequeue(topic: string, mood: string): Promise<string[]> {
  const key = queueKey(topic, mood);
  // Pop two oldest entries atomically
  const result = await redis.zpopmin(key, 2);
  // zpopmin returns [member, score, member, score, ...]
  return result.filter((_, i) => i % 2 === 0);
}

export async function removeFromQueue(topic: string, mood: string, userId: string): Promise<void> {
  await redis.zrem(queueKey(topic, mood), userId);
}

export async function getQueueLength(topic: string, mood: string): Promise<number> {
  return redis.zcard(queueKey(topic, mood));
}

// ─── Room → session mapping ───────────────────────────────────────────────────
export async function setRoomSession(roomToken: string, sessionId: string): Promise<void> {
  await redis.setex(`room:${roomToken}`, 7200, sessionId); // 2h TTL
}

export async function getRoomSession(roomToken: string): Promise<string | null> {
  return redis.get(`room:${roomToken}`);
}
