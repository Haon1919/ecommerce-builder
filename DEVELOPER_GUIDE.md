# Developer Guide

This guide covers everything you need to get the project running locally, understand the architecture, and work on it effectively.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repo Structure](#2-repo-structure)
3. [Local Setup](#3-local-setup)
4. [Running the Stack](#4-running-the-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Database & Prisma](#6-database--prisma)
7. [API Routes Reference](#7-api-routes-reference)
8. [Authentication & Multi-tenancy](#8-authentication--multi-tenancy)
9. [PII Encryption](#9-pii-encryption)
10. [Anomaly Detection Service](#10-anomaly-detection-service)
11. [Gemini AI Integration](#11-gemini-ai-integration)
12. [Drag-Drop Page Builder](#12-drag-drop-page-builder)
13. [Adding a New Feature](#13-adding-a-new-feature)
14. [Testing](#14-testing)
15. [Data Retention & Cleanup](#15-data-retention--cleanup)
16. [Production Configuration Guards](#16-production-configuration-guards)
17. [Common Pitfalls](#17-common-pitfalls)
18. [Headless Edge API](#18-headless-edge-api)

---

## 1. Prerequisites

- **Node.js** 20+ (`node --version`)
- **npm** 10+ (comes with Node 20)
- **Docker Desktop** (for the local Postgres container)
- **git**

Optional but useful:
- **gcloud CLI** — only needed if you're working on GCP-specific features
- **Terraform** 1.6+ — only for infrastructure changes

---

## 2. Repo Structure

```
ecommerce-builder/
├── apps/
│   ├── admin/          Next.js 14 — store admin panel (port 3002)
│   ├── store/          Next.js 14 — customer storefront (port 3003)
│   └── super-admin/    Next.js 14 — platform ops panel (port 3004)
├── services/
│   └── api/            Express + Socket.IO — backend API (port 3001)
│       ├── prisma/     Database schema and seed
│       └── src/
│           ├── config.ts
│           ├── db.ts
│           ├── errors.ts       Custom error classes
│           ├── index.ts        Express server entry point
│           ├── middleware/     auth.ts, security.ts (+ co-located tests)
│           ├── routes/         One file per resource (+ co-located tests)
│           ├── services/       encryption, anomaly, gemini, cleanup, order, product
│           └── utils/          logger.ts (winston)
├── infrastructure/
│   ├── docker-compose.yml      Local dev stack
│   ├── docker/                 Service Dockerfiles
│   ├── scripts/                GCP bootstrap scripts
│   └── terraform/              GCP infrastructure as code
├── .github/workflows/          CI/CD pipelines (test, deploy, deploy-pages)
├── .env.example
└── package.json                Monorepo root (npm workspaces)
```

This is an **npm workspaces monorepo**. The root `package.json` declares `apps/*` and `services/*` as workspaces. You can run scripts across all packages from the root.

---

## 3. Local Setup

### 3a. Clone and install

```bash
git clone <repo-url> ecommerce-builder
cd ecommerce-builder

# Install all workspace dependencies from the root
npm install
```

### 3b. Environment variables

```bash
cp .env.example services/api/.env
```

Open `services/api/.env` and fill in the minimum required values for local dev:

```env
DATABASE_URL="postgresql://app_user:localdevpassword@localhost:5432/ecommerce_builder"
JWT_SECRET="<generate: openssl rand -base64 48>"
ENCRYPTION_KEY="<generate: openssl rand -hex 16>"      # exactly 32 hex chars
ENCRYPTION_IV_SECRET="<generate: openssl rand -hex 8>" # exactly 16 hex chars
GEMINI_API_KEY=""                                       # leave blank to skip AI features
REFRESH_TOKEN_SECRET="<generate: openssl rand -base64 48>" # optional in dev (has fallback)
SUPER_ADMIN_EMAIL="admin@example.com"
SUPER_ADMIN_PASSWORD="<choose a strong password>"
DEMO_STORE_ADMIN_EMAIL="store@example.com"
DEMO_STORE_ADMIN_PASSWORD="<choose a strong password>"
NODE_ENV="development"
LOG_LEVEL="debug"
APP_LOGS_RETENTION_DAYS="30"                            # days before auto-deleting AppLog rows
METRIC_SNAPSHOTS_RETENTION_DAYS="90"                    # days before auto-deleting MetricSnapshot rows
```

> **`ENCRYPTION_KEY`** must be **exactly 32 characters**. Generate a safe one — never use a placeholder:
> ```bash
> openssl rand -hex 16
> ```
> The seed script reads `SUPER_ADMIN_PASSWORD` and `DEMO_STORE_ADMIN_PASSWORD` from env. It will exit with an error if either is missing — there are no hardcoded fallback credentials.

The three frontend apps only need one env var each. Create these files:

```bash
# apps/admin/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001

# apps/store/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001

# apps/super-admin/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3c. Start the database

```bash
# From the repo root
docker compose -f infrastructure/docker-compose.yml up postgres -d
```

This starts a PostgreSQL 15 container on port 5432 with the credentials matching your `.env`.

### 3d. Run migrations and seed

```bash
npm run db:migrate     # runs prisma migrate deploy
npm run db:seed        # creates super admin + demo store with products
```

If you are setting up environments for specific clients/demos, you can use the `--store` flag to seed specialized products and orders:

```bash
npm run db:seed -- --store=the-jaunty-lady
# Available specific presets:
#  --store=the-jaunty-lady
#  --store=ivy-rose-boutique
#  --store=country-charm-boutique
#  --store=heidijhale-designs
```

After seeding you'll have:
- **Super admin:** email/password from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
- **Demo store:** slug `demo-store`, admin from `DEMO_STORE_ADMIN_EMAIL` / `DEMO_STORE_ADMIN_PASSWORD`
- 6 demo products in the demo store

---

## 4. Running the Stack

### Option A — All services at once (recommended)

```bash
npm run dev
```

This uses `concurrently` to start all four services simultaneously. Output from each service is prefixed with its name.

### Option B — Individual services

```bash
# API (required first — others depend on it)
npm run dev --workspace=services/api

# In separate terminals:
npm run dev --workspace=apps/admin
npm run dev --workspace=apps/store
npm run dev --workspace=apps/super-admin
```

### Option C — Full Docker stack

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

This mirrors production topology but is slower to iterate on since it rebuilds images.

### Service URLs

| Service | URL |
|---|---|
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |
| Admin panel | http://localhost:3002 |
| Storefront | http://localhost:3003 |
| Super admin | http://localhost:3004 |

The demo store is accessible at `http://localhost:3003/demo-store`.

---

## 5. Architecture Overview

```
Browser
  │
  ├── apps/admin       → /api/*  (authenticated, store-scoped JWT)
  ├── apps/store       → /api/*  (public endpoints + store slug routing)
  └── apps/super-admin → /api/*  (SUPER_ADMIN JWT, PII auto-scrubbed)
                              │
                       services/api  (Express + Socket.IO)
                              │
                    ┌─────────┼──────────┐
                 Prisma    Socket.IO   Gemini API
                    │       (live logs)
              PostgreSQL
```

**Key design decisions:**

- The API is the **only** service that touches the database. All frontends are thin clients.
- Multi-tenancy is enforced at the **JWT level** — every store admin token embeds a `storeId`, and `requireStoreAdmin` middleware rejects requests where the URL's `storeId` doesn't match the token.
- Super admin tokens have `type: 'SUPER_ADMIN'` and no `storeId`. A separate middleware (`scrubPIIForSuperAdmin`) intercepts their responses and redacts encrypted field values.
- All four services are stateless — they can be scaled horizontally without coordination.

---

## 6. Database & Prisma

The schema lives at `services/api/prisma/schema.prisma`.

### Useful Prisma commands

```bash
# Run from services/api, or use the root shortcut:
npm run db:migrate         # Apply pending migrations (production-safe)

# Dev-only commands (run from services/api):
cd services/api
npx prisma migrate dev     # Create a new migration from schema changes
npx prisma studio          # Open browser-based DB GUI at localhost:5555
npx prisma generate        # Regenerate the Prisma client (run after schema changes)
npx prisma migrate reset   # WIPE and re-run all migrations + seed (dev only)
```

### Schema highlights

- **`Store`** — the tenant root. Every other model has a `storeId` foreign key.
- **`Company` & `PriceList`** — For B2B wholesale. Companies are assigned to `Store`s and can have special `PriceList`s overriding standard `Product` prices.
- **`User`** — store admins. Unique on `(email, storeId)` so the same email can admin multiple stores. Can optionally belong to a `CompanyId` for B2B portal login.
- **`SuperAdmin`** — completely separate table from `User`. No `storeId`.
- **`Product`** — tracks standard catalog. Fields `arEnabled` and `modelUrl` support Native AR & 3D Generative AI previews on the storefront.
- **`Experiment` & `Variant`** — Powers A/B testing on the storefront. Layouts on variants can replace normal pages and split traffic.
- **`Order`** — customer PII fields are named with `Enc` suffix (`customerEmailEnc`, `customerNameEnc`, `shippingAddrEnc`). Always read/write through the encryption service, never directly.
- **`Page`** — the `layout` column is a `Json` array of `PageComponent` objects. This is what the drag-drop editor saves and the store's `PageRenderer` component reads.
- **`MetricSnapshot`** — append-only time series for anomaly detection. `storeId` is nullable — null means platform-wide metric.
- **`AppLog`** — structured log entries written by the API. Displayed in the super admin Live Log Viewer. PII is never written here.

### Making a schema change

1. Edit `services/api/prisma/schema.prisma`
2. `cd services/api && npx prisma migrate dev --name describe_your_change`
3. Commit both the schema file and the generated migration file in `prisma/migrations/`
4. The CI/CD pipeline runs `prisma migrate deploy` before deploying the new API image

---

## 7. API Routes Reference

All routes are prefixed `/api`. Auth routes are rate-limited to 10 **failed** attempts / 15 min (successful requests are not counted). All other endpoints are limited to 100 requests / min.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Login for store admins and super admins |
| `POST` | `/auth/register` | Public | Register a new store admin + create store |
| `GET` | `/auth/me` | User | Get current user profile |
| `GET` | `/stores` | SuperAdmin | List all stores (tenants) |
| `GET` | `/stores/:storeId` | StoreAdmin | Get store details |
| `PATCH` | `/stores/:storeId` | StoreAdmin | Update store settings |
| `GET` | `/stores/:storeId/pages` | StoreAdmin | List pages |
| `POST` | `/stores/:storeId/pages` | StoreAdmin | Create a page |
| `PUT` | `/stores/:storeId/pages/:pageId` | StoreAdmin | Save page layout (drag-drop output) |
| `POST` | `/stores/:storeId/pages/:pageId/publish` | StoreAdmin | Publish a page draft |
| `GET` | `/stores/:storeId/products` | Public | List products (store's catalog) |
| `POST` | `/stores/:storeId/products` | StoreAdmin | Create product |
| `PUT` | `/stores/:storeId/products/:id` | StoreAdmin | Update product |
| `DELETE` | `/stores/:storeId/products/:id` | StoreAdmin | Delete product |
| `POST` | `/stores/:storeId/orders` | Public | Create order (checkout) |
| `GET` | `/stores/:storeId/orders` | StoreAdmin | List orders (PII decrypted for store admin) |
| `PATCH` | `/stores/:storeId/orders/:id` | StoreAdmin | Update order status |
| `GET` | `/stores/:storeId/messages` | StoreAdmin | List contact messages |
| `POST` | `/stores/:storeId/messages/:id/reply` | StoreAdmin | Reply to a message |
| `GET` | `/stores/:storeId/tickets` | StoreAdmin | List store's support tickets |
| `POST` | `/stores/:storeId/tickets` | StoreAdmin | File a support ticket |
| `GET` | `/tickets` | SuperAdmin | All tickets across all stores (Kanban) |
| `PATCH` | `/tickets/:id/status` | SuperAdmin | Move ticket between Kanban columns |
| `POST` | `/tickets/:id/comments` | Admin\|SuperAdmin | Add comment |
| `POST` | `/stores/:storeId/chat` | Public | Send chat message/voice to Gemini |
| `GET` | `/stores/:storeId/companies` | StoreAdmin | List B2B companies |
| `POST` | `/stores/:storeId/companies` | StoreAdmin | Create B2B company |
| `GET` | `/stores/:storeId/pricelists` | StoreAdmin | List price lists |
| `POST` | `/stores/:storeId/pricelists` | StoreAdmin | Create a price list |
| `GET` | `/stores/:storeId/experiments` | StoreAdmin | List A/B tests |
| `POST` | `/stores/:storeId/experiments` | StoreAdmin | Create A/B test |
| `GET` | `/analytics` | SuperAdmin | Platform-level overview stats |
| `GET` | `/analytics/metrics` | SuperAdmin | Time-series data for monitoring charts |
| `GET` | `/analytics/alerts` | SuperAdmin | KL divergence alert history |
| `POST` | `/analytics/alerts/:id/acknowledge` | SuperAdmin | Acknowledge an alert |
| `GET` | `/logs` | SuperAdmin | Paginated log history |

### Health check

`GET /health` — no auth required, returns `{ status: "ok", timestamp, version }`.

---

## 8. Authentication & Multi-tenancy

JWT tokens are issued by `POST /api/auth/login`. The payload shape differs by role:

```typescript
// Store staff/admin
{ type: 'USER', sub: string, storeId: string, role: string (roleId) }

// Super admin
{ type: 'SUPER_ADMIN', sub: string }
```

**Middleware chain for a typical store admin request:**

1. `requireAuth` — verifies the JWT, attaches the decoded payload to `req.user`
2. `requirePermission('resource:action')` — verifies that:
   - `req.params.storeId === req.user.storeId` (Multi-tenant isolation)
   - The user's role has a permission matching the requested action (RBAC)

**Adding a new protected route:**

```typescript
// For store admins with 'settings:write' permission
router.put('/:storeId/settings', requirePermission('settings:write'), async (req, res) => { ... });

// For super admin only
router.get('/platform/analytics', requireSuperAdmin, async (req, res) => { ... });
```

The `requirePermission` middleware handles both the store-id isolation and the granular permission check in a single call. Use it for all store-scoped API endpoints.

---

## 20. Roles & Permissions Management (RBAC)

The platform uses a dynamic **Granular RBAC** system. Roles are store-scoped, and permissions are defined as wildcard-supported strings (e.g., `products:*`, `orders:read`).

### Managing Roles (Admin UI)
Store owners can manage staff access in **Settings > Roles & Permissions**.
- **Static Roles**: Default roles like `Owner`, `Product Manager`, and `Support` are created automatically upon store registration and cannot be modified/deleted.
- **Custom Roles**: Store owners can create custom roles with specific combinations of permissions.
- **Staff Assignment**: Staff members (Users) are assigned exactly one Role. Their effective permissions are the union of all actions allowed by that role.

### Permission Syntax
Permissions use a `resource:action` format:
- `*:*` — Full administrative access.
- `products:*` — All actions on products (read/write/delete).
- `orders:read` — View-only access to orders.

### Adding a New Permission
1. Add the permission string to `AVAILABLE_PERMISSIONS` in `services/api/src/services/roles.service.ts`.
2. Apply the `requirePermission('your:perm')` middleware to the relevant routes.
3. Update the UI in `apps/admin/src/app/(dashboard)/settings/roles/page.tsx` to include the new resource/action if needed.


---

## 9. PII Encryption

Customer PII is encrypted before being written to the database and decrypted on the way out — but **only for store admins**. Super admins always see `[REDACTED]`.

The encryption service is at `services/api/src/services/encryption.ts`:

```typescript
import { encrypt, decrypt } from '../services/encryption';

// Writing an order
const customerEmailEnc = encrypt(form.email);   // returns "iv:ciphertext" hex

// Reading back for a store admin
const email = decrypt(order.customerEmailEnc);
```

**Rules to follow:**

- Never write raw PII to any `AppLog` entry. The log middleware already scrubs known field names, but if you're writing custom logs, use `anonymizeEmail()` from the encryption service instead.
- Never add a new PII field to a model without the `Enc` suffix so the `scrubPIIForSuperAdmin` middleware knows to redact it.
- The `ENCRYPTION_KEY` environment variable must be exactly 32 characters. Using the wrong length silently produces garbage ciphertext.

---

## 10. Anomaly Detection Service

`services/api/src/services/anomaly.ts`

Runs on a `setInterval` every `METRIC_SNAPSHOT_INTERVAL_MS` (default: 60 seconds). Each cycle:

1. Calls `recordMetric()` to snapshot current values into `MetricSnapshot`
2. Calls `runAnomalyChecks()` which runs `detectAnomaly()` for each metric
3. `detectAnomaly()` fetches the current 5-minute window and the 7-day baseline, converts both to probability distributions via histogram bucketing, then computes `KL(current || baseline)`
4. If KL exceeds `KL_DIVERGENCE_THRESHOLD` (default 0.5), an `Alert` record is created

**Adding a new metric to monitor:**

1. Call `recordMetric('your_metric_name', value)` wherever the metric is generated (e.g., in a route handler or middleware)
2. Add `'your_metric_name'` to the `metrics` array in `runAnomalyChecks()`
3. Add it to the `METRICS` array in `apps/super-admin/src/app/(dashboard)/monitoring/page.tsx` to chart it

**Note on cold start:** `detectAnomaly()` returns `isAnomaly: false` and skips alert creation when either the current window or the baseline has fewer than 3 data points. A freshly deployed instance will not fire false alerts for the first few minutes.

---

## 11. Gemini AI Integration

`services/api/src/services/gemini.ts`

The chat widget in the store frontend calls `POST /api/stores/:storeId/chat` which handles both text and **Omnichannel Voice Commerce** via transcription data leveraging browser Web Speech API. The API:

1. Calls `buildSystemPrompt(storeId)` — queries the store's name, description, settings, and up to 50 products, then formats them into a system prompt that gives Gemini full store context
2. Calls `processChat()` with the conversation history and the new message
3. Parses **action blocks** from the response — Gemini is prompted to emit JSON wrapped in triple-backtick `action` blocks when it wants to do something beyond just talking:

```
```action
{ "type": "SHOW_PRODUCTS", "payload": { "productIds": ["id1", "id2"] } }
```
```

4. The action block is stripped from the displayed text. The action type and payload are returned to the frontend separately, which then handles them (e.g., renders product cards inline, adds items to the cart).

**Supported action types:** `SHOW_PRODUCTS`, `ADD_TO_CART`, `GO_TO_PAGE`, `SHOW_CATEGORY`

**Store-specific API key:** Stores can configure their own Gemini API key in `StoreSettings.geminiApiKeyEnc`. If set, it overrides the platform-level `GEMINI_API_KEY`. This is encrypted with AES-256 in the database.

**If `GEMINI_API_KEY` is empty**, the chat endpoint returns an error. You can still develop and test all other features locally without a Gemini key.

---

## 12. Drag-Drop Page Builder

The builder lives across three components in `apps/admin/src/components/editor/`:

| File | Responsibility |
|---|---|
| `DragDropEditor.tsx` | Orchestrates everything. Owns state, undo/redo, viewport toggle, save/publish |
| `ComponentPalette.tsx` | Left sidebar. Each item is `useDraggable`. Dragging from here creates a new component |
| `Canvas.tsx` | Drop target. Uses `SortableContext` for reordering existing components |
| `PropertyPanel.tsx` | Right sidebar. Renders editable fields for the selected component |

**The page layout data format** (stored in `Page.layout` as JSON):

```typescript
interface PageComponent {
  id: string;           // UUID
  type: string;         // e.g., "HeroSection", "ProductGrid", "Button"
  props: Record<string, unknown>;  // Component-specific properties
}
```

**Adding a new component type:**

1. Add it to `PALETTE_ITEMS` in `ComponentPalette.tsx` with its default props
2. Add its editable fields to `COMPONENT_FIELDS` in `PropertyPanel.tsx`
3. Add a visual preview in the `ComponentPreview` switch in `Canvas.tsx`
4. Add a renderer in `PageRenderer.tsx` in `apps/store` so it renders on the live storefront

**A/B Testing Integration:**

When standard Pages are loaded on the storefront, it checks for active `Experiment`s and `Variant`s. If an A/B test is running, traffic is probabilistically routed according to the `weight` property of the `Variant`. The variant's layout completely replaces the standard page layout.

**How a drag-from-palette drop works:**

The `DragDropEditor` `onDragEnd` handler checks `active.data.current?.fromPalette`. If true, it inserts a new component object at the index of whatever component was hovered (`over`). If false, it's a canvas reorder and uses `arrayMove` from `@dnd-kit/sortable`.

---

## 13. Adding a New Feature

Here's the full path for a typical new feature — example: adding a "discount codes" feature.

**1. Database (schema)**
```bash
# Edit services/api/prisma/schema.prisma
# Add a DiscountCode model with storeId, code, percent, etc.
cd services/api && npx prisma migrate dev --name add_discount_codes
```

**2. API route**
Create `services/api/src/routes/discounts.ts`:
```typescript
import { Router } from 'express';
import { requireAuth, requireStoreAdmin } from '../middleware/auth';

const router = Router({ mergeParams: true });

router.get('/:storeId/discounts', requireAuth, requireStoreAdmin, async (req, res) => {
  // ...
});

export default router;
```

Register it in `services/api/src/index.ts`:
```typescript
import discountsRouter from './routes/discounts';
app.use('/api/stores', discountsRouter);
```

**3. Admin panel**
Add the API call to `apps/admin/src/lib/api.ts`, then create a page at `apps/admin/src/app/(dashboard)/discounts/page.tsx` and add it to the `Sidebar.tsx` nav.

**4. Store frontend (if customer-facing)**
Add to `apps/store/src/lib/api.ts` and use in the checkout flow.

---

## 14. Testing

```bash
# Run all tests
npm test

# Run API tests only
npm test --workspace=services/api

# E2E tests (Playwright)
npm run test:ui

# TypeScript type check all packages
npm run build --workspaces --if-present
```

The project has a growing test suite across multiple layers:

| Layer | Files | What they cover |
|---|---|---|
| **Route tests** | `auth.routes.test.ts`, `products.test.ts`, `orders.test.ts`, `stores.test.ts`, `pages.routes.test.ts`, `messages.routes.test.ts`, `logs.routes.test.ts`, `tickets.routes.test.ts`, `chat.routes.test.ts`, `analytics.test.ts` | Request/response validation, auth checks, error states |
| **Service tests** | `anomaly.test.ts`, `encryption.test.ts`, `order.service.test.ts`, `product.service.test.ts` | Business logic, KL divergence math, encryption round-trips |
| **Middleware tests** | `auth.test.ts`, `security.test.ts` | JWT verification, PII scrubbing, rate limiting |
| **E2E tests** | `tests/e2e/admin/`, `tests/e2e/store/`, `tests/e2e/super-admin/` | Full user flows via Playwright |

The CI pipeline (`test.yml`) runs the unit/integration tests, `tsc --noEmit` across all packages, and a full `npm run build` to catch compile errors before anything merges.

When writing new code:
- Keep business logic in `services/` functions (not inline in route handlers) so it can be unit tested independently
- Co-locate tests with their source files (e.g., `orders.ts` and `orders.test.ts` in the same directory)
- The encryption, anomaly detection, and order/product services are good examples of this pattern

---

## 15. Data Retention & Cleanup

The API includes an automatic data cleanup service (`services/api/src/services/cleanup.ts`) that runs every 24 hours:

- **AppLog**: rows older than `APP_LOGS_RETENTION_DAYS` (default: 30) are deleted
- **MetricSnapshot**: rows older than `METRIC_SNAPSHOTS_RETENTION_DAYS` (default: 90) are deleted

This prevents unbounded table growth. Adjust the retention periods via environment variables if you need longer audit trails.

---

## 16. Production Configuration Guards

`config.ts` enforces several validations when `NODE_ENV=production`:

| Guard | What it does |
|---|---|
| `JWT_SECRET` length | Must be ≥ 64 characters |
| `REFRESH_TOKEN_SECRET` | Must be set (no dev fallback) |
| `ENCRYPTION_KEY` entropy | Cannot be all-same-character (e.g., `aaaa...`) |
| `ALLOWED_ORIGINS` | Cannot be empty, cannot contain `localhost`, `127.0.0.1`, or `*` |

In non-production environments, the server logs warnings for obviously-weak keys but does not refuse to start.

---

## 17. Common Pitfalls

**`ENCRYPTION_KEY must be 32 chars`** — If you see a crypto error on startup or get garbled data back from encrypted fields, check the length of your key. `echo -n "$ENCRYPTION_KEY" | wc -c` should print `32`.

**`Prisma client not generated`** — If you get `Cannot find module '@prisma/client'` after pulling new changes, run `npm run db:migrate` which also regenerates the client. Or explicitly: `cd services/api && npx prisma generate`.

**`CORS error in browser`** — The API's allowed origins come from the `ALLOWED_ORIGINS` / `CORS_ORIGINS` env var. For local dev, make sure it includes all three frontend ports: `http://localhost:3002,http://localhost:3003,http://localhost:3004`.

**`Socket.IO not connecting`** — The live log viewer authenticates the socket with the super admin JWT stored in `localStorage`. If you're testing locally and the connection keeps dropping, check that the token is present and not expired. Tokens expire after 7 days by default.

**`storeId mismatch 403`** — If you're testing admin panel routes and getting 403s, the JWT you're using may have been issued for a different store than the one in the URL. Log out and log back in to the correct store.

**`Page builder saves but store shows old content`** — Saving via the editor writes a draft. The storefront only renders **published** pages. Hit "Publish" in the editor toolbar.

**Changing the schema without a migration** — Prisma reads the generated client, not the schema file at runtime. If you edit `schema.prisma` but don't run `migrate dev`, nothing changes in the database and queries will fail silently. Always follow a schema edit with a migration.

---

## 18. Headless Edge API
19. Promotions & Rule-Based Discounts

The Headless Edge API (`/api/edge/*`) provides high-performance, stateless endpoints designed for custom storefronts, mobile apps, or any decoupled client. Access requires an API Key, which can be generated in the Store Admin Panel (requires **GROWTH** tier or higher).

**Authentication:**
Pass the API key in the `Authorization` header:
```text
Authorization: Bearer edge_live_...
```

**Available Endpoints:**
- `GET /api/edge/products` — List catalog products (supports `search`, `category`, `limit`, `offset`, `sort`)
- `GET /api/edge/products/:productId` — Get a single product by ID
- `POST /api/edge/checkout` — Create a stateless order (checkout)
- `POST /api/edge/cart/calculate` — Calculate cart totals with real-time discounts (including applied coupons)

---

## 19. Promotions & Rule-Based Discounts

The promotion system (`services/api/src/services/discount.ts`) decoupling complex marketing logic from order processing.

### Data Model
- **`DiscountRule`**: Defines the "Action" (Percentage, Fixed, BOGO) and metadata (priority, combinable, code).
- **`DiscountCondition`**: Defines the "IF" required to trigger the rule (Minimum Cart Value, etc).

### Visual Builder State
The builder in `apps/admin/src/components/offers/PromotionBuilder.tsx` manages a recursive JSON-serializable rule set.

### Example: BOGO Logic
A "Buy 2 Get 1 Free" rule stores:
- `type: 'BUY_X_GET_Y'`
- `buyQuantity: 2`, `getQuantity: 1`
- `buyProductId`, `getProductId`: Product identifiers.

---

## 21. Shipping Service & Dimensional Constraints

The shipping service (`services/api/src/services/shipping.ts`) handles rate calculation for external carriers using a unified interface.

### Package Dimensions
The `Product` model includes volumetric constraints:
- `length`: Package length (cm)
- `width`: Package width (cm)
- `height`: Package height (cm)
- `weight`: Package physical weight (kg)

### Volumetric Weight Calculator
Carriers charge based on the **Chargeable Weight**, which is the greater of the actual weight and the **Volumetric Weight**.

```typescript
Volumetric Weight (kg) = (Length * Width * Height) / 5000
```

### Carrier Integrations
The service currently uses mocked integrations for:
- **UPS**: Base rate $12.00 + weight multiplier
- **FedEx**: Base rate $14.50 + weight multiplier
- **USPS**: Base rate $8.75 + weight multiplier

Use `shippingService.getAllRates(request)` to fetch and aggregate rates from all active carriers, sorted by price.
 
---

## 22. Multi-Location Inventory & Fulfillment

The inventory system supports tracking stock across multiple physical locations (warehouses, stores, etc.).

### Inventory Models
- **`Location`**: A physical site with a `priority` (Int). Higher values indicate higher fulfillment priority.
- **`Stock`**: The quantity of a specific `Product` at a specific `Location`.

### Order Fulfillment Logic
When an order is placed, the `OrderService` determines the optimal fulfillment plan using a priority-based algorithm:
1. **Priority-Based Selection**: Active locations are sorted by `priority` (descending).
2. **Availability Check**: The system iterates through the sorted locations to find available stock for each requested product.
3. **Split-Fulfillment**: If a product's requested quantity cannot be satisfied by a single location, the system splits the fulfillment across multiple locations, creating individual `OrderItem` records for each location split.
4. **Atomic Transactions**: Stock deduction from multiple `Stock` records, updates to the `Product` summary stock, and order/sub-order creation are all wrapped in a single database transaction to ensure consistency.

### API & Persistence
- **`OrderItem` Tracking**: Each `OrderItem` includes a `locationId` field, identifying which physical location fulfilled that specific item segment.
- **Stock Summary**: The `Product.stock` field is maintained as a redundant summary for performance in catalog queries, kept in sync with the sum of location-specific stocks during order processing.
```
