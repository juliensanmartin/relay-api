# 🧪 Testing Guide - Relay API

**Comprehensive testing strategy for Relay API microservices**

---

## 📊 Testing Overview

### Test Coverage Strategy

| Test Type             | Tool       | Coverage                  | Location                                         | Run Time |
| --------------------- | ---------- | ------------------------- | ------------------------------------------------ | -------- |
| **Unit Tests**        | Vitest     | Business logic, utilities | `services/*/src/__tests__/*.unit.test.ts`        | < 1 min  |
| **Integration Tests** | Vitest     | Database, Redis, services | `services/*/src/__tests__/*.integration.test.ts` | 1-2 min  |
| **E2E Tests**         | Playwright | Complete user flows       | `e2e-tests/tests/*.spec.ts`                      | 2-3 min  |

### Current Test Coverage

```
✅ Auth Service: Unit + Integration tests (JWT, bcrypt, database)
✅ Post Service: Unit + Integration tests (caching, CRUD, Redis)
✅ API Gateway: Unit tests (routing, circuit breaker, middleware)
✅ E2E: Complete user flows (register → login → post → upvote)
✅ E2E: Performance tests (cache, throughput, response times)
✅ E2E: Health checks (all services, metrics, observability)
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL, Redis, RabbitMQ)
docker compose up -d postgres redis rabbitmq

# 3. Wait for services to be ready (~10 seconds)
```

### Run All Tests

```bash
# All tests (unit + integration + E2E)
pnpm test

# Only unit tests (fast, no dependencies)
pnpm test:unit

# Only integration tests (requires PostgreSQL + Redis)
pnpm test:integration

# Only E2E tests (requires all services running)
pnpm test:e2e

# With coverage report
pnpm test:coverage
```

### Run Tests by Service

```bash
# Auth Service tests
cd services/auth-service
pnpm test

# Post Service tests
cd services/post-service
pnpm test

# API Gateway tests
cd services/api-gateway
pnpm test

# E2E tests
cd e2e-tests
pnpm test
```

---

## 📝 Unit Tests (Vitest)

### What Are Unit Tests?

- Test individual functions and logic in **isolation**
- No external dependencies (database, Redis, network)
- Fast execution (< 1 second per test)
- Run on every code change

### Example: Auth Service Unit Tests

**File:** `services/auth-service/src/__tests__/auth.unit.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

describe("Auth Service - Unit Tests", () => {
  it("should generate a valid JWT token", () => {
    const payload = { userId: 1, username: "testuser" };
    const token = jwt.sign(payload, "secret", { expiresIn: "1h" });
    expect(token).toBeDefined();
  });

  it("should hash password with bcrypt", async () => {
    const password = "password123";
    const hash = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });
});
```

### Running Unit Tests

```bash
# Watch mode (auto-rerun on changes)
cd services/auth-service
pnpm test:watch

# Run once
pnpm test:unit

# With coverage
pnpm test:coverage
```

### What's Tested in Unit Tests?

**Auth Service:**

- ✅ JWT token generation and verification
- ✅ bcrypt password hashing
- ✅ Email/username validation
- ✅ Input sanitization

**Post Service:**

- ✅ Cache key generation
- ✅ Data validation (title, URL)
- ✅ Upvote logic
- ✅ TTL calculations
- ✅ Metrics tracking

**API Gateway:**

- ✅ JWT middleware logic
- ✅ Route matching
- ✅ URL construction
- ✅ Circuit breaker configuration
- ✅ Retry logic

---

## 🔗 Integration Tests (Vitest)

### What Are Integration Tests?

- Test interactions with **external dependencies**
- Require PostgreSQL, Redis, RabbitMQ running
- Test real database queries, cache operations
- Slower than unit tests (1-10 seconds per test)

### Example: Post Service Integration Tests

**File:** `services/post-service/src/__tests__/post.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { Pool } from "pg";
import { createRedisClient, cacheAside } from "@relay/cache";

const pool = new Pool({
  /* config */
});
const redis = createRedisClient("redis://localhost:6379");

describe("Post Service - Integration Tests", () => {
  it("should cache and retrieve posts from Redis", async () => {
    const cacheKey = "posts:all";

    // First call (cache miss → database)
    const posts = await cacheAside(
      cacheKey,
      60,
      async () => {
        const result = await pool.query("SELECT * FROM posts LIMIT 5");
        return result.rows;
      },
      redis
    );

    // Second call (cache hit → Redis)
    const cachedPosts = await cacheAside(
      cacheKey,
      60,
      async () => {
        throw new Error("Should not hit database");
      },
      redis
    );

    expect(cachedPosts).toEqual(posts);
  });
});
```

