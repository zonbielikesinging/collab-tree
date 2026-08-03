# ── Build stage ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY client/package*.json client/
RUN cd client && npm install
COPY client/ client/
RUN cd client && npx vite build

# ── Production stage ──
FROM node:22-alpine
WORKDIR /app

# Copy server
COPY server/package*.json server/
RUN cd server && npm install --omit=dev --omit=optional
COPY server/ server/

# Copy built client
COPY --from=builder /app/client/dist /app/client/dist

# Data directory for persistence
RUN mkdir -p /app/server/data

ENV PORT=1234
ENV NODE_ENV=production
ENV DISABLE_TUNNEL=1

EXPOSE 1234

CMD ["node", "--max-old-space-size=192", "server/server.cjs"]