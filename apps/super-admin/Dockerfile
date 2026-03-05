FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/super-admin/package.json ./apps/super-admin/
RUN npm ci --workspace=apps/super-admin --include-workspace-root
COPY apps/super-admin/ ./apps/super-admin/
RUN npm run build --workspace=apps/super-admin

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/super-admin/.next/standalone ./
COPY --from=builder /app/apps/super-admin/.next/static ./apps/super-admin/.next/static
CMD ["node", "apps/super-admin/server.js"]
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s CMD wget -qO- http://localhost:3004 || exit 1
