import "dotenv/config";
import express, { Request, Response } from "express";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import amqp from "amqplib";

const app = express();
const port = 5001;

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

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP" });
});

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    console.log("Attempting to insert user into DB...");
    const queryText =
      "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id, username";
    const queryValues = [username, email, passwordHash];

    const result = await pool.query(queryText, queryValues);
    const newUser = result.rows[0];
    console.log("User inserted successfully:", newUser.id);

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
      console.log(`✉️  Sent user registration message for ${email}`);
    }

    res
      .status(201)
      .json({ message: "User created successfully!", user: newUser });
  } catch (error: any) {
    console.error("❌ Error creating user:", error);
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

    res.json({ message: "Logged in successfully!", token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Auth service listening on http://localhost:${port}`);
  connectRabbitMQ();
});
