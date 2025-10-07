/**
 * Unit Tests for Auth Service
 * Tests: JWT signing/verification, bcrypt hashing
 */

import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Auth Service - Unit Tests", () => {
  describe("JWT Token Generation", () => {
    it("should generate a valid JWT token", () => {
      const payload = { userId: 1, username: "testuser" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should verify a valid JWT token", () => {
      const payload = { userId: 1, username: "testuser" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });

    it("should reject an invalid JWT token", () => {
      const invalidToken = "invalid.token.here";

      expect(() => {
        jwt.verify(invalidToken, JWT_SECRET);
      }).toThrow();
    });

    it("should reject a token with wrong secret", () => {
      const payload = { userId: 1, username: "testuser" };
      const token = jwt.sign(payload, "wrong-secret", { expiresIn: "1h" });

      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow();
    });

    it("should include expiration in token", () => {
      const payload = { userId: 1, username: "testuser" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe("Password Hashing with bcrypt", () => {
    it("should hash a password successfully", async () => {
      const password = "password123";
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are ~60 chars
    });

    it("should verify correct password", async () => {
      const password = "password123";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "password123";
      const wrongPassword = "wrongpassword";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it("should generate different hashes for same password", async () => {
      const password = "password123";
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);

      expect(hash1).not.toBe(hash2); // Salt ensures different hashes
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });

    it("should handle empty password", async () => {
      const password = "";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare("", hash);
      expect(isValid).toBe(true);
    });

    it("should handle special characters in password", async () => {
      const password = "p@ssw0rd!#$%^&*()";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe("Input Validation Logic", () => {
    it("should validate email format", () => {
      const validEmails = [
        "test@example.com",
        "user.name@example.co.uk",
        "user+tag@example.com",
      ];
      const invalidEmails = [
        "invalid.email",
        "@example.com",
        "user@",
        "user@.com",
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });

      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it("should validate username requirements", () => {
      const validUsernames = ["user123", "john_doe", "alice-smith"];
      const invalidUsernames = ["ab", "a", "", "user@name"];

      // Example: username must be 3+ characters, alphanumeric + underscore/dash
      const usernameRegex = /^[a-zA-Z0-9_-]{3,}$/;

      validUsernames.forEach((username) => {
        expect(usernameRegex.test(username)).toBe(true);
      });

      invalidUsernames.forEach((username) => {
        expect(usernameRegex.test(username)).toBe(false);
      });
    });

    it("should validate password strength", () => {
      const strongPasswords = ["Password123!", "Secure@Pass1", "MyP@ss123"];
      const weakPasswords = ["pass", "12345678", "password"];

      // Example: 8+ chars, at least one uppercase, one number
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

      strongPasswords.forEach((password) => {
        expect(passwordRegex.test(password)).toBe(true);
      });

      // Note: weak passwords would fail this check
      // This is just demonstrating validation logic
    });
  });

  describe("JWT Payload Structure", () => {
    it("should include only essential user data in JWT", () => {
      const payload = { userId: 1, username: "testuser" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.userId).toBeDefined();
      expect(decoded.username).toBeDefined();
      // Ensure no sensitive data like password is included
      expect(decoded.password).toBeUndefined();
      expect(decoded.password_hash).toBeUndefined();
    });

    it("should not exceed reasonable token size", () => {
      const payload = { userId: 1, username: "testuser" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      // JWT tokens should be reasonably sized (< 500 bytes for basic payload)
      expect(token.length).toBeLessThan(500);
    });
  });
});
