# Troubleshooting Guide - Tshifhinga Time Tracker

This guide provides solutions to common issues users may encounter when installing or using the Tshifhinga Time Tracker.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Application Startup Issues](#application-startup-issues)
3. [Database Issues](#database-issues)
4. [Authentication and Login Issues](#authentication-and-login-issues)
5. [Timer and Session Issues](#timer-and-session-issues)
6. [Performance Issues](#performance-issues)
7. [Update and Migration Issues](#update-and-migration-issues)
8. [Data Recovery](#data-recovery)

---

## Installation Issues

### Issue: "Windows protected your PC" SmartScreen Warning

**Symptoms**:
- Blue screen appears when running the installer
- Message: "Windows protected your PC"
- Cannot install the application

**Cause**:
The application is not digitally signed, which triggers Windows SmartScreen protection.

**Solution**:
1. Click **"More info"** on the warning screen
2. Click **"Run anyway"** button
3. Continue with installation

**Note**: This is safe for company-distributed applications. The warning only appears for unsigned software.

---

### Issue: Installation Fails or Hangs

**Symptoms**:
- Installer freezes during installation
- Installation completes but app doesn't appear
- Error message: "Installation failed"

**Possible Causes**:
- Insufficient permissions
- Antivirus interference
- Corrupted installer file
- Insufficient disk space

**Solutions**:

**1. Run as Administrator**:
1. Right-click the installer `.exe` file
2. Select **"Run as administrator"**
3. Click **"Yes"** on the User Account Control prompt
4. Complete installation

**2. Disable Antivirus Temporarily**:
1. Temporarily disable your antivirus software
2. Run the installer
3. Re-enable antivirus after installation

**3. Check Disk Space**:
1. Ensure you have at least **500 MB free space**
2. Open **This PC** and check C: drive space
3. Delete unnecessary files if needed

**4. Re-download Installer**:
1. Delete the current installer file
2. Download a fresh copy
3. Verify file size (should be ~150-250 MB)
4. Try installation again

---

### Issue: Missing Prerequisites

**Symptoms**:
- Error: "VCRUNTIME140.dll was not found"
- Error: "The code execution cannot proceed because MSVCP140.dll was not found"

**Cause**:
Missing Microsoft Visual C++ Redistributables.

**Solution**:
1. Download **Microsoft Visual C++ Redistributable** from:
   - https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Run the installer
3. Restart your computer
4. Reinstall Tshifhinga Time Tracker

---

## Application Startup Issues

### Issue: Application Won't Start

**Symptoms**:
- Double-clicking the app does nothing
- App appears in Task Manager but no window opens
- Error message: "Application failed to start"

**Solutions**:

**1. Check if Already Running**:
1. Press **Ctrl + Shift + Esc** to open Task Manager
2. Look for "Tshifhinga Time Tracker" under **Processes**
3. If found, right-click and select **"End task"**
4. Try starting the app again

**2. Delete Application Cache**:
1. Close the application completely
2. Press **Windows Key + R**
3. Type: `%APPDATA%\Tshifhinga Time Tracker`
4. Delete all files **EXCEPT** the `data` folder (keep your database!)
5. Restart the application

**3. Check Permissions**:
1. Navigate to: `C:\Program Files\Tshifhinga Time Tracker`
2. Right-click the folder → **Properties**
3. **Security** tab → Ensure your user account has **Read & Execute** permissions
4. If not, click **Edit** and add permissions

**4. Reinstall the Application**:
1. Backup your database first! (`%APPDATA%\Tshifhinga Time Tracker\data\sessions.db`)
2. Uninstall the application
3. Delete any remaining files in `%APPDATA%\Tshifhinga Time Tracker` (except `data` folder)
4. Reinstall from the installer
5. Restore your database if needed

---

### Issue: Application Crashes on Startup

**Symptoms**:
- App starts but immediately closes
- Error message: "A JavaScript error occurred in the main process"
- White screen then crash

**Causes**:
- Corrupted database
- Corrupted configuration files
- Incompatible Windows version

**Solutions**:

**1. Reset Configuration**:
1. Close the app
2. Navigate to: `%APPDATA%\Tshifhinga Time Tracker`
3. Delete all files except the `data` folder
4. Restart the app

**2. Check Database Integrity**:
See [Database Corruption](#issue-database-corruption) below

**3. Check Windows Version**:
- Requires: **Windows 10 (64-bit)** or **Windows 11**
- Check: **Settings** → **System** → **About**
- If using 32-bit Windows, the app won't work

---

## Database Issues

### Issue: Database Corruption

**Symptoms**:
- Error: "Database disk image is malformed"
- Error: "Unable to open database file"
- Sessions not loading
- App crashes when accessing data

**Cause**:
SQLite database file corruption (often from improper shutdown or disk errors).

**Solutions**:

**1. Restore from Backup**:
If you have a recent backup:
1. Close the app
2. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
3. Rename `sessions.db` to `sessions.db.corrupted`
4. Copy your backup file here
5. Rename it to `sessions.db`
6. Restart the app

**2. Attempt Database Recovery** (Advanced):
1. Download **DB Browser for SQLite**: https://sqlitebrowser.org/
2. Open the corrupted database: `%APPDATA%\Tshifhinga Time Tracker\data\sessions.db`
3. Go to **File** → **Export** → **Database to SQL file**
4. Save the SQL file
5. Create a new database
6. Go to **File** → **Import** → **Database from SQL file**
7. Select your exported SQL file
8. Save the new database as `sessions_recovered.db`
9. Close the app
10. Replace `sessions.db` with `sessions_recovered.db`
11. Restart the app

**3. Start Fresh** (Last Resort):
1. Backup the corrupted database (for potential future recovery)
2. Delete `sessions.db`
3. Restart the app (a new empty database will be created)

**Prevention**:
- Always close the app properly (don't force quit)
- Backup regularly (see User Guide)
- Use "Safely Remove Hardware" for external drives

---

### Issue: "Database is Locked"

**Symptoms**:
- Error: "Database is locked"
- Cannot save new sessions
- App freezes when trying to access data

**Cause**:
- Multiple instances of the app running
- Previous app instance didn't close properly
- File system lock not released

**Solutions**:

**1. Close All Instances**:
1. Open **Task Manager** (Ctrl + Shift + Esc)
2. Find all instances of "Tshifhinga Time Tracker"
3. Right-click each → **End task**
4. Wait 10 seconds
5. Restart the app

**2. Check for Database Lock Files**:
1. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
2. Look for files named:
   - `sessions.db-shm`
   - `sessions.db-wal`
3. Close the app completely
4. Delete these lock files (safe to delete when app is closed)
5. Restart the app

**3. Restart Computer**:
If the above doesn't work:
1. Close all applications
2. Restart your computer
3. Try the app again

---

### Issue: Permission Denied / Cannot Write to Database

**Symptoms**:
- Error: "Unable to write to database"
- Error: "Permission denied"
- Sessions not saving

**Cause**:
Insufficient file permissions on the database or data folder.

**Solutions**:

**1. Check File Permissions**:
1. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
2. Right-click `sessions.db` → **Properties**
3. **General** tab → Ensure **Read-only** is unchecked
4. **Security** tab → Ensure your user account has **Modify** permissions

**2. Take Ownership**:
1. Right-click the `data` folder → **Properties**
2. **Security** tab → **Advanced**
3. Click **Change** next to Owner
4. Enter your Windows username
5. Check **Replace owner on subcontainers and objects**
6. Click **OK**

**3. Run as Administrator** (Temporary):
1. Right-click Tshifhinga Time Tracker shortcut
2. Select **"Run as administrator"**
3. If this fixes it, there's a permission issue
4. Apply solutions above permanently

---

## Authentication and Login Issues

### Issue: Forgot Password

**Symptoms**:
- Cannot log in to the application
- "Invalid username or password" error

**Solution**:
Contact your **system administrator** or **IT support** to reset your password. Password resets require admin access to the database.

---

### Issue: "Invalid username or password"

**Symptoms**:
- Correct credentials don't work
- Login fails repeatedly

**Possible Causes**:
- Incorrect username/password
- Caps Lock enabled
- User account disabled
- Database issue

**Solutions**:

**1. Check Basic Issues**:
- Verify **Caps Lock** is off
- Check for extra spaces in username/password
- Ensure you're using the correct username (case-sensitive)

**2. Try Different Browser Behavior**:
- Copy-paste password from a known-good source
- Type password manually (don't paste)

**3. Contact Administrator**:
- Verify your account exists
- Check if account is active
- Request password reset if needed

---

## Timer and Session Issues

### Issue: Timer Doesn't Start

**Symptoms**:
- Clicking "Start Timer" does nothing
- Timer immediately stops after starting
- No timer appears

**Solutions**:

**1. Verify Selections**:
- Ensure you've selected a **Client**
- Ensure you've selected a **Project**
- Ensure you've selected a **Task**
- All three are required

**2. Check Permissions**:
- Verify you have permission to track time on the selected project
- Contact admin if you need access

**3. Restart the App**:
- Close and reopen the application
- Try starting the timer again

---

### Issue: Sessions Not Appearing in History

**Symptoms**:
- Started and stopped timer, but session not showing
- Session history is empty
- Data seems to disappear

**Solutions**:

**1. Refresh the View**:
- Click on a different page (Dashboard, Calendar)
- Return to the Sessions view
- Press **F5** to refresh the page

**2. Check Filters**:
- Look for active filters (date range, client, project)
- Clear all filters to see all sessions
- Expand the date range

**3. Verify Database**:
- Check that sessions are actually saved
- Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
- Check `sessions.db` file size (should increase when sessions are added)
- If file size is 0 bytes or very small, there's a database issue

---

### Issue: Cannot Edit or Delete Sessions

**Symptoms**:
- Edit button is grayed out or missing
- Delete option not available
- Changes don't save

**Causes**:
- Insufficient permissions (only admins or session owners can edit)
- Session is locked
- Database permission issue

**Solutions**:

**1. Check Permissions**:
- You can only edit your own sessions
- Admins can edit all sessions
- Directors have specific permissions
- Contact admin if you need to edit someone else's session

**2. Verify You're the Owner**:
- Check that the session belongs to your user account
- If logged in as wrong user, log out and log back in

---

## Performance Issues

### Issue: App Running Slowly

**Symptoms**:
- App takes a long time to open
- Laggy or unresponsive interface
- High CPU usage

**Solutions**:

**1. Close Unnecessary Programs**:
- Close other applications to free up RAM
- Especially close other Electron apps (they use lots of memory)

**2. Clear Old Data** (if applicable):
- If you have years of session data, consider archiving old sessions
- Export old data to CSV
- Remove very old sessions from the database (consult admin)

**3. Check System Resources**:
- Open **Task Manager**
- Check CPU and memory usage
- Ensure you have at least **2 GB RAM free**

**4. Restart Computer**:
- Close all applications
- Restart Windows
- Start the app fresh

---

### Issue: High Memory Usage

**Symptoms**:
- Task Manager shows high memory usage (500+ MB)
- Computer becomes slow when app is running

**Causes**:
- Normal for Electron apps (Chrome-based)
- Large dataset
- Memory leak (rare)

**Solutions**:

**1. Restart the App Periodically**:
- Close and reopen the app once per day
- This clears memory caches

**2. Export and Archive Old Data**:
- Reduces database size
- Improves performance

**3. Upgrade RAM** (if possible):
- Electron apps work best with **8 GB+ RAM**
- Consider hardware upgrade for better performance

---

## Update and Migration Issues

### Issue: Update Fails to Install

**Symptoms**:
- Error during update installation
- Update installer won't run
- Stuck on old version

**Solutions**:

**1. Manual Update**:
1. **Backup your database first!**
   - Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
   - Copy `sessions.db` to a safe location
2. Uninstall the current version
3. Download the new installer
4. Install the new version
5. Your data should automatically carry over

**2. Verify Data After Update**:
1. Open the updated app
2. Check that your sessions are still there
3. If data is missing, restore from backup

---

### Issue: Data Lost After Update

**Symptoms**:
- Updated to new version, now sessions are gone
- Database appears empty

**Solutions**:

**1. Check Database Location**:
The database should still be at:
```
%APPDATA%\Tshifhinga Time Tracker\data\sessions.db
```

Verify the file exists and has a reasonable size (not 0 bytes).

**2. Restore from Backup**:
If you backed up before updating:
1. Close the app
2. Navigate to the data folder
3. Replace `sessions.db` with your backup
4. Restart the app

**3. Check for Old Version Data**:
Sometimes old versions store data in different locations. Check:
- `%APPDATA%\tshifhinga-time-tracker\` (alternate naming)
- `%LOCALAPPDATA%\Tshifhinga Time Tracker\`

---

## Data Recovery

### Issue: Accidentally Deleted Sessions

**Symptoms**:
- Deleted sessions by mistake
- Need to recover deleted data

**Solutions**:

**1. Restore from Backup**:
If you have a recent backup, restore it (see User Guide).

**2. Database Recovery** (Advanced):
SQLite doesn't have a built-in "undo" for deletions. Options:
- Check if your backup software has file versioning (Windows File History)
- Use professional data recovery software (TestDisk, Recuva)
- Contact IT support for help

**Prevention**:
- Implement regular automatic backups
- Consider backup before bulk deletions
- Be careful with delete operations

---

### Issue: Database File Deleted

**Symptoms**:
- `sessions.db` file is missing
- App creates new empty database

**Solutions**:

**1. Check Recycle Bin**:
1. Open **Recycle Bin**
2. Search for `sessions.db`
3. Right-click → **Restore**
4. Restart the app

**2. Restore from Backup**:
Use your most recent backup (see User Guide).

**3. Windows File History**:
If enabled:
1. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data`
2. Right-click the folder → **Restore previous versions**
3. Select a restore point from before deletion
4. Click **Restore**

---

## Getting Additional Help

### When to Contact IT Support

Contact your IT department if:
- None of the solutions above work
- You need admin access or permissions
- Password reset is required
- Application needs reinstallation
- Data recovery is needed
- Hardware issues (RAM, disk space)

### Information to Provide

When contacting support, include:
1. **Application version** (found in app About section)
2. **Windows version** (Settings → System → About)
3. **Error messages** (take a screenshot)
4. **Steps to reproduce** the issue
5. **When the issue started** (after update, after crash, etc.)

### Escalation Path

1. **First**: Try solutions in this guide
2. **Second**: Check User Guide for basic usage questions
3. **Third**: Contact your team lead or supervisor
4. **Fourth**: Contact IT support with detailed information

---

## Preventive Maintenance

### Best Practices to Avoid Issues

1. **Regular Backups**:
   - Backup database weekly (or daily if heavily used)
   - Store backups in multiple locations

2. **Proper Shutdown**:
   - Always close the app using File → Exit or the X button
   - Don't force quit or kill the process

3. **Keep Windows Updated**:
   - Install Windows updates regularly
   - Restart after updates

4. **Antivirus Exclusions**:
   - Add app to antivirus exclusions to prevent interference
   - Exclude: `C:\Program Files\Tshifhinga Time Tracker`
   - Exclude: `%APPDATA%\Tshifhinga Time Tracker`

5. **Monitor Disk Space**:
   - Keep at least **10% free space** on C: drive
   - Clean up old files regularly

6. **Update Regularly**:
   - Install new versions when available
   - Backup before updating

---

## Quick Troubleshooting Checklist

Before contacting support, try these steps:

- [ ] Restart the application
- [ ] Check if app is already running (Task Manager)
- [ ] Verify database file exists and isn't 0 bytes
- [ ] Check file permissions (not read-only)
- [ ] Close and restart the app
- [ ] Restart your computer
- [ ] Check antivirus isn't blocking the app
- [ ] Verify you have admin rights if needed
- [ ] Check for Windows updates
- [ ] Verify sufficient disk space (500+ MB free)
- [ ] Try running as administrator (temporarily)
- [ ] Check if backup exists
- [ ] Review User Guide for proper usage

---

## Common Error Messages

| Error Message | Likely Cause | Solution |
|--------------|-------------|----------|
| "Database is locked" | Multiple app instances | Close all instances, restart |
| "Permission denied" | File permissions | Check file/folder permissions |
| "Database disk image is malformed" | Corrupted database | Restore from backup |
| "Unable to open database file" | Missing/corrupted file | Restore from backup or reinstall |
| "VCRUNTIME140.dll not found" | Missing VC++ Redist | Install Visual C++ Redistributable |
| "Invalid username or password" | Wrong credentials | Verify credentials, contact admin |
| "Application failed to start" | Missing prerequisites | Install VC++ Redist, reinstall app |

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Application Version**: 1.0.0

For the latest version of this guide and additional support resources, contact your system administrator.
