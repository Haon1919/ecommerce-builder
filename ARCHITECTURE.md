# Platform Architecture

This document provides an architectural overview of the `ecommerce-builder` platform. It is intended for software architects, technical leads, and system designers to understand the structural design, data flows, and key technical decisions made in this system.

---

## 1. System Topology

The platform follows a decoupled, service-oriented architecture centered around a stateless API backend and multiple purpose-built Next.js frontend applications.

```mermaid
flowchart TD
    %% Internet/Clients
    subgraph Clients["Clients"]
        Customer["Customer Browser"]
        StoreAdminUser["Store Admin Browser"]
        PlatformOperator["Super Admin Browser"]
    end

    %% Frontend Apps (Next.js)
    subgraph Frontend["Frontend Applications (Next.js 15)"]
        StoreApp["Storefront App\n(Port 3003)"]
        AdminApp["Store Admin App\n(Port 3002)"]
        SuperAdminApp["Super Admin App\n(Port 3004)"]
    end

    %% Backend Services (Express)
    subgraph Backend["Backend Services (Express + Node.js)"]
        API["Core API Service\n(Port 3001)"]
        SocketIO["Socket.IO Server\n(Live Logs)"]
        AnomalyCron["Anomaly Detection\n(Interval Worker)"]
    end

    %% Infrastructure & External
    subgraph Infrastructure["Infrastructure"]
        DB[(PostgreSQL 15\nDatabase)]
        GeminiAPI["Google Gemini API\n(LLM Provider)"]
    end

    %% Connections
    Customer -->|HTTP/HTTPS| StoreApp
    StoreAdminUser -->|HTTP/HTTPS| AdminApp
    PlatformOperator -->|HTTP/HTTPS| SuperAdminApp

    StoreApp -->|REST API| API
    AdminApp -->|REST API, Auth: JWT| API
    SuperAdminApp -->|REST API, Auth: JWT| API
    SuperAdminApp -->|WebSockets| SocketIO

    API <-->|Prisma ORM| DB
    API <-->|HTTP/JSON| GeminiAPI
    SocketIO ---> API
    AnomalyCron ---> API
    AnomalyCron <-->|Read Metrics, Write Alerts| DB
```

### Components Summary
- **Storefront (`apps/store`)**: Public-facing app optimized for SEO and fast page loads. Serves dynamically built pages for individual tenants. Now supports Native AR & 3D product previews and Voice Commerce via Web Speech API.
- **Store Admin (`apps/admin`)**: Authenticated portal for store owners to manage products, orders, pages, and store settings. Includes management for A/B Testing, B2B wholesale features, and 3D asset generation.
- **Super Admin (`apps/super-admin`)**: Authenticated portal for platform operators. Handles cross-tenant support tickets, platform analytics, live logs, and anomaly alerts.
- **API (`services/api`)**: The unified backend component containing all business logic, data access, and integrations.

---

## 2. Core Architectural Patterns

### 2.1. Multi-Tenancy Model
The platform uses a **Logical Separation (Row-Level)** multi-tenancy model within a single unified PostgreSQL database.
- Every tenant-specific table contains a `storeId` foreign key.
- The authorization layer enforces isolation using JSON Web Tokens (JWT). A Store Admin's JWT contains their `storeId`.
- API middleware (`requireStoreAdmin`) intercepts requests and guarantees that `req.params.storeId` matches the token's `storeId`.

### 2.2. Statelessness and Scalability
- **Frontends**: Next.js applications are deployed in a stateless manner (or exported as static/SSR where applicable).
- **Backend**: The Express API holds no session state in memory. Session state is entirely encoded in the client-side JWTs. This allows the API to be horizontally scaled dynamically behind a load balancer without sticky sessions.
- **Cache**: Currently relies on DB performance; easily extensible to Redis for distributed caching if query load increases.

