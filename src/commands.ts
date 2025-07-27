/**
 * Command handlers for Qwen Code Router CLI
 *
 * This module implements the core CLI commands including 'qcr use' for
 * activating configurations by name.
 */

import {
  resolveConfigurationByName,
  getAllConfigurationNames,
  getCurrentDefaultConfiguration
} from './resolver';
import { validateEnvironmentVariables } from './environment';
import { ConfigFile } from './types';
import {
  createErrorResult,
  invalidArgumentsError,
  createSuccessResult,
  environmentNotSetError,
  processLaunchError,
  configFileNotFoundError,
  configValidationError,
  fileOperationError,
  configNotFoundError,
  unexpectedError,
  EXIT_CODES
} from './errors';
import { ChildProcess } from 'child_process';
import { spawnCrossPlatform } from './platform';
import { discoverAndLoadConfig, saveConfigFile } from './persistence';
import { UseCommandOptions } from './commands/use';
import { useCommandHelp, useCommand } from './commands/use';

/**
 * Result of a command execution
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Success or error message */
  message: string;
  /** Additional details (optional) */
  details?: string | undefined;
  /** Exit code for the process */
  exitCode: number;
}

/**
 * Lists all available configurations
 * @param configFile - Configuration file to list from
 * @param options - Display options
 * @returns CommandResult with configuration list
 */
