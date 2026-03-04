# Super Admin Operations Guide

This guide covers everything you need to know to operate the Ecommerce Builder platform as the super admin. The super admin panel is separate from the store admin panels and gives you a platform-level view of all tenants, system health, and support operations.

---

## Table of Contents

1. [Accessing the Panel](#1-accessing-the-panel)
2. [What You Can See vs. What You Cannot](#2-what-you-can-see-vs-what-you-cannot)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Tenant Management](#4-tenant-management)
5. [Support Ticket Kanban](#5-support-ticket-kanban)
6. [Live Log Viewer](#6-live-log-viewer)
7. [Anomaly Detection & Monitoring](#7-anomaly-detection--monitoring)
8. [Routine Operations](#8-routine-operations)
9. [Incident Response Playbook](#9-incident-response-playbook)
10. [Infrastructure Reference](#10-infrastructure-reference)
11. [GitHub Actions & Deployments](#11-github-actions--deployments)

---

## 1. Accessing the Panel

The super admin panel is a separate Cloud Run service from the store admin panels.

**URL:** Set at deploy time. Check Terraform outputs or run:
```bash
gcloud run services describe ecommerce-super-admin \
  --region=us-central1 --format="value(status.url)"
```

**Login:** Use the email you set as `super_admin_email` in `terraform.tfvars`. The password is set by the database seed script (`services/api/prisma/seed.ts`). Change it immediately after first login via the API:

```bash
curl -X PATCH https://<api-url>/api/auth/me \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "your-new-password"}'
```

Your JWT token is stored in `localStorage` under the key `super_admin_token`. Sessions are not automatically revoked — if you suspect a token is compromised, restart the API service to invalidate all active sessions.

---

## 2. What You Can See vs. What You Cannot

This is deliberate by design. Customer PII (personally identifiable information) is AES-256 encrypted in the database. The API middleware automatically scrubs it before it ever reaches your browser.

| Data | Visible to you | Why |
|---|---|---|
| Store names, slugs, themes | Yes | Platform metadata |
| Aggregate revenue totals | Yes | Platform metrics only |
| Order counts, product counts | Yes | Aggregate counts |
| Error logs, stack traces | Yes | Scrubbed of PII |
| Customer names | No | AES-256 encrypted, shows `[REDACTED]` |
| Customer emails | No | AES-256 encrypted, shows `[REDACTED]` |
| Shipping addresses | No | AES-256 encrypted, shows `[REDACTED]` |
| Store admin passwords | No | bcrypt hashed, never stored in plaintext |

**The practical implication:** If a store admin reports "order #1234 has the wrong address", you cannot look up the address. You can however look at the logs for that order's trace ID to diagnose a processing error. If an actual data correction is needed, the store admin must do it from their own panel, or you must handle it directly in the database with appropriate authorization.

---

## 3. Dashboard Overview

The main dashboard (`/dashboard`) refreshes every 60 seconds and shows:

**Stat Cards**
- **Total Stores** — all registered tenants, with active count
- **Orders (30d)** — platform-wide order volume
- **Revenue (30d)** — aggregate revenue across all stores
- **Open Tickets** — turns red with a ring if more than 5 are open
- **Critical Alerts** — turns red if any unacknowledged critical anomaly exists
- **Store Growth** — new stores registered in the last 30 days

**Charts**
- **New Store Registrations** — bar chart of daily new tenants (30-day window)
- **Error Rate (24h)** — line chart of the platform-wide HTTP 5xx rate

**Top Stores by Revenue** — leaderboard of stores ranked by 30-day revenue. Numbers are real; customer data is not.

**Recent Alerts** — the latest unacknowledged anomaly detection alerts. KL divergence score shown next to each. Clicking through to Monitoring lets you acknowledge them.

---

## 4. Tenant Management

Located at `/dashboard/tenants`.

Each store card shows:
- Store name and URL slug
- Product count, order count, user count
- CSS framework theme (Tailwind / Bootstrap / Bulma / Pico)
- How long ago the store was created
- An **Unconfigured** badge if the store admin has not yet finished the setup wizard

**Actions available:**

**Enable / Disable a store** — Click the toggle button on the right. Disabling a store does not delete any data; it prevents the storefront from serving pages and prevents new orders. The store admin's panel still works so they can fix whatever issue caused the suspension.

Use disable for:
- Non-payment (if you add billing later)
- Terms of service violations
- Stores that appear to be fraudulent based on order patterns you see in logs

**Open store** — The external link icon opens the store's public-facing URL in a new tab so you can verify it's working.

---

## 5. Support Ticket Kanban

Located at `/dashboard/tickets`.

Store admins create tickets from their own panels. You work through them here.

**Columns** (left to right):

| Column | Meaning |
|---|---|
| **Open** | New ticket, not yet looked at |
| **In Progress** | You are actively working on it |
| **Waiting** | You need more info from the store admin |
| **Resolved** | Fix is in place, confirming with the store admin |
| **Closed** | Fully done |

**Working a ticket:**

1. Click the chevron (▼) on any card to expand it
2. Read the description and any existing comments
3. Use the arrow buttons at the bottom to move it to the next/previous column
4. Add notes in the comment box

**Internal notes:** Check "Internal note" before saving a comment to write a note only you can see. This is useful for recording your diagnosis, commands you ran, or things to follow up on. Store admins cannot see internal notes.

**Priority colors:** Low (gray) → Medium (blue) → High (amber) → Critical (red). Critical tickets should go directly to In Progress.

**Tip:** When moving a ticket to "Waiting", add a comment first explaining what information you need. The store admin will see your comment when they log into their panel.

---

## 6. Live Log Viewer

Located at `/dashboard/logs`.

Connects to the API via Socket.IO and streams logs in real time. Logs are newest-first, capped at 1,000 entries in the browser.

**Log level color coding:**

| Level | Color | Meaning |
|---|---|---|
| DEBUG | Gray | Verbose dev info, usually filtered out in production |
| INFO | Green | Normal operations |
| WARN | Amber | Something unexpected but non-fatal |
| ERROR | Red | A request or operation failed |
| CRITICAL | Bold red | System-level failure requiring immediate attention |

**Toolbar controls:**
- **Search box** — filters by message text or trace ID
- **Level dropdown** — show only a specific severity
- **Service dropdown** — filter to `api`, `admin`, or `store`
- **Pause/Resume** — freeze the stream so you can read without entries scrolling past
- **Trash icon** — clear the browser buffer (does not delete logs from the database)
- **Download icon** — saves the currently visible filtered entries to a `.txt` file

**Reading a log line:**
```
[HH:MM:SS]  [LEVEL]  [svc]  message text                          [storeId tail]
10:42:31     ERROR    api    Failed to process order: timeout      ...a3f9b2c1
```

The rightmost column shows the last 8 characters of the `storeId` associated with the log entry. Use this to tell which tenant an error belongs to. Cross-reference it against the Tenants page.

**Trace IDs:** Errors include a `traceId`. If a store admin reports an error, ask them for the time it occurred, then search the trace ID to follow the full request through the system.

---

## 7. Anomaly Detection & Monitoring

Located at `/dashboard/monitoring`.

The system compares the current 5-minute metric window against a rolling 7-day baseline using **KL Divergence** (Kullback-Leibler). This catches unusual patterns before they become user-facing failures.

**Metrics monitored:**
- Error rate (HTTP 5xx responses)
- Response time (milliseconds)
- Orders per minute
- Chat sessions per minute

**KL Divergence thresholds:**

| Score | Status | What it usually means |
|---|---|---|
| KL < 0.3 | Normal | Distributions closely match baseline |
| 0.3 ≤ KL < 0.5 | Warning | Moderate deviation — worth watching |
| KL ≥ 0.5 | Critical | Significant anomaly — investigate now |

**Time window selector:** Use 1h for active incidents, 6h/24h for daily review, 7d for trend analysis.

**Acknowledging alerts:** Once you have investigated an alert, click **Acknowledge**. This dims the alert in the list and removes it from the homepage counter. You cannot delete alerts — this is intentional for audit purposes.

**What triggers a false positive?** Anomalies are expected during:
- Planned deployments (brief error rate spike during rollout)
- First week after a new tenant launches (order patterns have no baseline yet)
- Marketing campaigns at a tenant (sudden order/session spike)

In these cases, acknowledge the alert and add a note in your own records.

---

## 8. Routine Operations

### Daily
- Check the dashboard for any red stat cards (open tickets, critical alerts)
- Glance at the error rate chart — look for any overnight spikes
- Acknowledge resolved alerts on the Monitoring page

### Weekly
- Review the Tenants page for any stores marked "Unconfigured" that have been sitting that way for more than a week — they may need a follow-up
- Check the Top Stores leaderboard for any unusual revenue patterns
- Download the last 7 days of ERROR logs from the log viewer and skim for recurring errors

### On a new tenant signing up
1. They appear on the Tenants page with an "Unconfigured" badge
2. They should configure their store from their admin panel (prompted automatically on first login)
3. No action needed from you unless they open a ticket

### Secret rotation (quarterly recommended)
```bash
cd infrastructure/scripts
./create-secrets.sh --project=YOUR_PROJECT_ID --rotate
```
After rotation, redeploy all Cloud Run services to pick up the new secret versions:
```bash
gcloud run services update ecommerce-api --region=us-central1 --project=YOUR_PROJECT_ID
```

---

## 9. Incident Response Playbook

### High error rate alert (KL ≥ 0.5 on `error_rate`)

1. Open **Live Logs**, filter to `ERROR` level
2. Look for a repeating error pattern — same message, same service
3. Check if errors are scoped to one `storeId` (tenant-specific) or all traffic (platform-wide)
4. If tenant-specific: check if that tenant recently deployed a theme change or published a new page. Check their tickets for context
5. If platform-wide: check Cloud Run service health in GCP Console. Look for a bad deploy — the GitHub Actions workflow runs smoke tests but may not catch all runtime errors
6. Rollback if needed:
   ```bash
   gcloud run services update-traffic ecommerce-api \
     --to-revisions=PREVIOUS_REVISION=100 \
     --region=us-central1
   ```
   Find the previous revision name in: GCP Console → Cloud Run → ecommerce-api → Revisions

### Slow response times (KL ≥ 0.5 on `response_time_ms`)

1. Check if it started at a specific time — correlate with recent deploys
2. Check Cloud SQL metrics in GCP Console for CPU/disk I/O spikes
3. If database load is high, check for missing indexes. The most common culprits are large product catalogs with unindexed searches
4. Cloud SQL has automatic backups enabled — point-in-time recovery is available for the last 7 days if data corruption is suspected

### A store admin is locked out

They cannot reset their own password from the panel. You need to do it directly:
```bash
# Find their user ID from logs or by querying the DB via Cloud SQL Auth Proxy
# Then call the admin password reset endpoint
curl -X POST https://<api-url>/api/admin/users/<userId>/reset-password \
  -H "Authorization: Bearer <your-super-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "TemporaryPassword123"}'
```
Tell them the temporary password and instruct them to change it immediately from Settings.

### Suspected fraudulent store

1. Check the Tenants page — note their order and product counts
2. Check the Live Logs — look for unusually high order velocity or failed payment patterns
3. **Disable the store** from the Tenants page immediately (non-destructive, reversible)
4. Review with a clear head before deciding to permanently delete

---

## 10. Infrastructure Reference

All infrastructure lives on GCP. The key services:

| GCP Service | What it is | Where to find it |
|---|---|---|
| Cloud Run | Hosts all 4 app services | GCP Console → Cloud Run |
| Cloud SQL (PostgreSQL 15) | Main database | GCP Console → SQL → ecommerce-builder-pg |
| Cloud Storage | Media uploads bucket | GCP Console → Storage → `{project}-ecommerce-media` |
| Secret Manager | All secrets (DB password, JWT, etc.) | GCP Console → Security → Secret Manager |
| Cloud Monitoring | Uptime alerts, metrics | GCP Console → Monitoring |
| VPC | Private network for DB access | GCP Console → VPC Network |

**The 4 Cloud Run services:**

| Service | What it does |
|---|---|
| `ecommerce-api` | Backend API — the only service that touches the database |
| `ecommerce-admin` | Store admin panel (Next.js) |
| `ecommerce-store` | Customer-facing storefront (Next.js) |
| `ecommerce-super-admin` | This panel (Next.js) |

**Terraform state** is stored in GCS at `gs://{project}-tf-state/terraform/state`. Never modify infrastructure manually in the GCP Console if you plan to continue using Terraform — it will cause state drift.

**To apply an infrastructure change:**
```bash
cd infrastructure/terraform
terraform plan   # review what will change
terraform apply  # apply it
```

---

## 11. GitHub Actions & Deployments

Every push to the `main` branch triggers `.github/workflows/deploy.yml`, which:

1. Detects which services changed (only rebuilds what changed)
2. Builds Docker images and pushes them to Google Container Registry (`gcr.io`)
3. Runs database migrations via a one-off Cloud Run Job
4. Deploys each updated service to Cloud Run
5. Runs a smoke test (hits `/health` on the API)
6. Reports success/failure to the GitHub Actions summary

**Required GitHub repository secrets** (set these under Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `GCP_SA_KEY` | Full contents of `.terraform-sa-key.json` |
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | e.g., `us-central1` |
| `GCP_SA_EMAIL` | Terraform service account email |
| `DATABASE_URL` | Full connection string for migrations |
| `TF_DB_PASSWORD` | Database password |
| `TF_JWT_SECRET` | JWT signing secret |
| `TF_ENCRYPTION_KEY` | 32-char hex encryption key |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SUPER_ADMIN_EMAIL` | Your email |

**Manual deploy of a single service:**

Trigger the workflow manually from GitHub → Actions → Deploy to GCP → Run workflow. Select the service in the `services` input (e.g., `api`).

**Rolling back a bad deploy:**

The previous image is tagged by commit SHA in GCR. Find the last-known-good SHA from the GitHub Actions history and redeploy it:
```bash
gcloud run services update ecommerce-api \
  --image=gcr.io/YOUR_PROJECT/ecommerce-api:GOOD_SHA \
  --region=us-central1
```

**The `test.yml` workflow** runs on all pull requests and checks TypeScript types, builds, security audits, and Docker build validity. It must pass before merging to `main`.
