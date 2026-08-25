# Casuya AI — Dockerfile
# Builds the TypeScript library and runs the HTTP server (server.ts → dist/server.js)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ src/
COPY server.ts ./

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV CASUYA_AI_PORT=3000

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
