// services/notification-service/src/index.ts
import "dotenv/config";
import express from "express";
import amqp from "amqplib";

const app = express();
const port = 5003;

app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
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
        const messageContent = JSON.parse(msg.content.toString());
        console.log(`[x] Received message:`, messageContent);

        // Simulate sending an email
        console.log(`📧 Sending welcome email to ${messageContent.email}...`);

        // Acknowledge the message
        // This tells RabbitMQ that the message has been successfully processed.
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("❌ Error in RabbitMQ consumer:", error);
  }
}

app.listen(port, () => {
  console.log(`Notification service listening on http://localhost:${port}`);
  startConsumer(); // Start listening for messages when the server starts
});
