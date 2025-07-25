# Qwen Code Router Release Notes Template

## Version X.X.X - YYYY-MM-DD

### 🎉 新功能 / New Features
- ✅ 跨平台支持 - Windows、Linux、macOS 全平台兼容
- ✅ 多提供商支持 - OpenAI、Azure OpenAI、Anthropic、Google AI
- ✅ 配置管理系统 - YAML/JSON 配置文件支持
- ✅ 快速切换功能 - 一键切换不同的 API 配置
- ✅ 配置验证 - 使用前自动验证配置有效性
- ✅ 内置提供商列表 - 发现可用模型和提供商
- ✅ 环境变量管理 - 自动为 Qwen Code 设置环境

### 🔧 改进 / Improvements
- 🚀 跨平台进程生成 - 智能检测和使用平台特定的 shell
- 🔍 命令可用性检查 - 自动检测系统中可用的命令
- 📁 智能路径处理 - 平台特定的配置文件路径管理
- ⚡ 性能优化 - 快速配置加载和切换
- 🛡️ 错误处理 - 友好的错误消息和建议

### 🐛 修复 / Bug Fixes
- 修复 Windows 平台下的命令扩展名处理
- 修复跨平台路径分隔符问题
- 修复环境变量继承问题
- 修复配置文件发现逻辑

### 📚 文档 / Documentation
- 📖 完整的中英文文档 (README.md / README_zh.md)
- 📋 详细安装指南 (INSTALL.md / INSTALL_zh.md)
- 🔧 跨平台实现总结 (CROSS_PLATFORM_SUMMARY.md / CROSS_PLATFORM_SUMMARY_zh.md)
- 📝 发布说明模板和指南

### 🔄 变更 / Changes
- 重构平台检测逻辑，提高兼容性
- 优化配置文件搜索顺序
- 改进命令行界面和帮助信息
- 统一错误消息格式

### ⚠️ 破坏性变更 / Breaking Changes
- 无破坏性变更 / No breaking changes

### 📦 依赖更新 / Dependencies
- Node.js >= 16.0.0 (推荐 18.0.0+)
- commander ^11.1.0 - CLI 框架
- yaml ^2.8.0 - YAML 配置文件支持
- TypeScript ^5.8.3 - 开发依赖

### 🌍 国际化 / Internationalization
- ✅ 中文文档完整支持
- ✅ 中英文错误消息
- ✅ 本地化的帮助信息
- ✅ 平台特定的路径和约定

### 🧪 测试 / Testing
- ✅ 550+ 单元测试和集成测试
- ✅ Windows 平台专项测试
- ✅ 跨平台兼容性测试
- ✅ CLI 功能端到端测试
- ✅ 配置文件加载和验证测试

### 📋 已知问题 / Known Issues
- PowerShell 执行策略可能需要调整（Windows）
- 某些 Unix 系统可能需要手动设置脚本权限
- 首次运行需要配置 API 密钥

---

## 安装说明 / Installation Instructions

### 🪟 Windows
1. 下载 `qwen-code-router-X.X.X-win32-x64.zip`
2. 解压到您选择的目录
3. 运行 `install.bat` 进行自动安装
4. 或手动将 `bin` 目录添加到 PATH 环境变量

**可用脚本 / Available Scripts:**
- `bin/qcr.bat` - 批处理脚本
- `bin/qcr.ps1` - PowerShell 脚本

### 🐧 Linux
1. 下载 `qwen-code-router-X.X.X-linux-x64.tar.gz`
2. 解压：`tar -xzf qwen-code-router-X.X.X-linux-x64.tar.gz`
3. 运行 `./install.sh` 进行自动安装
4. 或手动复制 `bin/qcr` 到 `/usr/local/bin/`

### 🍎 macOS
1. 下载 `qwen-code-router-X.X.X-darwin-x64.tar.gz`
2. 解压：`tar -xzf qwen-code-router-X.X.X-darwin-x64.tar.gz`
3. 运行 `./install.sh` 进行自动安装
4. 或使用 Homebrew 风格的手动安装

