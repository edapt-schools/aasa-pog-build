# AASA Platform Web - Production Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace config and package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/

# Install all workspace dependencies (--legacy-peer-deps for React 19 compatibility)
RUN npm install --legacy-peer-deps

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/

# Build args for Vite (needed at build time)
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build the frontend
WORKDIR /app/packages/web
RUN npm run build

# Production stage - serve static files
FROM node:20-alpine AS runner
WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files
COPY --from=base /app/packages/web/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
