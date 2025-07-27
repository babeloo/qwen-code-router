/**
 * Standardized error handling and formatting for Qwen Code Router
 * 
 * This module provides consistent error message formatting, exit codes,
 * and helpful suggestions across all commands.
 */

import { CommandResult } from './commands';

/**
 * Standard exit codes for different error conditions
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_USAGE: 2,
  CONFIG_NOT_FOUND: 3,
  CONFIG_INVALID: 4,
  CONFIG_VALIDATION_FAILED: 5,
  ENVIRONMENT_ERROR: 6,
  COMMAND_NOT_FOUND: 127,
  INTERRUPTED: 130
} as const;

/**
 * Error categories for consistent formatting
 */
export enum ErrorCategory {
  CONFIG_FILE = 'Configuration File',
  VALIDATION = 'Validation',
  ENVIRONMENT = 'Environment',
  COMMAND = 'Command',
  SYSTEM = 'System',
  NETWORK = 'Network'
}

/**
 * Standardized error message structure
 */
export interface ErrorMessage {
  /** Brief error description */
  message: string;
  /** Detailed explanation of the error */
  details?: string;
  /** Helpful suggestions for resolving the error */
  suggestions?: string[];
  /** Available options or alternatives */
  availableOptions?: string[];
  /** Error category for consistent formatting */
  category?: ErrorCategory;
  /** Exit code for the error */
  exitCode: number;
}

/**
 * Creates a standardized error result for commands
 * @param error - Error message structure
 * @returns CommandResult with formatted error
 */
export function createErrorResult(error: ErrorMessage): CommandResult {
  let formattedMessage = error.message;
  let formattedDetails = '';

  // Add details if provided
  if (error.details) {
    formattedDetails += error.details;
  }

  // Add available options if provided
  if (error.availableOptions && error.availableOptions.length > 0) {
    if (formattedDetails) formattedDetails += '\n\n';
    formattedDetails += `Available options:\n${error.availableOptions.map(opt => `  - ${opt}`).join('\n')}`;
  }

  // Add suggestions if provided
  if (error.suggestions && error.suggestions.length > 0) {
    if (formattedDetails) formattedDetails += '\n\n';
    formattedDetails += `Suggestions:\n${error.suggestions.map(sug => `  • ${sug}`).join('\n')}`;
  }

  return {
    success: false,
    message: formattedMessage,
    details: formattedDetails || undefined,
    exitCode: error.exitCode
  };
}

/**
 * Creates a standardized success result for commands
 * @param message - Success message
 * @param details - Optional details
 * @param exitCode - Exit code (default: 0)
 * @returns CommandResult with formatted success
 */
export function createSuccessResult(message: string, details?: string, exitCode: number = EXIT_CODES.SUCCESS): CommandResult {
  return {
    success: true,
    message,
    details,
    exitCode
  };
}

/**
 * Configuration file not found error
 */
export function configFileNotFoundError(searchPaths: string[]): ErrorMessage {
  const { getText, MESSAGES, SUGGESTIONS } = require('./i18n');
  
  return {
    message: getText(MESSAGES.CONFIG_FILE_NOT_FOUND),
    details: `Searched in the following locations:\n${searchPaths.map(path => `  - ${path}`).join('\n')}`,
    suggestions: [
      getText(SUGGESTIONS.CREATE_CONFIG_FILE),
      'Use "config.yaml" or "config.json" as the filename',
      getText(SUGGESTIONS.USE_EXAMPLE_CONFIG)
    ],
    availableOptions: [
      'config.yaml (recommended)',
      'config.json',
      '~/.qcr/config.yaml',
      '~/.qcr/config.json'
    ],
    category: ErrorCategory.CONFIG_FILE,
    exitCode: EXIT_CODES.CONFIG_NOT_FOUND
  };
}

/**
 * Configuration file validation failed error
 */
export function configValidationError(errors: string[], warnings: string[] = []): ErrorMessage {
  const { getText, MESSAGES, SUGGESTIONS } = require('./i18n');
  
  let details = `Configuration validation errors:\n${errors.map(err => `  ✗ ${err}`).join('\n')}`;
  
  if (warnings.length > 0) {
    details += `\n\nWarnings:\n${warnings.map(warn => `  ⚠ ${warn}`).join('\n')}`;
  }

  return {
    message: getText(MESSAGES.CONFIG_VALIDATION_FAILED),
    details,
    suggestions: [
      'Check the configuration file syntax and structure',
      'Ensure all required fields are present and properly formatted',
      'Verify that provider and model references are valid',
      getText(SUGGESTIONS.USE_EXAMPLE_CONFIG)
    ],
    category: ErrorCategory.VALIDATION,
    exitCode: EXIT_CODES.CONFIG_VALIDATION_FAILED
  };
}

