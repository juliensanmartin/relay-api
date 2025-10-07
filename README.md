# 🚀 Relay API - Microservices Social News Aggregator

A production-ready, microservices-based social news aggregator (similar to Hacker News/Reddit) built with Node.js, TypeScript, React, and a complete observability stack.

## 📐 Architecture Overview

Relay follows a distributed microservices architecture with API Gateway pattern, event-driven communication, and comprehensive observability.

```
┌─────────────────┐
│  React Client   │
│  (Port 5173)    │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  API Gateway    │◄──────┐
│  (Port 5000)    │       │ Service Discovery
└────────┬────────┘       │
         │                │
    ┌────┴────┬───────────┴───┐
    ▼         ▼               ▼
┌──────┐  ┌──────┐      ┌──────────┐
│ Auth │  │ Post │      │  Notif   │
│ 5001 │  │ 5002 │      │  5003    │
└──┬───┘  └──┬───┘      └────┬─────┘
   │         │                │
   │    ┌────┴────┐          │
   │    ▼         │          │
   │ ┌──────────┐ │          │
   └►│PostgreSQL│◄┘          │
     └──────────┘            │
          ▲                  │
          │              ┌───▼────┐
          └──────────────┤RabbitMQ│
                         └────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 22+
- pnpm 10+

### Start All Services

```bash
# Clone the repository
git clone <your-repo-url>
cd relay-api

# Install dependencies
pnpm install

# Start infrastructure and services
docker compose up -d

