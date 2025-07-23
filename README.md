# Qwen Code Router

A command-line tool to manage and switch API configurations for different large model service providers when using Qwen Code.

## Installation

```bash
pnpm install
pnpm run build
```

## Usage

The tool provides several commands to manage configurations:

- `qcr use [config_name]` - Activate a configuration
- `qcr run [additional_args...]` - Launch Qwen Code with active configuration
- `qcr set-default [config_name]` - Set default configuration
- `qcr chk [config_name]` - Validate a specific configuration
- `/router [provider] [model]` - Quick configuration via provider/model

## Configuration

Create a configuration file (`config.yaml` or `config.json`) in your project directory or user home directory (`~/.qcr/`).

See `config.example.yaml` and `config.example.json` for example configurations.

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm test

# Watch mode for development
pnpm run dev
```

## License

MIT