### Running Integration Tests

```bash
# Start dependencies first
docker compose up -d postgres redis

# Wait for services to be ready
sleep 10

# Run integration tests
cd services/post-service
pnpm test:integration
```

### What's Tested in Integration Tests?

**Auth Service:**

- ✅ Database connection
- ✅ User registration (INSERT)
- ✅ User login (SELECT)
- ✅ Duplicate email prevention
- ✅ SQL injection prevention

**Post Service:**

- ✅ Post creation (INSERT)
- ✅ Post retrieval (SELECT)
- ✅ Upvote transactions
- ✅ Redis caching (get/set/delete)
- ✅ Cache-Aside pattern
- ✅ Cache invalidation by pattern
- ✅ TTL expiration
- ✅ Cache vs database latency

---

## 🎭 End-to-End Tests (Playwright)

### What Are E2E Tests?

- Test **complete user workflows** through the API Gateway
- All services must be running
- Closest to real-world usage
- Slowest tests (2-5 seconds per test)

### Example: Complete User Flow

**File:** `e2e-tests/tests/user-flow.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Complete User Flow", () => {
  const testUser = {
    username: `user_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: "Test123!",
  };

  let token: string;
  let postId: number;

  test("1. Register user", async ({ request }) => {
    const response = await request.post("/api/auth/users", {
      data: testUser,
    });
    expect(response.status()).toBe(201);
  });

  test("2. Login user", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: { email: testUser.email, password: testUser.password },
    });
    const body = await response.json();
    token = body.token;
    expect(token).toBeDefined();
  });

  test("3. Create post", async ({ request }) => {
    const response = await request.post("/api/posts", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Test Post", url: "https://example.com" },
    });
    const post = await response.json();
    postId = post.id;
    expect(postId).toBeDefined();
  });

  test("4. Upvote post", async ({ request }) => {
    const response = await request.post(`/api/posts/${postId}/upvote`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(201);
  });
});
```

### Running E2E Tests

```bash
# Start ALL services
docker compose up -d

# Wait for services
sleep 15

# Run E2E tests
cd e2e-tests
pnpm test

# Run in headed mode (see browser)
pnpm test:headed

# Run with UI (interactive)
pnpm test:ui

# Debug mode
pnpm test:debug

# View test report
pnpm report
```

### E2E Test Suites

#### 1. User Flow Tests (`user-flow.spec.ts`)

Complete user journey from registration to upvoting:

- ✅ User registration
- ✅ User login (JWT token)
- ✅ Fetch posts (public)
- ✅ Create post (authenticated)
- ✅ Upvote post
- ✅ Remove upvote
- ✅ Prevent duplicate upvotes
- ✅ Authentication errors (401, 403)
- ✅ Data validation
- ✅ Cache invalidation

#### 2. Performance Tests (`performance.spec.ts`)

- ✅ Response time < 200ms
- ✅ Concurrent requests (10 simultaneous)
- ✅ Cache speedup measurement
- ✅ Load testing (50 sequential requests)
- ✅ Throughput measurement (req/s)

#### 3. Health Checks (`health-checks.spec.ts`)

- ✅ All services health endpoints
- ✅ Metrics endpoints (Prometheus)
- ✅ Cache metrics tracking
- ✅ Observability stack (Jaeger, Grafana)

---

## 📊 Coverage Reports

### Generate Coverage Report

```bash
# For individual service
cd services/auth-service
pnpm test:coverage

# For all services
pnpm test:coverage
```

### View HTML Coverage Report

```bash
# After running coverage, open in browser:
open services/auth-service/coverage/index.html
open services/post-service/coverage/index.html
open services/api-gateway/coverage/index.html
```

### Coverage Goals

| Service      | Target | Current |
| ------------ | ------ | ------- |
| Auth Service | 80%    | TBD     |
| Post Service | 80%    | TBD     |
| API Gateway  | 70%    | TBD     |

---

## 🐛 Debugging Tests

### Vitest Debugging

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test auth.unit.test.ts

# Run specific test suite
pnpm test -t "JWT Token Generation"

# Debug mode with Node inspector
node --inspect-brk node_modules/vitest/vitest.mjs run
```

