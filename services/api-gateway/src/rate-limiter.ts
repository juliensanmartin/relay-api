import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "@relay/cache";
import pino from "pino";
import { Counter, Histogram } from "prom-client";

const logger = pino({ name: "rate-limiter" });

// =================================================================
// PROMETHEUS METRICS
// =================================================================
const rateLimitCounter = new Counter({
  name: "rate_limit_requests_total",
  help: "Total number of rate limit checks",
  labelNames: ["identifier_type", "endpoint", "result"],
});

const rateLimitBlockedCounter = new Counter({
  name: "rate_limit_blocked_total",
  help: "Total number of requests blocked by rate limiter",
  labelNames: ["identifier_type", "endpoint"],
});

const rateLimitHistogram = new Histogram({
  name: "rate_limit_tokens_remaining",
  help: "Histogram of remaining tokens when requests are made",
  labelNames: ["identifier_type", "endpoint"],
  buckets: [0, 10, 25, 50, 75, 100, 150, 200],
});

// =================================================================
// TOKEN BUCKET CONFIGURATION
// =================================================================
export interface RateLimitConfig {
  maxTokens: number; // Maximum tokens in the bucket
  refillRate: number; // Tokens added per second
  windowSeconds: number; // Time window for rate limiting
}

export interface EndpointRateLimits {
  perUser?: RateLimitConfig;
  perIP?: RateLimitConfig;
}

// Default configurations
export const DEFAULT_RATE_LIMITS: Record<string, EndpointRateLimits> = {
  // Authentication endpoints (stricter)
  "/api/auth/login": {
    perIP: { maxTokens: 5, refillRate: 1, windowSeconds: 300 }, // 5 attempts per 5 minutes per IP
  },
  "/api/auth/register": {
    perIP: { maxTokens: 3, refillRate: 1, windowSeconds: 3600 }, // 3 registrations per hour per IP
  },

  // Post creation (authenticated users)
  "/api/posts": {
    perUser: { maxTokens: 10, refillRate: 2, windowSeconds: 60 }, // 10 posts per minute, refill 2/sec
    perIP: { maxTokens: 20, refillRate: 5, windowSeconds: 60 }, // 20 posts per minute per IP
  },

  // Upvoting (authenticated users)
  "/api/posts/:postId/upvote": {
    perUser: { maxTokens: 30, refillRate: 10, windowSeconds: 60 }, // 30 upvotes per minute
  },

  // Default for all other endpoints
  default: {
    perUser: { maxTokens: 100, refillRate: 50, windowSeconds: 60 }, // 100 requests per minute
    perIP: { maxTokens: 200, refillRate: 100, windowSeconds: 60 }, // 200 requests per minute per IP
  },
};

// =================================================================
// TOKEN BUCKET IMPLEMENTATION
// =================================================================

/**
 * Token Bucket Algorithm with Redis
 *
 * The token bucket algorithm works as follows:
 * 1. Each identifier (user or IP) has a bucket with a maximum capacity
 * 2. Tokens are consumed for each request (1 token per request)
 * 3. Tokens refill at a constant rate over time
 * 4. If no tokens are available, the request is rate limited
 *
 * Redis stores: { tokens, lastRefill }
 */
class TokenBucket {
  private redisClient = getRedisClient();

  /**
   * Try to consume a token from the bucket
   * Returns true if request is allowed, false if rate limited
   */
  async consume(
    identifier: string,
    config: RateLimitConfig
  ): Promise<{
    allowed: boolean;
    tokensRemaining: number;
    retryAfterSeconds?: number;
  }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now() / 1000; // Current time in seconds

    try {
      // Use Lua script for atomic operations (prevents race conditions)
      const result = await this.redisClient.eval(
        `
        local key = KEYS[1]
        local max_tokens = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local window_seconds = tonumber(ARGV[4])

        -- Get current bucket state
        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1])
        local last_refill = tonumber(bucket[2])

        -- Initialize bucket if it doesn't exist
        if not tokens then
          tokens = max_tokens
          last_refill = now
        end

        -- Calculate tokens to add based on time elapsed
        local elapsed = now - last_refill
        local tokens_to_add = elapsed * refill_rate
        tokens = math.min(max_tokens, tokens + tokens_to_add)

        -- Try to consume 1 token
        local allowed = 0
        local retry_after = 0
        
        if tokens >= 1 then
          tokens = tokens - 1
          allowed = 1
        else
          -- Calculate when next token will be available
          retry_after = math.ceil((1 - tokens) / refill_rate)
        end

        -- Update bucket state
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
        redis.call('EXPIRE', key, window_seconds)

        return {allowed, tokens, retry_after}
        `,
        1, // Number of keys
        key, // KEYS[1]
        config.maxTokens, // ARGV[1]
        config.refillRate, // ARGV[2]
        now, // ARGV[3]
        config.windowSeconds // ARGV[4]
      );

      const [allowed, tokensRemaining, retryAfter] = result as number[];

      return {
        allowed: allowed === 1,
        tokensRemaining: Math.floor(tokensRemaining),
        retryAfterSeconds: retryAfter > 0 ? retryAfter : undefined,
      };
    } catch (error) {
      logger.error({ err: error, identifier }, "Rate limiter error");
      // Fail open: allow request if Redis is unavailable (graceful degradation)
      return { allowed: true, tokensRemaining: -1 };
    }
  }

  /**
   * Get current token count (for debugging/monitoring)
   */
  async getTokens(identifier: string): Promise<number | null> {
    const key = `rate_limit:${identifier}`;
    try {
      const tokens = await this.redisClient.hget(key, "tokens");
      return tokens ? parseFloat(tokens) : null;
    } catch (error) {
      logger.error({ err: error, identifier }, "Failed to get tokens");
      return null;
    }
  }
}

