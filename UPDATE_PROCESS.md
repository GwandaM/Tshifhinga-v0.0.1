# Update Release Process - Tshifhinga Time Tracker

This guide explains how to build, test, and distribute updates to users via the company network share.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Version Management](#version-management)
3. [Adding Database Migrations](#adding-database-migrations)
4. [Building the Update](#building-the-update)
5. [Testing the Update](#testing-the-update)
6. [Distribution Workflow](#distribution-workflow)
7. [User Communication](#user-communication)
8. [Rollback Procedure](#rollback-procedure)
9. [Common Scenarios](#common-scenarios)

---

## Prerequisites

Before releasing an update, ensure you have:

- [ ] Development environment set up (Node.js, npm)
- [ ] Access to the codebase
- [ ] Access to company network share for distribution
- [ ] Test machine with previous version installed
- [ ] Changelog of changes since last version

---

## Version Management

### Understanding Semantic Versioning

Use semantic versioning: **MAJOR.MINOR.PATCH**

**Examples**:
- `1.0.0` → `1.0.1` - Bug fixes, minor improvements (PATCH)
- `1.0.0` → `1.1.0` - New features, no breaking changes (MINOR)
- `1.0.0` → `2.0.0` - Breaking changes, major overhaul (MAJOR)

### Updating the Version Number

**Step 1: Edit package.json**

Location: `/package.json` (root directory)

```json
{
  "name": "tshifhinga-time-tracker",
  "version": "1.0.0"  // ← Change this
}
```

**Examples**:
- Bug fix release: `"1.0.0"` → `"1.0.1"`
- New feature: `"1.0.1"` → `"1.1.0"`
- Major update: `"1.1.0"` → `"2.0.0"`

**Step 2: Commit the Version Change**

```bash
git add package.json
git commit -m "Bump version to 1.1.0"
```

---

## Adding Database Migrations

### When Do You Need a Migration?

You need a database migration if you're:
- Adding new columns to existing tables
- Creating new tables
- Adding indexes
- Modifying relationships
- Adding new configuration data

### Two Migration Approaches

#### Option A: Legacy System (Currently Active)

**When to use**: Quick additions, simple schema changes

**Pattern**: Add a new migration method to `src/electron/database.ts`

**Example - Adding a new column**:

```typescript
// In src/electron/database.ts

private addNewFeatureColumn(): void {
  if (!this.db) return;

  this.db.all("PRAGMA table_info(sessions)", (err, columns: any[]) => {
    if (err) {
      console.error('Error checking for new_feature column:', err);
      return;
    }

    const hasColumn = columns.some(col => col.name === 'new_feature');

    if (!hasColumn) {
      this.db.run(
        "ALTER TABLE sessions ADD COLUMN new_feature TEXT DEFAULT ''",
        (alterErr) => {
          if (alterErr) {
            console.error('Error adding new_feature column:', alterErr);
          } else {
            console.log('Successfully added new_feature column');
          }
        }
      );
    } else {
      console.log('new_feature column already exists');
    }
  });
}
```

**Step 2**: Call the method in `initializeDatabaseConnection()`:

```typescript
async initializeDatabaseConnection(): Promise<void> {
  // ... existing code ...

  this.addBillableColumnIfMissing();
  this.addUserIdColumnIfMissing();
  this.addCodeColumnToTeamsTableIfMissing();
  this.addSessionEditingFeatures();
  this.addNewFeatureColumn(); // ← Add your new migration here

  // ... rest of code ...
}
```

#### Option B: MigrationService (Better Long-Term)

**When to use**: Complex migrations, need version tracking, need rollback capability

**Note**: MigrationService is implemented but not currently active. To use it, you need to:

1. Activate it in `src/electron/main.ts`
2. Add your migration to `src/electron/migration-service.ts`

**Example - Adding Migration 11**:

```typescript
// In src/electron/migration-service.ts

private migrations: Migration[] = [
  // ... existing migrations 1-10 ...

  {
    version: 11,
    name: 'add_new_feature',
    up: [
      `ALTER TABLE sessions ADD COLUMN new_feature TEXT DEFAULT ''`,
      `CREATE INDEX idx_sessions_new_feature ON sessions(new_feature)`
    ],
    down: [
      `DROP INDEX idx_sessions_new_feature`,
      // Note: SQLite doesn't support DROP COLUMN easily, so we skip it
    ],
    checksum: '' // Will be auto-generated
  }
];
```

**Activation**: See Optional Improvements section in the plan file.

### Safe Migration Practices

**Do's**:
- ✅ Use `ALTER TABLE ADD COLUMN` with `DEFAULT` values
- ✅ Create new tables with `CREATE TABLE IF NOT EXISTS`
- ✅ Add indexes with `CREATE INDEX IF NOT EXISTS`
- ✅ Test on a copy of production database
- ✅ Always provide sensible defaults for new columns

**Don'ts**:
- ❌ Never use `ALTER TABLE DROP COLUMN` (SQLite doesn't support it well)
- ❌ Never rename columns without data migration plan
- ❌ Never change column types without data conversion
- ❌ Never run migrations without testing first

---

## Building the Update

### Step 1: Clean Build

Remove previous build artifacts:

```bash
# macOS/Linux
rm -rf dist dist-electron release

# Windows
rmdir /s /q dist dist-electron release
```

### Step 2: Install Dependencies (if changed)

```bash
npm install
```

### Step 3: Build the Windows Installer

```bash
npm run electron:build
```

**This command does**:
1. Builds React/Vite app → `dist/`
2. Compiles Electron TypeScript → `dist-electron/`
3. Packages with electron-builder → `release/`

**Expected output**:
```
release/Tshifhinga Time Tracker Setup 1.1.0.exe
```

**Build time**: 2-5 minutes

### Step 4: Verify the Build

Check that the installer was created:

```bash
# macOS/Linux
ls -lh release/*.exe

# Windows
dir release\*.exe
```

Verify file size: Should be ~150-250 MB

---

## Testing the Update

### Test Scenario 1: Clean Install

**Purpose**: Verify new installation works

**Steps**:
1. Find a clean test machine (no app installed)
2. Run the installer: `Tshifhinga Time Tracker Setup 1.1.0.exe`
3. Complete installation
4. Launch the app
5. Test core functionality:
   - Login works
   - Can create client/project/task
   - Can start/stop timer
   - Sessions save correctly
   - Database created at: `%APPDATA%\Tshifhinga Time Tracker\data\sessions.db`

**Expected**: Everything works, clean database initialized

### Test Scenario 2: Update from Previous Version

**Purpose**: Verify database migration works

**Critical Test - This is the most important one!**

**Steps**:

1. **Set up test environment**:
   - Use a test machine with v1.0.0 installed
   - Or: Install v1.0.0 from `\\company-server\shared\apps\time-tracker\v1.0.0\`

2. **Add test data**:
   - Log in
   - Create at least:
     - 2 clients
     - 3 projects across those clients
     - 5 tasks across those projects
     - 10 time tracking sessions (mix of ongoing and completed)
   - Add users (if testing user features)

3. **Backup the database**:
   ```
   Navigate to: %APPDATA%\Tshifhinga Time Tracker\data
   Copy: sessions.db → sessions_v1.0.0_backup.db
   ```

4. **Close the app completely**

5. **Install the update**:
   - Run the new installer: `Tshifhinga Time Tracker Setup 1.1.0.exe`
   - Let it complete (it will overwrite app files, NOT the database)

6. **Launch the updated app**:
   - Watch the console logs (if running from terminal)
   - Look for migration messages like:
     ```
     Successfully added new_feature column
     Migration complete
     ```

7. **Verify data integrity**:
   - All old clients still exist
   - All old projects still exist
   - All old tasks still exist
   - All old sessions still exist with correct times
   - Can view session history
   - Can create new sessions

8. **Test new features**:
   - Verify new functionality works
   - Check that new database columns are accessible

9. **Test rollback** (optional):
   - Close the app
   - Restore backup: Copy `sessions_v1.0.0_backup.db` → `sessions.db`
   - Launch app again
   - Verify old data still intact

**Expected Results**:
- ✅ Update installs successfully
- ✅ App launches without errors
- ✅ All old data preserved
- ✅ Migrations run automatically
- ✅ New features work
- ✅ No crashes or database errors

**If any of these fail, DO NOT RELEASE THE UPDATE**

### Test Scenario 3: Multiple Sequential Updates

**Purpose**: Verify migrations work when users skip versions

**Example**: User updates from v1.0.0 → v1.2.0 (skipping v1.1.0)

**Steps**:
1. Install v1.0.0
2. Add test data
3. Install v1.2.0 directly (skip v1.1.0)
4. Verify all migrations from v1.0.0 to v1.2.0 applied correctly

**Expected**: All intermediate migrations run, data preserved

### Test Scenario 4: Database with Heavy Load

**Purpose**: Verify performance with large datasets

**Steps**:
1. Create database with:
   - 100+ sessions
   - 20+ projects
   - Multiple users
2. Update to new version
3. Verify migration completes in reasonable time (< 30 seconds)

---

## Distribution Workflow

### Network Share Structure

Set up your network share with this structure:

```
\\company-server\shared\apps\time-tracker\
├── v1.0.0\
│   ├── Tshifhinga Time Tracker Setup 1.0.0.exe
│   └── CHANGELOG_v1.0.0.md
├── v1.1.0\
│   ├── Tshifhinga Time Tracker Setup 1.1.0.exe
│   └── CHANGELOG_v1.1.0.md
├── latest\
│   ├── Tshifhinga Time Tracker Setup 1.1.0.exe  (copy of latest)
│   ├── CHANGELOG_latest.md  (copy of latest)
│   └── USER_GUIDE.md  (always current version)
└── documentation\
    ├── USER_GUIDE.md
    ├── TROUBLESHOOTING.md
    └── UPDATE_INSTRUCTIONS.md
```

### Distribution Steps

**1. Create Changelog**

Create a file: `CHANGELOG_v1.1.0.md`

```markdown
# Version 1.1.0 - 2026-01-15

## New Features
- Added ability to edit sessions after they're stopped
- New "Analytics" dashboard with time reports
- Export sessions to CSV format

## Improvements
- Faster session loading (50% improvement)
- Better error messages for login failures
- Updated UI for client selection

## Bug Fixes
- Fixed timer not stopping when computer sleeps
- Fixed session duplication bug
- Fixed timezone issues in reports

## Database Changes
- Added `edited_at` column to sessions table
- Added `session_edits` table for audit trail
- All changes applied automatically on first launch

## Installation Notes
- Backup your database before updating (see instructions)
- Estimated update time: 2 minutes
- App version will show 1.1.0 in About page
```

**2. Copy Files to Network Share**

```bash
# Create version folder
mkdir "\\company-server\shared\apps\time-tracker\v1.1.0"

# Copy installer
cp "release/Tshifhinga Time Tracker Setup 1.1.0.exe" "\\company-server\shared\apps\time-tracker\v1.1.0\"

# Copy changelog
cp "CHANGELOG_v1.1.0.md" "\\company-server\shared\apps\time-tracker\v1.1.0\"

# Update 'latest' folder
cp "release/Tshifhinga Time Tracker Setup 1.1.0.exe" "\\company-server\shared\apps\time-tracker\latest\"
cp "CHANGELOG_v1.1.0.md" "\\company-server\shared\apps\time-tracker\latest\CHANGELOG_latest.md"
```

**3. Verify Network Share Access**

- Ensure all employees have READ access to the network share
- Test downloading from a user's computer
- Verify file permissions are correct

---

## User Communication

### Email Template for Update Announcement

```
Subject: Time Tracker Update Available - Version 1.1.0

Hi Team,

A new update for the Tshifhinga Time Tracker is now available.

VERSION: 1.1.0
RELEASE DATE: January 15, 2026

WHAT'S NEW:
• Added ability to edit sessions after they're stopped
• New Analytics dashboard with time reports
• Export sessions to CSV format
• Performance improvements and bug fixes

IMPORTANT BEFORE UPDATING:
1. Backup your data (see instructions below)
2. Close the Time Tracker app completely
3. Download and install the update

WHERE TO DOWNLOAD:
\\company-server\shared\apps\time-tracker\latest\Tshifhinga Time Tracker Setup 1.1.0.exe

BACKUP INSTRUCTIONS:
1. Press Windows Key + R
2. Type: %APPDATA%\Tshifhinga Time Tracker\data
3. Copy the "sessions.db" file to a safe location

INSTALLATION:
1. Close the Time Tracker app
2. Double-click the installer
3. Click through the installation wizard
4. Launch the app - your data will be automatically updated

UPDATE TIME: ~2 minutes

SUPPORT:
If you encounter any issues, please:
1. Check the Troubleshooting Guide: \\company-server\shared\apps\time-tracker\documentation\TROUBLESHOOTING.md
2. Contact IT Support: itsupport@company.com

Thank you!
IT Department
```

### Slack/Teams Message Template

```
📢 **Time Tracker Update Available**

Version 1.1.0 is now available on the network share.

✨ **Highlights:**
• Edit sessions after stopping
• New analytics dashboard
• CSV export
• Bug fixes & performance improvements

📥 **Download:** \\company-server\shared\apps\time-tracker\latest\

⚠️ **Before updating:** Backup your database!
📖 **Instructions:** See email for details

Questions? Contact IT Support
```

---

## Rollback Procedure

### When to Rollback

Rollback to the previous version if:
- Critical bugs discovered after release
- Database migrations failing for users
- App crashes on startup for multiple users
- Data corruption reported

### Rollback Steps

**Option 1: Revert Network Share (Immediate)**

```bash
# Point 'latest' back to previous version
cp "\\company-server\shared\apps\time-tracker\v1.0.0\Tshifhinga Time Tracker Setup 1.0.0.exe" "\\company-server\shared\apps\time-tracker\latest\"
```

Send urgent email:
```
Subject: URGENT: Revert to Time Tracker v1.0.0

An issue was discovered with v1.1.0.

Please install v1.0.0 immediately:
\\company-server\shared\apps\time-tracker\latest\

If you already updated to v1.1.0:
1. Uninstall v1.1.0
2. Install v1.0.0
3. Restore your database backup
4. Contact IT if you need help

We apologize for the inconvenience.
```

**Option 2: User-Level Rollback**

For individual users experiencing issues:

1. **Uninstall current version**:
   - Settings → Apps → Tshifhinga Time Tracker → Uninstall

2. **Restore database backup**:
   - Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
   - Delete current `sessions.db`
   - Copy backup file to this location
   - Rename to `sessions.db`

3. **Install previous version**:
   - Download from: `\\company-server\shared\apps\time-tracker\v1.0.0\`
   - Run installer

4. **Verify**:
   - Launch app
   - Check that data is restored
   - Test core functionality

---

## Common Scenarios

### Scenario 1: Hotfix Release (Patch)

**Example**: Critical bug in v1.1.0 requires immediate fix

**Version**: 1.1.0 → 1.1.1

**Process**:
1. Fix the bug
2. Update version to 1.1.1
3. Build installer
4. Test ONLY the affected functionality (fast track)
5. Distribute with "HOTFIX" label
6. Communicate urgency to users

### Scenario 2: Feature Release (Minor)

**Example**: Adding new analytics page

**Version**: 1.1.0 → 1.2.0

**Process**:
1. Implement feature
2. Add database migrations if needed
3. Update version to 1.2.0
4. Full testing cycle (all scenarios)
5. Create comprehensive changelog
6. Distribute with normal timeline

### Scenario 3: Major Overhaul (Major)

**Example**: Redesigning entire UI, changing database structure significantly

**Version**: 1.2.0 → 2.0.0

**Process**:
1. Extensive development
2. Complex database migrations
3. Beta testing with select users
4. Update version to 2.0.0
5. Extended testing period
6. Gradual rollout (department by department)
7. Dedicated support during transition

### Scenario 4: Database Schema Change

**Example**: Adding new "billable hours" tracking

**Database Impact**: New columns in `sessions` table

**Process**:
1. Design the schema change
2. Implement migration (see "Adding Database Migrations")
3. Test migration with various database states:
   - Empty database (new install)
   - Database with 10 sessions
   - Database with 1000+ sessions
4. Verify migration is idempotent (can run multiple times safely)
5. Verify defaults work correctly for existing rows
6. Test app behavior with new columns

**Testing Checklist**:
- [ ] New install creates column correctly
- [ ] Update from v1.0.0 adds column correctly
- [ ] Existing sessions get correct default values
- [ ] New sessions populate the column
- [ ] App doesn't crash if migration partially fails

---

## Troubleshooting Release Issues

### Issue: Build Fails

**Symptoms**: `npm run electron:build` errors

**Solutions**:
- Clean build: `rm -rf node_modules dist dist-electron release && npm install`
- Check TypeScript errors: `npm run build:electron`
- Verify all imports are correct
- Check for syntax errors

### Issue: Installer Won't Run on User Machine

**Symptoms**: "This app can't run on your PC"

**Causes**:
- Wrong architecture (x86 vs x64)
- Windows version incompatibility

**Solutions**:
- Verify electron-builder config targets x64
- Test on Windows 10 and Windows 11
- Check antivirus isn't blocking

### Issue: Migration Fails on User Machine

**Symptoms**: User reports database errors after update

**Diagnosis**:
1. Ask user to send database file
2. Run migration locally on their database
3. Check error logs

**Solutions**:
- Fix migration code
- Release hotfix version
- Provide manual migration script if needed

### Issue: Version Number Not Updating

**Symptoms**: App shows old version after update

**Causes**:
- Forgot to update package.json
- Build cache not cleared

**Solutions**:
- Verify package.json version
- Clean build
- Check `app.getVersion()` in main.ts

---

## Checklist: Pre-Release

Before distributing any update, complete this checklist:

- [ ] Version number updated in package.json
- [ ] Database migrations implemented and tested
- [ ] Changelog created (CHANGELOG_vX.X.X.md)
- [ ] Clean build completed successfully
- [ ] Installer file created in `release/`
- [ ] Clean install tested (new machine)
- [ ] Update from previous version tested (with real data)
- [ ] Data integrity verified after update
- [ ] New features tested
- [ ] Bug fixes verified
- [ ] Performance tested (if applicable)
- [ ] Network share updated with new version
- [ ] User communication prepared (email, Slack)
- [ ] Documentation updated (USER_GUIDE.md if needed)
- [ ] IT support team notified
- [ ] Rollback plan prepared

---

## Version History Template

Keep a running log of all releases:

```markdown
# Version History - Tshifhinga Time Tracker

## v1.1.0 - 2026-01-15
- Added session editing
- Added analytics dashboard
- Database: Added session_edits table
- Status: Released

## v1.0.1 - 2026-01-05
- Fixed timer sleep bug
- Fixed session duplication
- Database: No changes
- Status: Released

## v1.0.0 - 2025-12-20
- Initial release
- Core time tracking features
- Database: Initial schema (10 tables)
- Status: Released
```

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Maintainer**: Your Name / IT Department
