# Build Guide - Tshifhinga Time Tracker

This guide explains how to build the Windows installer for distribution to company employees.

## Prerequisites

Before building, ensure you have the following installed:

### Required Software

1. **Node.js** (v18.x or later recommended)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Git** (optional, for version control)
   - Download from: https://git-scm.com/
   - Verify installation: `git --version`

### System Requirements

- **Operating System**: Windows, macOS, or Linux (can build Windows installers from any platform)
- **Disk Space**: ~2 GB free space for dependencies and build output
- **RAM**: 4 GB minimum, 8 GB recommended

## Initial Setup

### 1. Get the Source Code

If using Git:
```bash
git clone <repository-url>
cd session-sync-chronos-main
```

Or extract the source code from a ZIP archive to a folder.

### 2. Install Dependencies

Open a terminal/command prompt in the project directory and run:

```bash
npm install
```

This will:
- Download all required packages (~500 MB)
- Take 2-5 minutes depending on your internet speed
- Create a `node_modules` folder with all dependencies

**Note**: If you see warnings about optional dependencies or peer dependencies, these are usually safe to ignore.

## Building the Windows Installer

### Quick Build Command

To build the complete Windows installer in one command:

```bash
npm run electron:build
```

This command does three things automatically:
1. Builds the React/Vite application (`npm run build`)
2. Compiles TypeScript Electron files (`npm run build:electron`)
3. Packages everything into a Windows installer (`npm run electron:pack`)

### Build Process Details

The build process takes 2-5 minutes and goes through these stages:

1. **Vite Build** (30-60 seconds)
   - Compiles React components
   - Bundles JavaScript/CSS
   - Optimizes assets
   - Output: `dist/` folder

2. **Electron Build** (10-20 seconds)
   - Compiles TypeScript to JavaScript
   - Processes main process, preload script, database service, auth service
   - Output: `dist-electron/` folder

3. **Packaging** (60-180 seconds)
   - Creates NSIS installer for Windows
   - Bundles Electron runtime
   - Packages application files
   - Output: `release/` folder

### Expected Output

After a successful build, you'll find the installer in the `release` folder:

**File Location**: `release/Tshifhinga Time Tracker Setup 1.0.0.exe`

**File Details**:
- Format: NSIS Windows Installer (.exe)
- Size: ~150-250 MB (approximate)
- Architecture: x64 (64-bit Windows only)

## Version Management

### Updating the Version Number

Before building a new release, update the version in `package.json`:

```json
{
  "version": "1.0.0"  // Change this to your new version (e.g., "1.0.1", "1.1.0")
}
```

The version number will automatically appear in:
- The installer filename
- The installed application
- Windows "Add or Remove Programs"

### Version Numbering Convention

Follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR** (1.x.x): Breaking changes, major new features
- **MINOR** (x.1.x): New features, backwards compatible
- **PATCH** (x.x.1): Bug fixes, minor improvements

Example:
- `1.0.0` - Initial release
- `1.0.1` - Bug fix
- `1.1.0` - New feature added
- `2.0.0` - Major overhaul

## Development vs Production Builds

### Production Build (for distribution)
```bash
npm run electron:build
```
- Optimized and minified
- No developer tools
- Smaller file size
- Use this for releasing to users

### Development Build
```bash
npm run build:dev
```
- Includes source maps
- Easier debugging
- Larger file size
- Use only for testing

## Testing the Build

### Before Distribution

1. **Install the built package locally**:
   - Navigate to `release/` folder
   - Double-click `Tshifhinga Time Tracker Setup 1.0.0.exe`
   - Complete the installation

2. **Test core functionality**:
   - App launches successfully
   - Login works (if applicable)
   - Can create/start/stop timers
   - Sessions are saved correctly
   - Database is created at: `%APPDATA%\Tshifhinga Time Tracker\data\sessions.db`

3. **Test on a clean Windows machine** (recommended):
   - Install on a computer that doesn't have Node.js or developer tools
   - Verify it works for end users who only have the installer

### Automated Testing

Currently, no automated tests are configured. Consider adding:
- Unit tests with Vitest
- Integration tests
- E2E tests with Playwright or Cypress

## Distribution Process

### 1. Build the Installer

```bash
npm run electron:build
```

### 2. Locate the Output

```bash
cd release
dir  # Windows
ls   # macOS/Linux
```

You should see: `Tshifhinga Time Tracker Setup 1.0.0.exe`

### 3. Distribute to Users

**Recommended Methods**:
- **Network Share**: Place on company file server
- **Email**: Send to individual users (if file size permits)
- **USB Drive**: Copy to physical media
- **Intranet**: Host on company intranet for download

