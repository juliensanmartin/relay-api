# 1. Start with a base image that has Node.js installed
FROM node:22-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files and install dependencies
# This is done separately to leverage Docker's layer caching
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# 4. Copy the rest of the application code
COPY . .

# 5. Build the TypeScript code into JavaScript
RUN pnpm build

# 6. Expose the port the app runs on
EXPOSE 5000

# 7. The command to run when the container starts
CMD [ "node", "dist/index.js" ]