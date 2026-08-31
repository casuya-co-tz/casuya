# Casuya AI — Dockerfile
# Builds the TypeScript library + HTTP server (server.ts → dist/server.js)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.json ./
COPY tsconfig.server.json ./
COPY src/ src/
COPY server.ts ./
COPY kb-data/ kb-data/
COPY knowledge_base/ knowledge_base/

RUN npx tsc -p tsconfig.server.json

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/kb-data/ kb-data/
COPY --from=builder /app/knowledge_base/ knowledge_base/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;require('http').get('http://localhost:'+p+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]