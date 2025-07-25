# Qwen Code Router v0.1.0 Release Notes

## Version 0.1.0 - 2025-01-25

### 🎉 New Features
- ✅ **Cross-platform support** - Full compatibility across Windows, Linux, and macOS
- ✅ **Multi-provider support** - OpenAI, Azure OpenAI, Anthropic, Google AI
- ✅ **Configuration management system** - YAML/JSON configuration file support
- ✅ **Quick switching functionality** - One-click switching between different API configurations
- ✅ **Configuration validation** - Automatic validation of configurations before use
- ✅ **Built-in provider listings** - Discover available models and providers
- ✅ **Environment variable management** - Automatic environment setup for Qwen Code

### 🔧 Improvements
- 🚀 **Cross-platform process spawning** - Intelligent detection and use of platform-specific shells
- 🔍 **Command availability checking** - Automatic detection of available commands in the system
- 📁 **Smart path handling** - Platform-specific configuration file path management
- ⚡ **Performance optimization** - Fast configuration loading and switching
- 🛡️ **Error handling** - Friendly error messages and suggestions

### 🐛 Bug Fixes
- Fixed Windows platform command extension handling
- Fixed cross-platform path separator issues
- Fixed environment variable inheritance issues
- Fixed configuration file discovery logic

### 📚 Documentation
- 📖 Complete bilingual documentation (README.md / README_zh.md)
- 📋 Detailed installation guide (INSTALL.md / INSTALL_zh.md)
- 🔧 Cross-platform implementation summary (CROSS_PLATFORM_SUMMARY.md / CROSS_PLATFORM_SUMMARY_zh.md)
- 📝 Release notes template and guide

### 🔄 Changes
- Refactored platform detection logic for improved compatibility
- Optimized configuration file search order
- Improved command-line interface and help information
- Unified error message formatting

### ⚠️ Breaking Changes
- No breaking changes

### 📦 Dependencies
- Node.js >= 16.0.0 (recommended 18.0.0+)
- commander ^11.1.0 - CLI framework
- yaml ^2.8.0 - YAML configuration file support
- TypeScript ^5.8.3 - Development dependency

### 🌍 Internationalization
- ✅ Complete Chinese documentation support
- ✅ Bilingual error messages
- ✅ Localized help information
- ✅ Platform-specific paths and conventions

### 🧪 Testing
- ✅ 550+ unit and integration tests
- ✅ Windows platform-specific testing
- ✅ Cross-platform compatibility testing
- ✅ CLI functionality end-to-end testing
- ✅ Configuration file loading and validation testing

### 📋 Known Issues
- PowerShell execution policy may need adjustment (Windows)
- Some Unix systems may require manual script permission setting
- First run requires API key configuration

---

## Installation Instructions

### 🪟 Windows
1. Download `qwen-code-router-0.1.0-win32-x64.zip`
2. Extract to your chosen directory
3. Run `install.bat` for automatic installation
4. Or manually add the `bin` directory to your PATH environment variable

**Available Scripts:**
- `bin/qcr.bat` - Batch script
- `bin/qcr.ps1` - PowerShell script

### 🐧 Linux
1. Download `qwen-code-router-0.1.0-linux-x64.tar.gz`
2. Extract: `tar -xzf qwen-code-router-0.1.0-linux-x64.tar.gz`
3. Run `./install.sh` for automatic installation
4. Or manually copy `bin/qcr` to `/usr/local/bin/`

### 🍎 macOS
1. Download `qwen-code-router-0.1.0-darwin-x64.tar.gz`
2. Extract: `tar -xzf qwen-code-router-0.1.0-darwin-x64.tar.gz`
3. Run `./install.sh` for automatic installation
4. Or use Homebrew-style manual installation

## Quick Start

### 1. Configuration Setup
```bash
# Copy example configuration
cp config.example.yaml config.yaml

# Edit config file and add your API keys
# Replace "your-*-api-key-here" with actual API keys
```

### 2. Basic Usage
```bash
# List all available configurations
qcr list config

# Activate a configuration
qcr use openai-gpt4

# Validate configuration
qcr chk openai-gpt4

# Launch Qwen Code
qcr run
```

### 3. Advanced Features
```bash
# List providers and models
qcr list provider
qcr list provider --builtin
qcr list provider --all

# Set default configuration
qcr set-default openai-gpt4

# Quick switch in Qwen Code environment
# /router openai gpt-4
# /router anthropic claude-3-sonnet-20240229
```

## Supported Providers
- 🤖 **OpenAI** - GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- ☁️ **Azure OpenAI** - Azure-hosted OpenAI models
- 🧠 **Anthropic** - Claude 3 Opus, Sonnet, Haiku
- 🔍 **Google AI** - Gemini Pro, Gemini 1.5 Pro/Flash

## Supported Platforms
- 🪟 **Windows** 10/11 (x64) - Batch and PowerShell scripts
- 🐧 **Linux** (x64) - Shell scripts, supports major distributions
- 🍎 **macOS** (x64) - Shell scripts, Homebrew compatible

## System Requirements
- **Node.js** >= 16.0.0 (recommended 18.0.0+)
- **Disk Space** At least 50MB available space
- **Memory** At least 512MB RAM
- **Network** Internet connection to access AI provider APIs

## Configuration File Locations
1. `./config.yaml` or `./config.json` (current directory)
2. `~/.qcr/config.yaml` or `~/.qcr/config.json` (user directory)
3. `/etc/qcr/config.yaml` or `/etc/qcr/config.json` (system directory, Unix only)

## Getting Help
- 📖 [Installation Guide](INSTALL.md) | [中文版](INSTALL_zh.md)
- 📖 [User Manual](README.md) | [中文版](README_zh.md)
- 🔧 [Cross-Platform Summary](CROSS_PLATFORM_SUMMARY.md) | [中文版](CROSS_PLATFORM_SUMMARY_zh.md)
- 🐛 [Issue Tracker](https://github.com/babeloo/qwen-code-router/issues)
- 💬 [Discussions](https://github.com/babeloo/qwen-code-router/discussions)

## Upgrade Instructions
When upgrading from older versions:
1. Backup existing configuration files
2. Download new version release package
3. Run installation script or manually replace files
4. Verify configuration compatibility: `qcr chk`
5. Test basic functionality: `qcr list config`

## Troubleshooting
- **Command not found**: Check PATH environment variable settings
- **Configuration file not found**: Create using example configuration files
- **API key error**: Verify key settings in configuration file
- **Permission issues**: Ensure scripts have execute permissions (Unix)

---

**Thank you for using Qwen Code Router!**

For questions or suggestions, please contact us through GitHub Issues.