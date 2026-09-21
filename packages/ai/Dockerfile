# Casuya AI — Dockerfile
# Builds the TypeScript library + HTTP server (server.ts → dist/server.js)
#
# Railway sets the service root to packages/ai, so all COPY paths are relative
# to that directory (not the monorepo root).
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.json tsconfig.server.json ./
COPY src/ src/
COPY routes/ routes/
COPY server-utils.ts ./
COPY server-utils/ server-utils/
COPY server.ts server-security.ts ./

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json ./package.json

# Knowledge base ships as a single tarball to avoid Docker's context file-count
# limit (the raw KB is 2,600+ files). Extract it at /app/knowledge_base.
COPY kb-data/ kb-data/
RUN mkdir -p /app/knowledge_base \
  && tar -xzf /app/kb-data/knowledge.tar.gz -C /app/knowledge_base \
  && rm /app/kb-data/knowledge.tar.gz

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;require('http').get('http://localhost:'+p+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]
