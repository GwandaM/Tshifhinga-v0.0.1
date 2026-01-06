# Distributed Sync Implementation Plan

## Overview
Implementation plan for evolving Tshifhinga Time Tracker from single-user to distributed team sync with local-first architecture.

---

## Phase 1: Foundation
**Status: COMPLETED**

### Tasks
- [x] Set up PostgreSQL schema with proper indexing
- [x] Implement authentication middleware for sync (types defined)
- [x] Add schema version tracking
- [x] Create soft-delete mechanism
- [x] Add sync metadata columns to local SQLite
- [x] Create SyncService foundation class

### Files Created
- `src/electron/sync/postgres-schema.sql` - Central PostgreSQL schema
- `src/electron/sync/sync-types.ts` - TypeScript types and interfaces
- `src/electron/sync/sync-migrations.ts` - SQLite migration runner
- `src/electron/sync/sync-service.ts` - Core sync service
- `src/electron/sync/index.ts` - Module exports

### Technical Details

#### 1.1 PostgreSQL Schema
Central database schema mirroring local SQLite with additional sync fields:
- `synced_at` - when record arrived at server
- `origin_client_id` - which client created the record
- `version` - for conflict detection

#### 1.2 Authentication Middleware
- JWT-based authentication for all sync endpoints
- Token validation before accepting data
- User can only push sessions with their own user_id

#### 1.3 Schema Versioning
- Server exposes min/current schema version
- Client checks compatibility before sync
- Graceful degradation for version mismatches

#### 1.4 Soft Deletes
- `deleted_at` timestamp column on all syncable tables
- Never hard-delete from central DB
- Sync includes deleted records as tombstones

---

## Phase 2: Basic Sync
**Status: COMPLETED**

### Tasks
- [x] Build SyncService class in Electron main process
- [x] Implement HTTP client for server communication
- [x] Implement push logic (sessions → PostgreSQL)
- [x] Implement delta pull (projects/clients from server)
- [x] Add conflict detection (log only initially)
- [x] Service discovery (DNS/config file based)
- [x] Add "Sync Now" button to UI header
- [x] Create IPC handlers for renderer-main communication
- [x] Add preload API for sync operations

### Files Created (Phase 2)
- `src/electron/sync/sync-client.ts` - HTTP client using Electron's net module
- `src/electron/sync/server-discovery.ts` - Multi-method server discovery
- `src/electron/sync/sync-ipc-handlers.ts` - IPC handlers for sync operations
- `src/hooks/useSync.ts` - React hook for sync state management
- `src/components/sync/SyncStatusButton.tsx` - UI component for sync status
- `src/components/sync/index.ts` - Component exports
- Updated `src/electron/preload.ts` - Added sync API to preload

### Technical Details

#### 2.1 SyncService Architecture
```typescript
class SyncService {
  async runSync(): Promise<SyncResult>
  async pushPendingSessions(): Promise<PushResult>
  async pullUpdates(lastSyncTimestamp: string): Promise<PullResult>
  async discoverServer(): Promise<ServerConfig>
}
```

#### 2.2 Delta Sync
- Track `last_pull_timestamp` locally
- Server only sends records modified since last sync
- Dramatically reduces bandwidth after initial sync

#### 2.3 Service Discovery Priority
1. DNS lookup (timetracker.company.local)
2. mDNS/Bonjour broadcast
3. Static config file fallback

---

## Phase 3: Resilience
**Status: COMPLETED**

### Tasks
- [x] Retry logic with exponential backoff (built into SyncService)
- [x] Sync health monitoring (SyncHealthStatus in sync-types.ts)
- [x] Manual sync button with status indicator (SyncStatusButton.tsx)
- [x] Admin conflict resolution UI (SyncManagement page)
- [x] Offline queue management enhancements (OfflineQueuePanel)

