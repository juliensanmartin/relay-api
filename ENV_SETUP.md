# Environment Configuration Guide

## Overview

This document describes the environment variables needed for each service in the Relay API microservices architecture.

## Issues Found and Fixed

### ✅ Issues Identified:

1. **Missing .env files** - Services use `dotenv/config` but no environment files existed
2. **Incomplete docker-compose.yml** - Only infrastructure services were defined, microservices were missing
3. **No database initialization** - The db.sql file wasn't being executed automatically
4. **Hardcoded service URLs** - API Gateway used localhost instead of environment variables
5. **Incorrect Prometheus targets** - Used host.docker.internal instead of Docker service names

### ✅ Fixes Applied:

1. ✅ Updated `docker-compose.yml` to include all 4 microservices (api-gateway, auth-service, post-service, notification-service)
2. ✅ Added database initialization via `db.sql` mount
3. ✅ Added health checks for postgres and rabbitmq
4. ✅ Updated Dockerfile to support monorepo structure
5. ✅ Fixed API Gateway to use environment variables
6. ✅ Updated Prometheus configuration to use Docker service names
7. ✅ Created proper Docker network for all services

## Environment Variables Setup

### For Docker (Production/Container Mode)

All environment variables are defined in `docker-compose.yml`. You can start services with:

```bash
docker-compose up --build
```

### For Local Development

Create the following `.env` files for local development:

#### Root `.env` (Optional - for shared values)

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
DB_USER=relay
DB_PASSWORD=relay
DB_HOST=localhost
DB_DATABASE=relay_db
DB_PORT=5432
RABBITMQ_URL=amqp://localhost:5672
```

#### `services/api-gateway/.env`

```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:5001
POST_SERVICE_URL=http://localhost:5002
```

#### `services/auth-service/.env`

```env
PORT=5001
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Database
DB_USER=relay
DB_PASSWORD=relay
DB_HOST=localhost
DB_DATABASE=relay_db
DB_PORT=5432

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
```

#### `services/post-service/.env`

```env
PORT=5002

# Database
DB_USER=relay
DB_PASSWORD=relay
DB_HOST=localhost
DB_DATABASE=relay_db
DB_PORT=5432
```

#### `services/notification-service/.env`

```env
PORT=5003

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
```

## Environment Variables by Service

### API Gateway (Port 5000)

| Variable           | Description                 | Default               | Required |
| ------------------ | --------------------------- | --------------------- | -------- |
| `PORT`             | Server port                 | 5000                  | No       |
| `JWT_SECRET`       | Secret for JWT verification | default-secret        | **Yes**  |
| `AUTH_SERVICE_URL` | Auth service URL            | http://localhost:5001 | No       |
| `POST_SERVICE_URL` | Post service URL            | http://localhost:5002 | No       |

### Auth Service (Port 5001)

| Variable       | Description             | Default          | Required |
| -------------- | ----------------------- | ---------------- | -------- |
| `PORT`         | Server port             | 5001             | No       |
| `JWT_SECRET`   | Secret for JWT signing  | default-secret   | **Yes**  |
| `DB_USER`      | Database username       | -                | **Yes**  |
| `DB_PASSWORD`  | Database password       | -                | **Yes**  |
| `DB_HOST`      | Database host           | -                | **Yes**  |
| `DB_DATABASE`  | Database name           | -                | **Yes**  |
| `DB_PORT`      | Database port           | 5432             | No       |
| `RABBITMQ_URL` | RabbitMQ connection URL | amqp://localhost | No       |

### Post Service (Port 5002)

| Variable      | Description       | Default | Required |
| ------------- | ----------------- | ------- | -------- |
| `PORT`        | Server port       | 5002    | No       |
| `DB_USER`     | Database username | -       | **Yes**  |
| `DB_PASSWORD` | Database password | -       | **Yes**  |
| `DB_HOST`     | Database host     | -       | **Yes**  |
| `DB_DATABASE` | Database name     | -       | **Yes**  |
| `DB_PORT`     | Database port     | 5432    | No       |

### Notification Service (Port 5003)

| Variable       | Description             | Default          | Required |
| -------------- | ----------------------- | ---------------- | -------- |
| `PORT`         | Server port             | 5003             | No       |
| `RABBITMQ_URL` | RabbitMQ connection URL | amqp://localhost | No       |

## Service Connectivity Map

```
┌─────────────────┐
│   API Gateway   │ ──→ AUTH_SERVICE_URL ──→ Auth Service
│   (Port 5000)   │ ──→ POST_SERVICE_URL ──→ Post Service
└─────────────────┘
        │
        ↓ JWT_SECRET (must match)
        │
┌─────────────────┐     ┌──────────────┐
│  Auth Service   │ ──→ │  PostgreSQL  │
│   (Port 5001)   │     │  (Port 5432) │
└─────────────────┘     └──────────────┘
        │                      ↑
        ↓                      │
┌─────────────────┐           │
│   RabbitMQ      │           │
│   (Port 5672)   │           │
└─────────────────┘           │
        │                      │
        ↓                      │
┌─────────────────┐           │
│ Notification    │           │
│    Service      │           │
│   (Port 5003)   │           │
└─────────────────┘           │
                              │
┌─────────────────┐           │
│  Post Service   │ ──────────┘
│   (Port 5002)   │
└─────────────────┘
```

## Monitoring & Observability

- **Prometheus** (Port 9090): Metrics collection from `/metrics` endpoints
- **Grafana** (Port 3009): Visualization dashboard
- **Jaeger** (Port 16686): Distributed tracing UI

## Security Notes

⚠️ **IMPORTANT**:

- Change `JWT_SECRET` to a strong, random value in production
- Never commit `.env` files to version control
- Use proper secrets management (e.g., AWS Secrets Manager, Vault) in production
- Change default database credentials

## Running the Application

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Local Development (Manual)

```bash
# 1. Start infrastructure
docker-compose up postgres rabbitmq prometheus grafana jaeger

# 2. Create .env files as shown above

# 3. Start services individually
cd services/auth-service && pnpm dev
cd services/post-service && pnpm dev
cd services/notification-service && pnpm dev
cd services/api-gateway && pnpm dev
```

## Health Check Endpoints

All services expose health check endpoints:

- API Gateway: http://localhost:5000/health
- Auth Service: http://localhost:5001/health
- Post Service: http://localhost:5002/health
- Notification Service: http://localhost:5003/health

## Troubleshooting

### Services can't connect to database

- Ensure PostgreSQL is running and healthy
- Check `DB_HOST` is correct (`localhost` for local, `postgres` for Docker)
- Verify credentials match in both docker-compose.yml and .env files

### JWT token issues

- Ensure `JWT_SECRET` is **identical** in api-gateway and auth-service
- Default value "default-secret" is only for development

### RabbitMQ connection failures

- Check if RabbitMQ is running: http://localhost:15672 (guest/guest)
- Ensure `RABBITMQ_URL` uses correct host (`localhost` for local, `rabbitmq` for Docker)

### Port conflicts

- If ports are already in use, update the port mappings in docker-compose.yml
- For local development, update the PORT env vars in each service's .env
