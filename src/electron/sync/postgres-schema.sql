-- PostgreSQL Central Database Schema for Tshifhinga Time Tracker
-- This schema mirrors the local SQLite structure with additional sync fields

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema version tracking table
CREATE TABLE IF NOT EXISTS schema_versions (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applied_by TEXT
);

-- Insert initial schema version
INSERT INTO schema_versions (version, description)
VALUES (1, 'Initial distributed sync schema')
ON CONFLICT DO NOTHING;

-- ============================================
-- CORE TABLES WITH SYNC FIELDS
-- ============================================

-- Users table (central authority)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'director')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Enhanced user fields
    name VARCHAR(255),
    surname VARCHAR(255),
    team VARCHAR(100),
    region VARCHAR(100),
    job_level VARCHAR(100),
    billable_rate DECIMAL(10,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    target_utilization DECIMAL(5,2) DEFAULT 80,
    -- Sync metadata
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Sync metadata
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Sync metadata
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(name, client_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Sync metadata
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(name, project_id)
);

-- Sessions table (time tracking records)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY, -- Uses client-generated UUID
    client_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    active_ms BIGINT NOT NULL DEFAULT 0,
    paused_ms BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_billable BOOLEAN DEFAULT TRUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_manually_created BOOLEAN DEFAULT FALSE,
    -- Sync metadata
    origin_client_id VARCHAR(255), -- Machine/installation identifier
    client_timestamp TIMESTAMP WITH TIME ZONE, -- When created on client
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    -- Reliability tracking
    actual_end_time BIGINT,
    end_reason VARCHAR(50),
    reliability_score DECIMAL(5,2)
);

-- ============================================
-- CONFIGURATION TABLES
-- ============================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- Job levels table
CREATE TABLE IF NOT EXISTS job_levels (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    level_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- ============================================
-- PERMISSION TABLES
-- ============================================

-- User project permissions
CREATE TABLE IF NOT EXISTS user_project_permissions (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) DEFAULT 'track_time' CHECK (permission_level IN ('view', 'track_time', 'edit', 'admin')),
    can_track_time BOOLEAN DEFAULT TRUE,
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    UNIQUE(user_id, project_id)
);

-- Permission templates
CREATE TABLE IF NOT EXISTS permission_templates (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    template_data JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- Permission history (audit trail)
CREATE TABLE IF NOT EXISTS permission_history (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('granted', 'revoked', 'updated')),
    old_permission_level VARCHAR(50),
    new_permission_level VARCHAR(50),
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    reason TEXT,
    -- Sync metadata
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Billable rates by job level
CREATE TABLE IF NOT EXISTS billable_rates_by_job_level (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    job_level_code VARCHAR(50) NOT NULL REFERENCES job_levels(code) ON DELETE CASCADE,
    rate_zar_per_hour DECIMAL(10,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- ============================================
-- SYNC-SPECIFIC TABLES
-- ============================================

-- Sync log - tracks all sync operations
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL, -- Machine identifier
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('push', 'pull', 'full')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'success', 'partial', 'failed')),
    records_pushed INTEGER DEFAULT 0,
    records_pulled INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    error_message TEXT,
    client_version VARCHAR(50),
    schema_version INTEGER
);

-- Sync conflicts - records conflicts for manual resolution
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL, -- UUID of conflicting record
    local_data JSONB NOT NULL,
    server_data JSONB NOT NULL,
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN ('version_mismatch', 'deleted_modified', 'duplicate')),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution VARCHAR(50) CHECK (resolution IN ('keep_local', 'keep_server', 'merge', 'manual')),
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT
);

-- Notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional structured data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE,
    is_dismissed BOOLEAN DEFAULT FALSE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_synced_at ON sessions(synced_at);
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_time ON sessions(user_id, start_time);

-- Projects/Clients/Tasks indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL;

-- Permissions indexes
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_user ON user_project_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_project ON user_project_permissions(project_id);

-- Sync log indexes
CREATE INDEX IF NOT EXISTS idx_sync_log_user ON sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log(started_at);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON notifications(to_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(to_user_id, read_at) WHERE read_at IS NULL;

-- Conflicts indexes
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user ON sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY['users', 'clients', 'projects', 'tasks', 'sessions',
                           'teams', 'regions', 'job_levels', 'user_project_permissions',
                           'permission_templates', 'billable_rates_by_job_level'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
            CREATE TRIGGER update_%s_updated_at
            BEFORE UPDATE ON %s
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- Function to increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply version increment trigger to syncable tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY['users', 'clients', 'projects', 'tasks', 'sessions',
                           'teams', 'regions', 'job_levels', 'user_project_permissions'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS increment_%s_version ON %s;
            CREATE TRIGGER increment_%s_version
            BEFORE UPDATE ON %s
            FOR EACH ROW
            EXECUTE FUNCTION increment_version();
        ', t, t, t, t);
    END LOOP;
END $$;

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Active sessions view (excludes soft-deleted)
CREATE OR REPLACE VIEW active_sessions AS
SELECT * FROM sessions WHERE deleted_at IS NULL;

-- Active projects with client info
CREATE OR REPLACE VIEW active_projects_with_clients AS
SELECT
    p.id,
    p.uuid,
    p.name AS project_name,
    c.name AS client_name,
    c.id AS client_id,
    p.created_at,
    p.updated_at,
    p.version
FROM projects p
JOIN clients c ON p.client_id = c.id
WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL;

-- User time summary view
CREATE OR REPLACE VIEW user_time_summary AS
SELECT
    u.id AS user_id,
    u.username,
    u.name,
    u.surname,
    u.team,
    COUNT(s.id) AS total_sessions,
    SUM(s.active_ms) AS total_active_ms,
    SUM(s.paused_ms) AS total_paused_ms,
    MAX(s.synced_at) AS last_sync
FROM users u
LEFT JOIN sessions s ON u.id = s.user_id AND s.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.name, u.surname, u.team;

-- ============================================
-- INITIAL DATA
-- ============================================

-- This will be populated by the admin during setup
-- No seed data included as it should come from the existing local database
