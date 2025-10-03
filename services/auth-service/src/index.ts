import "dotenv/config";
import express, { Request, Response } from "express";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import amqp from "amqplib";
import { pinoHttp } from "pino-http";
import client from "prom-client"; // 👈 Import

const app = express();
const port = 5001;

// =================================================================
// METRICS CONFIGURATION
// =================================================================
const register = new client.Registry();
register.setDefaultLabels({ app: "relay-auth-service" });
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "code"],
  buckets: [50, 100, 200, 300, 400, 500],
});
register.registerMetric(httpRequestDurationMicroseconds);

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

// CORRECT: Fully configure the database pool from environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
});

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";
app.use(express.json());

// RabbitMQ connection and channel
let channel: amqp.Channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost"
    );
    channel = await connection.createChannel();
    await channel.assertQueue("user_registered_queue", { durable: true });
    console.log("✅ Connected to RabbitMQ");
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error);
  }
}

// 👇 Add the /metrics route
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP" });
});

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    req.log.info("Attempting to insert user into DB...");
    const queryText =
      "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id, username";
    const queryValues = [username, email, passwordHash];

    const result = await pool.query(queryText, queryValues);
    const newUser = result.rows[0];
    req.log.info({ userId: newUser.id }, "User inserted successfully");

    if (channel) {
      const message = {
        userId: newUser.id,
        email: email,
        username: newUser.username,
      };
      channel.sendToQueue(
        "user_registered_queue",
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
      req.log.info({ email }, "Sent user registration message");
    }

    res
      .status(201)
      .json({ message: "User created successfully!", user: newUser });
  } catch (error: any) {
    req.log.error(error, "Error creating user");
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Email or username already exists." });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    req.log.info({ userId: user.id }, "User logged in successfully");
    res.json({ message: "Logged in successfully!", token });
  } catch (error) {
    req.log.error(error, "Error logging in");
    res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(port, () => {
  const pino = require("pino");
  const logger = pino();
  logger.info(`✅ Auth service is running on http://localhost:${port}`);
  connectRabbitMQ();
});
