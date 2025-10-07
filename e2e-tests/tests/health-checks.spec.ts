/**
 * E2E Health Check Tests
 * Tests: Service health endpoints, observability
 */

import { test, expect } from "@playwright/test";

test.describe("Health Checks", () => {
  test("Auth Service - GET /health", async ({ request }) => {
    const response = await request.get("http://localhost:5001/health");

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("UP");
  });

  test("Post Service - GET /health", async ({ request }) => {
    const response = await request.get("http://localhost:5002/health");

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("UP");
    expect(body.database).toBe("connected");
    expect(body.redis).toBe("connected");
    expect(body.cache).toBeDefined();
  });

  test("Notification Service - GET /health", async ({ request }) => {
    const response = await request.get("http://localhost:5003/health");

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("UP");
  });
});

test.describe("Metrics Endpoints", () => {
  test("Auth Service - GET /metrics", async ({ request }) => {
    const response = await request.get("http://localhost:5001/metrics");

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("relay-auth-service");
    expect(body).toContain("process_cpu_user_seconds_total");
  });

  test("Post Service - GET /metrics", async ({ request }) => {
    const response = await request.get("http://localhost:5002/metrics");

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("relay-post-service");
    expect(body).toContain("cache_hits_total");
    expect(body).toContain("cache_misses_total");
  });

  test("cache metrics should increment on requests", async ({ request }) => {
    // Get initial metrics
    const metricsResponse1 = await request.get("http://localhost:5002/metrics");
    const metrics1 = await metricsResponse1.text();

    // Make a request to trigger cache
    await request.get("http://localhost:5000/api/posts");

    // Get updated metrics
    const metricsResponse2 = await request.get("http://localhost:5002/metrics");
    const metrics2 = await metricsResponse2.text();

    expect(metrics2).toContain("cache_hits_total");
    expect(metrics2).toContain("cache_misses_total");
  });
});

test.describe("Observability Stack", () => {
  test("Jaeger UI should be accessible", async ({ request }) => {
    const response = await request.get("http://localhost:16686");
    expect(response.status()).toBe(200);
  });

  test("Prometheus UI should be accessible", async ({ request }) => {
    const response = await request.get("http://localhost:9090");
    expect(response.status()).toBe(200);
  });

  test("Grafana UI should be accessible", async ({ request }) => {
    const response = await request.get("http://localhost:3009");
    expect(response.status()).toBe(200);
  });

  test("RabbitMQ Management UI should be accessible", async ({ request }) => {
    const response = await request.get("http://localhost:15672");
    expect(response.status()).toBe(200);
  });
});
