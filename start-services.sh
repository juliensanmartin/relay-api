#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Relay API - Starting All Services${NC}"
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if .env files exist for local development
if [ ! -f "services/auth-service/.env" ] || [ ! -f "services/post-service/.env" ] || [ ! -f "services/notification-service/.env" ] || [ ! -f "services/api-gateway/.env" ]; then
    echo -e "${YELLOW}⚠️  Warning: Some .env files are missing for local development.${NC}"
    echo -e "${YELLOW}   For Docker deployment, this is OK (using docker-compose.yml env vars).${NC}"
    echo -e "${YELLOW}   For local development, please create .env files (see ENV_SETUP.md).${NC}"
    echo ""
fi

# Ask user for deployment mode
echo "Select deployment mode:"
echo "1) Docker Compose (All services in containers)"
echo "2) Hybrid (Infrastructure in Docker, services locally)"
echo "3) Cancel"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo -e "${GREEN}🐳 Starting all services with Docker Compose...${NC}"
        docker-compose up --build
        ;;
    2)
        echo -e "${GREEN}🐳 Starting infrastructure services only...${NC}"
        docker-compose up postgres rabbitmq prometheus grafana jaeger -d
        
        echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
        sleep 10
        
        echo -e "${GREEN}✅ Infrastructure started!${NC}"
        echo ""
        echo "Now start your services manually:"
        echo "  cd services/auth-service && pnpm dev"
        echo "  cd services/post-service && pnpm dev"
        echo "  cd services/notification-service && pnpm dev"
        echo "  cd services/api-gateway && pnpm dev"
        echo ""
        echo "Access points:"
        echo "  - PostgreSQL: localhost:5432"
        echo "  - RabbitMQ UI: http://localhost:15672 (guest/guest)"
        echo "  - Prometheus: http://localhost:9090"
        echo "  - Grafana: http://localhost:3009"
        echo "  - Jaeger: http://localhost:16686"
        ;;
    3)
        echo -e "${YELLOW}Cancelled.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