### Files Created (Phase 3)
- `src/components/sync/ConflictCard.tsx` - Individual conflict display with resolution options
- `src/components/sync/SyncSettingsPanel.tsx` - Server configuration and sync settings UI
- `src/components/sync/OfflineQueuePanel.tsx` - Pending sync queue visualization
- `src/pages/admin/SyncManagement.tsx` - Admin page for sync management
- Updated `src/App.tsx` - Added `/admin/sync` route
- Updated `src/components/app-sidebar.tsx` - Added Sync Management nav item

### Technical Details

#### 3.1 Retry Strategy
- Initial retry: 30 seconds
- Exponential backoff: 30s → 1m → 2m → 5m → 15m (max)
- Reset on successful sync

#### 3.2 Health Indicators
- Green: Last sync < 30 min
- Yellow: Last sync 30-120 min
- Red: Last sync > 2 hours

---

## Phase 4: Advanced Features
**Status: NOT STARTED**

### Tasks
- [ ] Real-time notifications via WebSocket
- [ ] Bulk operations optimization
- [ ] Data export from central DB
- [ ] Audit trail viewer
- [ ] Admin dashboard for team stats

---

## API Specification

### Sync Endpoint
```
POST /api/sync
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "client_version": "1.2.0",
  "schema_version": 5,
  "last_pull_timestamp": "2025-01-05T14:30:00Z",
  "push_data": {
    "sessions": [...]
  }
}
```

**Response:**
```json
{
  "status": "success",
  "server_timestamp": "2025-01-06T10:15:00Z",
  "push_results": {
    "accepted": ["uuid-1", "uuid-2"],
    "conflicts": [],
    "rejected": []
  },
  "pull_data": {
    "projects": [...],
    "clients": [...],
    "notifications": [...]
  }
}
```

---

## Security Considerations

1. **Transport**: HTTPS/TLS for all sync traffic
2. **Authentication**: JWT tokens with expiration
3. **Authorization**: Users can only push their own data
4. **Validation**: Server validates all incoming data
5. **Rate Limiting**: Max 1000 records per sync, 10 requests/min

---

## Conflict Resolution Strategy

### For Sessions (Last-Write-Wins with Versioning)
- Each record has `version` field
- Server checks version match before update
- Conflicts logged for manual review

### For Projects/Clients (Server-Authoritative)
- Only admins can modify
- Client pulls latest from server

---

## Progress Log

| Date | Phase | Task | Status |
|------|-------|------|--------|
| 2026-01-06 | 1 | Started Phase 1 implementation | Completed |
| 2026-01-06 | 1 | Created PostgreSQL schema (postgres-schema.sql) | Completed |
| 2026-01-06 | 1 | Created sync types and interfaces (sync-types.ts) | Completed |
| 2026-01-06 | 1 | Created SQLite migrations (sync-migrations.ts) | Completed |
| 2026-01-06 | 1 | Created SyncService foundation (sync-service.ts) | Completed |
| 2026-01-06 | 1 | **Phase 1 Complete** | Completed |
| 2026-01-06 | 2 | Created HTTP sync client (sync-client.ts) | Completed |
| 2026-01-06 | 2 | Created server discovery (server-discovery.ts) | Completed |
| 2026-01-06 | 2 | Created IPC handlers (sync-ipc-handlers.ts) | Completed |
| 2026-01-06 | 2 | Created useSync React hook | Completed |
| 2026-01-06 | 2 | Created SyncStatusButton UI component | Completed |
| 2026-01-06 | 2 | Updated preload.ts with sync API | Completed |
| 2026-01-06 | 2 | **Phase 2 Complete** | Completed |
| 2026-01-06 | 3 | Created ConflictCard component | Completed |
| 2026-01-06 | 3 | Created SyncSettingsPanel component | Completed |
| 2026-01-06 | 3 | Created OfflineQueuePanel component | Completed |
| 2026-01-06 | 3 | Created SyncManagement admin page | Completed |
| 2026-01-06 | 3 | Added /admin/sync route and sidebar link | Completed |
| 2026-01-06 | 3 | **Phase 3 Complete** | Completed |