export function listConfigurations(
  configFile: ConfigFile,
  options: { verbose?: boolean } = {}
): CommandResult {
  try {
    const configNames = getAllConfigurationNames(configFile);
    const defaultConfig = getCurrentDefaultConfiguration(configFile);

    if (configNames.length === 0) {
      return {
        success: true,
        message: 'No configurations found',
        details: 'Add configurations to your configuration file to get started.',
        exitCode: 0
      };
    }

    let message = 'Available configurations:';
    let details = '';

    for (const configName of configNames) {
      const isDefault = configName === defaultConfig;
      const marker = isDefault ? ' (default)' : '';

      if (options.verbose) {
        // Find the configuration details
        const configEntry = configFile.configs
          .flatMap(c => c.config)
          .find(c => c.name === configName);

        if (configEntry) {
          details += `\n  ${configName}${marker} - Provider: ${configEntry.provider}, Model: ${configEntry.model}`;
        } else {
          details += `\n  ${configName}${marker}`;
        }
      } else {
        details += `\n  ${configName}${marker}`;
      }
    }

    return {
      success: true,
      message,
      details: details.trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to list configurations',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Gets the current active configuration status
 * @returns CommandResult with current status
 */
export function getCurrentStatus(): CommandResult {
  try {
    const envValidation = validateEnvironmentVariables();

    if (!envValidation.isValid) {
      return {
        success: true,
        message: 'No configuration is currently active',
        details: 'Use "qcr use [config_name]" to activate a configuration.',
        exitCode: 0
      };
    }

    const apiKey = process.env['OPENAI_API_KEY'];
    const baseUrl = process.env['OPENAI_BASE_URL'];
    const model = process.env['OPENAI_MODEL'];

    const message = 'Configuration is currently active';
    const details = `Provider endpoint: ${baseUrl}\nModel: ${model}\nAPI Key: ${apiKey?.substring(0, 8)}...`;

    if (envValidation.warnings.length > 0) {
      return {
        success: true,
        message,
        details: details + `\nWarnings: ${envValidation.warnings.join(', ')}`,
        exitCode: 0
      };
    }

    return {
      success: true,
      message,
      details,
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to get current status',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Validates command arguments for the use command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseUseCommandArgs(args: string[]): {
  valid: boolean;
  options?: UseCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: UseCommandOptions = {};
  let configName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('-')) {
      return {
        valid: false,
        error: `Unknown option: ${arg}`
      };
    } else {
      // This should be the configuration name
      if (configName !== undefined) {
        return {
          valid: false,
          error: `Too many arguments. Expected at most one configuration name, got: ${configName}, ${arg}`
        };
      }
      configName = arg;
    }
  }

  if (configName !== undefined) {
    options.configName = configName;
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the use command from CLI
 * @param args - Command line arguments (excluding 'qcr use')
 * @returns Promise<CommandResult>
 */
export async function handleUseCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseUseCommandArgs(args);

  if (!parseResult.valid) {
    return createErrorResult(invalidArgumentsError('use', parseResult.error || 'Invalid arguments', 'qcr use [config_name] [-v|--verbose]'));
  }

  if (parseResult.showHelp) {
    return useCommandHelp();
  }

  return await useCommand(parseResult.options);
}

/**
 * Options for the run command
 */
export interface RunCommandOptions {
  /** Additional arguments to pass to the qwen command */
  additionalArgs?: string[];
  /** Whether to show verbose output */
  verbose?: boolean;
}

/**
 * Implements the 'qcr run' command
 * Launches Qwen Code with the currently active configuration
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with execution status and message
 */
export async function runCommand(options: RunCommandOptions = {}): Promise<CommandResult> {
  try {
    // Validate that required environment variables are set
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return createErrorResult(environmentNotSetError(envValidation.errors));
    }

    // Show warnings if any
    if (envValidation.warnings.length > 0 && options.verbose) {
      console.warn(`Warnings:\n${envValidation.warnings.map(w => `  ⚠ ${w}`).join('\n')}`);
    }

    // Prepare command arguments
    const qwenArgs = options.additionalArgs || [];

    if (options.verbose) {
      console.log(`Launching Qwen Code with environment:`);
      console.log(`  OPENAI_API_KEY: ${process.env['OPENAI_API_KEY']?.substring(0, 8)}...`);
      console.log(`  OPENAI_BASE_URL: ${process.env['OPENAI_BASE_URL']}`);
      console.log(`  OPENAI_MODEL: ${process.env['OPENAI_MODEL']}`);
      console.log(`  Command: qwen ${qwenArgs.join(' ')}`);
    }

    // Launch Qwen Code process using cross-platform spawning
    return new Promise<CommandResult>((resolve) => {
      const child: ChildProcess = spawnCrossPlatform('qwen', qwenArgs, {
        stdio: 'inherit', // Pass through stdin/stdout/stderr
        env: process.env, // Use current environment (including our set variables)
        useShell: true // Use shell to handle command resolution
      });

      // Handle process errors
      child.on('error', (error) => {
        resolve(createErrorResult(processLaunchError('Qwen Code', error.message)));
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        if (signal) {
          const exitCode = signal === 'SIGINT' ? EXIT_CODES.INTERRUPTED : EXIT_CODES.GENERAL_ERROR;
          resolve(createSuccessResult(`Qwen Code terminated by signal ${signal}`, undefined, exitCode));
        } else {
          const exitCode = code || 0;
          const message = exitCode === 0 ? 'Qwen Code completed successfully' : `Qwen Code exited with code ${exitCode}`;
          resolve(createSuccessResult(message, undefined, exitCode));
        }
      });

      // Handle signals to forward them to the child process
      const signalHandler = (signal: NodeJS.Signals) => {
        if (child.pid) {
          try {
            process.kill(child.pid, signal);
          } catch (error) {
            // Child process may have already exited
            if (options.verbose) {
              console.warn(`Failed to send ${signal} to child process:`, error);
            }
          }
        }
      };

      process.on('SIGINT', signalHandler);
      process.on('SIGTERM', signalHandler);

      // Clean up signal handlers when child exits
      child.on('exit', () => {
        process.removeListener('SIGINT', signalHandler);
        process.removeListener('SIGTERM', signalHandler);
      });
    });
  } catch (error) {
    return createErrorResult(unexpectedError('run command execution', error));
  }
}

/**
 * Shows help information for the run command
 * @returns CommandResult with help information
 */
export function runCommandHelp(): CommandResult {
  // Import here to avoid circular dependency
  const { getRunCommandHelp } = require('./help');
  return getRunCommandHelp();
}

/**
 * Validates command arguments for the run command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseRunCommandArgs(args: string[]): {
  valid: boolean;
  options?: RunCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: RunCommandOptions = {
    additionalArgs: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else {
      // All other arguments are passed through to qwen
      options.additionalArgs!.push(arg);
    }
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the run command from CLI
 * @param args - Command line arguments (excluding 'qcr run')
 * @returns Promise<CommandResult>
 */
export async function handleRunCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseRunCommandArgs(args);

  if (!parseResult.valid) {
    return createErrorResult(invalidArgumentsError('run', parseResult.error || 'Invalid arguments', 'qcr run [additional_args...] [-v|--verbose]'));
  }

  if (parseResult.showHelp) {
    return runCommandHelp();
  }

  return await runCommand(parseResult.options);
}

/**
 * Options for the set-default command
 */
export interface SetDefaultCommandOptions {
  /** Configuration name to set as default */
  configName: string;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
}

/**
 * Implements the 'qcr set-default [config_name]' command
 * Sets the default configuration in the configuration file
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with execution status and message
 */
export async function setDefaultCommand(options: SetDefaultCommandOptions): Promise<CommandResult> {
  try {
    // Discover and load configuration file
    let config: ConfigFile;
    let validation: any;
    let filePath: string;

    try {
      const result = await discoverAndLoadConfig(options.currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No configuration file found')) {
        const searchPaths = error.message.split('Searched in:\n')[1]?.split('\n').map(p => p.trim().replace('- ', '')) || [];
        return createErrorResult(configFileNotFoundError(searchPaths));
      } else if (error instanceof Error && error.message.includes('Failed to load configuration file')) {
        return createErrorResult(fileOperationError('load', 'configuration file', error.message));
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // Check if configuration file is valid
    if (!validation.isValid) {
      return createErrorResult(configValidationError(validation.errors, validation.warnings));
    }

    // Validate that the specified configuration exists
    const availableConfigs = getAllConfigurationNames(config);
    if (!availableConfigs.includes(options.configName)) {
      return createErrorResult(configNotFoundError(options.configName, availableConfigs));
    }

    // Get current default configuration
    const currentDefault = getCurrentDefaultConfiguration(config);

    // Update the default configuration
    if (!config.default_config) {
      config.default_config = [];
    }

    // Clear existing default configurations and set the new one
    config.default_config = [{ name: options.configName }];

    // Save the updated configuration file
    try {
      await saveConfigFile(config, filePath);
    } catch (error) {
      return createErrorResult(fileOperationError('save', filePath, error instanceof Error ? error.message : 'Unknown error'));
    }

    // Build success message
    let message = `Successfully set '${options.configName}' as the default configuration`;
    let details = '';

    if (currentDefault && currentDefault !== options.configName) {
      details = `Previous default: ${currentDefault}`;
    } else if (!currentDefault) {
      details = 'No previous default configuration was set';
    } else {
      details = `'${options.configName}' was already the default configuration`;
    }

    if (options.verbose) {
      details += `\nConfiguration file: ${filePath}`;
      details += `\nAvailable configurations: ${availableConfigs.join(', ')}`;
    }

    return createSuccessResult(message, details);
  } catch (error) {
    return createErrorResult(unexpectedError('set-default command execution', error));
  }
}

/**
 * Shows help information for the set-default command
 * @returns CommandResult with help information
 */
export function setDefaultCommandHelp(): CommandResult {
  // Import here to avoid circular dependency
  const { getSetDefaultCommandHelp } = require('./help');
  return getSetDefaultCommandHelp();
}

/**
 * Validates command arguments for the set-default command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseSetDefaultCommandArgs(args: string[]): {
  valid: boolean;
  options?: SetDefaultCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: Partial<SetDefaultCommandOptions> = {};
  let configName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('-')) {
      return {
        valid: false,
        error: `Unknown option: ${arg}`
      };
    } else {
      // This should be the configuration name
      if (configName !== undefined) {
        return {
          valid: false,
          error: `Too many arguments. Expected exactly one configuration name, got: ${configName}, ${arg}`
        };
      }
      configName = arg;
    }
  }

  if (configName === undefined) {
    return {
      valid: false,
      error: 'Configuration name is required'
    };
  }

  options.configName = configName;

  return {
    valid: true,
    options: options as SetDefaultCommandOptions
  };
}

/**
 * Main entry point for the set-default command from CLI
 * @param args - Command line arguments (excluding 'qcr set-default')
 * @returns Promise<CommandResult>
 */
export async function handleSetDefaultCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseSetDefaultCommandArgs(args);

  if (!parseResult.valid) {
    return createErrorResult(invalidArgumentsError('set-default', parseResult.error || 'Invalid arguments', 'qcr set-default <config_name> [-v|--verbose]'));
  }

  if (parseResult.showHelp) {
    return setDefaultCommandHelp();
  }

  return await setDefaultCommand(parseResult.options!);
}

/**
 * Built-in provider definitions with their known models
 */
export const BUILTIN_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4-0125-preview',
      'gpt-4-1106-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
      'gpt-3.5-turbo-16k'
    ]
  },
  azure: {
    name: 'Azure OpenAI',
    base_url: 'https://[resource].openai.azure.com/openai',
    models: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-32k',
      'gpt-35-turbo',
      'gpt-35-turbo-16k'
    ]
  },
  anthropic: {
    name: 'Anthropic',
    base_url: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ]
  },
  google: {
    name: 'Google AI',
    base_url: 'https://generativelanguage.googleapis.com/v1',
    models: [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
  }
} as const;

/**
 * Options for the list command
 */
