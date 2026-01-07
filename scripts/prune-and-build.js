const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Script to prune devDependencies, build with electron-builder, and restore dependencies
 * This ensures the smallest possible bundle size by only packaging production dependencies
 */

console.log('\n🔧 Starting optimized build process...\n');

// Get the electron-builder path before pruning
const builderPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-builder');
const hasBuilder = fs.existsSync(builderPath);

if (!hasBuilder) {
  console.error('❌ electron-builder not found. Please run: npm install');
  process.exit(1);
}

try {
  // Step 1: Prune devDependencies
  console.log('📦 Pruning devDependencies...');
  execSync('npm prune --production', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ DevDependencies pruned\n');

  // Step 2: Run electron-builder using npx (works even after prune if cached)
  console.log('🚀 Building Electron app with production dependencies only...');
  try {
    // Try using the local electron-builder via npx (uses npm cache)
    execSync('npx electron-builder', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (error) {
    console.error('❌ Electron-builder failed. Trying alternative method...');
    // Fallback: reinstall electron-builder temporarily
    execSync('npm install --no-save electron-builder', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    execSync('npx electron-builder', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  }
  console.log('✅ Electron app built successfully\n');

  // Step 3: Reinstall all dependencies
  console.log('🔄 Reinstalling all dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Dependencies restored\n');

  console.log('🎉 Optimized build complete!\n');
  console.log('Check the release/ directory for your packaged app.');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);

  // Try to restore dependencies even on failure
  console.log('\n🔄 Attempting to restore dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ Dependencies restored');
  } catch (restoreError) {
    console.error('❌ Failed to restore dependencies:', restoreError.message);
  }

  process.exit(1);
}
