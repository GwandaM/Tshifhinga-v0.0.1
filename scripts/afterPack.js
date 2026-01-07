const fs = require('fs');
const path = require('path');

/**
 * AfterPack hook to clean up unnecessary files from the packaged app
 * This runs after electron-builder packages the app
 */
exports.default = async function(context) {
  const appPath = context.appOutDir;
  const platform = context.electronPlatformName;

  console.log('Running afterPack cleanup...');
  console.log('Platform:', platform);
  console.log('App path:', appPath);

  // Determine the resources path based on platform
  let resourcesPath;
  if (platform === 'darwin') {
    resourcesPath = path.join(appPath, 'Tshifhinga Time Tracker.app', 'Contents', 'Resources');
  } else if (platform === 'win32') {
    resourcesPath = path.join(appPath, 'resources');
  } else if (platform === 'linux') {
    resourcesPath = path.join(appPath, 'resources');
  }

  if (!fs.existsSync(resourcesPath)) {
    console.log('Resources path not found, skipping cleanup');
    return;
  }

  // Patterns to remove (relative to resources/app.asar.unpacked/node_modules/)
  const patternsToRemove = [
    // Documentation files
    '**/CHANGELOG*',
    '**/README*',
    '**/readme*',
    '**/*.md',
    '**/*.markdown',
    '**/LICENSE*',
    '**/license*',

    // Test and example files
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/example/**',
    '**/examples/**',
    '**/demo/**',
    '**/.github/**',

    // Build artifacts
    '**/*.ts',
    '!**/node_modules/typescript/**/*.ts', // Keep TypeScript's own files
    '**/*.coffee',
    '**/*.map',

    // Config files
    '**/.eslintrc*',
    '**/.babelrc*',
    '**/.prettierrc*',
    '**/tsconfig*.json',
    '**/.editorconfig',

    // Source files (keep only compiled)
    '**/src/**/*.ts',
    '**/src/**/*.tsx',

    // Coverage and CI
    '**/.nyc_output/**',
    '**/coverage/**',
    '**/.travis.yml',
    '**/.gitlab-ci.yml',
    '**/appveyor.yml',
  ];

  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');

  if (fs.existsSync(unpackedPath)) {
    console.log('Cleaning up unpacked node_modules...');

    // Remove sqlite3 binaries for other platforms
    const sqlite3BuildPath = path.join(unpackedPath, 'sqlite3', 'build');
    if (fs.existsSync(sqlite3BuildPath)) {
      const releasePath = path.join(sqlite3BuildPath, 'Release');
      if (fs.existsSync(releasePath)) {
        // Keep only the .node file for the current platform
        const files = fs.readdirSync(releasePath);
        files.forEach(file => {
          if (!file.endsWith('.node')) {
            const filePath = path.join(releasePath, file);
            try {
              if (fs.statSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
              console.log('Removed:', filePath);
            } catch (err) {
              console.warn('Failed to remove:', filePath, err.message);
            }
          }
        });
      }

      // Remove other build directories
      const buildDirs = fs.readdirSync(sqlite3BuildPath);
      buildDirs.forEach(dir => {
        if (dir !== 'Release') {
          const dirPath = path.join(sqlite3BuildPath, dir);
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log('Removed build dir:', dirPath);
          } catch (err) {
            console.warn('Failed to remove build dir:', dirPath, err.message);
          }
        }
      });
    }
  }

  console.log('AfterPack cleanup complete!');
};
