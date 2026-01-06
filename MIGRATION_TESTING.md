# Database Migration Testing Guide

This guide provides comprehensive testing procedures for database migrations in the Tshifhinga Time Tracker application.

## Table of Contents

1. [Overview](#overview)
2. [Pre-Testing Setup](#pre-testing-setup)
3. [Test Scenarios](#test-scenarios)
4. [Testing Checklist](#testing-checklist)
5. [Sample Test Data](#sample-test-data)
6. [Rollback Testing](#rollback-testing)
7. [Performance Testing](#performance-testing)
8. [Common Issues](#common-issues)

---

## Overview

### Why Test Database Migrations?

Database migrations are **critical** because:
- They modify user data storage structure
- Errors can cause data loss or corruption
- Failed migrations can prevent app startup
- Users can't easily rollback failed migrations
- Testing catches issues before they affect real users

### What to Test

Every migration should be tested for:
- **Correctness**: Schema changes applied successfully
- **Data Integrity**: Existing data preserved and accessible
- **Idempotency**: Migration can run multiple times safely
- **Performance**: Migration completes in reasonable time
- **Backward Compatibility**: Old data works with new schema
- **Error Handling**: Graceful failure and informative errors

---

## Pre-Testing Setup

### Environment Setup

You'll need:

1. **Test Machine** (or VM):
   - Windows 10 or Windows 11
   - Previous version of the app installed
   - OR ability to install from scratch

2. **Test Databases**:
   - Empty database (new install)
   - Small database (~10 sessions)
   - Medium database (~100 sessions)
   - Large database (~1000+ sessions) - optional but recommended

3. **Tools** (optional but helpful):
   - **DB Browser for SQLite**: https://sqlitebrowser.org/
   - **SQLite command-line tool**: For manual SQL inspection

### Creating Test Databases

#### Option 1: Manual Creation

1. Install v1.0.0 (or previous version)
2. Use the app normally to create test data
3. Backup the database for reuse

#### Option 2: SQL Script

Create a SQL script to generate test data:

```sql
-- test_data.sql
-- Creates sample data for migration testing

INSERT INTO clients (id, name, created_at) VALUES
  (1, 'Test Client A', 1704067200000),
  (2, 'Test Client B', 1704067200000);

INSERT INTO projects (id, name, client_id, created_at) VALUES
  (1, 'Project Alpha', 1, 1704067200000),
  (2, 'Project Beta', 1, 1704067200000),
  (3, 'Project Gamma', 2, 1704067200000);

INSERT INTO tasks (id, name, project_id, created_at) VALUES
  (1, 'Development', 1, 1704067200000),
  (2, 'Testing', 1, 1704067200000),
  (3, 'Design', 2, 1704067200000);

INSERT INTO sessions (id, start, end, active_ms, client_id, project_id, task_id, created_at) VALUES
  (1, 1704067200000, 1704070800000, 3600000, 1, 1, 1, 1704067200000),
  (2, 1704073200000, 1704076800000, 3600000, 1, 1, 2, 1704073200000),
  (3, 1704080400000, 1704084000000, 3600000, 2, 3, 3, 1704080400000);
```

Apply with:
```bash
sqlite3 sessions.db < test_data.sql
```

---

## Test Scenarios

### Scenario 1: Fresh Installation

**Purpose**: Verify new installations create correct schema

**Steps**:

1. **Uninstall any existing version**:
   - Settings → Apps → Uninstall

2. **Delete any old database**:
   - Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data\`
   - Delete `sessions.db` if it exists

3. **Install new version**:
   - Run installer: `Tshifhinga Time Tracker Setup X.X.X.exe`

4. **Launch app**:
   - Start the application
   - Complete any first-run setup

5. **Verify schema**:
   - Check that database exists at: `%APPDATA%\Tshifhinga Time Tracker\data\sessions.db`
   - Open in DB Browser for SQLite
   - Verify all tables exist:
     - clients
     - projects
     - tasks
     - sessions
     - users
     - user_project_permissions
     - teams
     - regions
     - job_levels
     - billable_rates_by_job_level
     - permission_templates
     - permission_history
     - session_edits (if applicable)
     - user_reliability_metrics (if applicable)

6. **Verify functionality**:
   - Can create a client
   - Can create a project
   - Can create a task
   - Can start/stop timer
   - Session saves correctly

**Expected Result**: ✅ All tables created, app functional

**Pass/Fail Criteria**:
- [ ] Database created at correct location
- [ ] All required tables exist
- [ ] All columns present with correct types
- [ ] Foreign keys configured correctly
- [ ] Can create and save sessions

---

### Scenario 2: Update from Previous Version (No Data)

**Purpose**: Verify migration works on empty database

**Steps**:

1. **Install previous version** (e.g., v1.0.0):
   - Run installer
   - Launch app once to create database
   - Close app immediately (don't add data)

2. **Verify baseline**:
   - Database exists at: `%APPDATA%\Tshifhinga Time Tracker\data\sessions.db`
   - Note database file size (should be small, ~50-100 KB)

3. **Install new version** (e.g., v1.1.0):
   - Close app completely
   - Run new installer
   - Installer completes successfully

4. **Launch updated app**:
   - Start the application
   - Watch console logs (if available) for migration messages

5. **Verify migration**:
   - Open database in DB Browser
   - Check for new columns (compare with migration definition)
   - Check for new tables (if migration adds tables)
   - Verify indexes created

6. **Verify functionality**:
   - App launches without errors
   - Can create sessions
   - Can view (empty) history

**Expected Result**: ✅ Migration applied, schema updated, app functional

**Pass/Fail Criteria**:
- [ ] App launches successfully
- [ ] New columns exist
- [ ] New tables exist (if applicable)
- [ ] No errors in console
- [ ] Can create and save sessions

---

### Scenario 3: Update from Previous Version (With Data)

**Purpose**: Verify migration preserves existing data

**Critical Test - Most Important!**

**Steps**:

1. **Install previous version** (e.g., v1.0.0)

2. **Create comprehensive test data**:
   - 3-5 clients
   - 5-10 projects
   - 10-15 tasks
   - 20-50 sessions with variety:
     - Different clients/projects/tasks
     - Different time ranges
     - Active and completed sessions
     - Sessions from different dates
   - 2-3 users (if applicable)
   - Various permissions (if applicable)

3. **Document test data**:
   ```
   Clients:
   - Client A (id: 1)
   - Client B (id: 2)
   - Client C (id: 3)

   Projects:
   - Project Alpha (id: 1, client: 1)
   - Project Beta (id: 2, client: 1)
   - Project Gamma (id: 3, client: 2)

   Sessions Count: 45 total
   Total Active Time: 150 hours
   ```

4. **Backup database**:
   ```
   Copy: sessions.db → sessions_pre_migration_backup.db
   ```

5. **Take screenshots**:
   - Dashboard showing sessions
   - Session list
   - Any key data displays

6. **Export data** (if export feature exists):
   - Export to CSV for comparison later

7. **Close app completely**

8. **Install new version**:
   - Run installer
   - Let it complete

9. **Launch updated app**:
   - Start application
   - Note any migration messages
   - Wait for app to fully load

10. **Verify data integrity**:

    **Clients**:
    - [ ] All clients still exist
    - [ ] Client names unchanged
    - [ ] Client IDs preserved

    **Projects**:
    - [ ] All projects still exist
    - [ ] Projects linked to correct clients
    - [ ] Project names unchanged

    **Tasks**:
    - [ ] All tasks still exist
    - [ ] Tasks linked to correct projects
    - [ ] Task names unchanged

    **Sessions**:
    - [ ] All sessions still exist
    - [ ] Session count matches (e.g., 45 sessions)
    - [ ] Total active time matches (e.g., 150 hours)
    - [ ] Session times correct (start/end/duration)
    - [ ] Sessions linked to correct client/project/task
    - [ ] Session dates preserved
    - [ ] Active sessions still marked as active (if any)
    - [ ] Completed sessions still marked as completed

    **Users** (if applicable):
    - [ ] All users still exist
    - [ ] Usernames unchanged
    - [ ] Roles preserved

    **New Fields** (for new columns added by migration):
    - [ ] New columns exist on existing rows
    - [ ] Default values applied correctly
    - [ ] NULL values where appropriate

11. **Test functionality**:
    - [ ] Can view all old sessions
    - [ ] Can edit old sessions
    - [ ] Can create new sessions
    - [ ] Can delete sessions
    - [ ] Reports show correct data
    - [ ] Filters work
    - [ ] Search works

12. **Compare with backup**:
    - Open backup database in DB Browser
    - Compare row counts
    - Spot-check individual records

**Expected Result**: ✅ All data preserved, migration successful, app functional

**Pass/Fail Criteria**:
- [ ] All pre-existing data intact
- [ ] Data relationships preserved
- [ ] No data loss
- [ ] No data corruption
- [ ] App fully functional with old and new data

**If this test fails, DO NOT RELEASE THE UPDATE!**

---

### Scenario 4: Sequential Migrations (Skipped Versions)

**Purpose**: Verify users can skip versions

**Example**: User updates from v1.0.0 → v1.3.0 (skipping v1.1.0 and v1.2.0)

**Steps**:

1. **Install v1.0.0**
2. **Add test data** (moderate amount)
3. **Backup database**
4. **Install v1.3.0 directly** (do not install v1.1.0 or v1.2.0)
5. **Launch app**
6. **Verify all migrations applied**:
   - Migrations from v1.0→v1.1
   - Migrations from v1.1→v1.2
   - Migrations from v1.2→v1.3
   - All should run in sequence automatically
7. **Verify data integrity** (same as Scenario 3)
8. **Verify all features work** (from all skipped versions)

**Expected Result**: ✅ All intermediate migrations applied, data preserved

**Pass/Fail Criteria**:
- [ ] All migrations (1.0→1.1→1.2→1.3) applied successfully
- [ ] No errors or warnings
- [ ] Data integrity maintained
- [ ] Features from all versions work

---

### Scenario 5: Migration Idempotency

**Purpose**: Verify migration can run multiple times without issues

**Note**: This tests that the migration checks for existing columns/tables before adding them.

**Steps**:

1. **Install previous version**
2. **Add test data**
3. **Backup database**
4. **Install new version** (migration runs once)
5. **Verify migration succeeded**
6. **Manually trigger migration again**:
   - Option A: Modify the migration check to always run
   - Option B: Manually run the migration SQL
7. **Verify no errors**:
   - "Column already exists" errors should be caught and ignored
   - "Table already exists" should be handled gracefully
8. **Verify data unchanged**:
   - No duplicate rows
   - No data modified
   - Schema unchanged (same as after first migration)

**Expected Result**: ✅ Second migration run does nothing, no errors

**Pass/Fail Criteria**:
- [ ] Migration detects existing changes
- [ ] No errors thrown
- [ ] No data modified
- [ ] Schema unchanged

---

### Scenario 6: Large Database Migration

**Purpose**: Verify migration performance with real-world data volume

**Steps**:

1. **Create large test database**:
   - 1000+ sessions
   - 100+ projects
   - 50+ clients
   - Multiple years of data

   **Shortcut**: Use SQL script to bulk insert:
   ```sql
   -- Generate 1000 sessions
   INSERT INTO sessions (client_id, project_id, task_id, start, end, active_ms)
   SELECT
     (ABS(RANDOM()) % 5) + 1 as client_id,
     (ABS(RANDOM()) % 20) + 1 as project_id,
     (ABS(RANDOM()) % 50) + 1 as task_id,
     1704067200000 + (ABS(RANDOM()) % 31536000000) as start,
     1704067200000 + (ABS(RANDOM()) % 31536000000) + 3600000 as end,
     3600000 as active_ms
   FROM generate_series(1, 1000);
   ```

2. **Note database size**:
   - Check file size in MB

3. **Backup database**

4. **Time the migration**:
   - Start timer
   - Install new version
   - Launch app
   - Wait for migration to complete
   - Stop timer

5. **Verify**:
   - All 1000+ sessions still exist
   - Data integrity maintained
   - Migration completed in < 1 minute (should be fast)

**Expected Result**: ✅ Large database migrates successfully in reasonable time

**Pass/Fail Criteria**:
- [ ] Migration completes in < 1 minute
- [ ] All data preserved
- [ ] No performance degradation after migration
- [ ] App remains responsive

**Performance Benchmarks**:
- 100 sessions: < 5 seconds
- 1,000 sessions: < 30 seconds
- 10,000 sessions: < 2 minutes

---

### Scenario 7: Corrupted Database Detection

**Purpose**: Verify migration handles corrupted databases gracefully

**Steps**:

1. **Create test database**
2. **Corrupt the database**:
   - Method 1: Edit `sessions.db` with text editor (add random characters)
   - Method 2: Truncate file to partial size
3. **Install new version**
4. **Launch app**
5. **Verify error handling**:
   - App should detect corruption
   - Should show clear error message
   - Should not crash silently
   - Should suggest restore from backup

**Expected Result**: ✅ Graceful error, clear message, no silent failure

**Pass/Fail Criteria**:
- [ ] Corruption detected
- [ ] Clear error message shown
- [ ] App doesn't crash
- [ ] User directed to restore from backup

---

## Testing Checklist

Use this checklist before releasing any version with database migrations:

### Pre-Migration Testing

- [ ] Migration code reviewed
- [ ] SQL syntax verified
- [ ] Default values defined for new columns
- [ ] Foreign keys validated
- [ ] Indexes planned (if needed)
- [ ] Migration documented in CHANGELOG

### Fresh Install Testing

- [ ] Clean install creates correct schema
- [ ] All tables created
- [ ] All columns present
- [ ] Foreign keys work
- [ ] App functional

### Update Testing (No Data)

- [ ] Empty database migrates successfully
- [ ] New columns added
- [ ] New tables added (if applicable)
- [ ] No errors in console
- [ ] App functional after migration

### Update Testing (With Data)

- [ ] Small database (10 sessions) migrates successfully
- [ ] All data preserved
- [ ] Data integrity maintained
- [ ] New columns have correct defaults
- [ ] All features work with old data

- [ ] Medium database (100 sessions) migrates successfully
- [ ] Performance acceptable (< 30 seconds)
- [ ] All data preserved
- [ ] App remains responsive

- [ ] Large database (1000+ sessions) migrates successfully
- [ ] Performance acceptable (< 2 minutes)
- [ ] All data preserved
- [ ] No memory issues

### Idempotency Testing

- [ ] Migration can run twice without errors
- [ ] No duplicate data created
- [ ] Schema unchanged on second run

### Sequential Migration Testing

- [ ] Can skip versions (e.g., 1.0→1.3)
- [ ] All intermediate migrations apply
- [ ] Data preserved across multiple migrations

### Error Handling Testing

- [ ] Corrupted database handled gracefully
- [ ] Clear error messages
- [ ] No silent failures
- [ ] Recovery path documented

### Rollback Testing

- [ ] Can restore from backup
- [ ] Old version works with old database
- [ ] Rollback documented in USER_GUIDE

### Cross-Version Compatibility

- [ ] New version works with old database (before migration)
- [ ] Old version works with old database (for rollback)

---

## Sample Test Data

### Minimal Test Data

For quick testing:

```sql
INSERT INTO clients VALUES (1, 'Acme Corp', 1704067200000);
INSERT INTO projects VALUES (1, 'Website Redesign', 1, 1704067200000);
INSERT INTO tasks VALUES (1, 'Frontend Dev', 1, 1704067200000);
INSERT INTO sessions VALUES (1, 1704067200000, 1704070800000, 3600000, 1, 1, 1, 1704067200000);
```

### Realistic Test Data

For comprehensive testing:

```sql
-- Clients
INSERT INTO clients (id, name, created_at) VALUES
  (1, 'Acme Corporation', 1704067200000),
  (2, 'TechStart Inc', 1704070800000),
  (3, 'Global Solutions', 1704074400000);

-- Projects
INSERT INTO projects (id, name, client_id, created_at) VALUES
  (1, 'Website Redesign', 1, 1704067200000),
  (2, 'Mobile App', 1, 1704070800000),
  (3, 'API Development', 2, 1704074400000),
  (4, 'Database Migration', 2, 1704078000000),
  (5, 'Cloud Infrastructure', 3, 1704081600000);

-- Tasks
INSERT INTO tasks (id, name, project_id, created_at) VALUES
  (1, 'Frontend Development', 1, 1704067200000),
  (2, 'Backend Development', 1, 1704067200000),
  (3, 'UI/UX Design', 1, 1704067200000),
  (4, 'iOS Development', 2, 1704070800000),
  (5, 'Android Development', 2, 1704070800000),
  (6, 'API Design', 3, 1704074400000),
  (7, 'API Implementation', 3, 1704074400000),
  (8, 'Testing', 3, 1704074400000);

-- Sessions (20 sample sessions)
INSERT INTO sessions (id, start, end, active_ms, client_id, project_id, task_id, created_at) VALUES
  (1,  1704067200000, 1704074400000, 7200000, 1, 1, 1, 1704067200000),
  (2,  1704153600000, 1704160800000, 7200000, 1, 1, 2, 1704153600000),
  (3,  1704240000000, 1704247200000, 7200000, 1, 1, 3, 1704240000000),
  (4,  1704326400000, 1704333600000, 7200000, 1, 2, 4, 1704326400000),
  (5,  1704412800000, 1704420000000, 7200000, 1, 2, 5, 1704412800000),
  (6,  1704499200000, 1704506400000, 7200000, 2, 3, 6, 1704499200000),
  (7,  1704585600000, 1704592800000, 7200000, 2, 3, 7, 1704585600000),
  (8,  1704672000000, 1704679200000, 7200000, 2, 3, 8, 1704672000000),
  (9,  1704758400000, 1704765600000, 7200000, 2, 4, 8, 1704758400000),
  (10, 1704844800000, 1704852000000, 7200000, 3, 5, 8, 1704844800000);
```

---

## Rollback Testing

### When to Test Rollback

Test rollback scenarios if:
- Migration involves complex schema changes
- Data transformation is involved
- Renaming or restructuring tables
- Critical production deployment

### Rollback Test Steps

1. **Setup**:
   - Install v1.0.0
   - Add comprehensive test data
   - Backup: `sessions_v1.0.0.db`

2. **Update**:
   - Install v1.1.0
   - Let migration run
   - Verify it works
   - Add new data in v1.1.0

3. **Rollback**:
   - Uninstall v1.1.0
   - Restore backup: `sessions_v1.0.0.db`
   - Install v1.0.0
   - Launch app

4. **Verify**:
   - [ ] App launches on v1.0.0
   - [ ] Old data accessible
   - [ ] App functional
   - **Note**: New data added in v1.1.0 will be lost (expected)

### Rollback Documentation

Document the rollback procedure in:
- UPDATE_PROCESS.md (for maintainers)
- USER_GUIDE.md (for users)

---

## Performance Testing

### Migration Performance Metrics

Measure migration time for different database sizes:

| Database Size | Expected Migration Time |
|---------------|------------------------|
| Empty | < 1 second |
| 10 sessions | < 5 seconds |
| 100 sessions | < 10 seconds |
| 1,000 sessions | < 30 seconds |
| 10,000 sessions | < 2 minutes |

### How to Measure

```bash
# Start timer
time_start=$(date +%s)

# Launch app (migration runs)
# ... app launches ...

# Stop timer
time_end=$(date +%s)
migration_time=$((time_end - time_start))

echo "Migration took: $migration_time seconds"
```

### Performance Optimization

If migration is slow:
- Check for missing indexes
- Ensure transactions are used
- Avoid row-by-row updates (use batch updates)
- Test on different hardware (slow/fast machines)

---

## Common Issues

### Issue: "Column already exists" Error

**Cause**: Migration not checking if column exists before adding

**Fix**: Add existence check:
```typescript
this.db.all("PRAGMA table_info(sessions)", (err, columns: any[]) => {
  const hasColumn = columns.some(col => col.name === 'new_column');
  if (!hasColumn) {
    // Add column
  }
});
```

### Issue: Data Loss After Migration

**Cause**:
- Using ALTER TABLE DROP COLUMN (SQLite doesn't support it well)
- Renaming columns without data migration
- Deleting rows accidentally

**Prevention**:
- Never use DROP COLUMN
- Always copy data before renaming
- Test thoroughly before release

### Issue: Foreign Key Constraint Failures

**Cause**: Adding foreign key to existing data that violates constraint

**Fix**:
- Set foreign key to NULL initially
- Or update existing rows to valid values
- Or add foreign key without enforcement initially

### Issue: Migration Takes Too Long

**Cause**:
- Large database
- Missing indexes
- Row-by-row updates

**Fix**:
- Use batch updates
- Add indexes before data transformation
- Use transactions

### Issue: App Crashes After Migration

**Cause**:
- Code expects new column but migration failed
- Type mismatch
- NULL values where NOT NULL expected

**Fix**:
- Always set DEFAULT values
- Make new columns NULL-able initially
- Check migration success before using new fields

---

## Reporting Template

After testing, document results:

```markdown
# Migration Test Report - v1.1.0

**Date**: 2026-01-15
**Tester**: Your Name
**Migration**: v1.0.0 → v1.1.0

## Summary
- ✅ All tests passed
- Migration adds `edited_at` column to sessions table
- Performance acceptable on databases up to 10,000 sessions

## Test Results

### Fresh Install
- ✅ PASS - Clean database created correctly
- Time: < 1 second

### Update (No Data)
- ✅ PASS - Empty database migrated successfully
- Time: 2 seconds

### Update (With Data)
- ✅ PASS - Small DB (50 sessions): 5 seconds, all data preserved
- ✅ PASS - Medium DB (500 sessions): 15 seconds, all data preserved
- ✅ PASS - Large DB (5000 sessions): 45 seconds, all data preserved

### Idempotency
- ✅ PASS - Second run: no errors, no changes

### Sequential Migrations
- ✅ PASS - 1.0.0 → 1.1.0 (direct): Success

### Rollback
- ✅ PASS - Rollback to 1.0.0: Success

## Issues Found
- None

## Recommendation
✅ **APPROVED FOR RELEASE**

Signature: ________________
Date: ______________
```

---

**Document Version**: 1.0
**Last Updated**: January 2026
**For**: Tshifhinga Time Tracker Development Team