### 2.3. Defense in Depth (Data Security)
- **PII Encryption**: Customer Personally Identifiable Information (PII) is encrypted at the application layer before resting in the database.
- **Role-Based Attribute Scrubbing**: Super Admins possess broad platform access but are structurally blocked from viewing decrypted PII via a specialized response-interception middleware (`scrubPIIForSuperAdmin`).

---

## 3. Subsystem Workflows

### 3.1. Authentication and Multi-Tenancy Flow

The diagram below illustrates how a Store Admin accesses their specific store, ensuring they cannot read data from other tenants.

```mermaid
sequenceDiagram
    actor Admin as Store Admin
    participant App as Store Admin App
    participant Middleware as API Auth Middleware
    participant Route as API Route Handler
    participant DB as Database

    Admin->>App: Submits login credentials
    App->>Middleware: POST /api/auth/login
    Middleware->>DB: Validate user & password
    DB-->>Middleware: User record (includes storeId)
    Middleware-->>App: Returns JWT Payload { userId, storeId, role: 'ADMIN' }
    
    note over Admin,DB: Subsequent Request
    
    Admin->>App: Views Orders (Store A)
    App->>Middleware: GET /api/stores/{Store_A}/orders + Header: Bearer {JWT}
    Middleware->>Middleware: verify(JWT) -> extracts storeId (Store A)
    Middleware->>Middleware: requireStoreAdmin() -> matches JWT storeId with URL param
    
    alt StoreId Matches
        Middleware->>Route: Next()
        Route->>DB: Prisma.Order.findMany({ where: { storeId: 'Store A' } })
        DB-->>Route: Order Data
        Route-->>App: 200 OK + Data
    else StoreId Mismatch (Malicious attempt for Store B)
        Middleware-->>App: 403 Forbidden 
    end
```

### 3.2. PII Encryption and Masking Flow

Encryption is handled symmetrically within the API layer. The database only ever sees ciphertext for PII fields (like addresses and emails).

```mermaid
sequenceDiagram
    actor Customer
    participant API as API Service
    participant Crypto as Encryption Service
    participant DB as Postgres
    actor StoreAdmin as Store Admin
    actor SuperAdmin as Super Admin

    %% Write Path
    Customer->>API: Checkout (Name, Email, Address)
    API->>Crypto: encrypt(PII fields)
    Crypto-->>API: Returns "iv:ciphertext"
    API->>DB: INSERT Order (customerNameEnc, customerEmailEnc)
    
    %% Read Path - Store Admin
    StoreAdmin->>API: GET /api/stores/{id}/orders
    API->>DB: SELECT * FROM Order
    DB-->>API: Orders with ciphertext
    API->>Crypto: decrypt(orders.customerEmailEnc)
    Crypto-->>API: Plaintext Email
    API-->>StoreAdmin: Orders with Plaintext PII
    
    %% Read Path - Super Admin
    SuperAdmin->>API: GET /api/analytics (or similar global view)
    API->>DB: SELECT * FROM Order
    DB-->>API: Orders with ciphertext
    API->>API: scrubPIIForSuperAdmin() middleware intercepts response
    API->>API: Replace *Enc fields with "[REDACTED]"
    API-->>SuperAdmin: Orders with [REDACTED] data
```

### 3.3. Anomaly Detection Worker

The platform includes an internal background job that computes structural deviations in real-time metrics using Kullback-Leibler (KL) Divergence.

```mermaid
flowchart LR
    subgraph Background Worker
        Cron[setInterval Timer]
        Snapshotting[recordMetric()]
        Detection[runAnomalyChecks()]
        Math[detectAnomaly() -> KL Divergence]
    end

    subgraph Data Store
        MetricDB[(MetricSnapshot Table)]
        AlertDB[(Alert Table)]
    end

    subgraph Super Admin View
        Dashboard[Monitoring Dashboard]
    end

    Cron -->|Every 60s| Snapshotting
    Snapshotting -->|Insert Current Value| MetricDB
    Cron -->|Trigger Analysis| Detection
    Detection --> Math
    Math -->|Read 5m Window & 7d Baseline| MetricDB
    Math -->|If KL > Threshold| AlertDB
    
    AlertDB -->|Polling/Fetch| Dashboard
    MetricDB -->|Time Series Data| Dashboard
```

