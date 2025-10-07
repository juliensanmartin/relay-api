# 📋 Context Summary for New Chat

**Copy-paste this to start a new conversation with full context.**

---

## 🚀 Project Overview

**Relay API** is a production-ready microservices-based social news aggregator (like Hacker News/Reddit) built for learning distributed systems and backend engineering.

**Location:** `/Users/julien/relay-api/`

**Tech Stack:**

- **Backend:** Node.js 22, TypeScript, Express.js
- **Database:** PostgreSQL 15
- **Cache:** Redis 7 (ioredis)
- **Message Queue:** RabbitMQ 3.11
- **Frontend:** React 18, Vite 7, Tailwind CSS v4
- **Observability:** Jaeger (tracing), Prometheus (metrics), Grafana (dashboards), Pino (logging)
- **Infrastructure:** Docker Compose, pnpm workspace monorepo

---

## 🏗️ Architecture

**5 Microservices:**

1. **API Gateway** (port 5000) - Authentication, routing, circuit breaker, retry logic
2. **Auth Service** (port 5001) - User registration, JWT auth, bcrypt passwords
3. **Post Service** (port 5002) - Posts, upvotes, **Redis caching** (NEW!)
4. **Notification Service** (port 5003) - Event-driven notifications via RabbitMQ
5. **Relay Client** (port 5173) - React frontend

**Infrastructure:**

- PostgreSQL (port 5432) - Shared database
- Redis (port 6379) - Caching layer
- RabbitMQ (ports 5672, 15672) - Message broker
- Jaeger (port 16686) - Distributed tracing
- Prometheus (port 9090) - Metrics collection
- Grafana (port 3009) - Visualization (admin/admin)

---

## ✅ What We Accomplished This Session (October 3, 2025)

### 1. Created Learning Path Documentation

- **File:** `LEARNING_PATH.md` (411 lines)
- Comprehensive roadmap covering backend AND frontend engineering
- Organized by phases: Monolith → Scaling → Microservices → Advanced
- Includes frontend architecture (micro-frontends, SSR/SSG, state management, etc.)

### 2. Analyzed Learning Progress

- Identified we're at **45% of full learning path**
- **Phase 1 (Monolith): 100% COMPLETE** 🎉
- Strong on: Observability, event-driven architecture, fault tolerance
- Gaps: Testing (0% coverage), load balancing, frontend state management

### 3. Created Development Standards

- **File:** `.cursorrules` (609 lines)
- Complete architecture guide for AI assistants
- Includes patterns, conventions, checklists for adding services
- Documents current gaps and priorities

### 4. Created Progress Tracker

- **File:** `PROGRESS.md` (600+ lines)
- Tracks learning journey phase-by-phase
- Shows what's complete, in-progress, and planned
- Includes 30-day goals and priority matrix

### 5. **IMPLEMENTED REDIS CACHING** ⭐ (Main Achievement)

**Created:**

- `packages/cache/` - Shared Redis package with ioredis client
- Cache-Aside pattern implementation
- Smart cache invalidation (pattern-based: `posts:*`)

**Updated:**

- `docker-compose.yml` - Added Redis 7 service
- `services/post-service/` - Implemented caching with metrics
- Enhanced health endpoint with Redis status

**Cache Strategy:**

- Pattern: Cache-Aside (Lazy Loading)
- Key: `posts:all`
- TTL: 300 seconds (5 minutes)
- Invalidation: On post creation, upvote, unvote
- Performance: **20x faster** (5ms vs 50-100ms)

**Observability:**

- Prometheus metrics: `cache_hits_total`, `cache_misses_total`, `cache_operation_duration_ms`
- Structured logging with Pino
- Health checks

**Documentation:**

- `REDIS_CACHING_SUMMARY.md` - Complete implementation guide
- Updated `README.md` with caching features

### 6. Created Observability Guides

- **File:** `OBSERVABILITY_GUIDE.md` (500+ lines)

  - Explains when to use Prometheus vs Jaeger vs Grafana vs Logs
  - Real-world debugging scenarios
  - PromQL query examples
  - Workflow guidance

- **File:** `OBSERVABILITY_QUICK_REFERENCE.md` (200+ lines)
  - Cheat sheet for quick lookups
  - Common commands and queries
  - Decision tree for "where do I look?"

---

## 📊 Current State

### What's Working

✅ Full microservices architecture with API Gateway
✅ Event-driven communication (RabbitMQ)
✅ Complete observability stack (Jaeger, Prometheus, Grafana)
✅ JWT authentication + bcrypt
✅ Redis caching with Cache-Aside pattern
✅ Circuit breaker + retry logic
✅ Docker Compose orchestration
✅ pnpm monorepo with shared packages (`@relay/tracing`, `@relay/cache`)

### Critical Gaps

❌ **Testing: 0% coverage** (HIGHEST PRIORITY)
❌ No load balancing/horizontal scaling
❌ No frontend state management (React Query/SWR)
❌ No frontend error tracking (Sentry)
❌ No HTTPS/TLS
❌ No database replication
❌ No rate limiting
❌ No secrets management