/**
 * Configuration not found error (specific config name)
 */
export function configNotFoundError(configName: string, availableConfigs: string[]): ErrorMessage {
  const { getText, MESSAGES, SUGGESTIONS } = require('./i18n');
  
  return {
    message: `${getText(MESSAGES.CONFIG_NOT_FOUND)}: '${configName}'`,
    availableOptions: availableConfigs.length > 0 ? availableConfigs : ['No configurations available'],
    suggestions: availableConfigs.length > 0 ? [
      `Use one of the available configurations: ${availableConfigs.join(', ')}`,
      'Check the spelling of the configuration name',
      getText(SUGGESTIONS.LIST_AVAILABLE_CONFIGS)
    ] : [
      'Add configurations to your configuration file',
      getText(SUGGESTIONS.USE_EXAMPLE_CONFIG)
    ],
    category: ErrorCategory.CONFIG_FILE,
    exitCode: EXIT_CODES.CONFIG_INVALID
  };
}

/**
 * Provider not found error
 */
export function providerNotFoundError(providerName: string, availableProviders: string[]): ErrorMessage {
  return {
    message: `Provider '${providerName}' not found`,
    availableOptions: availableProviders.length > 0 ? availableProviders : ['No providers available'],
    suggestions: availableProviders.length > 0 ? [
      `Use one of the available providers: ${availableProviders.join(', ')}`,
      'Check the spelling of the provider name (case-insensitive)',
      'Use "qcr list provider" to see all available providers'
    ] : [
      'Add providers to your configuration file',
      'Check the example configuration files for proper format'
    ],
    category: ErrorCategory.CONFIG_FILE,
    exitCode: EXIT_CODES.CONFIG_INVALID
  };
}

/**
 * Model not found error
 */
export function modelNotFoundError(modelName: string, providerName: string, availableModels: string[]): ErrorMessage {
  return {
    message: `Model '${modelName}' not found for provider '${providerName}'`,
    availableOptions: availableModels.length > 0 ? availableModels : ['No models available for this provider'],
    suggestions: availableModels.length > 0 ? [
      `Use one of the available models: ${availableModels.join(', ')}`,
      'Check the spelling of the model name',
      `Use "qcr list provider ${providerName}" to see available models`
    ] : [
      `Add models to the '${providerName}' provider configuration`,
      'Check the provider documentation for supported models'
    ],
    category: ErrorCategory.CONFIG_FILE,
    exitCode: EXIT_CODES.CONFIG_INVALID
  };
}

/**
 * Environment variables not set error
 */
export function environmentNotSetError(missingVars: string[]): ErrorMessage {
  const { getText, MESSAGES, SUGGESTIONS } = require('./i18n');
  
  return {
    message: getText(MESSAGES.ENV_VARS_NOT_SET),
    details: `Missing environment variables:\n${missingVars.map(v => `  - ${v}`).join('\n')}`,
    suggestions: [
      getText(SUGGESTIONS.ACTIVATE_CONFIG_FIRST),
      'Use "/router [provider] [model]" for quick configuration',
      'Check that your configuration file is valid and accessible'
    ],
    category: ErrorCategory.ENVIRONMENT,
    exitCode: EXIT_CODES.ENVIRONMENT_ERROR
  };
}

/**
 * Environment variables validation error
 */
export function environmentValidationError(errors: string[], warnings: string[] = []): ErrorMessage {
  let details = `Environment validation errors:\n${errors.map(err => `  ✗ ${err}`).join('\n')}`;
  
  if (warnings.length > 0) {
    details += `\n\nWarnings:\n${warnings.map(warn => `  ⚠ ${warn}`).join('\n')}`;
  }

  return {
    message: 'Environment variables validation failed',
    details,
    suggestions: [
      'Check that all environment variables are properly set',
      'Verify API key format and validity',
      'Ensure base URL is a valid HTTPS endpoint',
      'Confirm model name is correct'
    ],
    category: ErrorCategory.ENVIRONMENT,
    exitCode: EXIT_CODES.ENVIRONMENT_ERROR
  };
}

/**
 * Command not found error
 */
export function commandNotFoundError(command: string, availableCommands: string[]): ErrorMessage {
  return {
    message: `Unknown command: ${command}`,
    availableOptions: availableCommands,
    suggestions: [
      'Use "qcr help" to see all available commands',
      'Check the spelling of the command name',
      'Use "qcr [command] --help" for command-specific help'
    ],
    category: ErrorCategory.COMMAND,
    exitCode: EXIT_CODES.INVALID_USAGE
  };
}

/**
 * Invalid command arguments error
 */
