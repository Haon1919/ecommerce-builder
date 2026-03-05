FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate
COPY src ./src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma/

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
