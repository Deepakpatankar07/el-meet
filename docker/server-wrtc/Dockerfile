FROM node:22-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y git python3 make g++

# Install PNPM globally
RUN npm install -g pnpm

ARG DATABASE_URL

WORKDIR /usr/src/app

# Copy all necessary monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY ./packages /usr/src/app/packages
COPY ./apps/wrtc-backend /usr/src/app/apps/wrtc-backend

RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd packages/db && DATABASE_URL=${DATABASE_URL} pnpm prisma generate

# Expose port for the client app
EXPOSE 8000

WORKDIR /usr/src/app/apps/wrtc-backend

# Build and start the client app
RUN pnpm run build 

CMD ["pnpm", "run", "start"]