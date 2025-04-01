FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache git

# Install PNPM globally
RUN npm install -g pnpm

WORKDIR /usr/src/app

# Copy all necessary monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web ./apps/web

# Install project dependencies
RUN pnpm install --frozen-lockfile

# Expose port for the client app
EXPOSE 3000

WORKDIR /usr/src/app/apps/web

# Build and start the client app
RUN pnpm run build 
CMD ["pnpm", "run", "start"]