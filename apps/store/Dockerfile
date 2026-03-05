FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/store/package.json ./apps/store/
RUN npm ci --workspace=apps/store --include-workspace-root
COPY apps/store/ ./apps/store/
RUN npm run build --workspace=apps/store

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/store/.next/standalone ./
COPY --from=builder /app/apps/store/.next/static ./apps/store/.next/static
COPY --from=builder /app/apps/store/public ./apps/store/public
CMD ["node", "apps/store/server.js"]
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s CMD wget -qO- http://localhost:3003 || exit 1
