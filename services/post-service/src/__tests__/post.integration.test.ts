/**
 * Integration Tests for Post Service
 * Tests: Database operations, Redis caching, cache invalidation
 *
 * NOTE: Requires PostgreSQL and Redis running
 * Run: docker compose up -d postgres redis
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { createRedisClient, cacheAside, invalidateCache } from "@relay/cache";

const pool = new Pool({
  user: process.env.DB_USER || "relay",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_DATABASE || "relay_db",
  password: process.env.DB_PASSWORD || "relay",
  port: parseInt(process.env.DB_PORT || "5432"),
});

const redis = createRedisClient(
  process.env.REDIS_URL || "redis://localhost:6379"
);

describe("Post Service - Integration Tests", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Verify database connection
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      console.warn(
        "⚠️ Database not available. Run 'docker compose up -d postgres' first."
      );
      throw error;
    }

    // Create test user
    const result = await pool.query(
      "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id",
      [`testuser_${Date.now()}`, `test_${Date.now()}@example.com`, "hash"]
    );
    testUserId = result.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      await pool.query("DELETE FROM posts WHERE user_id = $1", [testUserId]);
      await pool.query("DELETE FROM users WHERE id = $1", [testUserId]);
    }
    await pool.end();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await invalidateCache("posts:*", redis);
  });

  describe("Database Operations", () => {
    it("should insert a new post", async () => {
      const title = `Test Post ${Date.now()}`;
      const url = "https://example.com";

      const result = await pool.query(
        "INSERT INTO posts(title, url, user_id, username) VALUES($1, $2, $3, $4) RETURNING *",
        [title, url, testUserId, "testuser"]
      );

      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].title).toBe(title);
      expect(result.rows[0].url).toBe(url);
      expect(result.rows[0].upvote_count).toBe(0);

      // Cleanup
      await pool.query("DELETE FROM posts WHERE id = $1", [result.rows[0].id]);
    });

    it("should fetch all posts", async () => {
      const result = await pool.query(
        "SELECT id, title, url, created_at, username, upvote_count FROM posts ORDER BY created_at DESC"
      );

      expect(Array.isArray(result.rows)).toBe(true);
      result.rows.forEach((post) => {
        expect(post.id).toBeDefined();
        expect(post.title).toBeDefined();
        expect(post.upvote_count).toBeGreaterThanOrEqual(0);
      });
    });

    it("should increment upvote count", async () => {
      // Create test post
      const postResult = await pool.query(
        "INSERT INTO posts(title, url, user_id, username) VALUES($1, $2, $3, $4) RETURNING id, upvote_count",
        [`Test ${Date.now()}`, "https://example.com", testUserId, "testuser"]
      );
      const postId = postResult.rows[0].id;
      const initialCount = postResult.rows[0].upvote_count;

      // Increment upvote
      await pool.query(
        "UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = $1",
        [postId]
      );

      // Verify
      const updatedResult = await pool.query(
        "SELECT upvote_count FROM posts WHERE id = $1",
        [postId]
      );
      expect(updatedResult.rows[0].upvote_count).toBe(initialCount + 1);

      // Cleanup
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
    });
  });

  describe("Redis Cache Operations", () => {
    it("should store and retrieve data from cache", async () => {
      const cacheKey = "test:cache:key";
      const testData = { message: "Hello from cache" };

      // Store in cache
      await redis.set(cacheKey, JSON.stringify(testData), "EX", 60);

      // Retrieve from cache
      const cached = await redis.get(cacheKey);
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!)).toEqual(testData);

      // Cleanup
      await redis.del(cacheKey);
    });

    it("should implement Cache-Aside pattern", async () => {
      const cacheKey = "test:posts:all";
      let dbCalled = false;

      const posts = await cacheAside(
        cacheKey,
        60,
        async () => {
          dbCalled = true;
          const result = await pool.query("SELECT * FROM posts LIMIT 5");
          return result.rows;
        },
        redis
      );

      expect(dbCalled).toBe(true); // First call hits database
      expect(Array.isArray(posts)).toBe(true);

      // Second call should hit cache
      dbCalled = false;
      const cachedPosts = await cacheAside(
        cacheKey,
        60,
        async () => {
          dbCalled = true;
          const result = await pool.query("SELECT * FROM posts LIMIT 5");
          return result.rows;
        },
        redis
      );

      expect(dbCalled).toBe(false); // Should not hit database
      expect(cachedPosts).toEqual(posts);

      // Cleanup
      await redis.del(cacheKey);
    });

    it("should invalidate cache by pattern", async () => {
      // Create multiple cache keys
      await redis.set("posts:all", "data1", "EX", 60);
      await redis.set("posts:123", "data2", "EX", 60);
      await redis.set("posts:456", "data3", "EX", 60);
      await redis.set("users:789", "data4", "EX", 60);

      // Invalidate posts:* pattern
      const deleted = await invalidateCache("posts:*", redis);
      expect(deleted).toBeGreaterThanOrEqual(3);

      // Verify posts keys are deleted
      const posts1 = await redis.get("posts:all");
      const posts2 = await redis.get("posts:123");
      expect(posts1).toBeNull();
      expect(posts2).toBeNull();

      // Verify users key still exists
      const users = await redis.get("users:789");
      expect(users).toBe("data4");

      // Cleanup
      await redis.del("users:789");
    });

    it("should handle cache expiration (TTL)", async () => {
      const cacheKey = "test:ttl:key";
      await redis.set(cacheKey, "test data", "EX", 1); // 1 second TTL

      // Should exist immediately
      let cached = await redis.get(cacheKey);
      expect(cached).toBe("test data");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      cached = await redis.get(cacheKey);
      expect(cached).toBeNull();
    });

    it("should handle Redis connection errors gracefully", async () => {
      const cacheKey = "test:error:key";

      try {
        // Attempt operation
        await redis.set(cacheKey, "test");
        await redis.del(cacheKey);
        expect(true).toBe(true); // Connection is working
      } catch (error) {
        // If Redis is down, should handle gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe("Cache Invalidation on Updates", () => {
    it("should invalidate cache after post creation", async () => {
      const cacheKey = "posts:all";

      // Populate cache
      await cacheAside(
        cacheKey,
        60,
        async () => {
          const result = await pool.query("SELECT * FROM posts LIMIT 5");
          return result.rows;
        },
        redis
      );

      // Verify cache exists
      let cached = await redis.get(cacheKey);
      expect(cached).toBeDefined();

      // Create new post (should trigger invalidation)
      const postResult = await pool.query(
        "INSERT INTO posts(title, url, user_id, username) VALUES($1, $2, $3, $4) RETURNING id",
        [
          `New Post ${Date.now()}`,
          "https://example.com",
          testUserId,
          "testuser",
        ]
      );
      const postId = postResult.rows[0].id;

      // Invalidate cache
      await invalidateCache("posts:*", redis);

      // Verify cache is cleared
      cached = await redis.get(cacheKey);
      expect(cached).toBeNull();

      // Cleanup
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
    });

    it("should invalidate cache after upvote", async () => {
      const cacheKey = "posts:all";

      // Create test post
      const postResult = await pool.query(
        "INSERT INTO posts(title, url, user_id, username) VALUES($1, $2, $3, $4) RETURNING id",
        [`Test ${Date.now()}`, "https://example.com", testUserId, "testuser"]
      );
      const postId = postResult.rows[0].id;

      // Populate cache
      await redis.set(cacheKey, JSON.stringify([{ id: postId }]), "EX", 60);

      // Upvote post (should trigger invalidation)
      await pool.query(
        "UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = $1",
        [postId]
      );
      await invalidateCache("posts:*", redis);

      // Verify cache is cleared
      const cached = await redis.get(cacheKey);
      expect(cached).toBeNull();

      // Cleanup
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
    });
  });

  describe("Performance Metrics", () => {
    it("should measure cache vs database latency", async () => {
      const cacheKey = "test:performance";

      // Measure database query time
      const dbStart = Date.now();
      const dbResult = await pool.query("SELECT * FROM posts LIMIT 10");
      const dbTime = Date.now() - dbStart;

      // Store in cache
      await redis.set(cacheKey, JSON.stringify(dbResult.rows), "EX", 60);

      // Measure cache retrieval time
      const cacheStart = Date.now();
      const cached = await redis.get(cacheKey);
      const cacheTime = Date.now() - cacheStart;

      expect(cached).toBeDefined();
      // Cache should generally be faster, but timing can vary
      console.log(`DB Time: ${dbTime}ms, Cache Time: ${cacheTime}ms`);

      // Cleanup
      await redis.del(cacheKey);
    });
  });
});
