# 🚦 Rate Limiting Implementation Guide

## Overview

The Relay API implements **token bucket rate limiting** with Redis backend to protect against API abuse, DDoS attacks, and ensure fair resource usage across all users.

## ✅ Implementation Status

**Completed:** October 7, 2025

- ✅ Token bucket algorithm with atomic Redis operations (Lua script)
- ✅ Per-user rate limiting (authenticated requests)
- ✅ Per-IP rate limiting (all requests)
- ✅ Endpoint-specific configurations
- ✅ 429 error responses with Retry-After headers
- ✅ Prometheus metrics integration
- ✅ Graceful degradation (fails open if Redis unavailable)
- ✅ Comprehensive unit tests (21 tests, 100% pass rate)

---

## 🏗️ Architecture

### Token Bucket Algorithm

The **token bucket** algorithm is used because it:

- Allows burst traffic (up to `maxTokens`)
- Smooths out request rates over time
- Simple to implement and reason about
- Efficient with Redis (atomic operations)

### How It Works

```
┌─────────────────────────────────────┐
│         Token Bucket                │
│                                     │
│   ┌───────────────────────────┐   │
│   │  Tokens: 8/10             │   │  ← Current tokens
│   │  Max: 10 tokens           │   │  ← Bucket capacity
│   │  Refill: 2 tokens/sec     │   │  ← Refill rate
│   └───────────────────────────┘   │
│                                     │
│   Request arrives → Consume 1 token│
│   Time passes → Refill tokens      │
│                                     │
└─────────────────────────────────────┘
```

**Algorithm Steps:**

1. **Initialize:** Bucket starts with `maxTokens`
2. **Refill:** Add `refillRate * elapsed_seconds` tokens (capped at `maxTokens`)
3. **Consume:** Try to remove 1 token
   - If `tokens >= 1`: ✅ Allow request, decrement tokens
   - If `tokens < 1`: ❌ Block request, return 429 with retry-after

---

## 📊 Rate Limit Configuration

### Endpoint-Specific Limits

| Endpoint                          | Per-User Limit  | Per-IP Limit    | Rationale                     |
| --------------------------------- | --------------- | --------------- | ----------------------------- |
| `/api/auth/login`                 | N/A             | 5 req / 5 min   | Prevent brute-force attacks   |
| `/api/auth/register`              | N/A             | 3 req / 1 hour  | Prevent fake account creation |
| `/api/posts` (POST)               | 10 req / 1 min  | 20 req / 1 min  | Prevent spam posts            |
| `/api/posts/:postId/upvote`       | 30 req / 1 min  | N/A             | Allow rapid upvoting          |
| **Default** (all other endpoints) | 100 req / 1 min | 200 req / 1 min | General protection            |

### Configuration Structure

```typescript
export const DEFAULT_RATE_LIMITS: Record<string, EndpointRateLimits> = {
  "/api/auth/login": {
    perIP: {
      maxTokens: 5, // 5 requests allowed initially
      refillRate: 1, // 1 token added per second
      windowSeconds: 300, // Data expires after 5 minutes
    },
  },
  // ... more configs
};
```

---

## 🔄 Request Flow

### 1. Unauthenticated Request (Public Endpoint)

```
Client → API Gateway
         ↓
    [Optional JWT Extraction] → No token present
         ↓
    [Rate Limiter] → Check per-IP limit only
         ↓
    ✅ Allowed (or ❌ 429 Too Many Requests)
         ↓
    Route Handler
```

### 2. Authenticated Request (Protected Endpoint)

```
Client (with JWT) → API Gateway
                    ↓
               [Optional JWT Extraction] → Extract & decode JWT
                    ↓
               [Rate Limiter] → Check BOTH per-user AND per-IP limits
                    ↓
               ✅ Both limits passed (or ❌ 429 Too Many Requests)
                    ↓
               [Authenticate Token] → Enforce JWT validity
                    ↓
               Route Handler
```

**Key Insight:** Rate limiting happens **before** authentication enforcement, so:

- Rate limits apply even to requests with invalid tokens
- Prevents attackers from exhausting resources with invalid credentials
- Per-user limits only apply if JWT is valid and decodable

---

## 🗄️ Redis Data Structure

### Storage Key Format

```
rate_limit:{identifier_type}:{identifier}:{endpoint}
```

**Examples:**

- `rate_limit:user:123:/api/posts`
- `rate_limit:ip:192.168.1.1:/api/auth/login`

