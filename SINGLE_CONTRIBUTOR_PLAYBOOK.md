# 🚀 The Single Contributor Playbook: Running Your E-Commerce Builder Business

Welcome to your comprehensive operational playbook. As a single contributor running this multi-tenant B2B SaaS platform, you need to seamlessly transition between two roles: **Sales/Growth** (pitching and onboarding local businesses) and **Super Admin/Platform Ops** (keeping the system healthy, secure, and scaling).

This guide consolidates everything you need to successfully run the business, serve your community and state, and manage the platform efficiently.

---

## 📖 Part 1: The Business Model & Pitch

Your platform is a white-label, multi-tenant e-commerce builder (like Shopify, but with next-gen features) designed to serve D2C brands, retail stores, and B2B wholesale operators in your local community. 

### Target Audience
- **Local Retailers**: Businesses looking to modernize their online presence with fast, SEO-optimized sites.
- **Growth-Focused Merchants**: Those frustrated by slow page loads and poor conversion rates on legacy platforms.
- **Forward-Thinking Brands**: Businesses wanting to leverage AI, AR, and modern features to stand out.
- **B2B Wholesale Operators**: Companies that need secure, tiered pricing for corporate clients.

### The Core Pitch (Why Choose You?)
When pitching to local businesses in your state, emphasize these unique selling points:
1. **Speed & SEO**: Next.js 14 storefronts mean lightning-fast page loads, higher Google rankings, and more sales.
2. **AI Shopping Assistant**: Offer their customers a 24/7 personal shopper powered by Google Gemini, capable of Voice Commerce and dynamic product rendering.
3. **AR & 3D Previews**: Let their shoppers visualize products in their own homes via their smartphone camera.
4. **Built-in A/B Testing**: Stop guessing. Test different store layouts with zero code to maximize revenue.
5. **Bank-Grade Data Privacy**: Highly sensitive customer data (PII) is encrypted at rest automatically.
6. **Local, Dedicated Support**: Unlike giant faceless corporations, you offer proactive monitoring (via KL-Divergence detection) to fix anomalies before they affect revenue, and personalized support.

### Running a Successful Demo
Follow this sequence to wow prospects:
1. **The "Wow" Factor (Storefront AI)**: Open a demo storefront. Click the microphone and speak a complex query (*"I need a gift for my wife who loves gardening"*). Show the AI dynamically rendering relevant products.
2. **Interactive 3D/AR**: Navigate to a 3D-enabled product. Show the 3D model interaction and mention the AR mobile view.
3. **The Control Factor (Admin Portal)**: Log in as a store admin. Show the drag-and-drop page builder. Quickly create an A/B test variant with a 50/50 traffic split.
4. **The Scale Factor (B2B & Security)**: Highlight the B2B wholesale settings and explain your enterprise-grade PII encryption.

---

## 💰 Part 2: Monetization & Tiers

The platform is designed to scale with your clients' growth. Gate advanced features behind these structured plans:

### 1. Starter Tier
The foundation for emerging brands.
- **Includes**: Fast Next.js storefront, drag-and-drop builder, standard analytics, modern checkout.
- **The Angle**: Get them off slow legacy platforms onto a modern stack.

### 2. Growth Tier
For scaling, content-driven brands.
- **Includes**: Everything in Starter + Native AR/3D Previews, Live Commerce (shopper video feeds), Headless Edge APIs, Predictive Inventory/Automated Dropshipping alerts.
- **The Angle**: Turn their store into an omnichannel content engine.

### 3. Enterprise Tier
For high-volume retailers and wholesale operators.
- **Includes**: Everything in Growth + Generative UI (hyper-personalized layouts via Gemini), Agentic Checkout (zero-click autonomous voice/text shopping), B2B Multi-Vendor Marketplace infrastructure (Stripe Connect split payouts), Proactive Anomaly Detection.
- **The Angle**: An autonomous commerce operating system.

---

## 🛠️ Part 3: Super Admin Operations (Daily Routine)

As the sole platform operator, you use the **Super Admin Panel** (running on Port 3004 locally, or deployed via Cloud Run). This is your command center.

### What You Can and Cannot See
Due to strict AES-256 field-level encryption middleware:
- You **CAN** see store names, aggregate revenue, order counts, and system error logs.
- You **CANNOT** see customer PII (names, emails, shipping addresses). This protects you from liability and ensures absolute data privacy.

### Daily Checklist
1. **Check the Dashboard**: Look for red stat cards (Open Tickets > 5, Critical Alerts). Glance at the 24h error rate chart.
2. **Monitor the Kanban Board (`/dashboard/tickets`)**: Move support tickets from *Open* -> *In Progress* -> *Waiting* -> *Resolved*. Priority colors range from gray (Low) to red (Critical). 
    - *Tip*: Use "Internal note" checkboxes to document your diagnostic steps invisibly to the user.
3. **Review New Tenants**: Check `/dashboard/tenants` for newly registered businesses. Reach out to offer an onboarding call if they remain "Unconfigured" for too long.
4. **Acknowledge Anomalies**: Go to `/dashboard/monitoring`. The system alerts you if metrics (error rates, response times) deviate from a 7-day baseline using KL-Divergence. Acknowledge them once reviewed.

### Handling Problematic Stores
If a store violates Terms of Service, fails to pay, or looks fraudulent:
- Go to `/dashboard/tenants` and toggle the **Disable** switch. This shuts down their storefront and checkout, but leaves their admin panel active so they can contact you or fix the issue. It is non-destructive.

---

## 🚨 Part 4: Incident Response

When things go wrong, follow these playbooks using the Live Log Viewer (`/dashboard/logs`).

### 1. High Error Rate Alert (KL ≥ 0.5)
- Open Live Logs and filter to `ERROR`. Look for a repeating message.
- Check the `storeId` tail on the right side of the log.
    - If it's one specific store: They likely deployed a broken theme or page. Check their support tickets.
    - If it's all stores: Your API service is failing. Check Google Cloud Run to ensure the last automated GitHub Actions deployment was successful.
- **Rollback**: If a bad deploy occurred, you can revert traffic to a previous Cloud Run API revision using `gcloud run services update-traffic`.

### 2. Store Admin Locked Out
They cannot reset their own password from the panel. You must do it via your authenticated API:
```bash
curl -X POST https://<api-url>/api/admin/users/<userId>/reset-password \
  -H "Authorization: Bearer <your-super-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "TemporaryPassword123"}'
```
Provide them the temporary password and tell them to reset it in their Settings immediately.

### 3. Triaging an Order Issue
If a merchant states "Order #1234 failed":
- You *cannot* look up the customer info. 
- Ask the merchant for the approximate time. Search the Live Logs for `traceId` during that window to track the failure point (e.g., Stripe API timeout, schema error) and resolve the bug globally.

---

## ☁️ Part 5: Infrastructure & Deployments

The entire platform runs serverless on Google Cloud Platform, managed by Terraform (`infrastructure/terraform/`).

### Releasing New Features
- Push your code to the `main` branch. 
- GitHub Actions automatically builds the Docker images, pushes to Google Container Registry, runs database migrations, and deploys to Cloud Run with zero downtime.

### Security Maintenance
- Quarterly, you should rotate the platform's root secrets:
```bash
cd infrastructure/scripts
./create-secrets.sh --project=YOUR_PROJECT_ID --rotate
# Then redeploy Cloud Run APIs to pick up the new keys
```

---

*By following this playbook, you can seamlessly scale your e-commerce platform locally while maintaining enterprise-grade reliability and security as a single operator.*