### 3.4. AI Chat Assistant Flow (Google Gemini & Voice Commerce)

The codebase deeply integrates LLMs to provide a conversational shopping assistant that can perform actions within the UI, including Voice Commerce support via Web Speech API.

```mermaid
sequenceDiagram
    actor User as Shopper
    participant Store as Storefront (Client/Web Speech)
    participant API as API (Gemini Service)
    participant DB as Database
    participant LLM as Google Gemini API

    User->>Store: Speech input / Text: "Show me winter coats"
    Store->>Store: Transcribe speech audio to text
    Store->>API: POST /api/stores/{id}/chat { message: "Show me winter coats", context: {...} }
    API->>DB: Fetch Store Settings & Catalog (up to 50 items)
    DB-->>API: Context Data
    API->>API: buildSystemPrompt(Context Data)
    API->>LLM: processChat(Prompt + History + Message + Context)
    
    note right of LLM: LLM decides to show products<br/>and formats JSON in an action block
    
    LLM-->>API: Response with ```action { "type": "SHOW_PRODUCTS", ... } ```
    API->>API: Parse action block, separate from text
    API-->>Store: { text: "Here are some coats!", action: { type:... } }
    
    Store->>Store: Speak response (Text-To-Speech) / Render Text
    Store->>Store: Execute Action -> Render Product Cards UI (3D AR when applicable)
```

### 3.5. Page Builder Architecture and A/B Testing

The platform provides a drag-and-drop page editor and supports A/B testing variants where traffic is split natively on the storefront. Data flows from a React visual editor down to a JSON schema.

```mermaid
flowchart TD
    subgraph Admin App (Editor)
        Palette[Component Palette]
        Canvas[Drop Canvas (dnd-kit)]
        Props[Property Panel]
        
        Palette -->|Drag & Drop| Canvas
        Canvas -->|Select Item| Props
        Props -->|Update Fields| Canvas
        Canvas -->|Serialize to JSON array| ReduxState[Editor State]
    end

    RestAPI[API Route: PUT /pages/:id / PUT /experiments/:id/variants]
    DB[(Postgres Page.layout / Variant.layout)]

    ReduxState -->|Save Layout/Variant| RestAPI
    RestAPI --> DB

    subgraph Storefront App (Renderer)
        Fetcher[Page Data Fetcher]
        ExperimentRouter[A/B Variant Router]
        Renderer[PageRenderer Component]
        DynamicComp[Dynamic Next.js Components\n(Hero, Grid, Button)]
        
        DB -->|Serve Page/Variants| Fetcher
        Fetcher --> ExperimentRouter
        ExperimentRouter -->|Roll traffic weights 50/50| Renderer
        Renderer -->|Instantiate passing props| DynamicComp
    end
```

### 3.6. B2B & Wholesale Flow

The architecture supports B2B wholesale pricing through `Company` entities linked to `PriceList` overrides.

```mermaid
flowchart LR
    subgraph Auth Context
        User[B2B User]
        JWTAuth[JWT Session w/ CompanyId]
    end

    subgraph API Logic
        GetProducts[GET /products]
        PriceOverride[Apply Price List Overrides]
    end

    subgraph Database
        ProductTable[(Product)]
        CompanyTable[(Company)]
        PriceListTable[(PriceList)]
    end

    User -->|Login| JWTAuth
    JWTAuth -->|Request items| GetProducts
    GetProducts -->|Fetch| ProductTable
    GetProducts -->|Check| CompanyTable
    CompanyTable -->|Has| PriceListTable
    PriceListTable -->|Return overrides| PriceOverride
    PriceOverride -->|Serve custom prices| GetProducts
    GetProducts -->|Return Response| User
```