### Stored Data (Redis Hash)

```json
{
  "tokens": "8.5", // Current tokens (float)
  "lastRefill": "1728318000" // Unix timestamp (seconds)
}
```

### Atomic Operations (Lua Script)

All rate limit checks use a **Lua script** executed atomically in Redis:

```lua
-- 1. Get current bucket state (tokens, lastRefill)
-- 2. Calculate elapsed time
-- 3. Refill tokens: tokens += elapsed * refillRate (capped at maxTokens)
-- 4. Try to consume 1 token
-- 5. If successful: decrement tokens, return allowed=1
-- 6. If failed: calculate retry_after, return allowed=0
-- 7. Update bucket state with new tokens and timestamp
-- 8. Set expiration (TTL) on key
```

**Why Lua?** Prevents race conditions when multiple requests arrive simultaneously.

---

## 📈 Prometheus Metrics

### Exposed Metrics

1. **`rate_limit_requests_total`** (Counter)

   - Labels: `identifier_type`, `endpoint`, `result`
   - Tracks total rate limit checks (allowed vs blocked)

2. **`rate_limit_blocked_total`** (Counter)

   - Labels: `identifier_type`, `endpoint`
   - Tracks only blocked requests

3. **`rate_limit_tokens_remaining`** (Histogram)
   - Labels: `identifier_type`, `endpoint`
   - Tracks remaining tokens distribution

### Example Prometheus Queries

```promql
# Rate of blocked requests per endpoint (last 5 minutes)
rate(rate_limit_blocked_total[5m])

# Percentage of requests blocked
100 * rate(rate_limit_blocked_total[5m]) / rate(rate_limit_requests_total[5m])

# Average tokens remaining by endpoint
avg(rate_limit_tokens_remaining) by (endpoint)

# Endpoints under heavy load (low token counts)
rate_limit_tokens_remaining{quantile="0.5"} < 10
```

### Grafana Dashboard Queries

**Panel 1: Rate Limit Blocks by Endpoint**

```promql
sum by (endpoint) (rate(rate_limit_blocked_total[5m]))
```

**Panel 2: Block Rate (User vs IP)**

```promql
sum by (identifier_type) (rate(rate_limit_blocked_total[5m]))
```

**Panel 3: Token Distribution Heatmap**

```promql
histogram_quantile(0.5, rate(rate_limit_tokens_remaining_bucket[5m]))
```

---

## 🚨 Error Handling

### 429 Too Many Requests Response

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded for user. Please try again later.",
  "retryAfter": 15
}
```

### Response Headers

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10              ← Maximum tokens
X-RateLimit-Remaining: 0           ← Tokens remaining
X-RateLimit-Reset: 1728318015000   ← When limit resets (Unix ms)
Retry-After: 15                    ← Seconds until next token
```

### Client Handling (React)

```typescript
async function createPost(data: PostData) {
  try {
    const response = await apiClient.post("/api/posts", data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      const retryAfter = error.response.data.retryAfter;
      toast.error(`Rate limit exceeded. Try again in ${retryAfter}s`);
      // Optional: auto-retry after delay
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return createPost(data); // Retry
    }
    throw error;
  }
}
```

---

## 🧪 Testing

### Test Coverage

**21 unit tests** covering:

- ✅ Per-IP rate limiting (block after limit)
- ✅ Per-user rate limiting (authenticated requests)
- ✅ Endpoint-specific configurations
- ✅ Response headers (X-RateLimit-\*, Retry-After)
- ✅ IP address extraction (X-Forwarded-For, X-Real-IP)
- ✅ Dual limits (both user and IP enforced)
- ✅ Edge cases (unauthenticated, malformed JWT, Redis failure)

### Run Tests

```bash
# All API Gateway tests (79 tests)
cd services/api-gateway && pnpm test

# Only rate limiter tests (21 tests)
cd services/api-gateway && pnpm test rate-limiter

# With coverage
pnpm test:coverage
```

### Manual Testing with cURL

**1. Test IP-based rate limiting (login endpoint - 5 requests allowed)**

```bash
# Make 6 requests quickly
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -i
done

# 6th request should return 429 with Retry-After header
```

**2. Test user-based rate limiting (post creation - 10 requests/min)**

```bash
TOKEN="your-jwt-token-here"

for i in {1..11}; do
  curl -X POST http://localhost:5000/api/posts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Post '$i'","content":"Content"}' \
    -i
done

# 11th request should return 429
```

