#!/usr/bin/env node

/**
 * Enhanced packaging script for GitHub platform releases
 * Supports parallel execution for multiple platforms without blocking
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const SUPPORTED_PLATFORMS = [
    { platform: 'win32', arch: 'x64', target: 'node18-win-x64', ext: '.exe' },
    { platform: 'linux', arch: 'x64', target: 'node18-linux-x64', ext: '' },
    { platform: 'darwin', arch: 'x64', target: 'node18-macos-x64', ext: '' }
];

class ReleasePackager {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        
        // Get version from package.json
        const packageJsonPath = path.join(this.rootDir, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        this.version = process.env.VERSION || process.env.npm_package_version || packageJson.version;
        this.releaseDir = path.join(this.rootDir, 'release');
        this.distDir = path.join(this.rootDir, 'dist');
        this.binDir = path.join(this.rootDir, 'bin');
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async ensureDirectories() {
        this.log('Creating release directories...');

        // Clean and create release directory
        if (fs.existsSync(this.releaseDir)) {
            fs.rmSync(this.releaseDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.releaseDir, { recursive: true });

        // Ensure bin directory exists
        if (!fs.existsSync(this.binDir)) {
            fs.mkdirSync(this.binDir, { recursive: true });
            this.log('Created bin directory');
        }

        // Ensure dist directory exists
        if (!fs.existsSync(this.distDir)) {
            this.log('Building project first...', 'warn');
            execSync('pnpm run build', { stdio: 'inherit', cwd: this.rootDir });
        }
    }

    async buildExecutables() {
        this.log('Building executables for all platforms...');

        const buildPromises = SUPPORTED_PLATFORMS.map(async ({ platform, target, ext }) => {
            try {
                const outputName = `qcr-${platform}${ext}`;
                const outputPath = path.resolve(this.binDir, outputName);
                const cliPath = path.resolve(this.distDir, 'cli.js');

                this.log(`Building executable for ${platform}...`);
                this.log(`  CLI path: ${cliPath}`);
                this.log(`  Output path: ${outputPath}`);
                this.log(`  Working directory: ${this.rootDir}`);

                // Verify CLI file exists
                if (!fs.existsSync(cliPath)) {
                    this.log(`❌ CLI file not found: ${cliPath}`, 'error');
                    return;
                }

                await new Promise((resolve) => {
                    const child = spawn('pnpm', ['exec', 'pkg', cliPath, '--targets', target, '--output', outputPath], {
                        cwd: this.rootDir,
                        stdio: 'pipe'
                    });

                    let stdout = '';
                    let stderr = '';

                    child.stdout.on('data', (data) => {
                        stdout += data.toString();
                    });

                    child.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });

                    child.on('close', (code) => {
                        if (code === 0) {
                            this.log(`✅ Successfully built executable for ${platform}`);
                            // Verify the output file was created
                            if (fs.existsSync(outputPath)) {
                                this.log(`✅ Executable file created: ${outputPath}`);
                            } else {
                                this.log(`⚠️ Executable file not found after build: ${outputPath}`, 'warn');
                            }
                            resolve();
                        } else {
                            this.log(`❌ Failed to build executable for ${platform}: ${stderr}`, 'error');
                            if (stdout) this.log(`stdout: ${stdout}`, 'error');
                            // Don't reject - continue with other platforms
                            resolve();
                        }
                    });

                    child.on('error', (error) => {
                        this.log(`❌ Error building executable for ${platform}: ${error.message}`, 'error');
                        resolve(); // Continue with other platforms
                    });
                });

            } catch (error) {
                this.log(`❌ Error building executable for ${platform}: ${error.message}`, 'error');
                // Continue with other platforms
            }
        });

        // Wait for all builds to complete (parallel execution)
        await Promise.all(buildPromises);
        this.log('Executable building phase completed');
    }

    getFilesToCopy() {
        return [
            'dist',
            'bin',
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
    }

    async createPlatformPackages() {
        this.log('Creating platform-specific packages...');

        const packagePromises = SUPPORTED_PLATFORMS.map(async ({ platform, arch, ext }) => {
            try {
                const platformDir = path.join(this.releaseDir, `${platform}-${arch}`);
                fs.mkdirSync(platformDir, { recursive: true });

                this.log(`Creating package for ${platform}-${arch}...`);

                // Copy common files
                const filesToCopy = this.getFilesToCopy();
                for (const file of filesToCopy) {
                    const srcPath = path.join(this.rootDir, file);
                    const destPath = path.join(platformDir, file);

                    if (fs.existsSync(srcPath)) {
                        if (fs.statSync(srcPath).isDirectory()) {
                            fs.cpSync(srcPath, destPath, { recursive: true });
                        } else {
                            fs.copyFileSync(srcPath, destPath);
                        }
                    }
                }

                // Copy platform-specific executable from bin directory
                const executableName = `qcr-${platform}${ext}`;
                const executablePath = path.join(this.binDir, executableName);
                if (fs.existsSync(executablePath)) {
                    const destExecutablePath = path.join(platformDir, platform === 'win32' ? 'qcr.exe' : 'qcr');
                    fs.copyFileSync(executablePath, destExecutablePath);

                    // Make executable on Unix platforms
                    if (platform !== 'win32') {
                        fs.chmodSync(destExecutablePath, '755');
                    }

                    this.log(`✅ Copied executable for ${platform}-${arch}`);
                } else {
                    this.log(`⚠️ Executable not found for ${platform}-${arch}: ${executablePath}`, 'warn');
                }

                // Copy platform-specific installation scripts
                if (platform === 'win32') {
                    const installScript = path.join(this.rootDir, 'scripts', 'install.bat');
                    if (fs.existsSync(installScript)) {
                        fs.copyFileSync(installScript, path.join(platformDir, 'install.bat'));
                    }
                } else {
                    const installScript = path.join(this.rootDir, 'scripts', 'install.sh');
                    if (fs.existsSync(installScript)) {
                        const destScript = path.join(platformDir, 'install.sh');
                        fs.copyFileSync(installScript, destScript);
                        fs.chmodSync(destScript, '755');
                    }
                }

                // Create platform-specific package.json
                const packageJsonPath = path.join(platformDir, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    packageJson.name = `qwen-code-router-${platform}-${arch}`;
                    packageJson.version = this.version;
                    packageJson.os = [platform];
                    packageJson.cpu = [arch];
                    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                }

                // Create platform-specific README
                const platformReadme = this.createPlatformReadme(platform, arch);
                fs.writeFileSync(path.join(platformDir, 'PLATFORM_README.md'), platformReadme);

                this.log(`✅ Successfully created package for ${platform}-${arch}`);

            } catch (error) {
                this.log(`❌ Error creating package for ${platform}-${arch}: ${error.message}`, 'error');
                // Continue with other platforms
            }
        });

        // Wait for all platform packages to complete (parallel execution)
        await Promise.all(packagePromises);
        this.log('Platform package creation completed');
    }

    createPlatformReadme(platform, arch) {
        const platformName = platform === 'win32' ? 'Windows' :
            platform === 'linux' ? 'Linux' :
                platform === 'darwin' ? 'macOS' : platform;

        return `# Qwen Code Router ${this.version} - ${platformName} (${arch})

This is a platform-specific release of Qwen Code Router for ${platformName} on ${arch} architecture.

## Installation

### Automatic Installation
Run the installation script:
${platform === 'win32' ? '- Windows: Run `install.bat` as Administrator' : '- Unix/Linux: Run `./install.sh`'}

### Manual Installation
1. Extract this archive to your desired location
2. Add the executable to your PATH, or:
   - Copy the executable to a directory in your PATH
   - ${platform === 'win32' ? 'Use `qcr.exe` directly' : 'Use `qcr` directly'}

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
- Platform: ${platformName}
- Architecture: ${arch}
- Node.js Version Required: >= 16.0.0 (bundled in executable)
- Version: ${this.version}

## Files Included
- \`qcr${platform === 'win32' ? '.exe' : ''}\` - Main executable
- \`config.example.yaml\` - Example YAML configuration
- \`config.example.json\` - Example JSON configuration
- \`INSTALL.md\` - Detailed installation instructions
- \`README.md\` - General documentation
- \`LICENSE\` - License information
- \`bin/\` - Platform-specific scripts (if needed)
- \`dist/\` - Source distribution (for development)

## Troubleshooting
If you encounter issues:
1. Ensure the executable has proper permissions
2. Check that your configuration file is valid
3. Verify your API keys are correct
4. See \`INSTALL.md\` for detailed troubleshooting

## Support
For issues and questions, please visit the project repository.
`;
    }

    async createArchives() {
        this.log('Creating release archives...');

        const archivePromises = SUPPORTED_PLATFORMS.map(async ({ platform, arch }) => {
            try {
                const platformDir = path.join(this.releaseDir, `${platform}-${arch}`);
                if (!fs.existsSync(platformDir)) {
                    this.log(`⚠️ Platform directory not found: ${platformDir}`, 'warn');
                    return;
                }

                const archiveName = `qwen-code-router-${this.version}-${platform}-${arch}`;

                if (platform === 'win32') {
                    // Create ZIP for Windows
                    try {
                        const zipPath = path.join(this.releaseDir, `${archiveName}.zip`);
                        const command = `powershell -Command "Compress-Archive -Path '${platformDir}\\*' -DestinationPath '${zipPath}' -Force"`;
                        execSync(command, { stdio: 'pipe' });
                        this.log(`✅ Created ${archiveName}.zip`);
                    } catch (error) {
                        this.log(`❌ Failed to create ZIP for ${platform}-${arch}: ${error.message}`, 'error');
                    }
                } else {
                    // Create tar.gz for Unix
                    try {
                        const tarPath = path.join(this.releaseDir, `${archiveName}.tar.gz`);
                        execSync(`tar -czf "${tarPath}" -C "${platformDir}" .`, { stdio: 'pipe' });
                        this.log(`✅ Created ${archiveName}.tar.gz`);
                    } catch (error) {
                        this.log(`❌ Failed to create tar.gz for ${platform}-${arch}: ${error.message}`, 'error');
                    }
                }

                // Also create executable-only archives
                const executableName = platform === 'win32' ? 'qcr.exe' : 'qcr';
                const executablePath = path.join(platformDir, executableName);

                if (fs.existsSync(executablePath)) {
                    const execArchiveName = `qwen-code-router-${this.version}-${platform}-${arch}-executable`;

                    if (platform === 'win32') {
                        try {
                            const zipPath = path.join(this.releaseDir, `${execArchiveName}.zip`);
                            const command = `powershell -Command "Compress-Archive -Path '${executablePath}' -DestinationPath '${zipPath}' -Force"`;
                            execSync(command, { stdio: 'pipe' });
                            this.log(`✅ Created ${execArchiveName}.zip (executable only)`);
                        } catch (error) {
                            this.log(`❌ Failed to create executable ZIP for ${platform}-${arch}: ${error.message}`, 'error');
                        }
                    } else {
                        try {
                            const tarPath = path.join(this.releaseDir, `${execArchiveName}.tar.gz`);
                            execSync(`tar -czf "${tarPath}" -C "${platformDir}" "${executableName}"`, { stdio: 'pipe' });
                            this.log(`✅ Created ${execArchiveName}.tar.gz (executable only)`);
                        } catch (error) {
                            this.log(`❌ Failed to create executable tar.gz for ${platform}-${arch}: ${error.message}`, 'error');
                        }
                    }
                }

            } catch (error) {
                this.log(`❌ Error creating archives for ${platform}-${arch}: ${error.message}`, 'error');
                // Continue with other platforms
            }
        });

        // Wait for all archives to complete (parallel execution)
        await Promise.all(archivePromises);
        this.log('Archive creation completed');
    }

    async generateReleaseManifest() {
        this.log('Generating release manifest...');

        const manifest = {
            version: this.version,
            timestamp: new Date().toISOString(),
            platforms: [],
            files: []
        };

        // Scan release directory for files
        const releaseFiles = fs.readdirSync(this.releaseDir);

        for (const file of releaseFiles) {
            const filePath = path.join(this.releaseDir, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                manifest.files.push({
                    name: file,
                    size: stats.size,
                    created: stats.birthtime.toISOString()
                });
            } else if (stats.isDirectory()) {
                // Check if it's a platform directory
                const platformMatch = file.match(/^(win32|linux|darwin)-(.+)$/);
                if (platformMatch) {
                    const [, platform, arch] = platformMatch;
                    const executableName = platform === 'win32' ? 'qcr.exe' : 'qcr';
                    const executablePath = path.join(filePath, executableName);

                    manifest.platforms.push({
                        platform,
                        arch,
                        directory: file,
                        hasExecutable: fs.existsSync(executablePath)
                    });
                }
            }
        }

        fs.writeFileSync(
            path.join(this.releaseDir, 'release-manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        this.log(`✅ Generated release manifest with ${manifest.platforms.length} platforms and ${manifest.files.length} files`);
    }

    async run() {
        try {
            this.log(`Starting release packaging for version ${this.version}`);

            await this.ensureDirectories();
            await this.buildExecutables();
            await this.createPlatformPackages();
            await this.createArchives();
            await this.generateReleaseManifest();

            this.log(`🎉 Release packaging completed successfully!`);
            this.log(`📦 Release files available in: ${this.releaseDir}`);

            // List all created files
            const releaseFiles = fs.readdirSync(this.releaseDir);
            this.log('📋 Created files:');
            releaseFiles.forEach(file => {
                const filePath = path.join(this.releaseDir, file);
                const stats = fs.statSync(filePath);
                const size = stats.isFile() ? ` (${(stats.size / 1024 / 1024).toFixed(2)} MB)` : '';
                this.log(`   - ${file}${size}`);
            });

        } catch (error) {
            this.log(`❌ Release packaging failed: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Run the packager if called directly
if (require.main === module) {
    const packager = new ReleasePackager();
    packager.run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ReleasePackager;