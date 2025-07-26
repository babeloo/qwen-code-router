#!/usr/bin/env node

/**
 * Test script for local packaging validation
 * This script tests the packaging process locally before GitHub Actions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function runCommand(command, options = {}) {
  try {
    log(`Running: ${command}`);
    log(`Working directory: ${rootDir}`);
    const result = execSync(command, { 
      stdio: 'inherit', 
      cwd: rootDir,
      ...options 
    });
    return true;
  } catch (error) {
    log(`Command failed: ${command}`, 'error');
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testPackaging() {
  log('🧪 Starting packaging test...');
  
  // Check if we're in the right directory
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found. Are you in the right directory?', 'error');
    process.exit(1);
  }
  
  // Check if dependencies are installed
  const nodeModulesPath = path.join(rootDir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('Installing dependencies...', 'warn');
    if (!runCommand('pnpm install')) {
      log('❌ Failed to install dependencies', 'error');
      process.exit(1);
    }
  }
  
  // Clean previous builds
  log('Cleaning previous builds...');
  runCommand('pnpm run clean');
  
  // Build the project
  log('Building project...');
  if (!runCommand('pnpm run build')) {
    log('❌ Build failed', 'error');
    process.exit(1);
  }
  
  // Test the enhanced packaging script
  log('Testing enhanced packaging script...');
  if (!runCommand('node scripts/package-release.js')) {
    log('❌ Enhanced packaging failed', 'error');
    process.exit(1);
  }
  
  // Verify release directory
  const releaseDir = path.join(rootDir, 'release');
  if (!fs.existsSync(releaseDir)) {
    log('❌ Release directory not created', 'error');
    process.exit(1);
  }
  
  // List release contents
  log('📋 Release directory contents:');
  const releaseContents = fs.readdirSync(releaseDir);
  releaseContents.forEach(item => {
    const itemPath = path.join(releaseDir, item);
    const stats = fs.statSync(itemPath);
    const size = stats.isFile() ? ` (${(stats.size / 1024 / 1024).toFixed(2)} MB)` : '';
    const type = stats.isDirectory() ? '📁' : '📄';
    log(`   ${type} ${item}${size}`);
  });
  
  // Check for expected files
  const expectedFiles = [
    'release-manifest.json',
    'win32-x64',
    'linux-x64', 
    'darwin-x64'
  ];
  
  const missingFiles = expectedFiles.filter(file => 
    !releaseContents.includes(file)
  );
  
  if (missingFiles.length > 0) {
    log(`⚠️ Some expected files/directories are missing: ${missingFiles.join(', ')}`, 'warn');
  } else {
    log('✅ All expected files/directories are present');
  }
  
  // Check manifest
  const manifestPath = path.join(releaseDir, 'release-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    log(`📊 Manifest summary:`);
    log(`   - Version: ${manifest.version}`);
    log(`   - Platforms: ${manifest.platforms.length}`);
    log(`   - Files: ${manifest.files.length}`);
    log(`   - Timestamp: ${manifest.timestamp}`);
  }
  
  log('🎉 Packaging test completed successfully!');
  log(`📦 Release files available in: ${releaseDir}`);
}

// Run the test
testPackaging().catch(error => {
  log(`❌ Test failed: ${error.message}`, 'error');
  process.exit(1);
});