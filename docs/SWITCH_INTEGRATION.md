# Katana ↔ Switch Integration

Handoff document for the Katana product team and Switch engineering.

---

## Environment URLs

| Environment | `KATANA_API_BASE_URL` | OAuth callback (N/A — client credentials) |
|-------------|----------------------|-------------------------------------------|
| **Dev** | `http://localhost:3001` | — |
| **Staging** | Set in Vercel env (e.g. `https://katana-vv2-staging.vercel.app`) | — |
| **Prod** | `https://katana-vv2.vercel.app` | — |

Switch does **not** use browser OAuth redirects. Authentication is **client credentials** → Bearer token.

---

## Setup (one-time)

1. Run **`supabase-switch-integration-migration.sql`** in Supabase SQL Editor.
2. Set server env vars (Vercel → Settings → Environment Variables):

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server writes + token storage |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Yes | Supabase project URL |
| `SWITCH_OAUTH_CLIENT_ID` | Yes* | OAuth client id for Switch |
| `SWITCH_OAUTH_CLIENT_SECRET` | Yes* | Shared secret (give to Switch securely) |
| `SWITCH_DEFAULT_ORG_ID` | Yes* | Target organization UUID |
| `SWITCH_ACTING_USER_ID` | Optional | `auth.users` id stamped on ingested rows |
| `KATANA_API_BASE_URL` | Recommended | Returned in token response per environment |

\*Or insert a row into `switch_oauth_clients` manually instead of env vars.

3. Restart dev server after changing `.env`.

---

## OAuth — client credentials

**Endpoint:** `POST /switch/oauth/token`

Accepts JSON or `application/x-www-form-urlencoded`.

```bash
curl -s -X POST "$KATANA_API_BASE_URL/switch/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "switch-dev",
    "client_secret": "YOUR_SECRET"
  }'
```

**Success (200):**

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "api_base_url": "https://katana-vv2.vercel.app"
}
```

Use `Authorization: Bearer <access_token>` on all ingest calls. Tokens expire after 1 hour.

**Errors:**

```json
{
  "error": "Invalid client credentials",
  "code": "UNAUTHORIZED"
}
```

---

## File ingest

**Endpoint:** `POST /switch/ingest/files`

### How Katana resolves source file refs

| `source.type` | Behavior |
|---------------|----------|
| `signed_url` | Katana HTTP GETs `source.url` (optional `source.headers` for auth). Stores file in Supabase Storage bucket `switch-ingest`. |
| `public_url` | Same as `signed_url` — direct HTTPS fetch. |
| `webhook` | Registers a **pending** file row only (no fetch). Use when Switch will provide the URL later, or prefer `signed_url` for immediate ingest. |

Max file size: **25 MB**. Max files per request: **100**.

### Request

```json
{
  "source_system": "monday.com",
  "job_id": "optional-existing-job-uuid",
  "files": [
    {
      "external_id": "monday-file-abc123",
      "file_name": "brief.pdf",
      "mime_type": "application/pdf",
      "module": "projects",
      "source": {
        "type": "signed_url",
        "url": "https://source.example.com/files/abc?sig=...",
        "headers": { "Authorization": "Bearer source-token" }
      },
      "metadata": { "project_external_id": "proj-001" }
    }
  ]
}
```

### Success (200)

```json
{
  "job_id": "uuid",
  "accepted": 1,
  "failed": 0,
  "file_resolution": {
    "signed_url": "Katana performs an HTTP GET on source.url (optional source.headers).",
    "public_url": "Same as signed_url — direct HTTPS fetch.",
    "webhook": "Registers pending file; provide url later or use signed_url for immediate fetch."
  },
  "results": [
    {
      "external_id": "monday-file-abc123",
      "status": "ingested",
      "katana_file_id": "uuid",
      "storage_path": "org-id/1234567890-monday-f.pdf",
      "public_url": "https://....supabase.co/storage/v1/object/public/switch-ingest/..."
    }
  ]
}
```

---

## Record ingest

**Endpoint:** `POST /switch/ingest/records`

Upserts canonical entities into Katana tables. Idempotent via `external_id` → `switch_entity_mappings`.

Max records per request: **500**. Ingest parents before children (e.g. `project` before `task`).

### Request

```json
{
  "source_system": "monday.com",
  "records": [
    {
      "entity_type": "project",
      "external_id": "proj-001",
      "operation": "upsert",
      "payload": {
        "name": "Website Redesign",
        "status": "active",
        "progress": 40,
        "deadline": "2026-12-31"
      }
    },
    {
      "entity_type": "task",
      "external_id": "task-001",
      "operation": "upsert",
      "payload": {
        "title": "Design mockups",
        "status": "in-progress",
        "priority": "high",
        "deadline": "2026-08-01"
      },
      "relationships": {
        "project_external_id": "proj-001"
      }
    }
  ]
}
```

### Supported `entity_type` values

| entity_type | Katana table |
|-------------|--------------|
| `project` | `projects` |
| `task` | `tasks` |
| `milestone` | `milestones` |
| `customer` | `cs_clients` |
| `employee` | `hr_employees` |
| `inventory_item` | `inventory_items` |

Full field definitions: **`GET /switch/schema`**

### Success (200) / partial (200 with failures)

```json
{
  "job_id": "uuid",
  "accepted": 2,
  "failed": 0,
  "results": [
    {
      "external_id": "proj-001",
      "entity_type": "project",
      "status": "ingested",
      "katana_id": "uuid"
    }
  ]
}
```

If all records fail: HTTP **422** with the same body shape.

---

## Canonical schema

**Endpoint:** `GET /switch/schema`

Returns version, entity definitions, field types, enums, and relationship notes.

---

## Error response format

All Switch endpoints return structured JSON errors (not HTTP status alone):

```json
{
  "error": "Human-readable message",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "files", "message": "At least one file entry required" }
  ],
  "ingest_job_id": "optional-uuid"
}
```

| HTTP | `code` | When |
|------|--------|------|
| 400 | `VALIDATION_ERROR` | Bad payload |
| 401 | `UNAUTHORIZED` | Missing/invalid Bearer token |
| 405 | `INVALID_REQUEST` | Wrong HTTP method |
| 422 | `INGEST_FAILED` | All records in batch failed |
| 503 | `NOT_CONFIGURED` | Missing service role / migration |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Per-item failures appear in `results[]` with `status: "failed"`, `error_code`, and `error_message`.

---

## Checklist for Switch team

- [x] OAuth: `POST /switch/oauth/token` (client credentials)
- [x] `KATANA_API_BASE_URL` per environment (env var + token response)
- [x] `POST /switch/ingest/files`
- [x] `POST /switch/ingest/records`
- [x] File ref resolution: `signed_url`, `public_url`, `webhook`
- [x] Canonical schema: `GET /switch/schema` + mapping via `external_id`
- [x] Structured error JSON with `code` and `details`

---

## Local testing

```bash
# 1. Run migration in Supabase
# 2. Set env vars in .env (see .env.example)
npm run dev

# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/switch/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"switch-dev","client_secret":"YOUR_SECRET"}' \
  | jq -r .access_token)

# Ingest a project
curl -s -X POST http://localhost:3001/switch/ingest/records \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"entity_type":"project","external_id":"test-1","payload":{"name":"Switch Test","status":"active","deadline":"2026-12-31"}}]}'
```
