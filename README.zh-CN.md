# Qwen Code Router

一个命令行工具，用于管理和切换在使用 Qwen Code 时不同大型模型服务提供商的 API 配置。

## 功能特性

- ✅ **跨平台支持** - 支持 Windows、Linux 和 macOS
- ✅ **多提供商支持** - OpenAI、Azure OpenAI、Anthropic、Google AI
- ✅ **简易配置管理** - YAML/JSON 配置文件
- ✅ **快速提供商/模型切换** - 即时切换配置
- ✅ **配置验证** - 使用前验证配置
- ✅ **内置提供商列表** - 发现每个提供商的可用模型
- ✅ **环境变量管理** - 为 Qwen Code 自动设置环境

## 快速开始

### 安装

#### 方式一：下载预构建发布包（推荐）
1. 访问 [Releases](https://github.com/babeloo/qwen-code-router/releases) 页面
2. 下载适合您平台的包：
   - Windows: `qwen-code-router-*-win32-x64.zip`
   - Linux: `qwen-code-router-*-linux-x64.tar.gz`
   - macOS: `qwen-code-router-*-darwin-x64.tar.gz`
3. 解压缩文件
4. 运行安装脚本：
   - Windows: `install.bat`
   - Unix/Linux/macOS: `./install.sh`

#### 方式二：NPM 全局安装
```bash
npm install -g qwen-code-router
```

#### 方式三：从源码构建
```bash
git clone https://github.com/babeloo/qwen-code-router.git
cd qwen-code-router
npm install
npm run build
npm link  # 可选：用于全局使用
```

### 配置

1. 通过复制示例文件创建配置文件：
```bash
# YAML 格式（推荐）
cp config.example.yaml config.yaml

# 或者 JSON 格式
cp config.example.json config.json
```

2. 编辑您的配置文件（`config.yaml` 或 `config.json`），填入您的 API 密钥：
```yaml
# config.yaml 示例结构
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

**重要提示**：请将 `"your-*-api-key-here"` 替换为您从相应提供商获得的实际 API 密钥。

### 使用方法

#### 基本工作流程
```bash
# 1. 列出所有可用配置
qcr list config

# 2. 激活特定配置
qcr use openai-gpt4

# 3. 使用激活的配置启动 Qwen Code
qcr run
```

#### 配置管理
```bash
# 使用前验证配置
qcr chk openai-gpt4

# 设置默认配置（未激活特定配置时使用）
qcr set-default openai-gpt4

# 列出所有可用提供商及其模型
qcr list provider

# 列出内置提供商（OpenAI、Azure、Anthropic、Google）
qcr list provider --builtin
```

#### 在 Qwen Code 环境中
Qwen Code 运行后，您可以使用路由命令进行快速切换：
```
/router openai gpt-4
/router anthropic claude-3-sonnet-20240229
```

**注意**：`/router` 命令只能在 Qwen Code 环境中使用，不能在常规终端中使用。

## 支持的提供商

- **OpenAI** - GPT-4、GPT-3.5 Turbo 和其他 OpenAI 模型
- **Azure OpenAI** - Azure 托管的 OpenAI 模型
- **Anthropic** - Claude 3 Opus、Sonnet、Haiku
- **Google AI** - Gemini Pro、Gemini 1.5 Pro/Flash

## 配置文件位置

Qwen Code Router 按以下顺序搜索配置文件：

1. `./config.yaml` 或 `./config.json`（当前目录）
2. `~/.qcr/config.yaml` 或 `~/.qcr/config.json`（用户目录）
3. `/etc/qcr/config.yaml` 或 `/etc/qcr/config.json`（系统目录，仅 Unix）

## 命令

### 核心命令
- `qcr use [config_name]` - 激活配置
- `qcr run [args...]` - 使用激活的配置启动 Qwen Code
- `qcr list config` - 列出所有可用配置
- `qcr chk [config_name]` - 验证配置

### 提供商管理
- `qcr list provider` - 列出配置文件中的提供商
- `qcr list provider --builtin` - 列出内置已知提供商
- `qcr list provider --all` - 列出所有提供商（配置 + 内置）
- `qcr list provider [provider_name]` - 列出特定提供商的模型

### 配置管理
- `qcr set-default <name>` - 设置默认配置

### Qwen Code 集成
- `/router <provider> <model>` - 通过提供商/模型快速配置（在 Qwen Code 环境中使用）

## 跨平台支持

Qwen Code Router 设计为在不同平台上无缝工作：

### Windows
- 使用 Windows 特定路径（`%APPDATA%\qcr`）
- 支持批处理脚本（`.bat`）和 PowerShell（`.ps1`）
- 自动命令扩展名处理（`.cmd`、`.exe`）

### Linux/Unix
- 使用 XDG Base Directory 规范（`~/.config/qcr`）
- 支持系统级配置（`/etc/qcr`）
- Shell 脚本支持

### macOS
- 原生 macOS 路径支持
- Homebrew 友好安装
- Shell 脚本支持

## 开发

### 从源码构建
```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test

# 构建发布包
npm run release
```

### 项目结构
```
qwen-code-router/
├── src/                 # TypeScript 源代码
├── tests/              # 测试文件
├── bin/                # 可执行脚本
├── dist/               # 编译后的 JavaScript（生成）
├── config.example.*    # 示例配置文件
└── INSTALL.md         # 详细安装说明
```

## 贡献

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 支持

- 📖 [安装指南](INSTALL_zh.md)
- 🔧 [跨平台总结](CROSS_PLATFORM_SUMMARY_zh.md)
- 🐛 [问题跟踪](https://github.com/babeloo/qwen-code-router/issues)
- 💬 [讨论](https://github.com/babeloo/qwen-code-router/discussions)

## 相关项目

- [Qwen Code](https://github.com/QwenLM/qwen-code) - 本工具设计配合使用的 AI 编程助手