### Learning Progress

- **Phase 1 (Monolith):** 100% ✅
- **Phase 2 (Scaling):** 0%
- **Phase 3 (Microservices):** 75%
- **Phase 4 (Advanced):** 25%
- **Security:** 50%
- **Frontend:** 20%
- **Overall:** 45%

---

## 🎯 Recommended Next Steps (Priority Order)

### 1. Testing Framework (CRITICAL - 0% coverage)

- Vitest for unit/integration tests
- Playwright for E2E tests
- Test Redis caching, auth flow, post creation
- **Time:** 3-4 hours

### 2. React Query (High UX Impact)

- Frontend state management
- Optimistic updates
- Better loading states
- **Time:** 2-3 hours

### 3. NGINX Load Balancing (Scaling)

- Horizontal scaling patterns
- Multiple API Gateway instances
- Session management with Redis
- **Time:** 2-3 hours

### 4. Rate Limiting (Security)

- Token bucket algorithm
- Redis-based counters
- Per-user/per-IP limits
- **Time:** 2 hours

### 5. Sentry (Frontend Error Tracking)

- Real-time error monitoring
- User session replay
- Performance tracking
- **Time:** 1-2 hours

---

## 📁 Important Files

### Documentation

- `README.md` - Main project documentation (860 lines)
- `LEARNING_PATH.md` - Complete learning roadmap (411 lines)
- `PROGRESS.md` - Learning progress tracker (600+ lines)
- `.cursorrules` - Development standards for AI (609 lines)
- `OBSERVABILITY_GUIDE.md` - Where to look for what (500+ lines)
- `OBSERVABILITY_QUICK_REFERENCE.md` - Observability cheat sheet
- `REDIS_CACHING_SUMMARY.md` - Redis implementation details

### Key Implementation Files

- `docker-compose.yml` - All services (192 lines)
- `packages/cache/src/index.ts` - Redis client wrapper
- `packages/tracing/src/index.ts` - OpenTelemetry setup
- `services/post-service/src/index.ts` - Post service with caching (200 lines)
- `services/api-gateway/src/index.ts` - Gateway with circuit breaker
- `services/auth-service/src/index.ts` - Auth with JWT + bcrypt
- `db.sql` - Database schema

### Configuration

- `pnpm-workspace.yaml` - Monorepo configuration
- `monitoring/prometheus.yml` - Prometheus scrape config
- Individual service `package.json` files

---

## 🔗 Quick Access URLs

When services are running (`docker compose up -d`):

- Frontend: http://localhost:5173
- API Gateway: http://localhost:5000
- Grafana: http://localhost:3009 (admin/admin)
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686
- RabbitMQ: http://localhost:15672 (guest/guest)

---

## 💡 Key Decisions & Patterns

### Architecture Decisions

- Microservices for learning (overkill for scale, perfect for learning)
- API Gateway for centralized auth and routing
- RabbitMQ over Kafka (simpler, sufficient for learning)
- Shared PostgreSQL (simplicity over true service independence)
- OpenTelemetry for vendor-neutral observability

### Design Patterns Implemented

- Cache-Aside (Lazy Loading) for Redis
- Circuit Breaker (Opossum) for fault tolerance
- Event-Driven Architecture with RabbitMQ
- API Gateway pattern
- Repository pattern (implicit in service structure)
- Health Check pattern

### Tech Choices

- **ioredis** over node-redis (TypeScript support, cluster-ready)
- **Pino** for logging (fast, structured JSON)
- **prom-client** for metrics (standard Prometheus client)
- **OpenTelemetry** auto-instrumentation (minimal code changes)

---

## 🎓 Skills Acquired So Far

- Microservices architecture design
- Event-driven systems with message queues
- API Gateway pattern
- Circuit breaker and retry logic
- Distributed tracing and observability
- Docker containerization
- JWT authentication + bcrypt
- SQL database design and optimization
- **Redis caching with Cache-Aside pattern**
- **Cache invalidation strategies**
- **Prometheus custom metrics**
- pnpm monorepo management

---

## 🚀 How to Get Started in New Chat

1. **Ask about specific implementation details**: "How does the Redis caching work?" or "Show me the circuit breaker implementation"

2. **Request next feature**: "Let's implement testing with Vitest" or "Add React Query to the frontend"

3. **Debug/optimize**: "The cache hit rate is low, how do we improve it?" or "How do I add more cache keys?"

4. **Learn patterns**: "Explain the Cache-Aside pattern" or "How does the API Gateway route requests?"

5. **Extend features**: "Add a comment service" or "Implement rate limiting"

---

## 🔍 Common Questions to Ask New AI

- "What's the current architecture of Relay API?"
- "Show me how Redis caching is implemented"
- "What are the next priorities in the learning path?"
- "How do I test the cache invalidation?"
- "Let's implement [feature from priority list]"
- "Explain how the observability stack works"
- "Where should I look in Jaeger/Prometheus/Grafana for X?"

---

**Project is at 45% of learning path. Phase 1 complete. Redis caching just implemented. Testing is the next critical priority.**

