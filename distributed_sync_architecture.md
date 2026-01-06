# Distributed Architecture Proposal: "Local-First" Team Sync

## 1. Executive Summary
This document outlines the architectural evolution of **Tshifhinga Time Tracker** from a single-user local application to a robust, distributed team management tool. 

**The Core Philosophy:** "Local-First". 
The application will behave like a fast, offline-capable desktop app for the end-user, while silently handling data synchronization with a central server in the background. This ensures zero downtime during network interruptions (VPN drops, server resets) and guarantees a snappy user interface.

## 2. High-Level Architecture

### The Hybrid Database Model
We will employ a dual-database strategy:

1.  **The "Client" (Local/Offline)**: 
    *   **Technology**: SQLite (Existing setup).
    *   **Role**: The source of truth for the User Interface. All reads and writes happen here first. This ensures the app works perfectly even in a tunnel without internet.
  
2.  **The "Server" (Central/Truth)**:
    *   **Technology**: PostgreSQL or MySQL (Self-hosted on internal network).
    *   **Role**: The aggregation point. It holds the master copy of all projects, tasks, and every team member's time logs.

### The Network Topology & "Signpost" Discovery
**Problem**: Your Postgres server IP might change (DHCP reset), or you might move it. We don't want to re-code the app every time this happens.

