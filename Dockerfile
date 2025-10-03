# Multi-service Dockerfile for pnpm workspace
FROM node:22-alpine

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./

# Copy all packages and services (for workspace dependencies)
COPY packages ./packages
COPY services ./services

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the tracing package if it exists
RUN cd packages/tracing && pnpm build || true

# Accept SERVICE_PATH as a build argument
ARG SERVICE_PATH
ENV SERVICE_PATH=${SERVICE_PATH}

# Set working directory to the specific service
WORKDIR /app/${SERVICE_PATH}

# The command to run when the container starts
CMD ["pnpm", "start"]