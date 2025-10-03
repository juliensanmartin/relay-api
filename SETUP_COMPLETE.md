# ✅ Setup Complete - Relay API Microservices

## 🚀 Quick Start

### Option 1: Full Docker Deployment (Recommended for Testing)

```bash
# Start all services with Docker Compose
docker-compose up --build
```

This will start:

- PostgreSQL (port 5432)
- RabbitMQ (ports 5672, 15672)
- Prometheus (port 9090)
- Grafana (port 3009)
- Jaeger (port 16686)
- Auth Service (port 5001)
- Post Service (port 5002)
- Notification Service (port 5003)
- API Gateway (port 5000)

### Option 2: Local Development

```bash
# 1. Create .env files (run once)
./create-env-files.sh

# 2. Start infrastructure only
docker-compose up postgres rabbitmq prometheus grafana jaeger -d

# 3. In separate terminals, start each service
cd services/auth-service && pnpm dev
cd services/post-service && pnpm dev
cd services/notification-service && pnpm dev
cd services/api-gateway && pnpm dev
```

### Option 3: Use the Helper Script

```bash
./start-services.sh
```

## 📋 Environment Variables Summary

### Critical Variables (Must Match!)

- **`JWT_SECRET`**: Must be **identical** in `api-gateway` and `auth-service`

### Service Connectivity

```
API Gateway → AUTH_SERVICE_URL=http://auth-service:5001 (Docker) or http://localhost:5001 (Local)
           → POST_SERVICE_URL=http://post-service:5002 (Docker) or http://localhost:5002 (Local)

Auth Service → DB_HOST=postgres (Docker) or localhost (Local)
            → RABBITMQ_URL=amqp://rabbitmq:5672 (Docker) or amqp://localhost:5672 (Local)

Post Service → DB_HOST=postgres (Docker) or localhost (Local)

Notification → RABBITMQ_URL=amqp://rabbitmq:5672 (Docker) or amqp://localhost:5672 (Local)
```

## 🔍 Verification Checklist

### ✅ Docker Compose Verification

```bash
# Check all containers are running
docker-compose ps

# Expected output: All services should be "Up" and healthy
# - postgres (healthy)
# - rabbitmq (healthy)
# - auth-service (Up)
# - post-service (Up)
# - notification-service (Up)
# - api-gateway (Up)
# - prometheus (Up)
# - grafana (Up)
# - jaeger (Up)

# Check logs for any errors
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
docker-compose logs -f post-service
docker-compose logs -f notification-service
```

### ✅ Health Check Endpoints

```bash
curl http://localhost:5000/health  # API Gateway
curl http://localhost:5001/health  # Auth Service
curl http://localhost:5002/health  # Post Service
curl http://localhost:5003/health  # Notification Service
```

All should return: `{"status":"UP"}`

### ✅ Database Connection

```bash
# Connect to PostgreSQL
docker exec -it postgres psql -U relay -d relay_db

# Check tables exist
\dt

# Expected: users, posts, upvotes tables
```

### ✅ RabbitMQ Connection

Visit: http://localhost:15672

- Username: `guest`
- Password: `guest`
- Should see `user_registered_queue` queue

### ✅ Monitoring

- **Prometheus**: http://localhost:9090

  - Go to Status → Targets
  - Should see auth-service, post-service, notification-service all "UP"

- **Grafana**: http://localhost:3009

  - Default login: admin/admin
  - Add Prometheus datasource: http://prometheus:9090

- **Jaeger**: http://localhost:16686
  - Should see traces when services are called

## 🧪 Test the API

```bash
# 1. Register a user
curl -X POST http://localhost:5000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Save the token from response

# 3. Create a post (replace YOUR_TOKEN)
curl -X POST http://localhost:5000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "My First Post",
    "url": "https://example.com"
  }'

# 4. Get all posts
curl -X GET http://localhost:5000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔒 Security Notes

⚠️ **IMPORTANT for Production:**

1. **Change JWT_SECRET**: Use a strong, random value (min 32 characters)

   ```bash
   openssl rand -base64 32
   ```

2. **Change Database Credentials**: Update in both `.env` and `docker-compose.yml`

3. **Don't Commit `.env` Files**: They're gitignored, keep it that way!

4. **Use Secrets Management**:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets
5. **Enable HTTPS**: Add reverse proxy (nginx/traefik) with SSL/TLS

6. **Update RabbitMQ Credentials**: Change from default guest/guest

## 📊 Service Architecture

```
                                    ┌──────────────┐
                                    │   Client     │
                                    └──────┬───────┘
                                           │
                                           ↓
                                    ┌──────────────┐
                                    │ API Gateway  │ :5000
                                    └──────┬───────┘
                                           │
                            ┌──────────────┼──────────────┐
                            ↓                             ↓
                    ┌───────────────┐           ┌────────────────┐
                    │ Auth Service  │ :5001     │  Post Service  │ :5002
                    └───────┬───────┘           └────────┬───────┘
                            │                            │
                            ↓                            ↓
                    ┌───────────────┐           ┌────────────────┐
                    │   RabbitMQ    │           │   PostgreSQL   │
                    └───────┬───────┘           └────────────────┘
                            │
                            ↓
                  ┌──────────────────┐
                  │  Notification    │ :5003
                  │    Service       │
                  └──────────────────┘

        Monitoring:
        ┌──────────────┐  ┌──────────┐  ┌──────────┐
        │  Prometheus  │  │  Grafana │  │  Jaeger  │
        │    :9090     │  │   :3009  │  │  :16686  │
        └──────────────┘  └──────────┘  └──────────┘
```

## 🐛 Troubleshooting

### Issue: Services can't connect to database

**Solution**:

- In Docker: Use `DB_HOST=postgres`
- Locally: Use `DB_HOST=localhost`

### Issue: JWT verification fails

**Solution**: Ensure `JWT_SECRET` is identical in api-gateway and auth-service

### Issue: Port already in use

**Solution**:

```bash
# Find and kill process using port
lsof -ti:5000 | xargs kill -9

# Or change port in docker-compose.yml
```

### Issue: Database tables don't exist

**Solution**:

```bash
# Recreate database
docker-compose down -v  # Warning: deletes data!
docker-compose up postgres -d

# Wait for it to be healthy, then check
docker exec -it postgres psql -U relay -d relay_db -f /docker-entrypoint-initdb.d/init.sql
```

### Issue: RabbitMQ connection refused

**Solution**:

```bash
# Check RabbitMQ is running
docker-compose ps rabbitmq

# Check logs
docker-compose logs rabbitmq

# Restart if needed
docker-compose restart rabbitmq
```

## 📚 Additional Resources

- **Full Environment Guide**: See `ENV_SETUP.md`
- **API Documentation**: (To be added)
- **Architecture Diagrams**: See above

## ✅ Next Steps

1. ✅ All configuration files are updated and correct
2. ✅ Docker Compose is ready to use
3. ✅ Helper scripts created for easy setup
4. ⚠️ **ACTION REQUIRED**: Create `.env` files (run `./create-env-files.sh`)
5. ⚠️ **ACTION REQUIRED**: Test the setup (run `./start-services.sh`)
6. 🔒 **IMPORTANT**: Change security credentials before production deployment

---

**Created**: $(date)
**Status**: ✅ Ready for Development
