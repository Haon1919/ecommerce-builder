# ecommerce-builder

![E-Commerce Builder Commercial](./tutorials/commercial.webp)

A white-label, multi-tenant B2B SaaS platform for launching and managing modern e-commerce stores. Built on a monorepo architecture with three Next.js 14 frontends and a single Express.js backend API.

---

## ✨ Feature Highlights

- **Drag-and-Drop Page Builder** — Visual storefront editor with no-code page composition
- **AI Shopping Assistant** — Google Gemini-powered chat with dynamic product rendering
- **Voice Commerce** — Web Speech API integration for hands-free shopping
- **Native AR & 3D Previews** — In-browser augmented reality and generative 3D product models
- **A/B Testing** — Built-in traffic splitting for page variants, straight from the builder
- **Multi-Vendor Marketplace** — Stripe Connect integration for split payouts and sub-orders
- **Global Tax Engine** — Dynamic tax calculation based on destination address and nexus configuration
- **Advanced Order Fulfillment** — Priority-based multi-location stock deduction and split fulfillment
- **3rd-Party App APIs** — OAuth2 flow and webhook subscriptions for external integrations
- **Custom Domains** — Configuration for tenant storefront custom domains
- **B2B Wholesale Portal** — Company accounts with custom price lists and bulk ordering
- **Anomaly Detection** — KL-divergence monitoring against 7-day baselines with live alerts
- **PII Encryption at Rest** — AES-256-CBC field-level encryption before data hits the database
- **Live Log Viewer** — Real-time request streaming via Socket.IO to the super admin panel

---

## 🗂️ Repository Structure

```
ecommerce-builder/
├── apps/
│   ├── admin/          # Store admin panel — Next.js 14 (port 3002)
│   ├── store/          # Customer storefront — Next.js 14 (port 3003)
│   └── super-admin/    # Platform ops panel — Next.js 14 (port 3004)
├── services/
│   └── api/            # Express + Socket.IO backend (port 3001)
│       ├── prisma/     # PostgreSQL schema, migrations, seed
│       └── src/
│           ├── errors.ts          # Custom error classes
│           ├── middleware/        # Auth (JWT), security, PII scrubbing
│           ├── routes/            # One file per resource (+ co-located tests)
│           ├── services/          # encryption, anomaly, gemini, cleanup, order, product
│           └── utils/             # Logger (winston)
├── infrastructure/
│   ├── docker-compose.yml    # Local dev stack (Postgres)
│   ├── docker/               # Service Dockerfiles
│   ├── scripts/              # GCP bootstrap helpers
│   └── terraform/            # Full GCP infrastructure as code
├── tests/
│   ├── e2e/                  # Playwright end-to-end test suites
│   │   ├── admin/            # Admin login, builder, A/B testing
│   │   ├── store/            # Storefront checkout
│   │   └── super-admin/      # Tenant management
│   └── performance/          # k6 load test scenarios
├── .github/workflows/
│   ├── test.yml              # CI — lint, unit tests, E2E on every PR
│   ├── deploy.yml            # CD — Docker build + Cloud Run deploy on merge to main
│   └── deploy-pages.yml      # Static export to GitHub Pages (manual trigger)
└── scripts/
    └── security-audit.sh     # npm audit + dependency checks
```

This is an **npm workspaces monorepo**. Run `npm install` once from the root to install all workspace dependencies.

---

## 🏗️ Architecture

The platform uses a **stateless, service-oriented** architecture with **logical (row-level) multi-tenancy** enforced via JWT middleware.

```
Customers ──────► Storefront App  ──┐
Store Owners ───► Admin App  ────────┼──► Express API ◄──► PostgreSQL 15
Platform Ops ───► Super Admin App ──┘         │
                                          Gemini API
```

- **Multi-tenancy**: Every tenant row carries a `storeId`. The `requireStoreAdmin` middleware enforces that the JWT's `storeId` matches the route parameter on every request — preventing cross-tenant data access (BOLA/IDOR).
- **PII protection**: Customer names, emails, phones, and addresses are AES-256 encrypted at the application layer before storage. Super Admins are structurally blocked from decrypted PII via `scrubPIIForSuperAdmin` middleware.
- **Stateless API**: No server-side session state. All auth is JWT-based, enabling horizontal scaling on Cloud Run.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for full system diagrams and architectural decisions.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in JWT_SECRET, ENCRYPTION_KEY (exactly 32 chars), and GEMINI_API_KEY
```

### 3. Start the database

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

### 4. Run migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 5. Start all services

```bash
npm run dev
```

All four services start concurrently. Visit the admin panel at `http://localhost:3002`.

---

## 🧪 Testing

| Command | What it runs |
|---|---|
| `npm test` | Unit tests across all workspaces (Jest) |
| `npm run test:ui` | Playwright E2E tests (`tests/e2e/`) |
| `npm run test:perf:local` | k6 load tests via Docker (`tests/performance/`) |
| `npm run test:security` | `npm audit` + dependency security checks |

E2E suites cover: admin builder, A/B testing, B2B flows, storefront checkout, AR/3D, voice commerce, and super admin tenant management.

---

## ☁️ Infrastructure & Deployment

Production runs fully serverless on **Google Cloud Platform**:

| Service | GCP Resource |
|---|---|
| All four apps | Cloud Run |
| Database | Cloud SQL (PostgreSQL 15, **private IP only**) |
| Secrets | Cloud Secret Manager (no plaintext env vars in prod) |
| Media uploads | Cloud Storage |
| Networking | VPC + Serverless VPC Access Connector |
| IaC | Terraform (`infrastructure/terraform/`) |

Deployments are triggered automatically on merge to `main` via [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). Each service builds its own Docker image, pushes to GCR, and deploys a new Cloud Run revision. Unchanged services are skipped.

---

## 📚 Documentation

| Document | Audience |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Architects & tech leads — system design, data flows, ADRs |
| [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) | Engineers — local setup, API reference, adding features |
| [`SECURITY_ENGINEER_GUIDE.md`](./SECURITY_ENGINEER_GUIDE.md) | Security — auth model, PII strategy, secrets, threat monitoring |
| [`SRE_GUIDE.md`](./SRE_GUIDE.md) | SREs — GCP infra, CI/CD, runbooks, disaster recovery |
| [`SUPER_ADMIN_GUIDE.md`](./SUPER_ADMIN_GUIDE.md) | Operators — platform dashboard, tenant mgmt, incident response |
| [`SALES_GUIDE.md`](./SALES_GUIDE.md) | Sales — product positioning, key selling points, competitive angles |
| [`SINGLE_CONTRIBUTOR_PLAYBOOK.md`](./SINGLE_CONTRIBUTOR_PLAYBOOK.md) | Single Operators — running the B2B SaaS business |
| [`ERROR_README.md`](./ERROR_README.md) | All — common errors and how to resolve them |