**Solution**: The "Signpost" Method.
Think of the Network Drive as a bulletin board that everyone knows the location of (e.g., `Z:\Tshifhinga\`). The Server posts a note there saying "I am currently at 192.168.1.55". The Apps read that note to find the server.

**Step-by-Step Setup Guide:**
1.  **Prepare the Folder**: Create a folder on your shared network drive that all staff can *read*.
    *   Path: `Z:\General\TimeTrackingConfig\` (Windows example)
2.  **Create the Signpost File**: inside that folder, create a simple text file named `server_config.json`.
3.  **Content**: Open it with Notepad and paste this:
    ```json
    {
      "host": "192.168.1.50",
      "port": 5432,
      "dbName": "tshifhinga_central"
    }
    ```
4.  **Admin Workflow**:
    *   **Day 1**: You set up the server at `192.168.1.50`. You edit the file to match.
    *   **Day 100 (Disaster)**: The server resets and gets a new IP: `192.168.1.99`.
    *   **The Fix**: You (the Admin) simply open `Z:\General\TimeTrackingConfig\server_config.json` and change `.50` to `.99`. Save.
    *   **Result**: Instantly, all 50 users' apps will read the new IP on their next sync attempt and reconnect automatically.
    *   **If IP is NOT updated (Stale)**: The apps will simply fail to connect to the old IP. They will treat this exactly like a "VPN Down" scenario—users continue working offline, and data queues up locally until you fix the IP file.

## 3. Data Flow & Synchronization

### A. The "Write" Path (User logs time)
1.  **Instant Save**: User clicks "Start" or "Stop". Data is immediately committed to the local **SQLite** database.
2.  **Mark Dirty**: The created/updated record is flagged locally with `sync_status = 'pending'`.
3.  **Background Sync**: 
    *   A background process runs periodically (e.g., every 15 minutes) or upon network reconnection.
    *   It queries SQLite: *"Select all records where sync_status is 'pending'"*.
    *   It batches these records and pushes them to the **PostgreSQL** server.
4.  **Confirmation & Integrity**:
    *   **Conflict Prevention**: We use **UUIDs** (Universally Unique IDs) for all records instead of simple numbers (1, 2, 3). This guarantees that if John creates "Session A" and Jane creates "Session B" at the exact same millisecond, they will never clash.
    *   **Traceability**: Every record pushed to the central DB includes:
        *   `origin_user_id`: Who created it.
        *   `client_timestamp`: When it was created locally.
        *   `synced_at`: When it arrived at the server.
    *   **Status Update**: Only after the server replies "Received & Saved", the local app updates that specific record's status to `sync_status = 'synced'`.

### B. The "Read" Path (Project Manager updates)
1.  **Pull Changes**: During the sync cycle, the app also asks the server: *"Are there any new tasks or projects for me since my last sync?"*
2.  **Local Update**: New projects/tasks created by the Admin/PM are downloaded and inserted into the local SQLite database.
3.  **UI Refresh**: The user sees the new projects appear in their list automatically.

## 4. Resilience & Error Handling

### Scenario 1: VPN Disconnected / Network Down
*   **Behavior**: Sync attempts fail silently in the background.
*   **Performance Guarantee (No Freezing)**:
    *   The sync process runs in an **Asynchronous Background Task** (using `ipcMain` handlers and Javascript Promises).
    *   It is strictly decoupled from the UI thread. The "Spinner" or "Loading Bar" is completely optional.
    *   To the user, the app feels exactly the same whether it is syncing or not.
*   **Recovery**: Next time the VPN connected + 15 mins pass, the backlog is uploaded.

### Scenario 2: Re-Discovery Routine (Automated Fix)
*   **Trigger**: The App tries to sync to `192.168.1.50` and gets a "Connection Refused" or "Timeout" error.
*   **Action**:
    1.  App logs "Old IP failed".
    2.  App reads `Z:\General\TimeTrackingConfig\server_config.json` again.
    3.  **Check**: Is the IP in the file different from what I have memory?
        *   **Yes**: "Oh, the server moved to .99!" -> Update memory, Retry connection immediately.
        *   **No**: "Server is just down." -> Wait 15 minutes, try again.

### Scenario 3: Data Privacy & Visibility Rules (CRITICAL)
*   **The Golden Rule**: Standard users **NEVER** access the full central database. They only push their small piece of the puzzle.
*   **Central Database Structure**:
    *   Every single record in the central `sessions` table is stamped with a `user_id`.
*   **Sync Logic by Role**:
    *   **Standard User**:
        *   **PUSH**: Sends their own local time logs to server.
        *   **PULL**: Fetches ONLY the latest Project/Client/Task definitions. **They DO NOT pull time logs.** Their local app remains a view of *only* their own work.
    *   **Admin User**:
        *   **Access**: Has a special "Dashboard" view that can query the Central DB for *all* `user_id`s to generate reports.

## 5. Implementation Roadmap

### Phase 1: Database Migration
*   [ ] Set up PostgreSQL instance on the internal server.
*   [ ] Modify local `sessions.db` schema to add `sync_status`, `server_id`, and `last_synced_at` columns.
*   [ ] Create the `db_config.json` on the Network Drive.

### Phase 2: The Sync Service
*   [ ] Build `SyncService` class in the Electron Main process.
*   [ ] Implement "Push" logic (SQLite -> Postgres).
*   [ ] Implement "Pull" logic for basic configuration (Projects/Clients).
*   [ ] **Feature**: Add "Sync Now" button to the UI Header.

### Phase 3: Admin Dashboard
*   [ ] Update the Dashboard view to query aggregate stats from the local copy (which is now enriched with team data if the user is a PM).

## 6. Access Control (RBAC)
*   **Global Admin**: Can query Central DB for all users.
*   **Project Manager**: Can assign projects (Push project assignments). Can query Central DB for time logs *only* for their assigned projects.
*   **Team Member**: Can ONLY Push their own time. Can Pull only project assignments. **Strictly Isolated View.**

## 7. Notification Strategy

### A. In-App Notifications (Recommended - "Phase 1")
*   **Mechanism**: Since we are already syncing data every 15 minutes, we can piggback notifications on that same channel.
*   **How it works**:
    1.  PM assigns "Project X" to John.
    2.  Server creates a `notification` record: `{to_user: 'John', message: 'New Project Assigned: Project X'}`.
    3.  John's app performs its 15-min sync.
    4.  It sees the new notification record.
    5.  App shows a small "Toast" popup (bottom right corner) or a red dot on the "Projects" tab.
*   **Pros**: Zero extra infrastructure. Very easy to build.
*   **Cons**: Only seen when app is open.

*(Email notifications removed as per request)*

## 8. User Controls: Manual Sync
*   **UI Addition**: A prominent "Sync" button (icon: refreshing arrows) in the top header.
*   **Behavior**:
    1.  User clicks button.
    2.  Icon starts spinning.
    3.  App immediately triggers the `SyncService.runSync()` method (bypassing the 15-min timer).
    4.  If successful: Icon turns green/check. User sees "Last synced: Just now".
    5.  If failed: Icon turns red/warning. User sees "Sync failed. Retry?"
