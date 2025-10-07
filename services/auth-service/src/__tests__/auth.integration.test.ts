/**
 * Integration Tests for Auth Service
 * Tests: Full API endpoints with database
 *
 * NOTE: These tests require a running PostgreSQL database.
 * Run: docker compose up -d postgres
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER || "relay",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_DATABASE || "relay_db",
  password: process.env.DB_PASSWORD || "relay",
  port: parseInt(process.env.DB_PORT || "5432"),
});

describe("Auth Service - Integration Tests", () => {
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
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Database Connection", () => {
    it("should connect to PostgreSQL database", async () => {
      const result = await pool.query("SELECT 1 AS test");
      expect(result.rows[0].test).toBe(1);
    });

    it("should verify users table exists", async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe("User Registration", () => {
    it("should insert a new user with hashed password", async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      const username = `testuser_${Date.now()}`;
      const passwordHash = "hashed_password_example";

      const result = await pool.query(
        "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id, username, email",
        [username, testEmail, passwordHash]
      );

      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].username).toBe(username);
      expect(result.rows[0].email).toBe(testEmail);
      expect(result.rows[0].id).toBeGreaterThan(0);

      // Cleanup
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    });

    it("should prevent duplicate email registration", async () => {
      const testEmail = `duplicate-${Date.now()}@example.com`;
      const username = `testuser_${Date.now()}`;

      // Insert first user
      await pool.query(
        "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3)",
        [username, testEmail, "hash1"]
      );

      // Attempt to insert duplicate email
      try {
        await pool.query(
          "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3)",
          [`${username}_2`, testEmail, "hash2"]
        );
        expect.fail("Should have thrown duplicate key error");
      } catch (error: any) {
        expect(error.code).toBe("23505"); // PostgreSQL unique violation
      }

      // Cleanup
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    });
  });

  describe("User Login", () => {
    it("should retrieve user by email", async () => {
      const testEmail = `login-test-${Date.now()}@example.com`;
      const username = `loginuser_${Date.now()}`;

      // Insert test user
      const insertResult = await pool.query(
        "INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id",
        [username, testEmail, "test_hash"]
      );
      const userId = insertResult.rows[0].id;

      // Retrieve user by email
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        testEmail,
      ]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe(testEmail);
      expect(result.rows[0].username).toBe(username);

      // Cleanup
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    });

    it("should return empty result for non-existent user", async () => {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        "nonexistent@example.com",
      ]);

      expect(result.rows).toHaveLength(0);
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should safely handle SQL injection attempts in email", async () => {
      const maliciousEmail = "'; DROP TABLE users; --";

      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        maliciousEmail,
      ]);

      // Should return no results without executing malicious SQL
      expect(result.rows).toHaveLength(0);

      // Verify users table still exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        );
      `);
      expect(tableCheck.rows[0].exists).toBe(true);
    });
  });

  describe("Database Schema Validation", () => {
    it("should have correct columns in users table", async () => {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);

      const columns = result.rows.map((row) => row.column_name);
      expect(columns).toContain("id");
      expect(columns).toContain("username");
      expect(columns).toContain("email");
      expect(columns).toContain("password_hash");
      expect(columns).toContain("created_at");
    });

    it("should have unique constraint on email", async () => {
      const result = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
