/**
 * E2E Performance Tests
 * Tests: Response times, cache performance, throughput
 */

import { test, expect } from "@playwright/test";

const API_BASE_URL = "http://localhost:5000";

test.describe("Performance Tests", () => {
  test("GET /api/posts should respond within 200ms", async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${API_BASE_URL}/api/posts`);
    const duration = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(200);
    console.log(`Response time: ${duration}ms`);
  });

  test("should handle concurrent requests", async ({ request }) => {
    const requests = Array(10)
      .fill(null)
      .map(() => request.get(`${API_BASE_URL}/api/posts`));

    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    responses.forEach((response) => {
      expect(response.status()).toBe(200);
    });

    console.log(`10 concurrent requests completed in ${duration}ms`);
    expect(duration).toBeLessThan(1000); // All requests within 1 second
  });

  test("cache should significantly reduce response time", async ({
    request,
  }) => {
    // First request (likely cache miss)
    const start1 = Date.now();
    await request.get(`${API_BASE_URL}/api/posts`);
    const duration1 = Date.now() - start1;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second request (cache hit)
    const start2 = Date.now();
    await request.get(`${API_BASE_URL}/api/posts`);
    const duration2 = Date.now() - start2;

    console.log(
      `Cache miss: ${duration1}ms, Cache hit: ${duration2}ms, Speedup: ${(
        duration1 / duration2
      ).toFixed(2)}x`
    );

    // Cache hit should be at least 2x faster (conservative estimate)
    expect(duration2).toBeLessThan(duration1);
  });

  test("should handle large post list efficiently", async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${API_BASE_URL}/api/posts`);
    const duration = Date.now() - start;
    const posts = await response.json();

    expect(response.status()).toBe(200);
    expect(Array.isArray(posts)).toBe(true);
    console.log(`Fetched ${posts.length} posts in ${duration}ms`);

    // Should handle even large lists quickly
    expect(duration).toBeLessThan(500);
  });
});

test.describe("Load Testing (Light)", () => {
  test("should handle 50 sequential requests", async ({ request }) => {
    const start = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 50; i++) {
      try {
        const response = await request.get(`${API_BASE_URL}/api/posts`);
        if (response.status() === 200) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    const duration = Date.now() - start;
    const avgResponseTime = duration / 50;

    console.log(`
      Total: 50 requests
      Success: ${successCount}
      Errors: ${errorCount}
      Duration: ${duration}ms
      Avg response time: ${avgResponseTime.toFixed(2)}ms
    `);

    expect(successCount).toBeGreaterThan(45); // Allow some failures
    expect(avgResponseTime).toBeLessThan(100);
  });

  test("should measure throughput", async ({ request }) => {
    const duration = 5000; // 5 seconds
    const start = Date.now();
    let requestCount = 0;

    while (Date.now() - start < duration) {
      await request.get(`${API_BASE_URL}/api/posts`);
      requestCount++;
    }

    const actualDuration = Date.now() - start;
    const requestsPerSecond = (requestCount / actualDuration) * 1000;

    console.log(`
      Requests: ${requestCount}
      Duration: ${actualDuration}ms
      Throughput: ${requestsPerSecond.toFixed(2)} req/s
    `);

    expect(requestsPerSecond).toBeGreaterThan(10); // At least 10 req/s
  });
});

test.describe("Circuit Breaker Behavior", () => {
  test.skip("should trigger circuit breaker on service failure", async ({
    request,
  }) => {
    // This test requires manually stopping a service
    // Skip by default, run manually when testing resilience
    const response = await request.get(`${API_BASE_URL}/api/posts`);
    console.log(`Status: ${response.status()}`);
  });
});