# Start the React client (in a separate terminal)
cd services/relay-client
pnpm dev
```

### Access the Application

| Service         | URL                    | Credentials |
| --------------- | ---------------------- | ----------- |
| **Frontend**    | http://localhost:5173  | -           |
| **API Gateway** | http://localhost:5000  | -           |
| **Jaeger UI**   | http://localhost:16686 | -           |
| **Prometheus**  | http://localhost:9090  | -           |
| **Grafana**     | http://localhost:3009  | admin/admin |
| **RabbitMQ**    | http://localhost:15672 | guest/guest |
| **PostgreSQL**  | localhost:5432         | relay/relay |
| **Redis**       | localhost:6379         | -           |

---

## 🔧 Services

### 1. API Gateway (`services/api-gateway`)

**Port:** 5000

Entry point for all client requests with:

- JWT authentication & validation
- Request routing to microservices
- Circuit breaker pattern (Opossum)
- Retry logic with exponential backoff
- CORS handling
- Distributed tracing

**Technology:** Express.js, Axios, OpenTelemetry

---

### 2. Auth Service (`services/auth-service`)

**Port:** 5001

User authentication & management:

- User registration with bcrypt password hashing
- JWT token generation & validation
- Login authentication
- Event publishing to RabbitMQ
- Prometheus metrics

**Database Tables:**

- `users` (id, username, email, password_hash, created_at)

**Technology:** Express.js, PostgreSQL, bcrypt, JWT, RabbitMQ

---

### 3. Post Service (`services/post-service`)

**Port:** 5002

Content management (posts & upvotes) with Redis caching:

- Create posts with title and URL
- View all posts (sorted by upvotes) with Cache-Aside pattern
- Upvote posts with duplicate prevention
- Automatic cache invalidation on data changes
- Prometheus metrics for cache performance

**Database Tables:**

- `posts` (id, title, url, user_id, created_at)
- `upvotes` (id, user_id, post_id, created_at)

**Caching Strategy:**

- Pattern: Cache-Aside (Lazy Loading)
- Key: `posts:all`
- TTL: 300 seconds (5 minutes)
- Invalidation: On post creation, upvote, or unvote

**Technology:** Express.js, PostgreSQL, Redis, Pino, @relay/cache

---

### 4. Notification Service (`services/notification-service`)

**Port:** 5003

Asynchronous event processing:

- Consumes events from RabbitMQ
- Processes user registration events
- Sends notifications (console logging)
- Event-driven architecture example

**Technology:** Express.js, RabbitMQ, Pino

---

### 5. Relay Client (`services/relay-client`)

**Port:** 5173

Frontend user interface:

- User registration & login
- Post creation form
- Post feed with upvoting
- JWT token management
- Responsive UI with Tailwind CSS

**Technology:** React 18, TypeScript, Vite, Tailwind CSS v4, Axios

---

## 🛣️ API Routes

### Auth Service Routes (`/api/auth/*`)

| Method | Route             | Description       | Auth Required |
| ------ | ----------------- | ----------------- | ------------- |
| POST   | `/api/auth/users` | Register new user | ❌            |
| POST   | `/api/auth/login` | Login and get JWT | ❌            |

**Example:**

```bash
# Register
curl -X POST http://localhost:5000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
```

---

### Post Service Routes (`/api/posts/*`)

| Method | Route                   | Description     | Auth Required |
| ------ | ----------------------- | --------------- | ------------- |
| GET    | `/api/posts`            | Get all posts   | ✅            |
| POST   | `/api/posts`            | Create new post | ✅            |
| POST   | `/api/posts/:id/upvote` | Upvote a post   | ✅            |

**Example:**

```bash
# Get posts
curl http://localhost:5000/api/posts \
  -H "Authorization: Bearer <jwt_token>"

# Create post
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cool Article","url":"https://example.com"}'

# Upvote
curl -X POST http://localhost:5000/api/posts/1/upvote \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 📊 Observability Stack

> **💡 Confused about where to look for metrics?** Read the [OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md) for a complete breakdown!

**Quick Reference:**

- **Prometheus** (port 9090) → Metrics & trends ("How many? How fast?")
- **Grafana** (port 3009) → Beautiful dashboards & alerts
- **Jaeger** (port 16686) → Individual request traces ("What happened to THIS request?")
- **Pino Logs** → Detailed error messages & debugging

### 1. Distributed Tracing - Jaeger

**URL:** http://localhost:16686

Features:

- Automatic instrumentation of Express, PostgreSQL, Axios
- Service dependency graph
- Request flow visualization
- Performance bottleneck identification
- Error tracking across services

**Traced Services:**

- api-gateway
- auth-service
- post-service
- notification-service

**Implementation:** OpenTelemetry SDK with auto-instrumentation

---

### 2. Metrics - Prometheus

**URL:** http://localhost:9090

Features:

- Automatic service discovery
- 15-second scrape interval
- HTTP request metrics
- Database query metrics
- Custom business metrics

**Scraped Endpoints:**

- `api-gateway:5000/metrics`
- `auth-service:5001/metrics`
- `post-service:5002/metrics`
- `notification-service:5003/metrics`

---

### 3. Visualization - Grafana

**URL:** http://localhost:3009  
**Credentials:** admin/admin

Features:

- Pre-configured Prometheus data source
- Custom dashboard creation
- Alerting capabilities
- Time-series visualization

---

### 4. Logging - Pino

All services use structured JSON logging with:

- Request/response logging
- Error tracking
- Performance metrics
- Pretty-printing in development

---

## 🗄️ Infrastructure

### PostgreSQL (Port 5432)

- **Version:** 15
- **Database:** relay_db
- **User:** relay/relay
- **Schema:** Defined in `db.sql`
- **Health Check:** `pg_isready`

### Redis (Port 6379)

- **Version:** 7 (Alpine)
- **Purpose:** Caching layer for frequently accessed data
- **Persistence:** AOF (Append-Only File) enabled
- **Pattern:** Cache-Aside (Lazy Loading)
- **Health Check:** `redis-cli ping`
- **Shared Package:** `@relay/cache` (ioredis client)

**Cache Keys:**

- `posts:all` - All posts sorted by creation date (TTL: 5 minutes)

**Metrics:**

- `cache_hits_total` - Total cache hits
- `cache_misses_total` - Total cache misses
- `cache_operation_duration_ms` - Cache operation latency

### RabbitMQ (Ports 5672, 15672)

- **Version:** 3.11
- **Management UI:** http://localhost:15672 (guest/guest)
- **Queue:** `user_events`
- **Health Check:** `rabbitmq-diagnostics ping`

---

## 🛠️ Technology Stack

### Backend

- **Runtime:** Node.js 22
- **Language:** TypeScript 5.x
- **Framework:** Express.js
- **Database:** PostgreSQL 15 (pg driver)
- **Cache:** Redis 7 (ioredis client)
- **Message Queue:** RabbitMQ 3.11 (amqplib)
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Logging:** Pino
- **Metrics:** prom-client
- **Tracing:** OpenTelemetry

### Frontend

- **Framework:** React 18
- **Build Tool:** Vite 7
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **HTTP Client:** Axios

### Infrastructure

- **Container:** Docker + Docker Compose
- **Package Manager:** pnpm (monorepo workspace)
- **Process Manager:** ts-node
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **Message Broker:** RabbitMQ 3.11

### Observability

- **Tracing:** Jaeger 1.53
- **Metrics:** Prometheus 2.47
- **Visualization:** Grafana 10.1
- **Instrumentation:** OpenTelemetry

---

## 🔐 Security Features

1. **JWT Authentication**

   - Token-based authentication
   - 1-hour expiration
   - Stateless sessions

2. **Password Security**

   - bcrypt hashing (10 salt rounds)
   - No plaintext storage

3. **SQL Injection Prevention**

   - Parameterized queries
   - Prepared statements

4. **CORS Protection**
   - Configured in API Gateway
   - Controlled origin access

---

## 🎯 Key Features

### Caching Strategy (NEW! 🎉)

**Cache-Aside Pattern Implementation:**

1. **Automatic Caching**

   - First request fetches from database
   - Subsequent requests served from Redis
   - Performance improvement: 20x faster (< 5ms vs 50-100ms)

2. **Smart Invalidation**

   - Cache cleared on post creation
   - Cache cleared on upvote/downvote
   - Pattern-based deletion (`posts:*`)

3. **Observability**

   - Prometheus metrics for cache hits/misses
   - Cache operation duration tracking
   - Redis health monitoring

4. **Resilience**
   - Graceful fallback to database on cache failure
   - Connection retry logic
   - Error logging

### Resilience Patterns

1. **Circuit Breaker** (API Gateway)

   - Automatic failure detection
   - Service degradation
   - Timeout handling

2. **Retry Logic**

   - Exponential backoff
   - Configurable retry attempts
   - Idempotent request handling

3. **Health Checks**
   - Database connectivity
   - Redis cache availability
   - Message queue availability
   - Service readiness

### Event-Driven Architecture

- Asynchronous user creation events
- RabbitMQ message queue
- Decoupled service communication
- Scalable notification system

### Complete Observability

- Full request tracing across services
- Service dependency mapping
- Performance monitoring
- Error tracking
- Business metrics
- Cache performance metrics

---

## 📦 Project Structure

```
relay-api/
├── services/
│   ├── api-gateway/          # Entry point & routing (Port 5000)
│   ├── auth-service/         # Authentication (Port 5001)
│   ├── post-service/         # Content management (Port 5002)
│   ├── notification-service/ # Event processing (Port 5003)
│   └── relay-client/         # React frontend (Port 5173)
├── packages/
│   └── tracing/             # Shared OpenTelemetry configuration
├── monitoring/
│   └── prometheus.yml       # Prometheus scrape configuration
├── docker-compose.yml       # Infrastructure orchestration
├── Dockerfile              # Multi-service container build
├── db.sql                  # PostgreSQL schema & seed data
├── pnpm-workspace.yaml     # Monorepo configuration
└── tsconfig.json           # Root TypeScript configuration
```

---

## 🔄 Data Flow Examples

### User Registration Flow

1. User submits registration form (Frontend)
2. `POST /api/auth/users` → API Gateway
3. API Gateway routes to Auth Service
4. Auth Service hashes password & saves to PostgreSQL
5. Auth Service publishes event to RabbitMQ
6. Notification Service consumes event
7. Notification Service logs welcome message
8. Response flows back to client

**View in Jaeger:** Complete flow with timing and dependencies

---

### Post Creation & Upvote Flow

1. User creates post (Frontend)
2. `POST /api/posts` → API Gateway (validates JWT)
3. API Gateway routes to Post Service
4. Post Service inserts into PostgreSQL
5. Response with post data
6. User upvotes → `POST /api/posts/:id/upvote`
7. Post Service checks for duplicate upvote
8. Inserts upvote record if unique
9. Returns success or error

**View in Jaeger:** Database query times and performance

---

## 🚀 Development

### Running Services Locally (Without Docker)

```bash
# Terminal 1: Start PostgreSQL & RabbitMQ
docker compose up postgres rabbitmq jaeger prometheus grafana

# Terminal 2: Auth Service
cd services/auth-service
pnpm dev

# Terminal 3: Post Service
cd services/post-service
pnpm dev

# Terminal 4: Notification Service
cd services/notification-service
pnpm dev

# Terminal 5: API Gateway
cd services/api-gateway
pnpm dev

# Terminal 6: React Client
cd services/relay-client
pnpm dev
```

### Environment Variables

Each service supports these environment variables:

**Auth Service:**

```bash
PORT=5001
SERVICE_NAME=auth-service
DB_HOST=postgres
DB_PORT=5432
DB_USER=relay
DB_PASSWORD=relay
DB_DATABASE=relay_db
JWT_SECRET=your-secret-key
RABBITMQ_URL=amqp://rabbitmq:5672
```

**Post Service:**

```bash
PORT=5002
SERVICE_NAME=post-service
DB_HOST=postgres
DB_PORT=5432
DB_USER=relay
DB_PASSWORD=relay
DB_DATABASE=relay_db
```

**Notification Service:**

```bash
PORT=5003
SERVICE_NAME=notification-service
RABBITMQ_URL=amqp://rabbitmq:5672
```

**API Gateway:**

```bash
PORT=5000
SERVICE_NAME=api-gateway
JWT_SECRET=your-secret-key
AUTH_SERVICE_URL=http://auth-service:5001
POST_SERVICE_URL=http://post-service:5002
```

---

## 🧪 Testing the System

### 1. Test User Registration

```bash
curl -X POST http://localhost:5000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### 2. Test Login

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r .token)

echo $TOKEN
```

### 3. Test Create Post

```bash
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","url":"https://example.com"}'
```

### 4. Test Get Posts

```bash
curl http://localhost:5000/api/posts \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Test Upvote

```bash
curl -X POST http://localhost:5000/api/posts/1/upvote \
  -H "Authorization: Bearer $TOKEN"
```

### 6. View Traces in Jaeger

1. Open http://localhost:16686
2. Select a service (e.g., `api-gateway`)
3. Click "Find Traces"
4. Click on a trace to see the complete flow

### 7. Test Redis Caching (NEW! 🎉)

**Test Cache-Aside Pattern:**

```bash
# First request - Cache MISS (fetches from database)
time curl http://localhost:5000/api/posts -H "Authorization: Bearer $TOKEN"

# Second request - Cache HIT (served from Redis, much faster!)
time curl http://localhost:5000/api/posts -H "Authorization: Bearer $TOKEN"

# View cache metrics in Prometheus
open http://localhost:9090
# Query: cache_hits_total
# Query: cache_misses_total
# Query: cache_operation_duration_ms
```

**Test Cache Invalidation:**

```bash
# Create a new post (this invalidates the cache)
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Cache Invalidation","url":"https://example.com"}'

# Next GET request will be a cache MISS
curl http://localhost:5000/api/posts -H "Authorization: Bearer $TOKEN"
```

**Check Redis directly:**

```bash
# Connect to Redis
docker compose exec redis redis-cli

# View all keys
KEYS *

# Get cached posts
GET posts:all

# View TTL
TTL posts:all

# Exit
exit
```

---

## 🎓 Architectural Decisions

### Why Microservices?

- **Independent Scaling:** Scale services based on demand
- **Technology Diversity:** Use best tools for each service
- **Fault Isolation:** Failures don't cascade
- **Team Autonomy:** Teams can work independently

### Why API Gateway Pattern?

- **Single Entry Point:** Simplified client access
- **Centralized Authentication:** JWT validation in one place
- **Service Abstraction:** Hide internal architecture
- **Rate Limiting & Security:** Centralized control

### Why Event-Driven with RabbitMQ?

- **Asynchronous Processing:** Non-blocking operations
- **Service Decoupling:** Services don't need to know each other
- **Scalability:** Easy to add more consumers
- **Reliability:** Message persistence and acknowledgments

### Why OpenTelemetry?

- **Vendor-Neutral:** Not locked to specific vendors
- **Auto-Instrumentation:** Minimal code changes
- **Future-Proof:** Industry standard
- **Comprehensive:** Traces, metrics, and logs

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check if ports are available
lsof -i :5000
lsof -i :5001
lsof -i :5002
lsof -i :5003
lsof -i :5173

# Rebuild containers
docker compose down
docker compose up --build -d
```

### Database connection issues

```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Connect to database
docker compose exec postgres psql -U relay -d relay_db
```

### RabbitMQ not receiving messages

```bash
# Check RabbitMQ is healthy
docker compose ps rabbitmq

# View RabbitMQ logs
docker compose logs rabbitmq

# Access management UI
open http://localhost:15672
```

### No traces in Jaeger

```bash
# Check services are sending traces
docker compose logs api-gateway | grep -i "tracing\|telemetry"

# Check Jaeger is receiving data
docker compose logs jaeger
```

### Redis connection issues

```bash
# Check Redis is healthy
docker compose ps redis

# Test Redis connection
docker compose exec redis redis-cli ping
# Expected output: PONG

# View Redis logs
docker compose logs redis

# Check cache stats in post-service health endpoint
curl http://localhost:5002/health
```

### Cache not working

```bash
# Check post-service logs for cache operations
docker compose logs post-service | grep -i "cache"

# View cache metrics in Prometheus
open http://localhost:9090
# Query: rate(cache_hits_total[1m])
# Query: rate(cache_misses_total[1m])

# Manually flush cache
docker compose exec redis redis-cli FLUSHALL
```

---

## 📝 License

MIT

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ using modern microservices architecture and production-grade observability**