export interface ListCommandOptions {
  /** Subcommand to execute (config, provider, etc.) */
  subcommand?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show all providers and models in tree structure */
  all?: boolean;
  /** Whether to show providers and models in tree structure (--tree flag) */
  tree?: boolean;
  /** Specific provider to show models for */
  provider?: string;
  /** Whether to use short form (-p instead of provider) */
  shortForm?: boolean;
  /** Whether to list built-in providers (-f flag) */
  builtinProviders?: boolean;
}

/**
 * Implements the 'qcr list config' command
 * Lists all available configurations with their details
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with configuration list
 */
export async function listConfigCommand(options: ListCommandOptions = {}): Promise<CommandResult> {
  try {
    // Discover and load configuration file
    let config: ConfigFile;
    let validation: any;
    let filePath: string;

    try {
      const result = await discoverAndLoadConfig(options.currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No configuration file found')) {
        return {
          success: false,
          message: 'No configuration file found',
          details: error.message,
          exitCode: 1
        };
      } else if (error instanceof Error && error.message.includes('Failed to load configuration file')) {
        return {
          success: false,
          message: 'Failed to load configuration file',
          details: error.message,
          exitCode: 1
        };
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // Check if configuration file is valid
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Configuration file validation failed',
        details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
        exitCode: 1
      };
    }

    // Use the existing listConfigurations function
    const result = listConfigurations(config, { verbose: options.verbose || false });

    // Add configuration file path to verbose output
    if (options.verbose && result.success && result.details) {
      result.details += `\n\nConfiguration file: ${filePath}`;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while listing configurations',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Lists built-in providers and their models
 * @param options - Display options
 * @returns CommandResult with built-in provider list
 */
export function listBuiltinProviders(
  options: { verbose?: boolean; provider?: string } = {}
): CommandResult {
  try {
    const providerKeys = Object.keys(BUILTIN_PROVIDERS) as (keyof typeof BUILTIN_PROVIDERS)[];

    // If specific provider requested
    if (options.provider) {
      const providerKey = providerKeys.find(key =>
        key.toLowerCase() === options.provider!.toLowerCase()
      );

      if (!providerKey) {
        return {
          success: false,
          message: `Built-in provider '${options.provider}' not found`,
          details: `Available built-in providers: ${providerKeys.join(', ')}`,
          exitCode: 1
        };
      }

      const provider = BUILTIN_PROVIDERS[providerKey];
      let message = `Models for built-in provider '${providerKey}' (${provider.name}):`;
      let details = '';

      for (const model of provider.models) {
        details += `\n  ${model}`;
      }

      if (options.verbose) {
        details += `\n\nProvider details:`;
        details += `\n  Name: ${provider.name}`;
        details += `\n  Base URL: ${provider.base_url}`;
        details += `\n  Total models: ${provider.models.length}`;
      }

      return {
        success: true,
        message,
        details: details.trim(),
        exitCode: 0
      };
    }

    // Default: list all built-in providers
    let message = 'Available built-in providers:';
    let details = '';

    for (const providerKey of providerKeys) {
      const provider = BUILTIN_PROVIDERS[providerKey];
      if (options.verbose) {
        details += `\n  ${providerKey} (${provider.name}) - ${provider.models.length} models`;
        details += `\n    Base URL: ${provider.base_url}`;
      } else {
        details += `\n  ${providerKey} (${provider.name})`;
      }
    }

    if (!options.verbose) {
      details += `\n\nUse 'qcr list -f [provider]' to see models for a specific provider.`;
    }

    return {
      success: true,
      message,
      details: details.trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to list built-in providers',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Lists all available providers from configuration file
 * @param configFile - Configuration file to list from
 * @param options - Display options
 * @returns CommandResult with provider list
 */
export function listProviders(
  configFile: ConfigFile,
  options: { verbose?: boolean; all?: boolean; tree?: boolean; provider?: string; comprehensive?: boolean } = {}
): CommandResult {
  try {
    if (configFile.providers.length === 0) {
      return {
        success: true,
        message: 'No providers found',
        details: 'Add providers to your configuration file to get started.',
        exitCode: 0
      };
    }

    // If specific provider requested
    if (options.provider) {
      const provider = configFile.providers.find(p => p.provider.toLowerCase() === options.provider!.toLowerCase());

      // If comprehensive flag is set, merge with built-in providers
      if (options.comprehensive) {
        const providerKey = options.provider.toLowerCase();
        const builtinProvider = BUILTIN_PROVIDERS[providerKey as keyof typeof BUILTIN_PROVIDERS];

        if (!provider && !builtinProvider) {
          const availableProviders = [
            ...configFile.providers.map(p => p.provider),
            ...Object.keys(BUILTIN_PROVIDERS)
          ];
          return {
            success: false,
            message: `Provider '${options.provider}' not found`,
            details: `Available providers: ${[...new Set(availableProviders)].join(', ')}`,
            exitCode: 1
          };
        }

        // Merge models from both sources
        const allModels = new Set<string>();
        let baseUrl = '';
        let providerName = options.provider;  // Keep original case

        // Add models from configuration file
        if (provider) {
          provider.env.models.forEach(model => allModels.add(model.model));
          baseUrl = provider.env.base_url;
          // Keep original case from input, not from config
        }

        // Add models from built-in provider
        if (builtinProvider) {
          builtinProvider.models.forEach(model => allModels.add(model));
          if (!baseUrl) {
            baseUrl = builtinProvider.base_url;
          }
        }

        let message = `All available models for provider '${providerName}':`;
        let details = '';

        const sortedModels = Array.from(allModels).sort();
        for (const model of sortedModels) {
          details += `\n  ${model}`;
        }

        if (options.verbose) {
          details += `\n\nProvider details:`;
          details += `\n  Base URL: ${baseUrl}`;
          details += `\n  Total models: ${sortedModels.length}`;
          if (provider && builtinProvider) {
            details += `\n  Sources: Configuration file + Built-in definitions`;
          } else if (provider) {
            details += `\n  Source: Configuration file only`;
          } else {
            details += `\n  Source: Built-in definitions only`;
          }
        }

        return {
          success: true,
          message,
          details: details.trim(),
          exitCode: 0
        };
      }

      // Standard provider listing (configuration file only)
      if (!provider) {
        const availableProviders = configFile.providers.map(p => p.provider);
        return {
          success: false,
          message: `Provider '${options.provider}' not found`,
          details: `Available providers: ${availableProviders.join(', ')}`,
          exitCode: 1
        };
      }

      let message = `Models for provider '${provider.provider}':`;
      let details = '';

      for (const model of provider.env.models) {
        details += `\n  ${model.model}`;
      }

      if (options.verbose) {
        details += `\n\nProvider details:`;
        details += `\n  Base URL: ${provider.env.base_url}`;
        details += `\n  Total models: ${provider.env.models.length}`;
      }

      return {
        success: true,
        message,
        details: details.trim(),
        exitCode: 0
      };
    }

    // If --all or --tree flag is used, show tree structure
    if (options.all || options.tree) {
      let message = 'Available providers and models:';
      let details = '';

      if (options.comprehensive) {
        // Merge configuration file providers and built-in providers
        const allProviders = new Map<string, { models: Set<string>; baseUrl: string; source: string }>();

        // Add configuration file providers
        for (const provider of configFile.providers) {
          const providerKey = provider.provider.toLowerCase();
          if (!allProviders.has(providerKey)) {
            allProviders.set(providerKey, {
              models: new Set(),
              baseUrl: provider.env.base_url,
              source: 'config'
            });
          }
          const providerData = allProviders.get(providerKey)!;
          provider.env.models.forEach(model => providerData.models.add(model.model));
        }

        // Add built-in providers
        for (const [providerKey, builtinProvider] of Object.entries(BUILTIN_PROVIDERS)) {
          if (!allProviders.has(providerKey)) {
            allProviders.set(providerKey, {
              models: new Set(),
              baseUrl: builtinProvider.base_url,
              source: 'builtin'
            });
          }
          const providerData = allProviders.get(providerKey)!;
          builtinProvider.models.forEach(model => providerData.models.add(model));
          if (providerData.source === 'config') {
            providerData.source = 'both';
          }
        }

        // Display merged providers
        for (const [providerName, providerData] of Array.from(allProviders.entries()).sort()) {
          details += `\n${providerName}`;
          const sortedModels = Array.from(providerData.models).sort();
          for (const model of sortedModels) {
            details += `\n  └─ ${model}`;
          }
          if (options.verbose) {
            details += `\n     Base URL: ${providerData.baseUrl}`;
            details += `\n     Source: ${providerData.source === 'both' ? 'Configuration + Built-in' :
              providerData.source === 'config' ? 'Configuration file' : 'Built-in'}`;
          }
        }
      } else {
        // Show only configuration file providers
        for (const provider of configFile.providers) {
          details += `\n${provider.provider}`;
          for (const model of provider.env.models) {
            details += `\n  └─ ${model.model}`;
          }
          if (options.verbose) {
            details += `\n     Base URL: ${provider.env.base_url}`;
          }
        }
      }

      return {
        success: true,
        message,
        details: details.trim(),
        exitCode: 0
      };
    }

    // Default: just list provider names
    let message = 'Available providers:';
    let details = '';

    if (options.comprehensive) {
      // Merge configuration file providers and built-in providers
      const allProviders = new Map<string, { modelCount: number; baseUrl: string; source: string }>();

      // Add configuration file providers
      for (const provider of configFile.providers) {
        const providerKey = provider.provider.toLowerCase();
        allProviders.set(providerKey, {
          modelCount: provider.env.models.length,
          baseUrl: provider.env.base_url,
          source: 'config'
        });
      }

      // Add built-in providers
      for (const [providerKey, builtinProvider] of Object.entries(BUILTIN_PROVIDERS)) {
        if (allProviders.has(providerKey)) {
          // Provider exists in both, merge model counts
          const existing = allProviders.get(providerKey)!;
          const configModels = new Set(configFile.providers.find(p => p.provider.toLowerCase() === providerKey)?.env.models.map(m => m.model) || []);
          const builtinModels = new Set(builtinProvider.models);
          const mergedModels = new Set([...configModels, ...builtinModels]);
          existing.modelCount = mergedModels.size;
          existing.source = 'both';
        } else {
          // Only built-in provider
          allProviders.set(providerKey, {
            modelCount: builtinProvider.models.length,
            baseUrl: builtinProvider.base_url,
            source: 'builtin'
          });
        }
      }

      // Display merged providers
      for (const [providerName, providerData] of Array.from(allProviders.entries()).sort()) {
        if (options.verbose) {
          const sourceText = providerData.source === 'both' ? 'Configuration + Built-in' :
            providerData.source === 'config' ? 'Configuration file' : 'Built-in';
          details += `\n  ${providerName} - ${providerData.modelCount} models (${providerData.baseUrl}) [${sourceText}]`;
        } else {
          details += `\n  ${providerName}`;
        }
      }
    } else {
      // Show only configuration file providers
      for (const provider of configFile.providers) {
        if (options.verbose) {
          details += `\n  ${provider.provider} - ${provider.env.models.length} models (${provider.env.base_url})`;
        } else {
          details += `\n  ${provider.provider}`;
        }
      }
    }

    return {
      success: true,
      message,
      details: details.trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to list providers',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Implements the 'qcr list provider', 'qcr list -p', and 'qcr list -f' commands
 * Lists providers and their models from configuration file or built-in providers
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with provider list
 */
export async function listProviderCommand(options: ListCommandOptions = {}): Promise<CommandResult> {
  try {
    // If built-in providers flag is set, use built-in providers
    if (options.builtinProviders) {
      const builtinOptions: { verbose?: boolean; provider?: string } = {
        verbose: options.verbose || false
      };

      if (options.provider) {
        builtinOptions.provider = options.provider;
      }

      return listBuiltinProviders(builtinOptions);
    }

    // Otherwise, use configuration file providers
    // Discover and load configuration file
    let config: ConfigFile;
    let validation: any;
    let filePath: string;

    try {
      const result = await discoverAndLoadConfig(options.currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No configuration file found')) {
        return {
          success: false,
          message: 'No configuration file found',
          details: error.message,
          exitCode: 1
        };
      } else if (error instanceof Error && error.message.includes('Failed to load configuration file')) {
        return {
          success: false,
          message: 'Failed to load configuration file',
          details: error.message,
          exitCode: 1
        };
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // Check if configuration file is valid
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Configuration file validation failed',
        details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
        exitCode: 1
      };
    }

    // Use the listProviders function
    const providerOptions: { verbose?: boolean; all?: boolean; provider?: string; tree?: boolean; comprehensive?: boolean } = {
      verbose: options.verbose || false,
      all: options.all || false,
      tree: options.tree || false,
      comprehensive: options.all || false  // Enable comprehensive mode when --all is used
    };

    if (options.provider) {
      providerOptions.provider = options.provider;
      providerOptions.comprehensive = options.all || false;  // Enable comprehensive mode for specific provider with --all
    }

    const result = listProviders(config, providerOptions);

    // Add configuration file path to verbose output
    if (options.verbose && result.success && result.details) {
      result.details += `\n\nConfiguration file: ${filePath}`;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while listing providers',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the list command
 * @returns CommandResult with help information
 */
export function listCommandHelp(): CommandResult {
  const helpText = `
qcr list - List configurations and providers

USAGE:
  qcr list <subcommand> [options]
  qcr list -p [options]
  qcr list -f [provider]

SUBCOMMANDS:
  config                List all available configurations
  provider              List all available providers from configuration file
  -p                    Short form for provider listing from configuration file
  -f                    List built-in known providers

OPTIONS:
  -v, --verbose         Show detailed output including provider and model information
  -h, --help           Show this help message
  --all                 Show providers and models in tree structure (with -p)
  --tree                Show providers and models in tree structure (with provider)
  [provider_name]       Show models for specific provider (with -p or -f)

EXAMPLES:
  qcr list config              # List all configurations
  qcr list config -v           # List configurations with detailed information
  qcr list provider            # List all providers from configuration file
  qcr list -p                  # List all providers from configuration file (short form)
  qcr list -p --all            # List providers and models in tree structure
  qcr list provider --tree     # List providers and models in tree structure
  qcr list -p openai           # List models for openai provider from configuration file
  qcr list -f                  # List all built-in known providers
  qcr list -f openai           # List models for built-in openai provider
  qcr list provider -v         # List providers with detailed information

DESCRIPTION:
  The 'list' command provides various listing capabilities for configurations
  and providers. Use the appropriate subcommand to list the desired information.
  
  The 'config' subcommand shows all available configurations from the
  configuration file, highlighting the default configuration if one is set.
  
  The 'provider' subcommand (or '-p' short form) shows providers from the
  configuration file. Use --all or --tree to see a tree structure of providers and
  their models, or specify a provider name to see models for that provider.
  
  The '-f' flag shows built-in known providers (OpenAI, Azure, Anthropic, Google)
  with their predefined models. This doesn't require a configuration file.
  
  Use the verbose option (-v) to see additional details including base URLs
  and model counts for providers.
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
}

/**
 * Validates command arguments for the list command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseListCommandArgs(args: string[]): {
  valid: boolean;
  options?: ListCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: ListCommandOptions = {};
  let subcommand: string | undefined;
  let providerName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '-p') {
      // Short form for provider (from configuration file)
      options.shortForm = true;
      subcommand = 'provider';
    } else if (arg === '-f') {
      // Built-in providers flag
      options.builtinProviders = true;
      subcommand = 'provider';
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--tree') {
      options.tree = true;
    } else if (arg.startsWith('-')) {
      return {
        valid: false,
        error: `Unknown option: ${arg}. Use --help for usage information.`
      };
    } else {
      // This could be a subcommand or provider name
      if (subcommand === undefined) {
        subcommand = arg;
      } else if (subcommand === 'provider' && providerName === undefined) {
        providerName = arg;
      } else {
        return {
          valid: false,
          error: `Too many arguments. Unexpected argument: ${arg}`
        };
      }
    }
  }

  // Validate subcommand
  if (subcommand && !['config', 'provider'].includes(subcommand)) {
    return {
      valid: false,
      error: `Unknown subcommand: ${subcommand}. Available subcommands: config, provider`
    };
  }

  // Validate --all flag usage
  if (options.all && subcommand !== 'provider') {
    return {
      valid: false,
      error: '--all flag can only be used with provider subcommand'
    };
  }

  // Validate --tree flag usage
  if (options.tree && subcommand !== 'provider') {
    return {
      valid: false,
      error: '--tree flag can only be used with provider subcommand'
    };
  }

  // Validate --all flag usage with built-in providers
  if (options.all && options.builtinProviders) {
    return {
      valid: false,
      error: '--all flag cannot be used with -f (built-in providers) flag'
    };
  }

  // Validate --tree flag usage with built-in providers
  if (options.tree && options.builtinProviders) {
    return {
      valid: false,
      error: '--tree flag cannot be used with -f (built-in providers) flag'
    };
  }

  // Validate provider name usage
  if (providerName && subcommand !== 'provider') {
    return {
      valid: false,
      error: 'Provider name can only be specified with provider subcommand'
    };
  }

  if (subcommand !== undefined) {
    options.subcommand = subcommand;
  }

  if (providerName !== undefined) {
    options.provider = providerName;
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the list command from CLI
 * @param args - Command line arguments (excluding 'qcr list')
 * @returns Promise<CommandResult>
 */
export async function handleListCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseListCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
  }

  if (parseResult.showHelp) {
    return listCommandHelp();
  }

  const options = parseResult.options!;

  // Handle different subcommands
  switch (options.subcommand) {
    case 'config':
      return await listConfigCommand(options);
    case 'provider':
      return await listProviderCommand(options);
    case undefined:
      // No subcommand provided, show help
      return listCommandHelp();
    default:
      return {
        success: false,
        message: `Unknown subcommand: ${options.subcommand}`,
        details: 'Use "qcr list --help" to see available subcommands.',
        exitCode: 1
      };
  }
}

/**
 * Options for the chk command
 */
export interface ChkCommandOptions {
  /** Configuration name to validate (optional - validates all if not provided) */
  configName?: string;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Whether to test actual API connectivity */
  testApi?: boolean;
}

/**
 * Validation result for a single configuration
 */
export interface ConfigValidationResult {
  /** Configuration name */
  configName: string;
  /** Whether the configuration is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Provider information if found */
  provider?: {
    name: string;
    baseUrl: string;
    modelCount: number;
  };
  /** Model information if found */
  model?: {
    name: string;
    isSupported: boolean;
  };
}

/**
 * Validates a specific configuration with API call
 * @param configName - Name of configuration to validate
 * @param configFile - Configuration file to validate against
 * @param testApi - Whether to test actual API connectivity (default: false)
 * @returns Promise<ConfigValidationResult> with validation details
 */
export async function validateConfigurationWithApi(
  configName: string, 
  configFile: ConfigFile, 
  testApi: boolean = false
): Promise<ConfigValidationResult> {
  // First do static validation
  const result = validateConfiguration(configName, configFile);
  
  // If static validation failed or API testing is disabled, return early
  if (!result.isValid || !testApi) {
    return result;
  }

  // Get the configuration and provider for API testing
  const configEntry = configFile.configs
    .flatMap(c => c.config)
    .find(c => c.name === configName);
  
  const provider = configFile.providers.find(p => p.provider === configEntry!.provider);
  
  if (!provider || !configEntry) {
    return result;
  }

  // Test API connectivity
  try {
    const response = await fetch(`${provider.env.base_url}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.env.api_key}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      result.isValid = false;
      result.errors.push(`API test failed: ${response.status} ${response.statusText}`);
      return result;
    }

    const data = await response.json() as any;
    
    // Check if the configured model is available in the API response
    if (data && data.data && Array.isArray(data.data)) {
      const availableModels = data.data.map((model: any) => model.id);
      if (!availableModels.includes(configEntry.model)) {
        result.isValid = false;
        result.errors.push(`Model '${configEntry.model}' not available in API response`);
      }
    }
    
  } catch (error) {
    result.isValid = false;
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        result.errors.push(`API test timeout: Unable to connect to ${provider.env.base_url}`);
      } else {
        result.errors.push(`API test failed: ${error.message}`);
      }
    } else {
      result.errors.push(`API test failed: Unknown error`);
    }
  }

  return result;
}

/**
 * Validates a specific configuration (static validation only)
 * @param configName - Name of configuration to validate
 * @param configFile - Configuration file to validate against
 * @returns ConfigValidationResult with validation details
 */
export function validateConfiguration(configName: string, configFile: ConfigFile): ConfigValidationResult {
  const result: ConfigValidationResult = {
    configName,
    isValid: true,
    errors: [],
    warnings: []
  };

  // Find the configuration entry
  const configEntry = configFile.configs
    .flatMap(c => c.config)
    .find(c => c.name === configName);

  if (!configEntry) {
    result.isValid = false;
    result.errors.push(`Configuration '${configName}' not found`);
    return result;
  }

  // Validate provider exists
  const provider = configFile.providers.find(p => p.provider === configEntry.provider);
  if (!provider) {
    result.isValid = false;
    result.errors.push(`Provider '${configEntry.provider}' not found in providers section`);
  } else {
    result.provider = {
      name: provider.provider,
      baseUrl: provider.env.base_url,
      modelCount: provider.env.models.length
    };

    // Validate model exists in provider
    const model = provider.env.models.find(m => m.model === configEntry.model);
    if (!model) {
      result.isValid = false;
      result.errors.push(`Model '${configEntry.model}' not found in provider '${configEntry.provider}'`);
    } else {
      result.model = {
        name: model.model,
        isSupported: true
      };
    }

    // Check for API key configuration
    if (!provider.env.api_key) {
      result.warnings.push(`No API key configured for provider '${configEntry.provider}'`);
    }

    // Check for base URL configuration
    if (!provider.env.base_url) {
      result.warnings.push(`No base URL configured for provider '${configEntry.provider}'`);
    }

    // Check if provider has any models
    if (provider.env.models.length === 0) {
      result.warnings.push(`Provider '${configEntry.provider}' has no models configured`);
    }
  }

  // Note: Being the default configuration is not a warning condition
  // It's normal and expected behavior, so we don't add any warning for this

  return result;
}

/**
 * Implements the 'qcr chk [config_name]' command
 * Validates a configuration by name, or all configurations if no name provided
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with validation results
 */
export async function chkCommand(options: ChkCommandOptions = {}): Promise<CommandResult> {
  try {
    // Discover and load configuration file
    let config: ConfigFile;
    let validation: any;
    let filePath: string;

    try {
      const result = await discoverAndLoadConfig(options.currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No configuration file found')) {
        return {
          success: false,
          message: 'No configuration file found',
          details: error.message,
          exitCode: 1
        };
      } else if (error instanceof Error && error.message.includes('Failed to load configuration file')) {
        return {
          success: false,
          message: 'Failed to load configuration file',
          details: error.message,
          exitCode: 1
        };
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // Check if configuration file is valid
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Configuration file validation failed',
        details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
        exitCode: 1
      };
    }

    // Get all available configurations
    const availableConfigs = getAllConfigurationNames(config);

    if (availableConfigs.length === 0) {
      return {
        success: false,
        message: 'No configurations found',
        details: 'Add configurations to your configuration file to validate them.',
        exitCode: 1
      };
    }

    // Determine which configurations to validate
    let configsToValidate: string[];
    if (options.configName) {
      if (!availableConfigs.includes(options.configName)) {
        return {
          success: false,
          message: `Configuration '${options.configName}' does not exist`,
          details: `Available configurations: ${availableConfigs.join(', ')}`,
          exitCode: 1
        };
      }
      configsToValidate = [options.configName];
    } else {
      configsToValidate = availableConfigs;
    }

    // Validate configurations
    const validationResults: ConfigValidationResult[] = [];
    for (const configName of configsToValidate) {
      const result = await validateConfigurationWithApi(configName, config, options.testApi || false);
      validationResults.push(result);
    }

    // Build result message
    const validConfigs = validationResults.filter(r => r.isValid);
    const invalidConfigs = validationResults.filter(r => !r.isValid);

    let message: string;
    let details = '';
    let success = true;

    if (options.configName) {
      // Single configuration validation
      const result = validationResults[0];
      if (!result) {
        return {
          success: false,
          message: 'Internal error: validation result not found',
          exitCode: 1
        };
      }

      if (result.isValid) {
        message = `Configuration '${result.configName}' is valid`;
        if (result.warnings.length > 0) {
          details += `Warnings:\n${result.warnings.map(w => `  - ${w}`).join('\n')}`;
        }
      } else {
        message = `Configuration '${result.configName}' is invalid`;
        details += `Errors:\n${result.errors.map(e => `  - ${e}`).join('\n')}`;
        if (result.warnings.length > 0) {
          details += `\n\nWarnings:\n${result.warnings.map(w => `  - ${w}`).join('\n')}`;
        }
        success = false;
      }

      // Add detailed information in verbose mode
      if (options.verbose) {
        if (result.provider) {
          details += `\n\nProvider details:`;
          details += `\n  Name: ${result.provider.name}`;
          details += `\n  Base URL: ${result.provider.baseUrl}`;
          details += `\n  Available models: ${result.provider.modelCount}`;
        }
        if (result.model) {
          details += `\n\nModel details:`;
          details += `\n  Name: ${result.model.name}`;
          details += `\n  Supported: ${result.model.isSupported ? 'Yes' : 'No'}`;
        }
        details += `\n\nConfiguration file: ${filePath}`;
      }
    } else {
      // Multiple configuration validation
      if (invalidConfigs.length === 0) {
        message = `All ${validConfigs.length} configurations are valid`;
      } else {
        const invalidCount = invalidConfigs.length;
        const totalCount = validationResults.length;
        if (invalidCount === 1) {
          message = `${invalidCount} of ${totalCount} configurations is invalid`;
        } else {
          message = `${invalidCount} of ${totalCount} configurations are invalid`;
        }
        success = false;
      }

      // Get default configuration for marking
      const defaultConfig = getCurrentDefaultConfiguration(config);

      // Build compact configuration list on same line
      const configList: string[] = [];
      const errorDetails: string[] = [];
      
      for (const result of validationResults) {
        const status = result.isValid ? '✓' : '✗';
        const warningCount = result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : '';
        const defaultMarker = result.configName === defaultConfig ? ' (default)' : '';
        configList.push(`${status} ${result.configName}${defaultMarker}${warningCount}`);

        // Collect error details for invalid configurations
        if (!result.isValid && result.errors.length > 0) {
          errorDetails.push(`✗ ${result.configName}\nErrors: ${result.errors.join(', ')}`);
        }
        
        // Collect warning details if verbose mode
        if (options.verbose && result.warnings.length > 0) {
          errorDetails.push(`${status} ${result.configName}\nWarnings: ${result.warnings.join(', ')}`);
        }
      }
      
      // Add the compact configuration list (each on a new line with indentation)
      // All items have two spaces indentation
      if (configList.length > 0) {
        details += '\n  ' + configList.join('\n  ');
      }
      
      // Add error details after the configuration list
      if (errorDetails.length > 0) {
        details += '\n' + errorDetails.join('\n');
      }

      if (options.verbose) {
        details += `\n\nConfiguration file: ${filePath}`;
      }
    }

    return {
      success,
      message,
      details: details.trim(),
      exitCode: success ? 0 : 1
    };
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while validating configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the chk command
 * @returns CommandResult with help information
 */
export function chkCommandHelp(): CommandResult {
  const helpText = `
qcr chk - Validate configuration

USAGE:
  qcr chk [config_name]

ARGUMENTS:
  config_name    Name of the configuration to validate (optional)
                 If not provided, validates all configurations

OPTIONS:
  -v, --verbose  Show detailed validation information
  --test-api     Test actual API connectivity (slower but more thorough)
  -h, --help     Show this help message

EXAMPLES:
  qcr chk                    # Validate all configurations (static validation only)
  qcr chk openai-gpt4        # Validate specific configuration
  qcr chk azure-gpt35 -v     # Validate configuration with detailed output
  qcr chk --test-api         # Validate all configurations with API testing

DESCRIPTION:
  The 'chk' command validates configurations to ensure they are properly
  set up and can be used successfully. It performs the following checks:
  
  Static validation (default):
  - Configuration exists in the configuration file
  - Referenced provider exists in the providers section
  - Referenced model exists in the provider's model list
  - Provider has required settings (API key, base URL)
  
  API validation (with --test-api):
  - All static validation checks
  - Actual API connectivity test
  - Verify model availability through API call
  - Provider has required settings (API key, base URL)
  - Provider has at least one model configured
  
  The command will report errors for critical issues that prevent the
  configuration from working, and warnings for potential issues or
  missing optional settings.
  
  When validating all configurations, the command will show a summary
  of validation results and exit with code 1 if any configuration is invalid.
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
}

/**
 * Validates command arguments for the chk command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseChkCommandArgs(args: string[]): {
  valid: boolean;
  options?: ChkCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: ChkCommandOptions = {};
  let configName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--test-api') {
      options.testApi = true;
    } else if (arg.startsWith('-')) {
      return {
        valid: false,
        error: `Unknown option: ${arg}. Use --help for usage information.`
      };
    } else {
      // This should be the configuration name
      if (configName !== undefined) {
        return {
          valid: false,
          error: `Too many arguments. Expected at most one configuration name, got: ${configName}, ${arg}`
        };
      }
      configName = arg;
    }
  }

  if (configName !== undefined) {
    options.configName = configName;
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the chk command from CLI
 * @param args - Command line arguments (excluding 'qcr chk')
 * @returns Promise<CommandResult>
 */
export async function handleChkCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseChkCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
  }

  if (parseResult.showHelp) {
    return chkCommandHelp();
  }

  return await chkCommand(parseResult.options);
}/**
 * 
Options for the router command
 */
export interface RouterCommandOptions {
  /** Provider name */
  provider: string;
  /** Model name */
  model: string;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
}

/**
 * Implements the '/router [provider] [model]' command
 * Sets configuration via provider and model parameters
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with execution status and message
 */
export async function routerCommand(options: RouterCommandOptions): Promise<CommandResult> {
  try {
    const { provider: inputProvider, model: inputModel } = options;
    const providerKey = inputProvider.toLowerCase();

    // First, try to find a matching configuration in the config file
    let config: ConfigFile;
    let validation: any;
    let filePath: string | undefined;
    let hasConfigFile = true;

    try {
      const result = await discoverAndLoadConfig(options.currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;

      // Check if configuration file is valid
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Configuration file validation failed',
          details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
          exitCode: 1
        };
      }
    } catch (error) {
      // No config file found, we'll use built-in providers only
      hasConfigFile = false;
      config = { configs: [], providers: [] };
    }

    // Look for matching provider and model in configuration file
    let matchingConfig: { name: string; provider: string; model: string } | undefined;
    let configProvider: any;

    if (hasConfigFile) {
      // Find provider in config file (case-insensitive)
      configProvider = config.providers.find(p => p.provider.toLowerCase() === providerKey);

      if (configProvider) {
        // Check if the model exists in this provider
        const modelExists = configProvider.env.models.some((m: any) => m.model.toLowerCase() === inputModel.toLowerCase());

        if (modelExists) {
          // Look for existing configuration that matches this provider/model combination
          matchingConfig = config.configs
            .flatMap(c => c.config)
            .find(c => c.provider.toLowerCase() === providerKey && c.model.toLowerCase() === inputModel.toLowerCase());
        }
      }
    }

    // Check built-in providers
    const builtinProvider = BUILTIN_PROVIDERS[providerKey as keyof typeof BUILTIN_PROVIDERS];
    let builtinModelExists = false;

    if (builtinProvider) {
      builtinModelExists = builtinProvider.models.some(m => m.toLowerCase() === inputModel.toLowerCase());
    }

    // Determine the best match and set environment variables
    let resolvedProvider: string;
    let resolvedModel: string;
    let baseUrl: string;
    let source: string;

    if (matchingConfig) {
      // Use existing configuration
      const resolutionResult = resolveConfigurationByName(matchingConfig.name, config);

      if (!resolutionResult.success) {
        return {
          success: false,
          message: `Failed to activate configuration '${matchingConfig.name}'`,
          details: resolutionResult.error,
          exitCode: 1
        };
      }

      resolvedProvider = matchingConfig.provider;
      resolvedModel = matchingConfig.model;
      baseUrl = configProvider.env.base_url;
      source = `configuration '${matchingConfig.name}'`;
    } else if (configProvider && configProvider.env.models.some((m: any) => m.model.toLowerCase() === inputModel.toLowerCase())) {
      // Use config file provider with direct model match
      const exactModel = configProvider.env.models.find((m: any) => m.model.toLowerCase() === inputModel.toLowerCase());

      // Set environment variables directly
      process.env['OPENAI_API_KEY'] = configProvider.env.api_key;
      process.env['OPENAI_BASE_URL'] = configProvider.env.base_url;
      process.env['OPENAI_MODEL'] = exactModel.model;

      resolvedProvider = configProvider.provider;
      resolvedModel = exactModel.model;
      baseUrl = configProvider.env.base_url;
      source = 'configuration file provider';
    } else if (builtinProvider && builtinModelExists) {
      // Use built-in provider
      const exactModel = builtinProvider.models.find(m => m.toLowerCase() === inputModel.toLowerCase());

      if (!exactModel) {
        return {
          success: false,
          message: `Model '${inputModel}' not found in built-in provider '${inputProvider}'`,
          details: `Available models: ${builtinProvider.models.join(', ')}`,
          exitCode: 1
        };
      }

      // Set environment variables for built-in provider
      // Note: API key needs to be set by user separately
      process.env['OPENAI_BASE_URL'] = builtinProvider.base_url;
      process.env['OPENAI_MODEL'] = exactModel;

      resolvedProvider = inputProvider;
      resolvedModel = exactModel;
      baseUrl = builtinProvider.base_url;
      source = `built-in provider '${builtinProvider.name}'`;

      // Warning about API key
      if (!process.env['OPENAI_API_KEY']) {
        return {
          success: false,
          message: `API key not set for built-in provider '${inputProvider}'`,
          details: `Please set the OPENAI_API_KEY environment variable or configure this provider in your configuration file.`,
          exitCode: 1
        };
      }
    } else {
      // Provider or model not found
      const availableProviders: string[] = [];
      const availableModels: string[] = [];

      // Collect available providers from config file
      if (hasConfigFile) {
        availableProviders.push(...config.providers.map(p => p.provider));
      }

      // Collect available providers from built-in
      availableProviders.push(...Object.keys(BUILTIN_PROVIDERS));

      // If provider exists, collect available models
      if (configProvider) {
        availableModels.push(...configProvider.env.models.map((m: any) => m.model));
      }
      if (builtinProvider) {
        availableModels.push(...builtinProvider.models);
      }

      const uniqueProviders = [...new Set(availableProviders)];
      const uniqueModels = [...new Set(availableModels)];

      if (uniqueModels.length > 0) {
        return {
          success: false,
          message: `Model '${inputModel}' not found in provider '${inputProvider}'`,
          details: `Available models for '${inputProvider}': ${uniqueModels.join(', ')}`,
          exitCode: 1
        };
      } else {
        return {
          success: false,
          message: `Provider '${inputProvider}' not found`,
          details: `Available providers: ${uniqueProviders.join(', ')}`,
          exitCode: 1
        };
      }
    }

    // Validate that environment variables were set correctly
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return {
        success: false,
        message: 'Environment variables validation failed after router activation',
        details: `Errors: ${envValidation.errors.join(', ')}`,
        exitCode: 1
      };
    }

    // Build success message
    let message = `Successfully activated provider '${resolvedProvider}' with model '${resolvedModel}'`;
    let details = `Source: ${source}`;

    if (options.verbose) {
      details += `\nProvider: ${resolvedProvider}`;
      details += `\nModel: ${resolvedModel}`;
      details += `\nBase URL: ${baseUrl}`;
      details += `\nEnvironment variables set:`;
      details += `\n  OPENAI_API_KEY: ${process.env['OPENAI_API_KEY']?.substring(0, 8)}...`;
      details += `\n  OPENAI_BASE_URL: ${process.env['OPENAI_BASE_URL']}`;
      details += `\n  OPENAI_MODEL: ${process.env['OPENAI_MODEL']}`;

      if (hasConfigFile && filePath) {
        details += `\nConfiguration file: ${filePath}`;
      }

      if (envValidation.warnings.length > 0) {
        details += `\nWarnings: ${envValidation.warnings.join(', ')}`;
      }
    }

    return {
      success: true,
      message,
      details,
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while executing router command',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the router command
 * @returns CommandResult with help information
 */
export function routerCommandHelp(): CommandResult {
  const helpText = `
/router - Quick configuration via provider/model

USAGE:
  /router <provider> <model>

ARGUMENTS:
  provider       Name of the provider (required)
  model          Name of the model (required)

OPTIONS:
  -v, --verbose  Show detailed output including environment variables
  -h, --help     Show this help message

EXAMPLES:
  /router openai gpt-4           # Use OpenAI GPT-4
  /router azure gpt-35-turbo     # Use Azure GPT-3.5 Turbo
  /router anthropic claude-3-opus # Use Anthropic Claude 3 Opus
  /router google gemini-pro -v    # Use Google Gemini Pro with verbose output

DESCRIPTION:
  The '/router' command provides a quick way to activate a provider and model
  combination without needing to know the specific configuration name.
  
  The command searches for the provider/model combination in the following order:
  1. Existing named configuration in the configuration file
  2. Direct provider/model match in configuration file providers
  3. Built-in provider definitions (OpenAI, Azure, Anthropic, Google)
  
  For built-in providers, you must have the OPENAI_API_KEY environment variable
  set, or configure the provider in your configuration file with API credentials.
  
  The command is case-insensitive for both provider and model names, but will
  preserve the exact case from the configuration when setting environment variables.
  
  Available built-in providers:
  - openai: OpenAI models (gpt-4, gpt-3.5-turbo, etc.)
  - azure: Azure OpenAI models (gpt-4, gpt-35-turbo, etc.)
  - anthropic: Anthropic models (claude-3-opus, claude-3-sonnet, etc.)
  - google: Google AI models (gemini-pro, gemini-1.5-pro, etc.)
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
}

/**
 * Validates command arguments for the router command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseRouterCommandArgs(args: string[]): {
  valid: boolean;
  options?: RouterCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: Partial<RouterCommandOptions> = {};
  let provider: string | undefined;
  let model: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('-')) {
      return {
        valid: false,
        error: `Unknown option: ${arg}. Use --help for usage information.`
      };
    } else {
      // This should be provider or model
      if (provider === undefined) {
        provider = arg;
      } else if (model === undefined) {
        model = arg;
      } else {
        return {
          valid: false,
          error: `Too many arguments. Expected provider and model, got: ${provider}, ${model}, ${arg}`
        };
      }
    }
  }

  if (provider === undefined) {
    return {
      valid: false,
      error: 'Provider name is required. Use --help for usage information.'
    };
  }

  if (model === undefined) {
    return {
      valid: false,
      error: 'Model name is required. Use --help for usage information.'
    };
  }

  options.provider = provider;
  options.model = model;

  return {
    valid: true,
    options: options as RouterCommandOptions
  };
}

/**
 * Main entry point for the router command from CLI
 * @param args - Command line arguments (excluding '/router')
 * @returns Promise<CommandResult>
 */
export async function handleRouterCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseRouterCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
  }

  if (parseResult.showHelp) {
    return routerCommandHelp();
  }

  return await routerCommand(parseResult.options!);
}