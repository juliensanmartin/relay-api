import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { randomUUID } from "crypto";
import postServiceBreaker from "./circuit-breaker";
import apiClient from "./apiClient";

const app = express();
const port = process.env.PORT || 5000;

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:5001";
const POST_SERVICE_URL =
  process.env.POST_SERVICE_URL || "http://localhost:5002";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

// =================================================================
// LOGGER MIDDLEWARE
// =================================================================
const loggerMiddleware = pinoHttp({
  // Use a custom generator for request IDs
  genReqId: function (req, res) {
    const existingId = req.id ?? req.headers["x-request-id"];
    if (existingId) return existingId;
    const id = randomUUID();
    res.setHeader("X-Request-Id", id); // Set it on the response header
    return id;
  },
  // Customize log levels for different status codes
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) return "warn";
    if (res.statusCode >= 500 || err) return "error";
    return "info";
  },
});
app.use(loggerMiddleware);

app.use(express.json({ limit: "50mb" }));
app.use(cors());

// Custom Request interface to include user payload
interface AuthenticatedRequest extends Request {
  user?: any;
}

// =================================================================
// AUTHENTICATION MIDDLEWARE
// =================================================================
const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.sendStatus(401); // Unauthorized
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.sendStatus(403); // Token is not valid
    }
    req.user = user; // Attach user payload to the request
    next();
  });
};

// =================================================================
// ROUTING
// =================================================================

// Auth routes are public. No middleware needed.
app.all("/api/auth/*", async (req: Request, res: Response) => {
  req.log.info("Forwarding request to Auth Service");
  try {
    const response = await apiClient({
      method: req.method,
      url: `${AUTH_SERVICE_URL}${req.originalUrl.replace("/api/auth", "/api")}`,
      data: req.body,
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    req.log.error(error, "Error forwarding request to Auth Service");
    res.status(error.response?.status || 500).json(error.response?.data || {});
  }
});

// GET /api/posts is public (no authentication required)
app.get("/api/posts", async (req: Request, res: Response) => {
  req.log.info("Forwarding GET /api/posts request to Post Service (public)");
  try {
    const response = await postServiceBreaker.fire({
      method: req.method,
      url: `${POST_SERVICE_URL}${req.originalUrl}`,
      data: req.body,
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || {});
  }
});

// All other post routes are protected (POST /api/posts, upvotes, etc.)
// Note: Using a more specific pattern to avoid catching the GET /api/posts above
app.post(
  "/api/posts",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    req.log.info(
      `Forwarding POST /api/posts request to Post Service for user: ${req.user.userId}`
    );
    try {
      const response = await postServiceBreaker.fire({
        method: req.method,
        url: `${POST_SERVICE_URL}${req.originalUrl}`,
        data: req.body,
        headers: {
          "X-User-Id": req.user.userId,
          "X-User-Name": req.user.username,
        },
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      res
        .status(error.response?.status || 500)
        .json(error.response?.data || {});
    }
  }
);

// Protected routes for upvoting (requires authentication)
app.all(
  "/api/posts/:postId/*",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    req.log.info(
      `Forwarding request to Post Service for user: ${req.user.userId}`
    );
    try {
      const response = await postServiceBreaker.fire({
        method: req.method,
        url: `${POST_SERVICE_URL}${req.originalUrl}`,
        data: req.body,
        headers: {
          "X-User-Id": req.user.userId,
          "X-User-Name": req.user.username,
        },
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      res
        .status(error.response?.status || 500)
        .json(error.response?.data || {});
    }
  }
);

app.listen(port, () => {
  const pino = require("pino");
  const logger = pino();
  logger.info(`API Gateway listening on http://localhost:${port}`);
});
