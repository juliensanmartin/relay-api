import "dotenv/config";
import express, { Request, Response } from "express";
import { Pool } from "pg";
import { pinoHttp } from "pino-http";

const app = express();
const port = 5002;

// --- Logger Middleware ---
// This configuration prioritizes the incoming request ID from the API Gateway
const loggerMiddleware = pinoHttp({
  // 👇 This is the key change
  genReqId: function (req, res) {
    // Use the id from the request header if present
    const requestId = req.headers["x-request-id"];
    if (typeof requestId === "string") {
      return requestId;
    }
    // If header is array, use first value; otherwise let pino generate one
    if (Array.isArray(requestId) && requestId.length > 0) {
      return requestId[0];
    }
    // Return undefined to let pino-http generate a default ID
    return undefined as any;
  },
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) return "warn";
    if (res.statusCode >= 500 || err) return "error";
    return "info";
  },
});
app.use(loggerMiddleware);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
});

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP" });
});

// === POSTS ENDPOINTS ===

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
