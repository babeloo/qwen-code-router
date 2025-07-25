# Qwen Code Router

A command-line tool to manage and switch API configurations for different large model service providers when using Qwen Code.

## Features

- ✅ **Cross-platform support** - Works on Windows, Linux, and macOS
- ✅ **Multiple provider support** - OpenAI, Azure OpenAI, Anthropic, Google AI
- ✅ **Easy configuration management** - YAML/JSON configuration files
- ✅ **Quick provider/model switching** - Switch between configurations instantly
- ✅ **Configuration validation** - Validate your configurations before use
- ✅ **Built-in provider listings** - Discover available models for each provider
- ✅ **Environment variable management** - Automatic environment setup for Qwen Code

## Quick Start

### Installation

#### Option 1: Download Pre-built Release (Recommended)
1. Go to the [Releases](https://github.com/babeloo/qwen-code-router/releases) page
2. Download the appropriate package for your platform:
   - Windows: `qwen-code-router-*-win32-x64.zip`
   - Linux: `qwen-code-router-*-linux-x64.tar.gz`
   - macOS: `qwen-code-router-*-darwin-x64.tar.gz`
3. Extract the archive
4. Run the installation script:
   - Windows: `install.bat`
   - Unix/Linux/macOS: `./install.sh`

#### Option 2: NPM Global Installation
```bash
npm install -g qwen-code-router
```

#### Option 3: Build from Source
```bash
git clone https://github.com/babeloo/qwen-code-router.git
cd qwen-code-router
npm install
npm run build
npm link  # Optional: for global usage
```

### Configuration

1. Create a configuration file by copying one of the example files:
```bash
# For YAML format (recommended)
cp config.example.yaml config.yaml

# Or for JSON format
cp config.example.json config.json
```

2. Edit your configuration file (`config.yaml` or `config.json`) with your API keys:
```yaml
# Example config.yaml structure
default_config:
  - name: openai-gpt4

configs:
  - config:
      - name: openai-gpt4
        provider: openai
        model: gpt-4
      - name: claude-sonnet
        provider: anthropic
        model: claude-3-sonnet-20240229

providers:
  - provider: openai
    env:
      api_key: "your-openai-api-key-here"
      base_url: "https://api.openai.com/v1"
      models:
        - model: gpt-4
        - model: gpt-3.5-turbo
  - provider: anthropic
    env:
      api_key: "your-anthropic-api-key-here"
      base_url: "https://api.anthropic.com/v1"
      models:
        - model: claude-3-opus-20240229
        - model: claude-3-sonnet-20240229
```

**Important**: Replace `"your-*-api-key-here"` with your actual API keys from the respective providers.

### Usage

#### Basic Workflow
```bash
# 1. List all available configurations
qcr list config

# 2. Activate a specific configuration
qcr use openai-gpt4

# 3. Launch Qwen Code with the active configuration
qcr run
```

#### Configuration Management
```bash
# Validate a configuration before using it
qcr chk openai-gpt4

# Set a default configuration (used when no specific config is activated)
qcr set-default openai-gpt4

# List all available providers and their models
qcr list provider

# List built-in providers (OpenAI, Azure, Anthropic, Google)
qcr list provider --builtin
```

#### Within Qwen Code Environment
Once Qwen Code is running, you can use the router command for quick switching:
```
/router openai gpt-4
/router anthropic claude-3-sonnet-20240229
```

**Note**: The `/router` command only works within the Qwen Code environment, not in your regular terminal.

## Supported Providers

- **OpenAI** - GPT-4, GPT-3.5 Turbo, and other OpenAI models
- **Azure OpenAI** - Azure-hosted OpenAI models
- **Anthropic** - Claude 3 Opus, Sonnet, Haiku
- **Google AI** - Gemini Pro, Gemini 1.5 Pro/Flash

## Configuration File Locations

Qwen Code Router searches for configuration files in the following order:

1. `./config.yaml` or `./config.json` (current directory)
2. `~/.qcr/config.yaml` or `~/.qcr/config.json` (user directory)
3. `/etc/qcr/config.yaml` or `/etc/qcr/config.json` (system directory, Unix only)

## Commands

### Core Commands
- `qcr use [config_name]` - Activate a configuration
- `qcr run [args...]` - Launch Qwen Code with active configuration
- `qcr list config` - List all available configurations
- `qcr chk [config_name]` - Validate configuration(s)

### Provider Management
- `qcr list provider` - List providers from configuration file
- `qcr list provider --builtin` - List built-in known providers
- `qcr list provider --all` - List all providers (config + built-in)
- `qcr list provider [provider_name]` - List models for specific provider

### Configuration Management
- `qcr set-default <name>` - Set default configuration

### Qwen Code Integration
- `/router <provider> <model>` - Quick configuration via provider/model (use within Qwen Code environment)

## Cross-Platform Support

Qwen Code Router is designed to work seamlessly across different platforms:

### Windows
- Uses Windows-specific paths (`%APPDATA%\qcr`)
- Supports batch scripts (`.bat`) and PowerShell (`.ps1`)
- Automatic command extension handling (`.cmd`, `.exe`)

### Linux/Unix
- Uses XDG Base Directory specification (`~/.config/qcr`)
- Supports system-wide configuration (`/etc/qcr`)
- Shell script support

### macOS
- Native macOS path support
- Homebrew-friendly installation
- Shell script support

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Build release package
npm run release
```

### Project Structure
```
qwen-code-router/
├── src/                 # TypeScript source code
├── tests/              # Test files
├── bin/                # Executable scripts
├── dist/               # Compiled JavaScript (generated)
├── config.example.*    # Example configuration files
└── INSTALL.md         # Detailed installation instructions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Installation Guide](INSTALL.md) | [安装指南](INSTALL.zh-CN.md)
- 🔧 [Cross-Platform Summary](CROSS_PLATFORM_SUMMARY.md) | [跨平台总结](CROSS_PLATFORM_SUMMARY.zh-CN.md)
- 🐛 [Issue Tracker](https://github.com/babeloo/qwen-code-router/issues)
- 💬 [Discussions](https://github.com/babeloo/qwen-code-router/discussions)

## 中文文档 | Chinese Documentation

- [中文说明](README.zh-CN.md) - 完整的中文使用说明
- [安装指南](INSTALL.zh-CN.md) - 详细的中文安装说明
- [跨平台总结](CROSS_PLATFORM_SUMMARY.zh-CN.md) - 跨平台功能实现总结

## Related Projects

- [Qwen Code](https://github.com/QwenLM/qwen-code) - The AI coding assistant this tool is designed for