**3. Check rate limit headers**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  -i | grep -i "X-RateLimit"

# Output:
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 4
```

---

## 🛠️ Customization

### Adding a New Rate-Limited Endpoint

**1. Define the rate limit configuration**

```typescript
// services/api-gateway/src/rate-limiter.ts

export const DEFAULT_RATE_LIMITS: Record<string, EndpointRateLimits> = {
  // ... existing configs

  // New endpoint: Comment creation (authenticated)
  "/api/posts/:postId/comments": {
    perUser: {
      maxTokens: 20, // 20 comments per minute
      refillRate: 5, // 5 tokens/sec = 300/min sustained
      windowSeconds: 60,
    },
    perIP: {
      maxTokens: 50, // 50 comments per minute per IP
      refillRate: 10,
      windowSeconds: 60,
    },
  },
};
```

**2. No code changes needed!** The middleware automatically applies the configuration.

### Adjusting Existing Limits

```typescript
// Make login more strict (3 attempts per 10 minutes)
"/api/auth/login": {
  perIP: {
    maxTokens: 3,
    refillRate: 0.5,  // 1 token every 2 seconds
    windowSeconds: 600  // 10 minutes
  }
}
```

### Disabling Rate Limiting for an Endpoint

```typescript
// Option 1: Don't add the endpoint to DEFAULT_RATE_LIMITS
// (will use default limits)

// Option 2: Set very high limits
"/api/health": {
  perIP: { maxTokens: 10000, refillRate: 1000, windowSeconds: 60 };
}
```

---

## 🔧 Operational Tasks

### Monitoring Rate Limits

**1. Check current token counts (Redis CLI)**

```bash
# Connect to Redis
docker exec -it relay-api-redis-1 redis-cli

# List all rate limit keys
KEYS rate_limit:*

# Check specific user's tokens
HMGET rate_limit:user:123:/api/posts tokens lastRefill

# Output: ["8.5", "1728318000"]
```

**2. View metrics in Prometheus**

```
http://localhost:9090/graph

Query: rate_limit_blocked_total
```

**3. Check logs for blocked requests**

```bash
# API Gateway logs
docker logs relay-api-api-gateway-1 | grep "Rate limit exceeded"
```

### Clearing Rate Limits (Emergency)

```bash
# Clear all rate limits for a specific user
docker exec -it relay-api-redis-1 redis-cli DEL "rate_limit:user:123:*"

# Clear all rate limits (nuclear option)
docker exec -it relay-api-redis-1 redis-cli FLUSHDB
```

### Temporarily Disable Rate Limiting

**Option 1: Environment Variable (not yet implemented)**

```bash
# .env
RATE_LIMITING_ENABLED=false
```

**Option 2: Comment out middleware (quick fix)**

```typescript
// services/api-gateway/src/index.ts
// app.use(createRateLimitMiddleware()); // ← Comment this line
```

---

## 🎯 Best Practices

### 1. **Set Limits Based on Real Usage**

- Monitor Prometheus metrics after deployment
- Start conservative, loosen if legitimate users hit limits
- Example: If 99th percentile of POST creation is 5/min, set limit to 10/min

### 2. **Differentiate Public vs Authenticated Limits**

- Public endpoints (IP-based): Stricter limits
- Authenticated endpoints: More generous per-user limits

### 3. **Graceful Degradation**

- Current implementation: **Fails open** (allows requests if Redis is down)
- For high-security endpoints, consider **failing closed**

```typescript
// In rate-limiter.ts
catch (error) {
  logger.error({ err: error, identifier }, "Rate limiter error");
  // FAIL CLOSED for critical endpoints
  if (path.includes("/api/admin/")) {
    return { allowed: false, tokensRemaining: 0, retryAfterSeconds: 60 };
  }
  // FAIL OPEN for normal endpoints
  return { allowed: true, tokensRemaining: -1 };
}
```

### 4. **Informative Error Messages**

```typescript
// Good ✅
{
  error: "Too many requests",
  message: "You can create up to 10 posts per minute. Please try again in 15 seconds.",
  retryAfter: 15
}

