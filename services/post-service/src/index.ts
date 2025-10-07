// packages/post-service/src/index.ts

import "dotenv/config";
import express, { Request, Response } from "express";
import { Pool } from "pg";
import { pinoHttp } from "pino-http";
import client from "prom-client";
import {
  createRedisClient,
  cacheAside,
  invalidateCache,
  getCacheStats,
} from "@relay/cache";

const app = express();
const port = 5002;

// =================================================================
// REDIS CLIENT SETUP
// =================================================================
const redis = createRedisClient(process.env.REDIS_URL);

// =================================================================
// LOGGER MIDDLEWARE
// =================================================================
const loggerMiddleware = pinoHttp({
  genReqId: function (req, res) {
    const requestId = req.headers["x-request-id"];
    if (typeof requestId === "string") return requestId;
    if (Array.isArray(requestId) && requestId.length > 0) return requestId[0];
    return undefined as any;
  },
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) return "warn";
    if (res.statusCode >= 500 || err) return "error";
    return "info";
  },
});
app.use(loggerMiddleware);

// =================================================================
// METRICS CONFIGURATION
// =================================================================
const register = new client.Registry();
register.setDefaultLabels({ app: "relay-post-service" });
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "code"],
  buckets: [50, 100, 200, 300, 400, 500, 1000],
});
register.registerMetric(httpRequestDurationMicroseconds);

// Cache-specific metrics
const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_key"],
});
register.registerMetric(cacheHits);

const cacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_key"],
});
register.registerMetric(cacheMisses);

const cacheOperationDuration = new client.Histogram({
  name: "cache_operation_duration_ms",
  help: "Duration of cache operations in ms",
  labelNames: ["operation", "cache_key"],
  buckets: [1, 5, 10, 25, 50, 100],
});
register.registerMetric(cacheOperationDuration);

// =================================================================
// MIDDLEWARES
// =================================================================
app.use(express.json());

// Metrics middleware for all routes
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on("finish", () => {
    const route = req.route ? req.route.path : req.path;
    end({ route, code: res.statusCode, method: req.method });
  });
  next();
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
});

// =================================================================
// ROUTES
// =================================================================
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Check database connection
    await pool.query("SELECT 1");

    // Check Redis connection
    const cacheStats = await getCacheStats(redis);

    res.status(200).json({
      status: "UP",
      database: "connected",
      redis: cacheStats.connected ? "connected" : "disconnected",
      cache: cacheStats,
    });
  } catch (error) {
    req.log.error({ err: error }, "Health check failed");
    res.status(503).json({
      status: "DOWN",
      error: "Service unhealthy",
    });
  }
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// =================================================================
// POST ENDPOINTS WITH CACHING
// =================================================================

/**
 * GET /api/posts - Fetch all posts with Redis caching
 *
 * Cache Strategy: Cache-Aside pattern
 * - Cache key: "posts:all"
 * - TTL: 300 seconds (5 minutes)
 * - Invalidated on: post creation, upvote changes
 */
app.get("/api/posts", async (req: Request, res: Response) => {
  const cacheKey = "posts:all";
  const cacheTTL = 300; // 5 minutes

  try {
    const startTime = Date.now();

    // Implement Cache-Aside pattern with metrics
    const posts = await cacheAside(
      cacheKey,
      cacheTTL,
      async () => {
        // Cache miss - fetch from database
        cacheMisses.inc({ cache_key: cacheKey });

        const queryText = `
          SELECT id, title, url, created_at, username, upvote_count
          FROM posts
          ORDER BY created_at DESC;
        `;
        const result = await pool.query(queryText);
        req.log.info(
          { count: result.rows.length },
          "Posts fetched from database"
        );
        return result.rows;
      },
      redis
    );

    // Track cache operation duration
    const duration = Date.now() - startTime;
    cacheOperationDuration.observe(
      { operation: "get", cache_key: cacheKey },
      duration
    );

    // If we got here from cache, increment cache hits
    const cached = await redis.get(cacheKey);
    if (cached) {
      cacheHits.inc({ cache_key: cacheKey });
    }

    req.log.info(
      { count: posts.length, cached: !!cached },
      "Posts response ready"
    );
    res.json(posts);
  } catch (error) {
    req.log.error({ err: error }, "Error fetching posts");
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/posts - Create new post and invalidate cache
 */
app.post("/api/posts", async (req: Request, res: Response) => {
  try {
    const { title, url } = req.body;
    const userId = req.headers["x-user-id"];
    const username = req.headers["x-user-name"];

    req.log.info({ userId, title }, "Creating new post");

    if (!userId || !username) {
      return res
        .status(401)
        .json({ message: "User info not found in request headers." });
    }

    const queryText =
      "INSERT INTO posts(title, url, user_id, username) VALUES($1, $2, $3, $4) RETURNING *";
    const result = await pool.query(queryText, [title, url, userId, username]);

    // Invalidate cache after post creation
    const startTime = Date.now();
    const invalidated = await invalidateCache("posts:*", redis);
    const duration = Date.now() - startTime;

    cacheOperationDuration.observe(
      { operation: "invalidate", cache_key: "posts:*" },
      duration
    );
    req.log.info({ invalidated }, "Cache invalidated after post creation");

    req.log.info({ postId: result.rows[0].id }, "Post created successfully");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    req.log.error({ err: error }, "Error creating post");
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/posts/:postId/upvote - Add upvote and invalidate cache
 */
app.post("/api/posts/:postId/upvote", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.headers["x-user-id"];

    await client.query("BEGIN");

    const insertUpvoteText =
      "INSERT INTO upvotes(user_id, post_id) VALUES($1, $2)";
    await client.query(insertUpvoteText, [userId, postId]);

    const updatePostText =
      "UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = $1";
    await client.query(updatePostText, [postId]);

    await client.query("COMMIT");

    // Invalidate cache after upvote
    const startTime = Date.now();
    const invalidated = await invalidateCache("posts:*", redis);
    const duration = Date.now() - startTime;

    cacheOperationDuration.observe(
      { operation: "invalidate", cache_key: "posts:*" },
      duration
    );
    req.log.info(
      { postId, userId, invalidated },
      "Post upvoted successfully, cache invalidated"
    );

    res.status(201).json({ message: "Post upvoted successfully" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "You have already upvoted this post" });
    }
    req.log.error({ err: error }, "Error upvoting post");
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/posts/:postId/upvote - Remove upvote and invalidate cache
 */
app.delete("/api/posts/:postId/upvote", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.headers["x-user-id"];

    await client.query("BEGIN");

    const deleteUpvoteText =
      "DELETE FROM upvotes WHERE user_id = $1 AND post_id = $2";
    const deleteResult = await client.query(deleteUpvoteText, [userId, postId]);

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Upvote not found" });
    }

    const updatePostText =
      "UPDATE posts SET upvote_count = upvote_count - 1 WHERE id = $1";
    await client.query(updatePostText, [postId]);

    await client.query("COMMIT");

    // Invalidate cache after upvote removal
    const startTime = Date.now();
    const invalidated = await invalidateCache("posts:*", redis);
    const duration = Date.now() - startTime;

    cacheOperationDuration.observe(
      { operation: "invalidate", cache_key: "posts:*" },
      duration
    );
    req.log.info(
      { postId, userId, invalidated },
      "Upvote removed successfully, cache invalidated"
    );

    res.status(200).json({ message: "Upvote removed successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    req.log.error({ err: error }, "Error removing upvote");
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  const pino = require("pino");
  const logger = pino();
  logger.info(
    `✅ Post service with Redis caching is running on http://localhost:${port}`
  );
});
