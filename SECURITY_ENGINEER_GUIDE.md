# Security Engineer Guide

This guide outlines the security architecture, data protection mechanisms, authorization rules, and operational security posture for the Ecommerce Builder platform. It is intended for security engineers reviewing or contributing to the project.

---

## 1. Architecture & Attack Surface

- **Four-Tier Architecture:** 3 Next.js frontends (Storefront, Store Admin, Super Admin) and 1 Express.js backend (`services/api`). The frontends are thin clients.
- **Backend Isolation:** All business logic, database queries, and interactions with external APIs (like Gemini integration) happen inside the Node.js API layer.
- **Network Boundaries:** 
  - The API is hosted on **Cloud Run** with private egress to a VPC via Serverless VPC Access.
  - The PostgreSQL 15 database is hosted on **Cloud SQL** configured with a **private IP only**. The database has no public IP address or public internet attack surface.
  - Compute runs serverless, managed entirely by Google Cloud without persistent VMs.
- **Frontend Statelessness:** All frontends rely on the backend for state and data authorization.

## 2. Authentication & Authorization

- **Stateless Authentication (JWT):** The API issues signed JWT tokens for Store Admins and Super Admins.
- **Tenant Isolation Context:** 
  - Store Admin JWT payloads embed a `storeId` property alongside their user ID.
  - Super Admin JWTs lack a `storeId` but utilize a `type: 'SUPER_ADMIN'` flag.
- **Multi-Tenancy Enforcement:** Multi-tenancy isolation is strictly enforced via route middleware. For any endpoint under `/api/stores/:storeId/*`, the `requireStoreAdmin` middleware asserts that the `req.user.storeId` strictly matches `req.params.storeId`. This prevents broken object-level authorization (BOLA/IDOR) between tenants.
- **Rate Limiting:** Auth endpoints (`/api/auth/*`) are heavily rate-limited (20 requests / 15 min). All other API endpoints have a default limit of 100 requests / minute.

## 3. Data Protection Strategies

### PII Encryption at Rest (Application Level)
Customer PII (Emails, Names, Addresses, Phones) passing through the system is deeply encrypted *before* it gets persisted in the database.
- Encryption relies on AES-256 via the `encryption.ts` service.
- Columns tracking PII are suffixed with `Enc` (e.g., `customerEmailEnc`, `customerNameEnc`) to explicitly denote application-level encrypted fields.
- Cloud SQL inherently provides infrastructure-level encryption (Google-managed keys), but double-encrypting sensitive columns shields them from read-only manual queries and unauthorized staff.

### Implicit PII Scrubbing
Super Admin interactions are intentionally blind to user PII. The global API middleware interceptor (`scrubPIIForSuperAdmin`) recursively strips any known PII fields (`customerEmailEnc`, `nameEnc`, `password`, etc.) and replaces them with `[REDACTED]` string values in responses aimed at Super Admins.

## 4. Secrets & Configuration Security

- **Cloud Secret Manager:** Application secrets (database passwords, JWT signature keys, AES encryption keys) are completely decoupled from code, git histories, and plain `.env` variables in production. The API service reads them directly from Cloud Secret Manager at startup using API calls.
- **Least Privilege Execution:** The Cloud Run process assumes the identity of a dedicated service account (`ecommerce-builder-app`), holding strict minimal permissions (e.g., `secretmanager.secretAccessor`, `cloudsql.client`).
- **Secret Rotation Pipeline:** Operations documentation details rapid, zero-downtime procedures to rotate major platform secrets on a recurring basis. Wait times during deployment pipelines are negligible.

## 5. Threat Monitoring & Alerting

- **Anomaly Detection (Live Metrics):** The API generates KL (Kullback-Leibler) Divergence tracking to identify statistical irregularities against 7-day rolling baselines.
  - Rapid jumps in `error_rate`, backend `response_time_ms`, anomalous order surges, or chat sessions result in a `Critical` or `Warning` anomaly alert viewable in the Super Admin dashboard.
- **Auditing:** The `requestLogger` middleware commits structured logs of every incoming request to both an `AppLog` DB table (for the Socket.io live dashboard) and GCP Cloud Logging. Crucially, the system excludes user parameters or body objects containing PII from logs.
- **Tracking:** UUID `x-trace-id` headers are injected and bubbled into all logs relating to individual HTTP sessions to diagnose multi-service chain behaviors.

## 6. Dependency & Setup Security

- **Dependency Security Analysis:** The CI/CD pipelines run `npm audit` on every Pull Request toward the main branch, acting as a gate against high-severity CVEs upstream.
- **Container Analysis:** Google Artifact Analysis constantly inspects the project's Docker containers housed in `gcr.io` for systemic operating-system risks.
- **Infrastructure as Code (Terraform):** Secure GCP topologies (locked-down storage buckets, private SQL instances, least-privilege service accounts) are codified in Terraform (`infrastructure/terraform/*`) minimizing accidental human drift.
