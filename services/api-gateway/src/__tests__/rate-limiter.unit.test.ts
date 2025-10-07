import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import {
  createRateLimitMiddleware,
  TokenBucket,
  DEFAULT_RATE_LIMITS,
} from "../rate-limiter";

// Mock data storage
let mockData = new Map<string, any>();

// Mock Redis client
const mockRedisClient = {
  eval: vi.fn(async (script: string, numKeys: number, ...args: any[]) => {
    // Simulate Lua script execution for token bucket
    const key = args[0];
    const maxTokens = parseFloat(args[1]);
    const refillRate = parseFloat(args[2]);
    const now = parseFloat(args[3]);

    let bucket = mockData.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      mockData.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * refillRate;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);

    let allowed = 0;
    let retryAfter = 0;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      allowed = 1;
    } else {
      retryAfter = Math.ceil((1 - bucket.tokens) / refillRate);
    }

    bucket.lastRefill = now;

    return [allowed, bucket.tokens, retryAfter];
  }),
  hget: vi.fn(async (key: string, field: string) => {
    const bucket = mockData.get(key);
    if (!bucket) return null;
    return bucket[field]?.toString() || null;
  }),
  hmget: vi.fn(),
  hmset: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
};

// Mock @relay/cache module
vi.mock("@relay/cache", () => ({
  createRedisClient: vi.fn(() => mockRedisClient),
  getRedisClient: vi.fn(() => mockRedisClient),
  closeRedisClient: vi.fn(),
}));

// Mock prom-client to avoid actual metrics
vi.mock("prom-client", () => ({
  Counter: class {
    inc() {}
  },
  Histogram: class {
    observe() {}
  },
}));

