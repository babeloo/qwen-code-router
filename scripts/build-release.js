#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Get version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const platform = os.platform();
const arch = os.arch();
const version = process.env.VERSION || packageJson.version;

console.log(`Building release for ${platform}-${arch} version ${version}`);

// Create release directory
const releaseDir = path.join(__dirname, '..', 'release');
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true });
}
fs.mkdirSync(releaseDir, { recursive: true });

// Build the project
console.log('Building project...');
execSync('npm run build', { stdio: 'inherit' });

// Copy files
console.log('Copying files...');
const filesToCopy = [
  'dist',
  'package.json',
  'README.md',
  'README.zh-CN.md',
  'config.example.yaml',
  'config.example.json',
  'INSTALL.md',
  'INSTALL.zh-CN.md',
  'CROSS_PLATFORM_SUMMARY.md',
  'CROSS_PLATFORM_SUMMARY.zh-CN.md',
  'RELEASE_NOTES.md',
  'RELEASE_NOTES.zh-CN.md',
  'LICENSE'
];

filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, '..', file);
  const destPath = path.join(releaseDir, file);

  if (fs.existsSync(srcPath)) {
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`Copied ${file}`);
  } else {
    console.log(`Skipped ${file} (not found)`);
  }
});

// Copy platform-specific scripts
const binDir = path.join(releaseDir, 'bin');
fs.mkdirSync(binDir, { recursive: true });

if (platform === 'win32') {
  // Windows scripts
  const windowsScripts = ['qcr.bat', 'qcr.ps1'];
  windowsScripts.forEach(script => {
    const srcPath = path.join(__dirname, '..', 'bin', script);
    const destPath = path.join(binDir, script);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${script}`);
    }
  });

  // Copy install script
  const installScript = path.join(__dirname, '..', 'install.bat');
  if (fs.existsSync(installScript)) {
    fs.copyFileSync(installScript, path.join(releaseDir, 'install.bat'));
    console.log('Copied install.bat');
  }
} else {
  // Unix scripts
  const unixScript = path.join(__dirname, '..', 'bin', 'qcr');
  if (fs.existsSync(unixScript)) {
    const destPath = path.join(binDir, 'qcr');
    fs.copyFileSync(unixScript, destPath);
    fs.chmodSync(destPath, '755');
    console.log('Copied qcr (Unix script)');
  }

  // Copy install script
  const installScript = path.join(__dirname, '..', 'install.sh');
  if (fs.existsSync(installScript)) {
    const destPath = path.join(releaseDir, 'install.sh');
    fs.copyFileSync(installScript, destPath);
    fs.chmodSync(destPath, '755');
    console.log('Copied install.sh');
  }
}

// Create platform-specific package.json
const releasePackageJson = JSON.parse(fs.readFileSync(path.join(releaseDir, 'package.json'), 'utf8'));
releasePackageJson.name = `qwen-code-router-${platform}-${arch}`;
releasePackageJson.version = version;
releasePackageJson.os = [platform];
releasePackageJson.cpu = [arch];

fs.writeFileSync(
  path.join(releaseDir, 'package.json'),
  JSON.stringify(releasePackageJson, null, 2)
);

console.log('Updated package.json for platform');

// Create README for the release
const releaseReadme = `# Qwen Code Router ${version} - ${platform}-${arch}

This is a platform-specific release of Qwen Code Router for ${platform} on ${arch} architecture.

## Installation

### Automatic Installation
Run the installation script:
${platform === 'win32' ? '- Windows: Run `install.bat`' : '- Unix/Linux: Run `./install.sh`'}

### Manual Installation
1. Extract this archive to your desired location
2. Add the \`bin\` directory to your PATH, or:
   - Copy the appropriate script to a directory in your PATH
   - ${platform === 'win32' ? 'Use `bin/qcr.bat` or `bin/qcr.ps1`' : 'Use `bin/qcr`'}

## Configuration
1. Copy \`config.example.yaml\` to \`config.yaml\`
2. Edit \`config.yaml\` with your API keys and settings
3. Run \`qcr list config\` to verify your configuration

## Usage
\`\`\`bash
# List available configurations
qcr list config

# Use a specific configuration
qcr use openai-gpt4

# Run Qwen Code with the active configuration
qcr run

# Quick setup with provider and model
/router openai gpt-4
\`\`\`

For detailed documentation, see \`INSTALL.md\`.

## Platform Information
- Platform: ${platform}
- Architecture: ${arch}
- Node.js Version Required: >= 16.0.0
- Version: ${version}
`;

fs.writeFileSync(path.join(releaseDir, 'README.md'), releaseReadme);

console.log(`Release built successfully in ${releaseDir}`);
console.log(`Platform: ${platform}-${arch}`);
console.log(`Version: ${version}`);

// Create archive
const archiveName = `qwen-code-router-${version}-${platform}-${arch}`;
if (platform === 'win32') {
  // Create ZIP for Windows
  try {
    execSync(`powershell Compress-Archive -Path "${releaseDir}/*" -DestinationPath "${archiveName}.zip"`, { stdio: 'inherit' });
    console.log(`Created ${archiveName}.zip`);
  } catch (error) {
    console.log('Failed to create ZIP archive. You can manually create it from the release directory.');
  }
} else {
  // Create tar.gz for Unix
  try {
    execSync(`tar -czf "${archiveName}.tar.gz" -C "${releaseDir}" .`, { stdio: 'inherit' });
    console.log(`Created ${archiveName}.tar.gz`);
  } catch (error) {
    console.log('Failed to create tar.gz archive. You can manually create it from the release directory.');
  }
}

console.log('\nRelease build completed!');