// =================================================================
// RATE LIMIT MIDDLEWARE
// =================================================================

/**
 * Get rate limit configuration for a specific endpoint
 */
function getEndpointConfig(path: string): EndpointRateLimits {
  // Check for exact match
  if (DEFAULT_RATE_LIMITS[path]) {
    return DEFAULT_RATE_LIMITS[path];
  }

  // Check for pattern match (e.g., /api/posts/:postId/upvote)
  for (const [pattern, config] of Object.entries(DEFAULT_RATE_LIMITS)) {
    if (pattern !== "default" && matchRoute(path, pattern)) {
      return config;
    }
  }

  // Return default configuration
  return DEFAULT_RATE_LIMITS.default;
}

/**
 * Simple route pattern matcher
 * Matches /api/posts/123/upvote with /api/posts/:postId/upvote
 */
function matchRoute(actualPath: string, pattern: string): boolean {
  const actualParts = actualPath.split("/");
  const patternParts = pattern.split("/");

  if (actualParts.length !== patternParts.length) {
    return false;
  }

  return patternParts.every((part, i) => {
    return part.startsWith(":") || part === actualParts[i];
  });
}

/**
 * Get client IP address from request
 * Handles various proxy headers
 */
function getClientIP(req: Request): string {
  // Check common proxy headers
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
    const ips = (forwarded as string).split(",");
    return ips[0].trim();
  }

  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return realIP as string;
  }

  // Fallback to socket IP
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware() {
  const bucket = new TokenBucket();

  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const config = getEndpointConfig(path);
    const clientIP = getClientIP(req);

    // Extract user ID from JWT if available (set by authenticateToken middleware)
    const userId = (req as any).user?.userId;

    const checks: Array<{
      identifier: string;
      identifierType: "user" | "ip";
      config: RateLimitConfig;
    }> = [];

    // Add per-user rate limit check if applicable
    if (userId && config.perUser) {
      checks.push({
        identifier: `user:${userId}:${path}`,
        identifierType: "user",
        config: config.perUser,
      });
    }

    // Add per-IP rate limit check if applicable
    if (config.perIP) {
      checks.push({
        identifier: `ip:${clientIP}:${path}`,
        identifierType: "ip",
        config: config.perIP,
      });
    }

    // If no checks configured, allow request
    if (checks.length === 0) {
      return next();
    }

    // Execute all rate limit checks
    for (const check of checks) {
      const result = await bucket.consume(check.identifier, check.config);

      // Record metrics
      rateLimitCounter.inc({
        identifier_type: check.identifierType,
        endpoint: path,
        result: result.allowed ? "allowed" : "blocked",
      });

      if (result.tokensRemaining >= 0) {
        rateLimitHistogram.observe(
          {
            identifier_type: check.identifierType,
            endpoint: path,
          },
          result.tokensRemaining
        );
      }

      // If rate limited, block request
      if (!result.allowed) {
        rateLimitBlockedCounter.inc({
          identifier_type: check.identifierType,
          endpoint: path,
        });

        logger.warn(
          {
            identifier: check.identifier,
            identifierType: check.identifierType,
            path,
            clientIP,
            userId,
          },
          "Rate limit exceeded"
        );

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", check.config.maxTokens);
        res.setHeader("X-RateLimit-Remaining", 0);
        res.setHeader(
          "X-RateLimit-Reset",
          Date.now() + (result.retryAfterSeconds || 1) * 1000
        );

        if (result.retryAfterSeconds) {
          res.setHeader("Retry-After", result.retryAfterSeconds);
        }

        return res.status(429).json({
          error: "Too many requests",
          message: `Rate limit exceeded for ${check.identifierType}. Please try again later.`,
          retryAfter: result.retryAfterSeconds,
        });
      }

      // Set rate limit info headers (for the strictest limit)
      res.setHeader("X-RateLimit-Limit", check.config.maxTokens);
      res.setHeader("X-RateLimit-Remaining", result.tokensRemaining);
    }

    // All checks passed, allow request
    next();
  };
}

export { TokenBucket };