**File to Distribute**: Only the `.exe` installer file (users don't need the source code)

### 4. Provide User Documentation

Share the `USER_GUIDE.md` file with your colleagues to help them:
- Install the application
- Use the time tracker
- Backup their data
- Troubleshoot issues

## Troubleshooting Build Errors

### Error: "npm: command not found"

**Cause**: Node.js/npm not installed or not in PATH

**Solution**:
1. Install Node.js from https://nodejs.org/
2. Restart your terminal
3. Verify: `npm --version`

### Error: "Cannot find module 'electron'"

**Cause**: Dependencies not installed

**Solution**:
```bash
npm install
```

### Error: "Permission denied" (macOS/Linux)

**Cause**: Insufficient permissions

**Solution**:
```bash
sudo chown -R $(whoami) node_modules
```

### Error: Building gets stuck during packaging

**Cause**: Antivirus interfering with electron-builder

**Solution**:
1. Temporarily disable antivirus
2. Add `release/` folder to antivirus exclusions
3. Retry build

### Error: "Out of memory" during build

**Cause**: Insufficient RAM or Node.js heap limit

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS=--max_old_space_size=4096  # macOS/Linux
set NODE_OPTIONS=--max_old_space_size=4096     # Windows CMD
```

### Error: SQLite3 compilation errors

**Cause**: Native module compilation issues

**Solution**:
```bash
# Rebuild native modules
npm install --build-from-source sqlite3
```

Or install Visual Studio Build Tools (Windows):
- Download from: https://visualstudio.microsoft.com/downloads/
- Install "Desktop development with C++" workload

## Build Performance Tips

### Faster Builds

1. **Use SSD**: Build on SSD instead of HDD
2. **Disable antivirus scanning**: Exclude `node_modules/`, `dist/`, `dist-electron/`, `release/`
3. **Clear cache if needed**:
   ```bash
   npm run build -- --force
   ```

### Clean Build

If you encounter persistent issues, try a clean build:

```bash
# Delete build artifacts
rm -rf dist dist-electron release  # macOS/Linux
rmdir /s /q dist dist-electron release  # Windows

# Delete dependencies
rm -rf node_modules  # macOS/Linux
rmdir /s /q node_modules  # Windows

# Reinstall and rebuild
npm install
npm run electron:build
```

## Continuous Integration (Optional)

For automated builds, consider setting up:

- **GitHub Actions**: Automated builds on every commit
- **Jenkins**: Self-hosted CI/CD pipeline
- **GitLab CI**: Build and deploy automatically

Example GitHub Actions workflow would:
1. Install Node.js
2. Install dependencies (`npm install`)
3. Run tests (`npm test`)
4. Build installer (`npm run electron:build`)
5. Upload installer as artifact

## Build Configuration Files

Key files that control the build process:

- **`package.json`**: Build scripts, dependencies, electron-builder config
- **`vite.config.ts`**: Vite build configuration for React app
- **`tsconfig.json`**: TypeScript compiler settings for renderer
- **`tsconfig.electron.json`**: TypeScript settings for Electron main process

## Platform-Specific Notes

### Building Windows Installers on macOS/Linux

electron-builder can create Windows installers from macOS or Linux, but you may need:

**macOS**:
```bash
brew install wine  # Optional, for better Windows app icon support
```

**Linux**:
```bash
sudo apt-get install wine  # Ubuntu/Debian
```

Note: Wine is optional and only needed for advanced features like custom icons.

## Security Considerations

### Code Signing (Optional but Recommended)

For professional deployment, consider code signing the installer:

1. **Obtain a code signing certificate**:
   - Purchase from DigiCert, Sectigo, or similar Certificate Authority
   - Cost: ~$100-500/year

2. **Configure electron-builder** in `package.json`:
   ```json
   "win": {
     "certificateFile": "path/to/certificate.pfx",
     "certificatePassword": "password"
   }
   ```

3. **Benefits**:
   - Removes Windows SmartScreen warnings
   - Shows your company name during installation
   - Builds user trust

### Without Code Signing

If not code-signed, users will see:
- "Windows protected your PC" SmartScreen warning
- They can click "More info" → "Run anyway"
- This is normal for unsigned apps
- See `USER_GUIDE.md` for end-user instructions

## Support and Resources

- **Electron Documentation**: https://www.electronjs.org/docs
- **electron-builder**: https://www.electron.build/
- **Vite Documentation**: https://vitejs.dev/
- **Troubleshooting**: See `TROUBLESHOOTING.md` for common issues

## Quick Reference

```bash
# Install dependencies
npm install

# Build Windows installer
npm run electron:build

# Find the installer
cd release

# Clean rebuild (if issues occur)
rm -rf dist dist-electron release node_modules
npm install
npm run electron:build

# Development mode (for testing)
npm run electron:dev
```

---

**Current Version**: 1.0.0
**Build System**: Vite + TypeScript + electron-builder
**Target Platform**: Windows x64
**Output Format**: NSIS Installer (.exe)