export function invalidArgumentsError(command: string, error: string, usage?: string): ErrorMessage {
  let details = error;
  if (usage) {
    details += `\n\nUsage: ${usage}`;
  }

  return {
    message: `Invalid arguments for command '${command}'`,
    details,
    suggestions: [
      `Use "qcr ${command} --help" for detailed usage information`,
      'Check the command syntax and required arguments',
      'Ensure all required parameters are provided'
    ],
    category: ErrorCategory.COMMAND,
    exitCode: EXIT_CODES.INVALID_USAGE
  };
}

/**
 * File operation error
 */
export function fileOperationError(operation: string, filePath: string, error: string): ErrorMessage {
  return {
    message: `Failed to ${operation} file`,
    details: `File: ${filePath}\nError: ${error}`,
    suggestions: [
      'Check file permissions and accessibility',
      'Ensure the directory exists and is writable',
      'Verify the file path is correct',
      'Check available disk space'
    ],
    category: ErrorCategory.SYSTEM,
    exitCode: EXIT_CODES.GENERAL_ERROR
  };
}

/**
 * Process launch error
 */
export function processLaunchError(command: string, error: string): ErrorMessage {
  const isCommandNotFound = error.includes('ENOENT') || error.includes('command not found');
  
  return {
    message: `Failed to launch ${command}`,
    details: error,
    suggestions: isCommandNotFound ? [
      `Ensure ${command} is installed and available in your PATH`,
      'Check the installation documentation for proper setup',
      'Verify the command name and spelling',
      'Try running the command directly to test availability'
    ] : [
      'Check system resources and permissions',
      'Verify the command arguments are valid',
      'Try running the command directly to diagnose the issue'
    ],
    category: ErrorCategory.SYSTEM,
    exitCode: isCommandNotFound ? EXIT_CODES.COMMAND_NOT_FOUND : EXIT_CODES.GENERAL_ERROR
  };
}

/**
 * Network/API error
 */
export function networkError(operation: string, endpoint: string, error: string): ErrorMessage {
  return {
    message: `Network error during ${operation}`,
    details: `Endpoint: ${endpoint}\nError: ${error}`,
    suggestions: [
      'Check your internet connection',
      'Verify the API endpoint URL is correct',
      'Ensure API credentials are valid and not expired',
      'Check if the service is currently available',
      'Try again after a few moments'
    ],
    category: ErrorCategory.NETWORK,
    exitCode: EXIT_CODES.GENERAL_ERROR
  };
}

/**
 * No default configuration error
 */
export function noDefaultConfigError(availableConfigs: string[]): ErrorMessage {
  const { getText, MESSAGES, SUGGESTIONS } = require('./i18n');
  
  return {
    message: `${getText(MESSAGES.DEFAULT_CONFIG_NOT_SET)} and no configuration name provided`,
    availableOptions: availableConfigs,
    suggestions: [
      getText(SUGGESTIONS.SET_DEFAULT_CONFIG),
      'Specify a configuration name explicitly',
      getText(SUGGESTIONS.LIST_AVAILABLE_CONFIGS)
    ],
    category: ErrorCategory.CONFIG_FILE,
    exitCode: EXIT_CODES.CONFIG_INVALID
  };
}

/**
 * Unexpected error wrapper
 */
export function unexpectedError(operation: string, error: unknown): ErrorMessage {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  return {
    message: `Unexpected error occurred during ${operation}`,
    details: errorMessage,
    suggestions: [
      'Try the operation again',
      'Check the configuration file for any issues',
      'Ensure all required dependencies are installed',
      'Report this issue if it persists'
    ],
    category: ErrorCategory.SYSTEM,
    exitCode: EXIT_CODES.GENERAL_ERROR
  };
}

/**
 * Formats validation results into a user-friendly message
 */
export function formatValidationResult(validation: { isValid: boolean; errors: string[]; warnings: string[] }): string {
  let result = '';
  
  if (validation.errors.length > 0) {
    result += `Errors:\n${validation.errors.map(err => `  ✗ ${err}`).join('\n')}`;
  }
  
  if (validation.warnings.length > 0) {
    if (result) result += '\n\n';
    result += `Warnings:\n${validation.warnings.map(warn => `  ⚠ ${warn}`).join('\n')}`;
  }
  
  return result;
}

/**
 * Available commands for help and error messages
 */
export const AVAILABLE_COMMANDS = [
  'use [config_name]',
  'run [args...]',
  'set-default <config_name>',
  'list <subcommand>',
  'chk [config_name]',
  '/router <provider> <model>',
  'help'
];

/**
 * Common configuration file names for suggestions
 */
export const CONFIG_FILE_NAMES = [
  'config.yaml',
  'config.json',
  '~/.qcr/config.yaml',
  '~/.qcr/config.json'
];