## 快速开始 / Quick Start

### 1. 配置设置 / Configuration Setup
```bash
# 复制示例配置 / Copy example configuration
cp config.example.yaml config.yaml

# 编辑配置文件，添加您的 API 密钥
# Edit config file and add your API keys
# 将 "your-*-api-key-here" 替换为实际的 API 密钥
```

### 2. 基本使用 / Basic Usage
```bash
# 列出所有可用配置 / List all configurations
qcr list config

# 激活特定配置 / Activate a configuration
qcr use openai-gpt4

# 验证配置 / Validate configuration
qcr chk openai-gpt4

# 启动 Qwen Code / Launch Qwen Code
qcr run
```

### 3. 高级功能 / Advanced Features
```bash
# 列出提供商和模型 / List providers and models
qcr list provider
qcr list provider --builtin
qcr list provider --all

# 设置默认配置 / Set default configuration
qcr set-default openai-gpt4

# 在 Qwen Code 中快速切换 / Quick switch in Qwen Code
# /router openai gpt-4
# /router anthropic claude-3-sonnet-20240229
```

## 支持的提供商 / Supported Providers
- 🤖 **OpenAI** - GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- ☁️ **Azure OpenAI** - Azure 托管的 OpenAI 模型
- 🧠 **Anthropic** - Claude 3 Opus, Sonnet, Haiku
- 🔍 **Google AI** - Gemini Pro, Gemini 1.5 Pro/Flash

## 支持的平台 / Supported Platforms
- 🪟 **Windows** 10/11 (x64) - 批处理和 PowerShell 脚本
- 🐧 **Linux** (x64) - Shell 脚本，支持主流发行版
- 🍎 **macOS** (x64) - Shell 脚本，Homebrew 兼容

## 系统要求 / System Requirements
- **Node.js** >= 16.0.0 (推荐 18.0.0+)
- **磁盘空间** 至少 50MB 可用空间
- **内存** 至少 512MB RAM
- **网络** 访问 AI 提供商 API 的网络连接

## 配置文件位置 / Configuration File Locations
1. `./config.yaml` 或 `./config.json` (当前目录)
2. `~/.qcr/config.yaml` 或 `~/.qcr/config.json` (用户目录)
3. `/etc/qcr/config.yaml` 或 `/etc/qcr/config.json` (系统目录，仅 Unix)

## 获取帮助 / Getting Help
- 📖 [安装指南 / Installation Guide](INSTALL.md) | [中文版](INSTALL_zh.md)
- 📖 [用户手册 / User Manual](README.md) | [中文版](README_zh.md)
- 🔧 [跨平台总结 / Cross-Platform Summary](CROSS_PLATFORM_SUMMARY.md) | [中文版](CROSS_PLATFORM_SUMMARY_zh.md)
- 🐛 [问题报告 / Issue Tracker](https://github.com/your-username/qwen-code-router/issues)
- 💬 [讨论区 / Discussions](https://github.com/your-username/qwen-code-router/discussions)

## 升级说明 / Upgrade Instructions
从旧版本升级时：
1. 备份现有配置文件
2. 下载新版本发布包
3. 运行安装脚本或手动替换文件
4. 验证配置兼容性：`qcr chk`
5. 测试基本功能：`qcr list config`

## 故障排除 / Troubleshooting
- **命令未找到**：检查 PATH 环境变量设置
- **配置文件未找到**：使用示例配置文件创建
- **API 密钥错误**：验证配置文件中的密钥设置
- **权限问题**：确保脚本具有执行权限 (Unix)

---

**感谢使用 Qwen Code Router！/ Thank you for using Qwen Code Router!**

如有问题或建议，请通过 GitHub Issues 联系我们。
For questions or suggestions, please contact us through GitHub Issues.