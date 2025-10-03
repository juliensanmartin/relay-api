// packages/post-service/src/index.ts

import "dotenv/config";
import express, { Request, Response } from "express";
import { Pool } from "pg";
import { pinoHttp } from "pino-http";
import client from "prom-client"; // 👈 Import prom-client

const app = express();
const port = 5002;

// ... (your existing pinoHttp logger middleware setup)
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

// =================================================================
// MIDDLEWARES
// =================================================================
app.use(express.json());

// This middleware captures metrics for all subsequent routes
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
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP" });
});

// 👇 DEFINE THE /metrics ROUTE
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// === POSTS ENDPOINTS ===
// ... (Your existing post-related routes: /api/posts, /api/posts/:postId/upvote, etc.)
// ... they remain unchanged ...

app.post("/api/posts", async (req: Request, res: Response) => {
  try {
    const { title, url } = req.body;
    const userId = req.headers["x-user-id"];
    const username = req.headers["x-user-name"];

    req.log.info({ userId }, "Request received to fetch all posts");

    if (!userId || !username) {
      return res
        .status(401)
        .json({ message: "User info not found in request headers." });
    }

    const queryText =
      "INSERT INTO posts(title, url, user_id, username) VALUES($1, $2, $3, $4) RETURNING *";
    const result = await pool.query(queryText, [title, url, userId, username]);
    req.log.info({ result }, "Post created successfully");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    req.log.error(error, "Error creating post");
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/posts", async (req: Request, res: Response) => {
  try {
    const queryText = `
        SELECT id, title, url, created_at, username, upvote_count
        FROM posts
        ORDER BY created_at DESC;
      `;
    const result = await pool.query(queryText);
    req.log.info({ result }, "Posts fetched successfully");
    res.json(result.rows);
  } catch (error) {
    req.log.error(error, "Error fetching posts");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add an upvote
app.post("/api/posts/:postId/upvote", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.headers["x-user-id"];

    await client.query("BEGIN"); // Start transaction

    const insertUpvoteText =
      "INSERT INTO upvotes(user_id, post_id) VALUES($1, $2)";
    await client.query(insertUpvoteText, [userId, postId]);

    const updatePostText =
      "UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = $1";
    await client.query(updatePostText, [postId]);

    await client.query("COMMIT"); // Commit transaction
    req.log.info({ postId, userId }, "Post upvoted successfully");
    res.status(201).json({ message: "Post upvoted successfully" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      // Handles duplicate upvote error
      return res
        .status(409)
        .json({ message: "You have already upvoted this post" });
    }
    req.log.error(error, "Error upvoting post");
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
});

// Remove an upvote
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
    req.log.info({ postId, userId }, "Upvote removed successfully");
    res.status(200).json({ message: "Upvote removed successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    req.log.error(error, "Error removing upvote");
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  const pino = require("pino");
  const logger = pino();
  logger.info(
    `✅ Post service (latest version) is running on http://localhost:${port}`
  );
});
