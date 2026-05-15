# Enterprise Platform Production Architecture

## Runtime Model

The application now uses tenant-scoped keys, modular business features, audited writes, idempotent API mutations, rate limiting, and a realtime event stream.

Recommended production deployment:

- Static assets behind a CDN.
- API routes behind a load balancer.
- Upstash/Redis or equivalent for KV, rate-limit coordination, queues, and realtime fan-out.
- Durable object storage for uploaded files, with only encrypted metadata/content references in KV.
- Separate secrets per environment: `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `ASSET_SYNC_TOKEN`, payment provider keys.

## Tenant Isolation

All business data is namespaced as:

```text
tenant:<tenant-id>:<logical-key>
```

Clients send `X-Tenant-ID`; server APIs also derive tenant from request bodies where appropriate. Direct API calls are scoped server-side, so isolation does not depend only on browser code.

## Security Controls

- Same-origin mutation checks for core KV APIs.
- Per-route in-memory rate limits. Production should move this to Redis.
- Idempotency keys for POST requests to reduce duplicate writes.
- Signed session tokens via `/api/auth/session`.
- Role and permission map in `enterprise-core.js`.
- Audit trail via `/api/audit` and client-side audit events.
- Upload validation and AES-256-GCM encryption via `/api/files`.
- Security headers on API and static responses.

## Realtime

Local Node server supports Server-Sent Events at:

```text
GET /api/realtime
```

Serverless deployments use the same endpoint as a polling source. Production can replace the implementation with Redis pub/sub, WebSockets, or managed realtime infrastructure while preserving the event payload contract.

## Business Modules

`/api/modules` stores enabled modules per tenant. Supported module families include inventory, POS, orders, logistics, pharmacy controls, finance, HR, CRM, files, AssetWise, school operations, and service desk.

## Scale Notes

The current file KV fallback is for development and small installations only. For thousands of concurrent users, use a managed low-latency datastore and external queue workers. The application code is now structured so that storage can be swapped behind `api/_lib/kv-store.js` without changing the portals.
