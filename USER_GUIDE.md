# User Guide - Tshifhinga Time Tracker

Welcome to the Tshifhinga Time Tracker! This guide will help you install, use, and manage the application on your Windows computer.

## Table of Contents

1. [Installation](#installation)
2. [Getting Started](#getting-started)
3. [Using the Time Tracker](#using-the-time-tracker)
4. [Data Storage and Backup](#data-storage-and-backup)
5. [Uninstalling the Application](#uninstalling-the-application)
6. [Frequently Asked Questions](#frequently-asked-questions)

---

## Installation

### Step 1: Download the Installer

You should receive a file named:
```
Tshifhinga Time Tracker Setup 1.0.0.exe
```

Save this file to your computer (Downloads folder is fine).

### Step 2: Run the Installer

1. **Locate the installer** in your Downloads folder
2. **Double-click** the `.exe` file to start installation

### Step 3: Windows SmartScreen Warning (If Shown)

You may see a blue screen that says **"Windows protected your PC"**

This is normal! The app is safe - this warning appears for new applications.

**To continue**:
1. Click **"More info"**
2. Click **"Run anyway"**

![SmartScreen Example](https://via.placeholder.com/500x300.png?text=Windows+SmartScreen+Warning)

### Step 4: Complete Installation

1. The installer will open
2. Click **"Next"** to proceed through the installation wizard
3. Choose installation location (default is fine: `C:\Program Files\Tshifhinga Time Tracker`)
4. Click **"Install"**
5. Wait for installation to complete (~30 seconds)
6. Click **"Finish"**

### Step 5: Launch the Application

After installation, you can launch the app by:
- **Desktop shortcut** (if created during installation)
- **Start Menu**: Search for "Tshifhinga Time Tracker"
- **Pinned to Taskbar** (right-click the app and select "Pin to taskbar")

---

## Getting Started

### First Launch

When you first open the application:

1. **Login Screen** (if authentication is enabled)
   - Enter your **username** and **password**
   - These should be provided by your system administrator
   - If you don't have credentials, contact IT support

2. **Main Dashboard**
   - You'll see the main time tracking interface
   - The dashboard shows your recent sessions and active timers

### Understanding the Interface

The app has several main sections:

- **Dashboard**: Overview of your time tracking activity
- **Tracker**: Start/stop timers for different tasks
- **Calendar**: View your time entries by day/week/month
- **Admin** (if you have admin access): Manage users, clients, projects

---

## Using the Time Tracker

### The Client → Project → Task Hierarchy

Time tracking in this app follows a three-level structure:

```
Client (e.g., "ACME Corporation")
  └─ Project (e.g., "Website Redesign")
      └─ Task (e.g., "Frontend Development")
```

**Example**:
- **Client**: The company or department you're working for
- **Project**: The specific project within that client
- **Task**: The specific activity within that project

### Starting a Timer

1. Go to the **Tracker** page
2. Select a **Client** from the dropdown
3. Select a **Project** (only projects under the selected client will appear)
4. Select a **Task** (only tasks under the selected project will appear)
5. Click the **"Start Timer"** button

The timer will begin counting and show elapsed time.

### Stopping a Timer

1. Click the **"Stop Timer"** button
2. Your session will be automatically saved
3. You can view it in your session history

### Viewing Your Sessions

**Recent Sessions**:
- The Dashboard shows your most recent time entries
- Click on any session to view details

**Calendar View**:
- Click **Calendar** in the sidebar
- View sessions by day, week, or month
- Filter by client, project, or task

### Editing Sessions

If you need to correct a time entry:

1. Find the session in your history
2. Click the **Edit** icon
3. Modify the start time, end time, or other details
4. Click **Save**

**Note**: Session edits are tracked for audit purposes.

### Manual Time Entry

To add time for work done offline or in the past:

1. Go to the **Tracker** page
2. Click **"Add Manual Entry"**
3. Fill in:
   - Client, Project, Task
   - Start date and time
   - End date and time (or duration)
4. Click **"Save"**

---

## Data Storage and Backup

### Where Is My Data Saved?

All your time tracking data is stored **locally on your computer** in a database file.

**Database Location**:
```
C:\Users\{YourUsername}\AppData\Roaming\Tshifhinga Time Tracker\data\sessions.db
```

To access this folder:
1. Press **Windows Key + R**
2. Type: `%APPDATA%\Tshifhinga Time Tracker\data`
3. Press **Enter**
4. You'll see the `sessions.db` file

### Important Data Facts

- **Your data is private**: Each user has their own separate database
- **No automatic cloud sync**: Data is only on your computer
- **Persists across updates**: Installing a new version keeps your data
- **Not deleted on uninstall**: See [Uninstalling](#uninstalling-the-application) below

### Backing Up Your Data

It's recommended to backup your time tracking data regularly, especially before updating the app.

**To backup**:

1. **Close the application** (important!)
2. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data\`
3. **Copy** the `sessions.db` file
4. **Paste** it to a safe location:
   - External USB drive
   - Network drive
   - Cloud storage (OneDrive, Google Drive, etc.)
   - Different folder on your computer

**Backup naming suggestion**:
```
sessions_backup_2025-01-06.db
```

**How often to backup**:
- **Daily**: If you track time extensively
- **Weekly**: For regular users
- **Before updates**: Always backup before installing a new version

### Restoring Your Data

If you need to restore from a backup:

1. **Close the application** (important!)
2. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data\`
3. **Delete or rename** the current `sessions.db` file
4. **Copy** your backup file to this location
5. **Rename** it to `sessions.db` (exact spelling, lowercase)
6. **Restart** the application

**Your data should now be restored!**

### Transferring Data to a New Computer

To move your time tracking data to a new computer:

1. **On the old computer**:
   - Backup the `sessions.db` file (see above)
   - Save it to a USB drive or cloud storage

2. **On the new computer**:
   - Install Tshifhinga Time Tracker
   - Close the application
   - Replace the database file (see Restoring Your Data above)
   - Restart the application

---

## Updating the Application

### Why Update?

Updates bring:
- **New features**: Improved functionality and capabilities
- **Bug fixes**: Solutions to known issues
- **Performance improvements**: Faster, more reliable operation
- **Security patches**: Protection from vulnerabilities

### Checking Your Current Version

To see which version you have installed:

1. Open the application
2. Go to **Help** → **About** (or check the bottom of the sidebar)
3. Your version number appears (e.g., "Version 1.0.0")

### Where to Find Updates

Updates are available on your company's network share:

```
\\company-server\shared\apps\time-tracker\latest\
```

**Contents**:
- `Tshifhinga Time Tracker Setup X.X.X.exe` - The installer
- `CHANGELOG_latest.md` - What's new in this version
- `USER_GUIDE.md` - Updated user guide

**Note**: Replace `\\company-server\shared\apps\time-tracker\` with your actual company network share path. Check with your IT department if you're unsure.

### Update Notification

You'll be notified of updates via:
- Email from IT department
- Company Slack/Teams announcement
- IT support portal

**Always read the changelog** to understand what's new and what's changed!

### Updating Step-by-Step

Follow these steps carefully to update safely:

#### Step 1: Backup Your Database (IMPORTANT!)

**Always backup before updating!**

1. Press **Windows Key + R**
2. Type: `%APPDATA%\Tshifhinga Time Tracker\data`
3. Press **Enter**
4. You'll see the `sessions.db` file
5. **Copy** this file to a safe location:
   - USB drive
   - Different folder on your computer
   - Cloud storage (OneDrive, Google Drive)
6. **Rename** the backup with the date:
   ```
   sessions_backup_2026-01-15.db
   ```

**Why backup?**
- If anything goes wrong, you can restore your data
- Protects against rare update issues
- Peace of mind!

#### Step 2: Close the Application

**Critical**: Make sure the app is completely closed:

1. Save any active timers or sessions
2. Click the **X** button to close the app
3. Open **Task Manager** (Ctrl + Shift + Esc)
4. Check **Processes** tab
5. If you see "Tshifhinga Time Tracker", right-click and select **End task**

**Why close the app?**
- Windows can't update files that are in use
- Prevents database corruption during update

#### Step 3: Download the Update

1. Open **File Explorer**
2. Navigate to: `\\company-server\shared\apps\time-tracker\latest\`
3. Find the installer file (e.g., `Tshifhinga Time Tracker Setup 1.1.0.exe`)
4. **Copy** it to your **Downloads** folder (or Desktop)

**Optional**: Read the changelog (`CHANGELOG_latest.md`) to see what's new

#### Step 4: Run the Installer

1. Go to your **Downloads** folder
2. **Double-click** the installer file: `Tshifhinga Time Tracker Setup 1.1.0.exe`

3. **If you see "Windows protected your PC" warning**:
   - This is normal for company software
   - Click **"More info"**
   - Click **"Run anyway"**

4. The installer will open:
   - Click **"Next"** through the wizard
   - Accept the default installation location
   - Click **"Install"**
   - Wait for installation to complete (~30 seconds)
   - Click **"Finish"**

**Note**: The installer will **update the app files only**. Your database (in AppData) is **not touched**.

#### Step 5: Launch the Updated App

1. **Start the application** (Desktop shortcut or Start Menu)
2. The app will launch and may show a brief "Updating database..." message
3. **This is normal!** The app is applying any necessary database updates
4. Wait for the app to fully load

**What's happening?**
- The app detects your database is from an older version
- Automatically adds any new columns or tables needed
- **All your existing data is preserved** (sessions, projects, clients, etc.)
- This happens only once per update

#### Step 6: Verify Everything Works

After the update, check that:

- [ ] App launches successfully
- [ ] You can log in (if applicable)
- [ ] All your old sessions are still there
- [ ] All your projects and clients are still there
- [ ] You can start a new timer
- [ ] You can stop a timer
- [ ] New sessions save correctly
- [ ] New features work (check the changelog)

**If everything looks good, you're done!** You can delete the backup after a few days of successful use.

### What If Something Goes Wrong?

#### App Won't Start After Update

**Solution 1**: Restart your computer
1. Restart Windows
2. Try launching the app again

**Solution 2**: Reinstall
1. Uninstall the app (see Uninstalling section below)
2. Download the installer again
3. Reinstall
4. Your data should still be safe in AppData

#### Missing Data After Update

**Cause**: Rare database issue during update

**Solution**: Restore from backup
1. Close the app
2. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data\`
3. Delete the current `sessions.db`
4. Copy your backup file here
5. Rename it to `sessions.db`
6. Restart the app

#### Database Error Messages

**Error**: "Database is corrupted" or "Cannot open database"

**Solution**:
1. Close the app
2. Restore from backup (see above)
3. If problem persists, contact IT support

#### Update Won't Install

**Error**: "Installation failed" or installer crashes

**Causes**:
- Antivirus blocking the installer
- Insufficient permissions
- Corrupted installer download

**Solutions**:
1. Try running installer as Administrator:
   - Right-click the installer
   - Select **"Run as administrator"**
2. Temporarily disable antivirus
3. Re-download the installer (might have been corrupted)
4. Contact IT support

### Frequently Asked Questions

**Q: How often should I update?**
A: Update whenever a new version is announced by IT. Updates are typically released every few weeks to months.

**Q: Will updating delete my data?**
A: No! Your session data is stored separately from the app and is preserved during updates. However, always backup first as a precaution.

**Q: Can I skip versions?**
A: Yes! You can update directly from v1.0.0 to v1.3.0 without installing intermediate versions. The app will apply all necessary database updates automatically.

**Q: How long does an update take?**
A: Typically 2-5 minutes total:
- Backup: 1 minute
- Download installer: 1 minute
- Install: 1 minute
- First launch (database update): 10-30 seconds

**Q: Do I need to update immediately?**
A: Not always, but it's recommended:
- **Critical updates** (security fixes, major bugs): Update ASAP
- **Feature updates**: Update when convenient
- **Hotfixes**: Update when announced as urgent

Check the email announcement for urgency level.

**Q: What if I'm in the middle of tracking time?**
A: Stop your active timer and save the session before updating. You can restart it after the update completes.

**Q: Will the update change the location of my database?**
A: No, the database will stay in the same location: `%APPDATA%\Tshifhinga Time Tracker\data\`

**Q: Can I update while offline?**
A: Yes, if you've already downloaded the installer. The update itself doesn't require internet. However, you need network access to download the installer from the company share.

### Best Practices

1. **Always backup before updating** - Takes 1 minute, saves hours of potential data recovery
2. **Read the changelog** - Know what's changing
3. **Update during downtime** - Don't update in the middle of important work
4. **Test after updating** - Spend 2 minutes verifying everything works
5. **Keep one backup** - Keep your backup for a week after updating successfully
6. **Update regularly** - Don't fall too far behind on versions

### Rollback (Reverting to Previous Version)

In rare cases, you may need to go back to the previous version.

**When to rollback**:
- New version has critical bugs affecting your work
- IT department announces a recall of the update
- You experience data corruption

**How to rollback**:

1. **Backup current state first**:
   - Even if the update is buggy, backup your current data
   - You might need to merge it later

2. **Uninstall current version**:
   - Settings → Apps → Tshifhinga Time Tracker → Uninstall

3. **Restore database backup** (from before the update):
   - Navigate to: `%APPDATA%\Tshifhinga Time Tracker\data\`
   - Delete current `sessions.db`
   - Copy your pre-update backup
   - Rename to `sessions.db`

4. **Install previous version**:
   - Download from: `\\company-server\shared\apps\time-tracker\v1.0.0\`
   - (Replace `v1.0.0` with the version you're rolling back to)
   - Run the installer

5. **Launch and verify**:
   - Start the app
   - Verify your data is restored
   - Contact IT support to report the issue

**Note**: Only rollback if absolutely necessary, and inform IT support so they're aware of issues.

---

## Uninstalling the Application

### Removing the Application

To uninstall:

1. Open **Windows Settings**
2. Go to **Apps** → **Apps & features**
3. Search for **"Tshifhinga Time Tracker"**
4. Click the app
5. Click **"Uninstall"**
6. Confirm the uninstallation

**Note**: This removes the application but **does NOT delete your data**.

### Deleting Your Data

If you want to completely remove all data:

1. **Uninstall the application** (see above)
2. Navigate to: `%APPDATA%\Tshifhinga Time Tracker\`
3. **Delete the entire folder**

**Warning**: This permanently deletes all your time tracking history. Backup first if you might need it later!

---

## Frequently Asked Questions

### Can multiple users use this app on the same computer?

Yes, each Windows user account will have its own separate database. Data is not shared between Windows users on the same machine.

### Can I use this app on multiple computers?

Yes, you can install it on as many computers as needed. However, each installation has its own separate database. Data is not automatically synced between computers.

To keep data in sync, you would need to manually backup and restore the database file.

### Do I need an internet connection?

No, the application works completely offline. All data is stored locally on your computer.

### What happens to my data when I update the app?

Your data is preserved when updating. The database file is stored separately from the application files, so installing a new version does not affect your existing data.

**Best practice**: Backup your data before any update, just in case.

### Can I export my time tracking data?

Yes! The application supports exporting to:
- **CSV format** (open in Excel)
- **JSON format** (for technical users)

To export:
1. Go to your session history
2. Click **"Export"**
3. Choose format (CSV or JSON)
4. Save the file

### I forgot my password. How do I reset it?

Contact your system administrator or IT support. Password resets require admin access.

### The app won't start. What should I do?

See the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) guide for common issues and solutions.

### Can I customize the client/project/task lists?

If you have appropriate permissions:
- **Admins** can create and manage all clients, projects, and tasks
- **Regular users** can only track time on projects they have access to

Contact your admin to request access to specific projects or to add new clients.

### Does this app track what I'm doing on my computer?

No, the app only tracks time when you actively start a timer. It does not monitor your computer activity, keystrokes, or applications.

### Where can I get help?

- **User Guide**: This document
- **Troubleshooting**: See `TROUBLESHOOTING.md`
- **IT Support**: Contact your company's IT department
- **Feature Requests**: Speak with your system administrator

---

## Tips for Effective Time Tracking

### Best Practices

1. **Start timers promptly**: Start the timer when you begin work
2. **Stop timers when done**: Don't leave timers running overnight
3. **Use descriptive tasks**: Clear task names help with reporting
4. **Review daily**: Check your sessions at the end of each day
5. **Backup regularly**: Don't lose your tracking history

### Common Workflows

**Starting Your Day**:
1. Open the app
2. Select your first client/project/task
3. Click "Start Timer"

**Switching Tasks**:
1. Stop the current timer
2. Select the new client/project/task
3. Start the new timer

**End of Day**:
1. Stop any running timers
2. Review the day's sessions
3. Make any necessary corrections

### Keyboard Shortcuts (if supported)

- **Ctrl + S**: Start/Stop timer (may vary by version)
- **Ctrl + E**: Edit selected session
- **Ctrl + R**: Refresh data

---

## Support Information

**Application Version**: 1.0.0
**Platform**: Windows 10/11 (64-bit)

**For assistance**:
- See `TROUBLESHOOTING.md` for common issues
- Contact your IT department for technical support
- Reach out to your system administrator for access/permission issues

---

**Last Updated**: January 2026
**Document Version**: 1.0
