// services/notification-service/src/index.ts
import "dotenv/config";
import express, { Request, Response } from "express";
import amqp from "amqplib";
import { pinoHttp } from "pino-http";
import client from "prom-client"; // 👈 Import

const app = express();
const port = 5003;

// =================================================================
// METRICS CONFIGURATION
// =================================================================
const register = new client.Registry();
register.setDefaultLabels({ app: "relay-notification-service" });
client.collectDefaultMetrics({ register });

// Custom counter for processed messages
const messagesProcessedCounter = new client.Counter({
  name: "rabbitmq_messages_processed_total",
  help: "Total number of messages processed from RabbitMQ",
  labelNames: ["status"], // 'success' or 'error'
});
register.registerMetric(messagesProcessedCounter);

// Custom histogram for message processing duration
const messageProcessingDuration = new client.Histogram({
  name: "rabbitmq_message_duration_seconds",
  help: "Duration of RabbitMQ message processing in seconds",
  buckets: [0.1, 0.5, 1, 2, 5],
});
register.registerMetric(messageProcessingDuration);

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

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP" });
});

// 👇 Add the /metrics route
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

async function startConsumer() {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost"
    );
    const channel = await connection.createChannel();
    const queueName = "user_registered_queue";

    await channel.assertQueue(queueName, { durable: true });

    // This tells RabbitMQ not to give more than one message to this worker at a time.
    channel.prefetch(1);

    console.log(
      `[*] Waiting for messages in ${queueName}. To exit press CTRL+C`
    );

    channel.consume(queueName, (msg) => {
      if (msg !== null) {
        const end = messageProcessingDuration.startTimer(); // 👈 Start timer
        try {
          const messageContent = JSON.parse(msg.content.toString());
          console.log(`[x] Received message:`, messageContent);
          console.log(`📧 Sending welcome email to ${messageContent.email}...`);

          channel.ack(msg);
          messagesProcessedCounter.inc({ status: "success" }); // 👈 Increment success
        } catch (error) {
          console.error("❌ Error processing message:", error);
          channel.nack(msg, false, false);
          messagesProcessedCounter.inc({ status: "error" }); // 👈 Increment error
        } finally {
          end(); // 👈 End timer regardless of success or failure
        }
      }
    });
  } catch (error) {
    console.error("❌ Error in RabbitMQ consumer:", error);
  }
}

app.listen(port, () => {
  const pino = require("pino");
  const logger = pino();
  logger.info(`✅ Notification service is running on http://localhost:${port}`);
  startConsumer(); // Start listening for messages when the server starts
});
