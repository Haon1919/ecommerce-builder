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
8. [Promotions & Offers](#8-promotions--offers)
9. [Routine Operations](#9-routine-operations)
10. [Incident Response Playbook](#10-incident-response-playbook)
11. [Infrastructure Reference](#11-infrastructure-reference)
12. [GitHub Actions & Deployments](#12-github-actions--deployments)

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

---

## 2. What You Can See vs. What You Cannot

PII is encrypted using AES-256.

| Data | Visible to you | Why |
|---|---|---|
| Store metadata | Yes | Platform ops |
| Aggregate Revenue | Yes | Platform health |
| Customer Names | No | Redacted/Encrypted |

---

## 3. Dashboard Overview
... [Standard Dashboard Info] ...

---

## 4. Tenant Management

You can view all registered stores on the **Tenants** page.

*   **View Stores:** The list shows store metadata, active status, theme, and counts for products, orders, and users.
*   **Toggle Status:** You can enable or disable a store using the Active/Disabled toggle. Disabled stores cannot be accessed by their owners or customers.
*   **Create Store:** You can manually create a new store by clicking the "Create Store" button on the top right.
    *   You will be asked to provide the Store Name, Store Slug, Owner Name, Owner Email, and a secure password.
    *   This will immediately create the store with default layouts, base roles, and the owner user.

---

## 8. Promotions & Offers

The platform includes a powerful, rule-based Promotion Engine. Store admins manage their own offers, but you can see the **Total Discount** impact on platform-wide revenue in your dashboard charts.

### Rule Structure (IF/THEN)
Promotions are built using a visual "If This Then That" logic:
- **IF (Conditions)**: 
  - **Min Cart Value**: Subtotal threshold.
  - **Customer Tag**: Target specific customer segments (e.g. `VIP`).
- **THEN (Actions)**:
  - **Percentage/Fixed Off**.
  - **BOGO**: Buy X Get Y.

---

## 9. Routine Operations
...
