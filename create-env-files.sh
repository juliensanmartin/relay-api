#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Creating .env files for local development${NC}"
echo "================================================"

# Generate a random JWT secret
JWT_SECRET=$(openssl rand -base64 32)

echo -e "${YELLOW}Generated JWT_SECRET: ${JWT_SECRET}${NC}"
echo ""

# Root .env
cat > .env << EOF
# =================================================================
# SHARED ENVIRONMENT VARIABLES
# =================================================================

# JWT Secret
JWT_SECRET=${JWT_SECRET}

# Database Configuration
DB_USER=relay
DB_PASSWORD=relay
DB_HOST=localhost
DB_DATABASE=relay_db
DB_PORT=5432

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672

# Service Ports
API_GATEWAY_PORT=5000
AUTH_SERVICE_PORT=5001
POST_SERVICE_PORT=5002
NOTIFICATION_SERVICE_PORT=5003
EOF
echo -e "${GREEN}✅ Created: .env${NC}"

# API Gateway .env
cat > services/api-gateway/.env << EOF
PORT=5000
JWT_SECRET=${JWT_SECRET}
AUTH_SERVICE_URL=http://localhost:5001
POST_SERVICE_URL=http://localhost:5002
EOF
echo -e "${GREEN}✅ Created: services/api-gateway/.env${NC}"

# Auth Service .env
cat > services/auth-service/.env << EOF
PORT=5001
JWT_SECRET=${JWT_SECRET}

# Database Configuration
DB_USER=relay
DB_PASSWORD=relay
DB_HOST=localhost
DB_DATABASE=relay_db
DB_PORT=5432

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
EOF
echo -e "${GREEN}✅ Created: services/auth-service/.env${NC}"

# Post Service .env
cat > services/post-service/.env << EOF
PORT=5002

# Database Configuration
DB_USER=relay
DB_PASSWORD=relay
DB_HOST=localhost
DB_DATABASE=relay_db
DB_PORT=5432
EOF
echo -e "${GREEN}✅ Created: services/post-service/.env${NC}"

# Notification Service .env
cat > services/notification-service/.env << EOF
PORT=5003

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
EOF
echo -e "${GREEN}✅ Created: services/notification-service/.env${NC}"

echo ""
echo -e "${GREEN}🎉 All .env files created successfully!${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: The JWT_SECRET has been set to: ${JWT_SECRET}${NC}"
echo -e "${YELLOW}   Make sure this is kept secret and use a different value in production!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the .env files and adjust if needed"
echo "2. Start infrastructure: docker-compose up postgres rabbitmq prometheus grafana jaeger -d"
echo "3. Run services: pnpm dev (in each service directory)"
echo "   OR use the helper script: ./start-services.sh"

