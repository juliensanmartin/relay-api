# ⚡ Quick Start - Testing

**Run tests in 60 seconds!**

---

## 🚀 Setup (One-time)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose up -d postgres redis rabbitmq

# 3. Wait for services to be ready
sleep 10
```

---

## 🧪 Run Tests

### Option 1: All Tests

```bash
# Run everything (unit + integration + E2E)
# ⚠️ Requires all services running
pnpm test
```

### Option 2: Unit Tests Only (Fast)

```bash
# No dependencies required
pnpm test:unit

# Result: ✓ Completes in < 1 minute
```

### Option 3: Integration Tests

```bash
# Requires: PostgreSQL + Redis
docker compose up -d postgres redis
sleep 10

pnpm test:integration

# Result: ✓ Completes in 1-2 minutes
```

### Option 4: E2E Tests

```bash
# Requires: ALL services running
docker compose up -d
sleep 15

pnpm test:e2e

# Result: ✓ Completes in 2-3 minutes
```

---

## 📊 Test by Service

```bash
# Auth Service
cd services/auth-service
pnpm test

# Post Service (includes cache tests)
cd services/post-service
pnpm test

# API Gateway
cd services/api-gateway
pnpm test

# E2E Tests
cd e2e-tests
pnpm test
```

---

## 🐛 Common Issues

### ❌ "Connection refused" errors

```bash
# Solution: Start the required services
docker compose up -d postgres redis

# Check they're running
docker compose ps
```

### ❌ E2E tests failing

```bash
# Solution: Start ALL services
docker compose up -d

# Wait longer for startup
sleep 20

# Verify health
curl http://localhost:5001/health  # Auth Service
curl http://localhost:5002/health  # Post Service
```

### ❌ "Port already in use"

```bash
# Solution: Stop conflicting services
docker compose down
docker compose up -d
```

---

## 📈 Coverage Report

```bash
# Generate coverage HTML report
pnpm test:coverage

# Open in browser
open services/auth-service/coverage/index.html
open services/post-service/coverage/index.html
```

---

## 🎯 Test Examples

### ✅ Successful Test Run

```
 ✓ services/auth-service/src/__tests__/auth.unit.test.ts (15)
   ✓ JWT Token Generation (5)
   ✓ Password Hashing (6)

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  234ms
```

### ✅ E2E Test Run

```
 ✓ e2e-tests/tests/user-flow.spec.ts (10)
   ✓ 1. User Registration
   ✓ 2. User Login
   ✓ 3. Create Post
   ✓ 4. Upvote Post

 Test Files  3 passed (3)
      Tests  28 passed (28)
   Duration  12.3s
```

---

## 📚 More Details

See **[TESTING.md](./TESTING.md)** for comprehensive guide.

---

**Happy Testing! 🧪✨**