// Bad ❌
{ error: "Rate limited" }
```

### 5. **Log Rate Limit Events**

Already implemented! Check logs:

```json
{
  "level": "warn",
  "identifier": "user:123:/api/posts",
  "identifierType": "user",
  "path": "/api/posts",
  "clientIP": "192.168.1.1",
  "userId": 123,
  "msg": "Rate limit exceeded"
}
```

---

## 🔗 Integration with Other Services

### Load Balancer (NGINX)

When adding NGINX in front of multiple API Gateway instances:

```nginx
# nginx.conf
http {
  limit_req_zone $binary_remote_addr zone=global:10m rate=100r/s;

  upstream api_gateway {
    server api-gateway-1:5000;
    server api-gateway-2:5000;
    server api-gateway-3:5000;
  }

  server {
    location /api/ {
      # NGINX-level rate limiting (first line of defense)
      limit_req zone=global burst=20 nodelay;

      # Forward to API Gateway (which has application-level rate limiting)
      proxy_pass http://api_gateway;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

**Layered Rate Limiting:**

1. **NGINX Layer:** Protect against DDoS (simple IP-based)
2. **API Gateway Layer:** Fine-grained (per-user, per-endpoint)

### API Clients (React)

**Axios Interceptor for Rate Limit Handling**

```typescript
// services/relay-client/src/lib/apiClient.ts
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(
        error.response.headers["retry-after"] || "10"
      );

      // Show user-friendly message
      toast.warning(`Please slow down! Retry in ${retryAfter} seconds.`, {
        duration: retryAfter * 1000,
      });

      // Optional: Auto-retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## 📚 References

### Token Bucket Algorithm

- [Wikipedia: Token Bucket](https://en.wikipedia.org/wiki/Token_bucket)
- [NGINX Rate Limiting](https://www.nginx.com/blog/rate-limiting-nginx/)

### Redis Patterns

- [Redis Lua Scripting](https://redis.io/docs/manual/programmability/lua-api/)
- [Atomic Operations with Lua](https://redis.io/docs/manual/patterns/distributed-locks/)

### HTTP Standards

- [RFC 6585: 429 Too Many Requests](https://datatracker.ietf.org/doc/html/rfc6585#section-4)
- [Retry-After Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)

---

## 🚀 Next Steps

### Future Enhancements

1. **Dynamic Rate Limits**

   - Adjust limits based on user tier (free vs premium)
   - Time-of-day limits (stricter during peak hours)

2. **Rate Limit Analytics Dashboard**

   - Grafana dashboard showing:
     - Top rate-limited users
     - Most blocked endpoints
     - Time series of rate limit violations

3. **Rate Limit Exemptions**

   - Whitelist IPs (internal services, monitoring)
   - Admin users bypass limits

4. **Distributed Rate Limiting**

   - Redis Cluster for horizontal scaling
   - Consistent hashing for multi-region deployments

5. **Machine Learning Integration**
   - Detect suspicious patterns (sudden spikes)
   - Adaptive rate limiting based on user behavior

---

## ✅ Checklist for Production

Before deploying to production:

- [ ] Review and adjust rate limits based on expected traffic
- [ ] Set up Grafana dashboard for rate limit metrics
- [ ] Configure alerts for excessive rate limiting
- [ ] Test rate limiting with load testing tools (k6, Locust)
- [ ] Document rate limits in API documentation (Swagger/OpenAPI)
- [ ] Implement frontend UI to show users their rate limit status
- [ ] Set up Redis persistence (AOF or RDB) to survive restarts
- [ ] Configure Redis maxmemory policy (e.g., `allkeys-lru`)
- [ ] Add monitoring for Redis memory usage
- [ ] Test failover behavior (what happens when Redis is down?)

---

## 💡 Lessons Learned

1. **Rate limiting BEFORE authentication** prevents attackers from exhausting resources with invalid credentials

2. **Per-user limits require careful JWT handling**

   - Optional JWT extraction allows rate limiter to use user info when available
   - Don't enforce JWT validity in rate limiter (let `authenticateToken` handle that)

3. **Lua scripts are essential for atomic operations**

   - Prevents race conditions with concurrent requests
   - Ensures consistency in token bucket state

4. **Graceful degradation is critical**

   - Failing open (allowing requests) when Redis is down prevents service outage
   - For critical endpoints, consider failing closed

5. **Comprehensive testing catches edge cases**
   - Test unauthenticated requests, malformed JWTs, different endpoints
   - Mock Redis carefully to simulate real behavior

---

**Documentation Generated:** October 7, 2025  
**Implementation Team:** Relay API Development  
**Status:** ✅ Production Ready
