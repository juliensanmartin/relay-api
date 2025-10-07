import Redis from "ioredis";
import pino from "pino";

const logger = pino({ name: "@relay/cache" });

let redisClient: Redis | null = null;

/**
 * Create and configure Redis client with connection handling
 */
export function createRedisClient(url?: string): Redis {
  const redisUrl = url || process.env.REDIS_URL || "redis://localhost:6379";

  if (redisClient) {
    logger.info("Reusing existing Redis client");
    return redisClient;
  }

  logger.info({ redisUrl }, "Creating Redis client");

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        return true;
      }
      return false;
    },
  });

  redisClient.on("connect", () => {
    logger.info("✅ Redis client connected");
  });

  redisClient.on("error", (err) => {
    logger.error({ err }, "❌ Redis connection error");
  });

  redisClient.on("close", () => {
    logger.warn("Redis connection closed");
  });

  redisClient.on("reconnecting", () => {
    logger.info("Redis client reconnecting...");
  });

  return redisClient;
}

/**
 * Get the existing Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error(
      "Redis client not initialized. Call createRedisClient() first."
    );
  }
  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    logger.info("Closing Redis connection");
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache-Aside Pattern Helper
 *
 * This function implements the Cache-Aside (Lazy Loading) pattern:
 * 1. Check if data exists in cache
 * 2. If cache hit: return cached data
 * 3. If cache miss: fetch from source, store in cache, return data
 *
 * @param key - Cache key
 * @param ttl - Time to live in seconds
 * @param fetchFn - Function to fetch data on cache miss
 * @param client - Redis client instance
 * @returns Cached or freshly fetched data
 */
export async function cacheAside<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>,
  client: Redis
): Promise<T> {
  try {
    // 1. Try to get from cache
    const cached = await client.get(key);

    if (cached) {
      logger.info({ key }, "Cache HIT");
      return JSON.parse(cached) as T;
    }

    // 2. Cache miss - fetch from source
    logger.info({ key }, "Cache MISS - fetching from source");
    const data = await fetchFn();

    // 3. Store in cache with TTL
    await client.setex(key, ttl, JSON.stringify(data));
    logger.info({ key, ttl }, "Data cached successfully");

    return data;
  } catch (error) {
    logger.error(
      { err: error, key },
      "Cache operation failed - falling back to source"
    );
    // On cache failure, fall back to fetching directly
    return await fetchFn();
  }
}

/**
 * Invalidate (delete) cache entries by key or pattern
 *
 * @param keyOrPattern - Single key or pattern (e.g., "posts:*")
 * @param client - Redis client instance
 */
export async function invalidateCache(
  keyOrPattern: string,
  client: Redis
): Promise<number> {
  try {
    if (keyOrPattern.includes("*")) {
      // Pattern-based deletion
      const keys = await client.keys(keyOrPattern);
      if (keys.length === 0) {
        logger.info({ pattern: keyOrPattern }, "No keys found to invalidate");
        return 0;
      }

      const deleted = await client.del(...keys);
      logger.info(
        { pattern: keyOrPattern, count: deleted },
        "Cache invalidated by pattern"
      );
      return deleted;
    } else {
      // Single key deletion
      const deleted = await client.del(keyOrPattern);
      logger.info({ key: keyOrPattern, deleted }, "Cache key invalidated");
      return deleted;
    }
  } catch (error) {
    logger.error({ err: error, keyOrPattern }, "Cache invalidation failed");
    return 0;
  }
}

/**
 * Get cache statistics (for metrics)
 */
export async function getCacheStats(client: Redis): Promise<{
  connected: boolean;
  memoryUsed?: string;
  keys?: number;
}> {
  try {
    const info = await client.info("memory");
    const dbsize = await client.dbsize();

    // Parse memory info
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1].trim() : undefined;

    return {
      connected: client.status === "ready",
      memoryUsed,
      keys: dbsize,
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to get cache stats");
    return { connected: false };
  }
}