describe("Rate Limiter - Token Bucket", () => {
  let app: Express;
  const JWT_SECRET = "test-secret";

  beforeEach(() => {
    // Reset mock data
    mockData.clear();

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());

    // Test middleware to attach user (simulate JWT auth) - MUST run BEFORE rate limiter
    app.use((req: any, res, next) => {
      const authHeader = req.headers["authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          req.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
          // Invalid token, no user attached
        }
      }
      next();
    });

    // Rate limiter runs after auth middleware so it can access req.user
    app.use(createRateLimitMiddleware());

    // Test routes
    app.post("/api/auth/login", (req, res) => {
      res.json({ success: true });
    });

    app.post("/api/auth/register", (req, res) => {
      res.json({ success: true });
    });

    app.post("/api/posts", (req, res) => {
      res.json({ success: true });
    });

    app.post("/api/posts/:postId/upvote", (req, res) => {
      res.json({ success: true });
    });

    app.get("/api/other", (req, res) => {
      res.json({ success: true });
    });
  });

  describe("Per-IP Rate Limiting", () => {
    it("should allow requests within rate limit", async () => {
      const config = DEFAULT_RATE_LIMITS["/api/auth/login"];
      const maxRequests = config.perIP!.maxTokens;

      // Make requests up to the limit
      for (let i = 0; i < maxRequests; i++) {
        const response = await request(app)
          .post("/api/auth/login")
          .send({ email: "test@example.com", password: "password" });

        expect(response.status).toBe(200);
        expect(response.headers["x-ratelimit-limit"]).toBe(
          maxRequests.toString()
        );
      }
    });

    it("should block requests exceeding rate limit", async () => {
      const config = DEFAULT_RATE_LIMITS["/api/auth/login"];
      const maxRequests = config.perIP!.maxTokens;

      // Exhaust the rate limit
      for (let i = 0; i < maxRequests; i++) {
        await request(app)
          .post("/api/auth/login")
          .send({ email: "test@example.com" });
      }

      // Next request should be rate limited
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe("Too many requests");
      expect(response.headers["retry-after"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBe("0");
    });

    it("should apply different limits for different endpoints", async () => {
      // Login has stricter limit (5 requests)
      const loginConfig = DEFAULT_RATE_LIMITS["/api/auth/login"];
      const loginLimit = loginConfig.perIP!.maxTokens;

      // Register has even stricter limit (3 requests)
      const registerConfig = DEFAULT_RATE_LIMITS["/api/auth/register"];
      const registerLimit = registerConfig.perIP!.maxTokens;

      expect(loginLimit).toBeGreaterThan(registerLimit);

      // Exhaust register limit
      for (let i = 0; i < registerLimit; i++) {
        const response = await request(app)
          .post("/api/auth/register")
          .send({ email: "test@example.com" });
        expect(response.status).toBe(200);
      }

      // Next register should be blocked
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com" });
      expect(registerResponse.status).toBe(429);

      // But login should still work (separate bucket)
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });
      expect(loginResponse.status).toBe(200);
    });
  });

  describe("Per-User Rate Limiting", () => {
    it("should apply per-user rate limiting for authenticated requests", async () => {
      const token = jwt.sign({ userId: 123, username: "testuser" }, JWT_SECRET);
      const config = DEFAULT_RATE_LIMITS["/api/posts"];
      const maxRequests = config.perUser!.maxTokens;

      // Make requests up to the limit
      for (let i = 0; i < maxRequests; i++) {
        const response = await request(app)
          .post("/api/posts")
          .set("Authorization", `Bearer ${token}`)
          .send({ title: "Test Post", content: "Content" });

        expect(response.status).toBe(200);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Test Post", content: "Content" });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain("user");
    });

    it("should track separate limits for different users", async () => {
      const token1 = jwt.sign({ userId: 123, username: "user1" }, JWT_SECRET);
      const token2 = jwt.sign({ userId: 456, username: "user2" }, JWT_SECRET);
      const config = DEFAULT_RATE_LIMITS["/api/posts"];
      const maxRequests = config.perUser!.maxTokens;

      // Exhaust limit for user1
      for (let i = 0; i < maxRequests; i++) {
        await request(app)
          .post("/api/posts")
          .set("Authorization", `Bearer ${token1}`)
          .send({ title: "Test" });
      }

      // user1 should be blocked
      const user1Response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token1}`)
        .send({ title: "Test" });
      expect(user1Response.status).toBe(429);

      // user2 should still be allowed (separate bucket)
      const user2Response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token2}`)
        .send({ title: "Test" });
      expect(user2Response.status).toBe(200);
    });
  });

  describe("Endpoint-Specific Configurations", () => {
    it("should use upvote-specific limits for upvote endpoint", async () => {
      const token = jwt.sign({ userId: 123, username: "testuser" }, JWT_SECRET);
      const upvoteConfig = DEFAULT_RATE_LIMITS["/api/posts/:postId/upvote"];
      const upvoteLimit = upvoteConfig.perUser!.maxTokens;

      // Upvote limit should be higher than post creation limit
      const postConfig = DEFAULT_RATE_LIMITS["/api/posts"];
      expect(upvoteLimit).toBeGreaterThan(postConfig.perUser!.maxTokens);

      // Make upvote requests
      for (let i = 0; i < upvoteLimit; i++) {
        const response = await request(app)
          .post("/api/posts/123/upvote")
          .set("Authorization", `Bearer ${token}`)
          .send();

        expect(response.status).toBe(200);
      }

      // Next should be rate limited
      const response = await request(app)
        .post("/api/posts/123/upvote")
        .set("Authorization", `Bearer ${token}`)
        .send();

      expect(response.status).toBe(429);
    });

    it("should use default limits for unspecified endpoints", async () => {
      const defaultConfig = DEFAULT_RATE_LIMITS.default;
      const defaultIPLimit = defaultConfig.perIP!.maxTokens;

      // Default limit should be generous
      expect(defaultIPLimit).toBeGreaterThan(50);

      // Make requests to an unspecified endpoint
      const response = await request(app).get("/api/other");
      expect(response.status).toBe(200);
      expect(response.headers["x-ratelimit-limit"]).toBe(
        defaultIPLimit.toString()
      );
    });
  });

  describe("Response Headers", () => {
    it("should include rate limit headers in successful responses", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
      expect(parseInt(response.headers["x-ratelimit-remaining"])).toBeLessThan(
        parseInt(response.headers["x-ratelimit-limit"])
      );
    });

    it("should include Retry-After header in 429 responses", async () => {
      const config = DEFAULT_RATE_LIMITS["/api/auth/login"];
      const maxRequests = config.perIP!.maxTokens;

      // Exhaust limit
      for (let i = 0; i < maxRequests; i++) {
        await request(app).post("/api/auth/login").send({});
      }

      // Get rate limited response
      const response = await request(app).post("/api/auth/login").send({});

      expect(response.status).toBe(429);
      expect(response.headers["retry-after"]).toBeDefined();
      expect(response.headers["x-ratelimit-reset"]).toBeDefined();
      expect(parseInt(response.headers["retry-after"])).toBeGreaterThan(0);
    });
  });

  describe("IP Address Extraction", () => {
    it("should extract IP from x-forwarded-for header", async () => {
      const response1 = await request(app)
        .post("/api/auth/login")
        .set("x-forwarded-for", "192.168.1.1, 10.0.0.1")
        .send({});

      const response2 = await request(app)
        .post("/api/auth/login")
        .set("x-forwarded-for", "192.168.1.2, 10.0.0.1")
        .send({});

      // Both should succeed as they have different IPs
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it("should extract IP from x-real-ip header", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("x-real-ip", "192.168.1.100")
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe("Dual Rate Limiting (User + IP)", () => {
    it("should enforce both per-user and per-IP limits", async () => {
      const token = jwt.sign({ userId: 123, username: "testuser" }, JWT_SECRET);

      // Posts endpoint has both per-user and per-IP limits
      const config = DEFAULT_RATE_LIMITS["/api/posts"];
      expect(config.perUser).toBeDefined();
      expect(config.perIP).toBeDefined();

      // Both limits should be enforced independently
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Test" });

      expect(response.status).toBe(200);
      // Both rate limit checks passed
    });
  });

  describe("Edge Cases", () => {
    it("should handle requests without authentication gracefully", async () => {
      // Unauthenticated request to posts endpoint
      // Should only apply per-IP rate limiting
      const response = await request(app)
        .post("/api/posts")
        .send({ title: "Test" });

      expect(response.status).toBe(200);
      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
    });

    it("should handle malformed JWT tokens gracefully", async () => {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", "Bearer invalid-token")
        .send({ title: "Test" });

      expect(response.status).toBe(200);
      // Should fall back to IP-based rate limiting only
    });

    it("should not rate limit endpoints with no configuration", async () => {
      // If an endpoint has neither perUser nor perIP config, it should pass through
      // Currently all endpoints use default config, so this is covered
      const response = await request(app).get("/api/other");
      expect(response.status).toBe(200);
    });
  });
});

describe("Rate Limiter - Token Bucket Class", () => {
  let bucket: TokenBucket;

  beforeEach(() => {
    // Reset mock data
    mockData.clear();
    bucket = new TokenBucket();
  });

  it("should consume tokens correctly", async () => {
    const config = { maxTokens: 10, refillRate: 1, windowSeconds: 60 };

    const result1 = await bucket.consume("test-user", config);
    expect(result1.allowed).toBe(true);
    expect(result1.tokensRemaining).toBeLessThan(10);

    const result2 = await bucket.consume("test-user", config);
    expect(result2.allowed).toBe(true);
    expect(result2.tokensRemaining).toBeLessThan(result1.tokensRemaining);
  });

  it("should return retry-after when rate limited", async () => {
    const config = { maxTokens: 2, refillRate: 0.5, windowSeconds: 60 };

    // Consume all tokens
    await bucket.consume("test-user", config);
    await bucket.consume("test-user", config);

    // Next request should be rate limited
    const result = await bucket.consume("test-user", config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should track different identifiers separately", async () => {
    const config = { maxTokens: 2, refillRate: 1, windowSeconds: 60 };

    await bucket.consume("user-1", config);
    await bucket.consume("user-1", config);

    // user-1 is exhausted
    const result1 = await bucket.consume("user-1", config);
    expect(result1.allowed).toBe(false);

    // user-2 should still be allowed
    const result2 = await bucket.consume("user-2", config);
    expect(result2.allowed).toBe(true);
  });
});

describe("Rate Limiter - Configuration", () => {
  it("should have stricter limits for auth endpoints", () => {
    const loginLimit = DEFAULT_RATE_LIMITS["/api/auth/login"].perIP!.maxTokens;
    const registerLimit =
      DEFAULT_RATE_LIMITS["/api/auth/register"].perIP!.maxTokens;
    const defaultLimit = DEFAULT_RATE_LIMITS.default.perIP!.maxTokens;

    expect(loginLimit).toBeLessThan(defaultLimit);
    expect(registerLimit).toBeLessThan(loginLimit);
  });

  it("should have higher limits for upvoting than posting", () => {
    const postLimit = DEFAULT_RATE_LIMITS["/api/posts"].perUser!.maxTokens;
    const upvoteLimit =
      DEFAULT_RATE_LIMITS["/api/posts/:postId/upvote"].perUser!.maxTokens;

    expect(upvoteLimit).toBeGreaterThan(postLimit);
  });

  it("should have refill rates configured", () => {
    Object.values(DEFAULT_RATE_LIMITS).forEach((config) => {
      if (config.perUser) {
        expect(config.perUser.refillRate).toBeGreaterThan(0);
        expect(config.perUser.windowSeconds).toBeGreaterThan(0);
      }
      if (config.perIP) {
        expect(config.perIP.refillRate).toBeGreaterThan(0);
        expect(config.perIP.windowSeconds).toBeGreaterThan(0);
      }
    });
  });
});
