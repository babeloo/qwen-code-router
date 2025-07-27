/**
 * Comprehensive help and documentation system for Qwen Code Router
 * 
 * This module provides detailed help text, command examples, and usage patterns
 * for all commands with context-sensitive help based on command.
 */

import { CommandResult } from './commands';
import { createSuccessResult } from './errors';
import { listCommandHelp } from './commands/list';
import { chkCommandHelp } from './commands/chk';
import { routerCommandHelp } from './commands/router';

/**
 * Main help information for the application
 */
export function getMainHelp(): CommandResult {
  const { getToolName, getText, MESSAGES } = require('./i18n');
  
  const helpText = `
${getToolName()} - ${getText(MESSAGES.TOOL_DESCRIPTION)}

DESCRIPTION:
  Qwen Code Router is a command-line tool that manages and switches API 
  configurations for different large language model service providers when 
  using Qwen Code. It allows you to store multiple configurations, switch 
  between them seamlessly, and launch Qwen Code with the appropriate 
  environment variables set.

USAGE:
  qcr <command> [options]

COMMANDS:
  use [config_name]         Activate a configuration by name
  run [args...]             Launch Qwen Code with active configuration
  set-default <config_name> Set default configuration
  list <subcommand>         List configurations and providers
  chk [config_name]         Validate configuration(s)
  /router <provider> <model> Quick configuration via provider/model
  help                      Show this help message

GLOBAL OPTIONS:
  -h, --help               Show help for a command
  -v, --verbose            Show detailed output

EXAMPLES:
  qcr use openai-gpt4      # Activate the openai-gpt4 configuration
  qcr run                  # Launch Qwen Code with active configuration
  qcr run --help           # Show Qwen Code help (passes --help to qwen)
  qcr list config          # List all available configurations
  qcr set-default azure    # Set azure as the default configuration
  qcr chk openai-gpt4      # Validate the openai-gpt4 configuration
  /router openai gpt-4     # Quick setup for OpenAI GPT-4

CONFIGURATION:
  Qwen Code Router looks for configuration files in the following order:
  1. ./config.yaml or ./config.json (current directory)
  2. ~/.qcr/config.yaml or ~/.qcr/config.json (user directory)

  Configuration files can be in YAML or JSON format. YAML is recommended
  for better readability and comment support.

ENVIRONMENT VARIABLES:
  The tool manages these environment variables for Qwen Code:
  - OPENAI_API_KEY: API key for the service provider
  - OPENAI_BASE_URL: Base URL for the API endpoint
  - OPENAI_MODEL: Model identifier to use

GETTING STARTED:
  1. Create a configuration file (config.yaml or config.json)
  2. Add your provider configurations and models
  3. Set a default configuration: qcr set-default <config_name>
  4. Activate a configuration: qcr use <config_name>
  5. Launch Qwen Code: qcr run

For more information about a specific command, use:
  qcr <command> --help

RESOURCES:
  - Qwen Code: https://github.com/QwenLM/qwen-code
  - Configuration examples: See config.example.yaml and config.example.json
  - Documentation: README.md and README.zh-CN.md
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Help for the 'use' command
 */
export function getUseCommandHelp(): CommandResult {
  const helpText = `
qcr use - Activate a configuration

DESCRIPTION:
  The 'use' command activates a configuration by setting the required
  environment variables (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL).
  
  If no configuration name is provided, it will use the default configuration
  if one is set. You can set a default configuration using the 'set-default'
  command.

USAGE:
  qcr use [config_name] [options]

ARGUMENTS:
  config_name    Name of the configuration to activate (optional)
                 If not provided, uses the default configuration

OPTIONS:
  -v, --verbose  Show detailed output including environment variables
  -h, --help     Show this help message

EXAMPLES:
  qcr use                    # Activate the default configuration
  qcr use openai-gpt4        # Activate the openai-gpt4 configuration
  qcr use azure-gpt35 -v     # Activate configuration with detailed output

BEHAVIOR:
  The 'use' command loads the specified configuration (or default if none
  specified) and sets the required environment variables for Qwen Code to use
  the appropriate API provider and model.
  
  After successful activation, you can run 'qcr run' to launch Qwen Code with
  the activated configuration.

ERROR HANDLING:
  - Configuration file not found: Create config.yaml or config.json
  - Configuration validation failed: Check file syntax and structure
  - Configuration not found: Verify configuration name exists
  - Environment variables not set: Check provider settings

RELATED COMMANDS:
  qcr list config      List all available configurations
  qcr set-default      Set default configuration
  qcr run              Launch Qwen Code with active configuration
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Help for the 'run' command
 */
export function getRunCommandHelp(): CommandResult {
  const helpText = `
qcr run - Launch Qwen Code with active configuration

DESCRIPTION:
  The 'run' command launches Qwen Code with the currently active configuration.
  It passes through any additional arguments to the Qwen Code command.

USAGE:
  qcr run [args...] [options]

OPTIONS:
  -v, --verbose  Show detailed output including environment variables
  -h, --help     Show this help message

EXAMPLES:
  qcr run                    # Launch Qwen Code
  qcr run --help             # Show Qwen Code help
  qcr run --version          # Show Qwen Code version
  qcr run -v                 # Launch with verbose output

PREREQUISITES:
  Before running this command, you must have:
  - Qwen Code installed and accessible in your PATH
  - A valid configuration activated with 'qcr use' or set as default
  - Required environment variables set (API key, base URL, model)

BEHAVIOR:
  The 'run' command executes the 'qwen' command with the environment variables
  set by the 'use' command. Any additional arguments are passed directly to
  the qwen command, allowing you to use all Qwen Code features and options.
  
  The command handles process signals (SIGINT, SIGTERM) to ensure proper
  cleanup when terminated.

RELATED COMMANDS:
  qcr use              Activate a configuration
  qcr set-default      Set default configuration

Make sure to run 'qcr use [config_name]' or set a default configuration
before running this command, otherwise Qwen Code may not have the required
API configuration.
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Help for the 'set-default' command
 */
export function getSetDefaultCommandHelp(): CommandResult {
  const helpText = `
qcr set-default - Set default configuration

DESCRIPTION:
  The 'set-default' command sets a configuration as the default in the
  configuration file. This configuration will be used when running 'qcr use'
  without specifying a configuration name.

USAGE:
  qcr set-default <config_name> [options]

OPTIONS:
  -v, --verbose  Show detailed output including configuration file path
  -h, --help     Show this help message

EXAMPLES:
  qcr set-default openai-gpt4    # Set openai-gpt4 as default configuration
  qcr set-default azure-gpt35 -v # Set with verbose output

DESCRIPTION:
  The 'set-default' command updates your configuration file to mark a specific
  configuration as the default. This allows you to run 'qcr use' without
  specifying a configuration name to automatically activate your preferred
  configuration.

CONFIGURATION FILE:
  The command modifies the 'default_config' section in your configuration file:
  
  default_config:
    - name: <config_name>
  
  This entry determines which configuration is activated when running 'qcr use'
  without arguments.
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Get context-sensitive help based on command
 */
export function getCommandHelp(command: string): CommandResult {
  switch (command.toLowerCase()) {
    case 'use':
      return getUseCommandHelp();
    case 'run':
      return getRunCommandHelp();
    case 'set-default':
      return getSetDefaultCommandHelp();
    case 'list':
      return listCommandHelp();
    case 'chk':
      return chkCommandHelp();
    case '/router':
    case 'router':
      return routerCommandHelp();
    case 'help':
    default:
      return getMainHelp();
  }
}

// Re-export command-specific help functions for tests
export { listCommandHelp, chkCommandHelp, routerCommandHelp };

/**
 * Get quick usage information for a command
 */
export function getQuickUsage(command: string): string {
  switch (command.toLowerCase()) {
    case 'use':
      return 'qcr use [config_name] [-v|--verbose]';
    case 'run':
      return 'qcr run [additional_args...] [-v|--verbose]';
    case 'set-default':
      return 'qcr set-default <config_name> [-v|--verbose]';
    case 'list':
      return 'qcr list <subcommand> [-v|--verbose]';
    case 'chk':
      return 'qcr chk [config_name] [--test-api] [-v|--verbose]';
    case '/router':
    case 'router':
      return '/router <provider> <model>';
    default:
      return 'qcr <command> [options]';
  }
}

/**
 * Get command examples
 */
export function getCommandExamples(command: string): string[] {
  switch (command.toLowerCase()) {
    case 'use':
      return [
        'qcr use',
        'qcr use openai-gpt4',
        'qcr use azure-gpt35 -v'
      ];
    case 'run':
      return [
        'qcr run',
        'qcr run --help',
        'qcr run -v',
        'qcr run --port 8080'
      ];
    case 'set-default':
      return [
        'qcr set-default openai-gpt4',
        'qcr set-default azure-gpt35 -v'
      ];
    case 'list':
      return [
        'qcr list config',
        'qcr list provider',
        'qcr list provider --tree',
        'qcr list provider openai',
        'qcr list provider --all openai'
      ];
    case 'chk':
      return [
        'qcr chk',
        'qcr chk openai-gpt4',
        'qcr chk openai-gpt4 --test-api',
        'qcr chk -v'
      ];
    case '/router':
    case 'router':
      return [
        '/router openai gpt-4',
        '/router azure gpt-35-turbo',
        '/router anthropic claude-3-opus'
      ];
    default:
      return ['qcr help'];
  }
}

/**
 * Configuration file help and examples
 */
export function getConfigurationHelp(): CommandResult {
  const helpText = `
Configuration File Format

DESCRIPTION:
  Qwen Code Router uses YAML or JSON configuration files to store provider
  configurations, model definitions, and default settings. YAML format is
  recommended for better readability and comment support.

FILE LOCATIONS:
  The tool searches for configuration files in this order:
  1. ./config.yaml or ./config.json (current directory)
  2. ~/.qcr/config.yaml or ~/.qcr/config.json (user directory)

YAML EXAMPLE:
  # Qwen Code Router Configuration
  default_config:
    - name: openai-gpt4

  configs:
    - config:
        - name: openai-gpt4
          provider: openai
          model: gpt-4
        - name: azure-gpt35
          provider: azure
          model: gpt-35-turbo

  providers:
    - provider: openai
      env:
        api_key: YOUR_OPENAI_API_KEY
        base_url: https://api.openai.com/v1
        models:
          - model: gpt-4
          - model: gpt-3.5-turbo
    - provider: azure
      env:
        api_key: YOUR_AZURE_API_KEY
        base_url: https://myresource.openai.azure.com/openai
        models:
          - model: gpt-35-turbo
          - model: gpt-4

STRUCTURE:
  default_config: (optional)
    - name: <config_name>    # Default configuration to use

  configs:                   # Configuration definitions
    - config:
        - name: <config_name>      # Unique configuration name
          provider: <provider_name> # Reference to provider
          model: <model_name>       # Model to use

  providers:                 # Provider definitions
    - provider: <provider_name>    # Unique provider name
      env:
        api_key: <api_key>         # API authentication key
        base_url: <base_url>       # API endpoint URL
        models:                    # Supported models
          - model: <model_name>

VALIDATION RULES:
  - All configuration names must be unique
  - All provider names must be unique
  - Each configuration must reference an existing provider
  - Each configuration model must be in the provider's model list
  - API keys and base URLs cannot be empty
  - Base URLs must be valid URL format

SECURITY NOTES:
  - Store configuration files with restricted permissions (600)
  - Never commit API keys to version control
  - Use environment variables for sensitive data in CI/CD
  - Consider using separate configuration files for different environments

EXAMPLES:
  See config.example.yaml and config.example.json for complete examples
  with multiple providers and configurations.
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Troubleshooting help
 */
export function getTroubleshootingHelp(): CommandResult {
  const helpText = `
Troubleshooting Guide

COMMON ISSUES AND SOLUTIONS:

1. Configuration File Not Found
   Problem: "No configuration file found"
   Solutions:
   - Create config.yaml or config.json in current directory
   - Create ~/.qcr/config.yaml in your home directory
   - Check file permissions (must be readable)
   - Verify file format (YAML or JSON)

2. Configuration Validation Failed
   Problem: "Configuration file validation failed"
   Solutions:
   - Check YAML/JSON syntax with a validator
   - Ensure all required fields are present
   - Verify provider and model references are correct
   - Use 'qcr chk' to see detailed validation errors

3. Environment Variables Not Set
   Problem: "Required environment variables are not set"
   Solutions:
   - Run 'qcr use <config_name>' to activate a configuration
   - Check that the configuration exists with 'qcr list config'
   - Verify the configuration is valid with 'qcr chk <config_name>'

4. Qwen Code Command Not Found
   Problem: "Failed to launch Qwen Code: command not found"
   Solutions:
   - Install Qwen Code from https://github.com/QwenLM/qwen-code
   - Ensure 'qwen' command is in your PATH
   - Try running 'qwen --help' directly to test installation

5. API Authentication Errors
   Problem: API calls fail with authentication errors
   Solutions:
   - Verify API key is correct and not expired
   - Check API key permissions and quotas
   - Ensure base URL is correct for your provider
   - Use 'qcr chk <config> --test-api' to test connectivity

6. Model Not Available
   Problem: "Model not found for provider"
   Solutions:
   - Check model name spelling and case
   - Use 'qcr list provider <name>' to see available models
   - Use 'qcr list provider --all <name>' to see all models via API
   - Update your configuration file with correct model names

7. Permission Errors
   Problem: File permission or access errors
   Solutions:
   - Check file and directory permissions
   - Ensure you have write access to configuration file location
   - Run with appropriate user permissions
   - Check disk space availability

8. Network Connectivity Issues
   Problem: API calls timeout or fail
   Solutions:
   - Check internet connection
   - Verify firewall and proxy settings
   - Test API endpoint accessibility with curl
   - Check if the service is currently available

DEBUGGING TIPS:
  - Use -v or --verbose flag for detailed output
  - Use 'qcr chk --test-api' to test API connectivity
  - Check configuration file syntax with online validators
  - Test individual components (config file, API keys, network)

GETTING HELP:
  - Use 'qcr <command> --help' for command-specific help
  - Check README.md and README.zh-CN.md for documentation
  - Review example configuration files
  - Check Qwen Code documentation for installation issues
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Get all available help topics
 */
export function getHelpTopics(): string[] {
  return [
    'commands',
    'configuration',
    'troubleshooting',
    'examples'
  ];
}

/**
 * Get help for a specific topic
 */
export function getTopicHelp(topic: string): CommandResult {
  switch (topic.toLowerCase()) {
    case 'configuration':
    case 'config':
      return getConfigurationHelp();
    case 'troubleshooting':
    case 'troubleshoot':
      return getTroubleshootingHelp();
    case 'commands':
      return getMainHelp();
    default:
      return getMainHelp();
  }
}