### Playwright Debugging

```bash
# Debug mode (step through tests)
pnpm test:debug

# Run with headed browser
pnpm test:headed

# Interactive UI mode
pnpm test:ui

# Trace viewer (for failed tests)
npx playwright show-trace trace.zip
```

### Common Issues

#### ❌ Database Connection Failed

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

```bash
docker compose up -d postgres
sleep 10  # Wait for PostgreSQL to be ready
```

#### ❌ Redis Connection Failed

```bash
Error: Redis connection refused
```

**Solution:**

```bash
docker compose up -d redis
sleep 5  # Wait for Redis to be ready
```

#### ❌ E2E Tests Failing

```bash
Error: Service not available
```

**Solution:**

```bash
# Start ALL services
docker compose up -d

# Verify services are running
docker compose ps

# Check service logs
docker compose logs post-service
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: relay
          POSTGRES_PASSWORD: relay
          POSTGRES_DB: relay_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DB_HOST: localhost
          DB_USER: relay
          DB_PASSWORD: relay
          DB_DATABASE: relay_db
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📚 Best Practices

### 1. Test Naming Convention

```typescript
// ✅ Good: Descriptive test names
it("should return 401 when JWT token is missing", async () => {});
it("should hash password with bcrypt using 10 salt rounds", async () => {});

// ❌ Bad: Vague test names
it("test1", async () => {});
it("should work", async () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it("should increment upvote count", async () => {
  // Arrange: Set up test data
  const postId = await createTestPost();
  const userId = 123;

  // Act: Perform action
  await upvotePost(postId, userId);

  // Assert: Verify result
  const post = await getPost(postId);
  expect(post.upvote_count).toBe(1);
});
```

### 3. Test Isolation

```typescript
// ✅ Good: Each test cleans up
afterEach(async () => {
  await pool.query("DELETE FROM posts WHERE id = $1", [testPostId]);
});

// ❌ Bad: Tests depend on each other
test("create post", () => {
  /* creates global testPostId */
});
test("upvote post", () => {
  /* uses global testPostId */
});
```

### 4. Use Test Fixtures

```typescript
// fixtures/test-data.ts
export const createTestUser = async () => {
  const timestamp = Date.now();
  return {
    username: `test_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: "Test123!",
  };
};
```

### 5. Mock External Services

```typescript
import { vi } from "vitest";

// Mock RabbitMQ for unit tests
vi.mock("amqplib", () => ({
  connect: vi.fn(() => ({
    createChannel: vi.fn(),
  })),
}));
```

---

## 🎯 Testing Checklist for New Features

When adding new features, ensure:

- [ ] **Unit tests** for business logic
- [ ] **Integration tests** for database/cache operations
- [ ] **E2E tests** for critical user flows
- [ ] **Error handling** tests (4xx, 5xx)
- [ ] **Edge cases** (empty data, null values)
- [ ] **Security** tests (SQL injection, XSS)
- [ ] **Performance** tests (response time, throughput)
- [ ] **Documentation** updated

---

## 📖 Additional Resources

### Vitest

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)

### Playwright

- [Playwright Documentation](https://playwright.dev/)
- [Playwright API Testing](https://playwright.dev/docs/test-api-testing)

### Testing Patterns

- [Test-Driven Development (TDD)](https://en.wikipedia.org/wiki/Test-driven_development)
- [Behavior-Driven Development (BDD)](https://en.wikipedia.org/wiki/Behavior-driven_development)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

---

## 🚨 Known Limitations

1. **No frontend testing yet** - Need Vitest + React Testing Library
2. **No contract testing** - Consider Pact for microservices contracts
3. **No mutation testing** - Consider Stryker for test quality
4. **Manual load testing** - Consider k6 or Artillery for real load tests
5. **No visual regression testing** - Consider Percy or Chromatic

---

## 📈 Next Steps

1. **Increase coverage to 80%+**
2. **Add frontend tests** (React Testing Library)
3. **Implement contract testing** (Pact)
4. **Add load testing** (k6)
5. **Set up CI/CD pipeline** (GitHub Actions)
6. **Add test fixtures** for common scenarios
7. **Implement snapshot testing** for API responses

---

**Testing is not about finding bugs, it's about preventing them.**

Happy testing! 🧪✨
