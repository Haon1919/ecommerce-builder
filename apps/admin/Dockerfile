FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/
RUN npm ci --workspace=apps/admin --include-workspace-root
COPY apps/admin/ ./apps/admin/
RUN npm run build --workspace=apps/admin

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

CMD ["node", "apps/admin/server.js"]
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s CMD wget -qO- http://localhost:3002 || exit 1
