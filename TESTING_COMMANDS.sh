#!/bin/bash

# 🧪 Relay API - Testing Commands Reference
# Quick reference for all testing commands

echo "🧪 Relay API Testing Commands"
echo "=============================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 1. Install Dependencies${NC}"
echo "   pnpm install"
echo ""

echo -e "${BLUE}🐳 2. Start Infrastructure (for integration tests)${NC}"
echo "   docker compose up -d postgres redis rabbitmq"
echo "   sleep 10  # Wait for services"
echo ""

echo -e "${BLUE}🚀 3. Start All Services (for E2E tests)${NC}"
echo "   docker compose up -d"
echo "   sleep 15  # Wait for all services"
echo ""

echo -e "${GREEN}🧪 4. Run Tests${NC}"
echo ""
echo "   All tests:"
echo "   pnpm test"
echo ""
echo "   Unit tests only (fast, no dependencies):"
echo "   pnpm test:unit"
echo ""
echo "   Integration tests (requires PostgreSQL + Redis):"
echo "   pnpm test:integration"
echo ""
echo "   E2E tests (requires all services):"
echo "   pnpm test:e2e"
echo ""
echo "   Coverage report:"
echo "   pnpm test:coverage"
echo ""

echo -e "${GREEN}📊 5. Test by Service${NC}"
echo ""
echo "   Auth Service:"
echo "   cd services/auth-service && pnpm test"
echo ""
echo "   Post Service:"
echo "   cd services/post-service && pnpm test"
echo ""
echo "   API Gateway:"
echo "   cd services/api-gateway && pnpm test"
echo ""
echo "   E2E Tests:"
echo "   cd e2e-tests && pnpm test"
echo ""

echo -e "${GREEN}🔍 6. Watch Mode (auto-rerun)${NC}"
echo ""
echo "   cd services/auth-service"
echo "   pnpm test:watch"
echo ""

echo -e "${GREEN}🐛 7. Debug Tests${NC}"
echo ""
echo "   Playwright (E2E):"
echo "   cd e2e-tests"
echo "   pnpm test:debug      # Step-by-step debugging"
echo "   pnpm test:headed     # See browser"
echo "   pnpm test:ui         # Interactive UI"
echo ""

echo -e "${GREEN}📈 8. View Coverage Report${NC}"
echo ""
echo "   open services/auth-service/coverage/index.html"
echo "   open services/post-service/coverage/index.html"
echo "   open services/api-gateway/coverage/index.html"
echo ""

echo -e "${YELLOW}🎯 Quick Start (Most Common)${NC}"
echo ""
echo "   # Run unit tests (no setup required)"
echo "   pnpm test:unit"
echo ""
echo "   # Run all tests (requires services)"
echo "   docker compose up -d"
echo "   sleep 15"
echo "   pnpm test"
echo ""

echo -e "${YELLOW}📚 Documentation${NC}"
echo ""
echo "   Comprehensive guide:  cat TESTING.md"
echo "   Quick reference:      cat TEST_QUICK_START.md"
echo "   This file:            cat TESTING_COMMANDS.sh"
echo ""

