# Qwen Code Router 安装指南

本指南提供了在不同操作系统上安装和设置 Qwen Code Router 的分步说明。

## 前置要求

- **Node.js**（版本 16 或更高）
- **npm** 或 **pnpm** 包管理器
- **Qwen Code**（用于 `qcr run` 命令）

## 安装方法

### 方法一：NPM 全局安装（推荐）

```bash
# 使用 npm 全局安装
npm install -g qwen-code-router

# 或使用 pnpm
pnpm install -g qwen-code-router

# 验证安装
qcr --help
```

### 方法二：本地开发安装

```bash
# 克隆仓库
git clone <repository-url>
cd qwen-code-router

# 安装依赖
npm install
# 或
pnpm install

# 构建项目
npm run build
# 或
pnpm build

# 链接以供全局使用（可选）
npm link
# 或
pnpm link --global
```

### 方法三：手动脚本安装

如果您更喜欢直接使用可执行脚本：

#### Windows

1. 将 `bin/qcr.bat` 复制到 PATH 中的目录
2. 或将 `bin` 目录添加到您的 PATH 环境变量
3. 运行 `qcr --help` 验证

#### Unix/Linux/macOS

1. 使脚本可执行：
   ```bash
   chmod +x bin/qcr
   ```

2. 复制到 PATH 中的目录：
   ```bash
   sudo cp bin/qcr /usr/local/bin/
   ```

3. 或创建符号链接：
   ```bash
   sudo ln -s /path/to/qwen-code-router/bin/qcr /usr/local/bin/qcr
   ```

#### PowerShell（跨平台）

1. 将 `bin/qcr.ps1` 复制到 PATH 中的目录
2. 或将 `bin` 目录添加到您的 PATH
3. 运行 `qcr.ps1 --help` 验证

## 配置设置

### 1. 创建配置文件

为您的配置文件选择以下位置之一：

- **当前目录**：`./config.yaml` 或 `./config.json`
- **用户目录**：`~/.qcr/config.yaml` 或 `~/.qcr/config.json`

### 2. 使用示例配置

复制示例配置文件之一：

```bash
# YAML 格式（推荐）
cp config.example.yaml config.yaml

# JSON 格式
cp config.example.json config.json

# 或复制到用户目录
mkdir -p ~/.qcr
cp config.example.yaml ~/.qcr/config.yaml
```

### 3. 自定义配置

编辑您的配置文件并替换占位符 API 密钥：

```yaml
# 示例：更新 OpenAI 配置
providers:
  - provider: openai
    env:
      api_key: "sk-your-actual-openai-api-key-here"
      base_url: "https://api.openai.com/v1"
      models:
        - model: gpt-4
        - model: gpt-3.5-turbo
```

## 验证

使用这些命令测试您的安装：

```bash
# 显示帮助
qcr --help

# 列出可用配置
qcr list config

# 列出内置提供商
qcr list provider --builtin

# 验证配置
qcr chk openai-gpt4

# 使用路由命令快速设置
# 注意：此命令仅在 Qwen Code 环境中工作
# /router openai gpt-4
```

## 平台特定说明

### Windows

- **命令提示符**：使用 `qcr.bat`
- **PowerShell**：使用 `qcr.ps1` 或 `qcr.bat`
- **Git Bash**：使用 Unix 脚本 `qcr`

### macOS

- 使用 Homebrew 安装 Node.js：`brew install node`
- 使用 Unix 脚本 `qcr`
- 配置目录：`~/.qcr/`

### Linux

- 使用您发行版的包管理器安装 Node.js
- 使用 Unix 脚本 `qcr`
- 配置目录：`~/.qcr/`

## 环境变量

Qwen Code Router 为 Qwen Code 设置这些环境变量：

- `OPENAI_API_KEY`：您的 API 密钥
- `OPENAI_BASE_URL`：API 基础 URL
- `OPENAI_MODEL`：要使用的模型

如果需要，您也可以手动设置这些：

```bash
# Windows（命令提示符）
set OPENAI_API_KEY=your-api-key
set OPENAI_BASE_URL=https://api.openai.com/v1
set OPENAI_MODEL=gpt-4

# Windows（PowerShell）
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:OPENAI_MODEL="gpt-4"

# Unix/Linux/macOS
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4"
```

## 故障排除

### 常见问题

1. **"qcr: command not found"**
   - 确保已安装 Node.js
   - 检查脚本是否在您的 PATH 中
   - 尝试使用脚本的完整路径

2. **"No configuration file found"**
   - 使用示例创建配置文件
   - 检查文件是否在正确位置
   - 验证文件权限

3. **"API key not set"**
   - 使用实际 API 密钥更新配置文件
   - 检查环境变量是否正确设置

4. **"Provider not found"**
   - 验证配置中的提供商名称
   - 检查拼写和大小写敏感性
   - 使用 `qcr list provider --builtin` 查看可用的内置提供商

### 获取帮助

- 使用 `qcr --help` 获取一般帮助
- 使用 `qcr <command> --help` 获取特定命令帮助
- 检查仓库中的配置示例
- 验证您的 Node.js 版本：`node --version`

## 卸载

### NPM 全局安装

```bash
npm uninstall -g qwen-code-router
# 或
pnpm uninstall -g qwen-code-router
```

### 手动安装

1. 从 PATH 目录中删除脚本
2. 删除配置目录：`rm -rf ~/.qcr`
3. 删除创建的任何符号链接

## 下一步

安装后：

1. 使用您的 API 密钥设置配置文件
2. 使用 `qcr list config` 测试以验证设置
3. 使用 `qcr use <config-name>` 激活配置
4. 运行 `qcr run` 使用您的配置启动 Qwen Code

更多信息，请参阅主 README_zh.md 文件。