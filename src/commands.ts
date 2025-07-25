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
import { discoverAndLoadConfig, saveConfigFile } from './persistence';
import { validateEnvironmentVariables } from './environment';
import { ConfigFile } from './types';
import { spawn, ChildProcess } from 'child_process';

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
 * Options for the use command
 */
export interface UseCommandOptions {
  /** Configuration name to use (optional - uses default if not provided) */
  configName?: string;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
}

/**
 * Implements the 'qcr use [config_name]' command
 * Activates a configuration by name, or uses default if no name provided
 * 
 * @param options - Command options
 * @returns CommandResult with execution status and message
 */
export async function useCommand(options: UseCommandOptions = {}): Promise<CommandResult> {
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

    // Determine which configuration to use
    let targetConfigName: string;
    let useDefault = false;

    if (options.configName) {
      // Use specified configuration
      targetConfigName = options.configName;
    } else {
      // Use default configuration
      const defaultConfig = getCurrentDefaultConfiguration(config);
      if (!defaultConfig) {
        const availableConfigs = getAllConfigurationNames(config);
        return {
          success: false,
          message: 'No default configuration set and no configuration name provided',
          details: `Available configurations: ${availableConfigs.join(', ')}\nUse 'qcr set-default [config_name]' to set a default configuration.`,
          exitCode: 1
        };
      }
      targetConfigName = defaultConfig;
      useDefault = true;
    }

    // Resolve the configuration
    const resolutionResult = resolveConfigurationByName(targetConfigName, config);

    if (!resolutionResult.success) {
      return {
        success: false,
        message: `Failed to activate configuration '${targetConfigName}'`,
        details: resolutionResult.error,
        exitCode: 1
      };
    }

    // Validate that environment variables were set correctly
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return {
        success: false,
        message: 'Environment variables validation failed after configuration activation',
        details: `Errors: ${envValidation.errors.join(', ')}`,
        exitCode: 1
      };
    }

    // Build success message
    const configSource = useDefault ? 'default configuration' : 'specified configuration';
    const provider = resolutionResult.provider?.provider || 'unknown';
    const model = resolutionResult.configEntry?.model || 'unknown';

    let message = `Successfully activated ${configSource} '${targetConfigName}'`;
    let details = `Provider: ${provider}, Model: ${model}`;

    if (options.verbose) {
      details += `\nConfiguration file: ${filePath}`;
      details += `\nEnvironment variables set:`;
      details += `\n  OPENAI_API_KEY: ${resolutionResult.environmentVariables?.OPENAI_API_KEY?.substring(0, 8)}...`;
      details += `\n  OPENAI_BASE_URL: ${resolutionResult.environmentVariables?.OPENAI_BASE_URL}`;
      details += `\n  OPENAI_MODEL: ${resolutionResult.environmentVariables?.OPENAI_MODEL}`;

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
      message: 'Unexpected error occurred while executing use command',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the use command
 * @returns CommandResult with help information
 */
export function useCommandHelp(): CommandResult {
  const helpText = `
qcr use - Activate a configuration

USAGE:
  qcr use [config_name]

ARGUMENTS:
  config_name    Name of the configuration to activate (optional)
                 If not provided, uses the default configuration

OPTIONS:
  -v, --verbose  Show detailed output including environment variables
  -h, --help     Show this help message

EXAMPLES:
  qcr use                    # Use default configuration
  qcr use openai-gpt4        # Use specific configuration
  qcr use azure-gpt35 -v     # Use configuration with verbose output

DESCRIPTION:
  The 'use' command activates a configuration by setting the required
  environment variables (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL).
  
  If no configuration name is provided, it will use the default configuration
  if one is set. You can set a default configuration using:
  
    qcr set-default [config_name]
  
  The command will validate the configuration and ensure all required
  environment variables are properly set before completing.
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
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
 * Main entry point for the use command from CLI
 * @param args - Command line arguments (excluding 'qcr use')
 * @returns Promise<CommandResult>
 */
export async function handleUseCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseUseCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
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
      return {
        success: false,
        message: 'Cannot launch Qwen Code: required environment variables are not set',
        details: `Missing or invalid environment variables: ${envValidation.errors.join(', ')}\n\nUse 'qcr use [config_name]' to activate a configuration first.`,
        exitCode: 1
      };
    }

    // Show warnings if any
    if (envValidation.warnings.length > 0 && options.verbose) {
      console.warn(`Warnings: ${envValidation.warnings.join(', ')}`);
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

    // Launch Qwen Code process
    return new Promise<CommandResult>((resolve) => {
      const child: ChildProcess = spawn('qwen', qwenArgs, {
        stdio: 'inherit', // Pass through stdin/stdout/stderr
        env: process.env, // Use current environment (including our set variables)
        shell: true // Use shell to handle command resolution
      });

      // Handle process errors
      child.on('error', (error) => {
        if (error.message.includes('ENOENT')) {
          resolve({
            success: false,
            message: 'Failed to launch Qwen Code: command not found',
            details: 'Make sure Qwen Code is installed and the "qwen" command is available in your PATH.\n\nInstall Qwen Code from: https://github.com/QwenLM/qwen-code',
            exitCode: 127
          });
        } else {
          resolve({
            success: false,
            message: 'Failed to launch Qwen Code',
            details: error.message,
            exitCode: 1
          });
        }
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        if (signal) {
          resolve({
            success: true,
            message: `Qwen Code terminated by signal ${signal}`,
            exitCode: 128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 1)
          });
        } else {
          const exitCode = code || 0;
          resolve({
            success: exitCode === 0,
            message: exitCode === 0 ? 'Qwen Code completed successfully' : `Qwen Code exited with code ${exitCode}`,
            exitCode
          });
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
    return {
      success: false,
      message: 'Unexpected error occurred while executing run command',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the run command
 * @returns CommandResult with help information
 */
export function runCommandHelp(): CommandResult {
  const helpText = `
qcr run - Launch Qwen Code with active configuration

USAGE:
  qcr run [additional_args...]

ARGUMENTS:
  additional_args    Additional arguments to pass to the qwen command (optional)

OPTIONS:
  -v, --verbose      Show detailed output including environment variables
  -h, --help         Show this help message

EXAMPLES:
  qcr run                           # Launch Qwen Code with current configuration
  qcr run --help                    # Show Qwen Code help (passes --help to qwen)
  qcr run -v                        # Launch with verbose output
  qcr run --model-config custom.json  # Pass custom arguments to qwen

DESCRIPTION:
  The 'run' command launches Qwen Code using the currently active configuration.
  It requires that environment variables are properly set using 'qcr use' first.
  
  The command validates that all required environment variables are present:
  - OPENAI_API_KEY: API key for the service provider
  - OPENAI_BASE_URL: Base URL for the API endpoint  
  - OPENAI_MODEL: Model identifier to use
  
  Any additional arguments provided will be passed through to the underlying
  'qwen' command. The process will inherit stdin/stdout/stderr, allowing for
  interactive use.
  
  Signal handling (SIGINT/SIGTERM) is properly forwarded to the child process.

PREREQUISITES:
  - Qwen Code must be installed and available as 'qwen' command
  - A configuration must be activated using 'qcr use [config_name]'
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
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
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
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

    // Validate that the specified configuration exists
    const availableConfigs = getAllConfigurationNames(config);
    if (!availableConfigs.includes(options.configName)) {
      return {
        success: false,
        message: `Configuration '${options.configName}' does not exist`,
        details: `Available configurations: ${availableConfigs.join(', ')}`,
        exitCode: 1
      };
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
      return {
        success: false,
        message: 'Failed to save configuration file',
        details: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1
      };
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

    return {
      success: true,
      message,
      details,
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while executing set-default command',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the set-default command
 * @returns CommandResult with help information
 */
export function setDefaultCommandHelp(): CommandResult {
  const helpText = `
qcr set-default - Set default configuration

USAGE:
  qcr set-default <config_name>

ARGUMENTS:
  config_name    Name of the configuration to set as default (required)

OPTIONS:
  -v, --verbose  Show detailed output including configuration file path
  -h, --help     Show this help message

EXAMPLES:
  qcr set-default openai-gpt4    # Set openai-gpt4 as default configuration
  qcr set-default azure-gpt35 -v # Set azure-gpt35 as default with verbose output

DESCRIPTION:
  The 'set-default' command sets a configuration as the default configuration
  in the configuration file. The default configuration will be used when
  running 'qcr use' without specifying a configuration name.
  
  The specified configuration must exist in the configuration file. Use
  'qcr list config' to see all available configurations.
  
  The command updates the configuration file by setting the 'default_config'
  section to point to the specified configuration name.
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
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
        error: `Unknown option: ${arg}. Use --help for usage information.`
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
      error: 'Configuration name is required. Use --help for usage information.'
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
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
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
 * Validates a specific configuration
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

  // Check if this is the default configuration
  const isDefault = configFile.default_config?.some(dc => dc.name === configName);
  if (isDefault) {
    result.warnings.push(`This is the default configuration`);
  }

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
      validationResults.push(validateConfiguration(configName, config));
    }

    // Build result message
    const validConfigs = validationResults.filter(r => r.isValid);
    const invalidConfigs = validationResults.filter(r => !r.isValid);
    const configsWithWarnings = validationResults.filter(r => r.warnings.length > 0);

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
        if (configsWithWarnings.length > 0) {
          details += `${configsWithWarnings.length} configuration(s) have warnings`;
        }
      } else {
        message = `${invalidConfigs.length} of ${validationResults.length} configurations are invalid`;
        success = false;
      }

      // List validation results
      for (const result of validationResults) {
        const status = result.isValid ? '✓' : '✗';
        const warningCount = result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : '';
        details += `\n  ${status} ${result.configName}${warningCount}`;
        
        if (options.verbose || !result.isValid) {
          if (result.errors.length > 0) {
            details += `\n    Errors: ${result.errors.join(', ')}`;
          }
          if (result.warnings.length > 0 && options.verbose) {
            details += `\n    Warnings: ${result.warnings.join(', ')}`;
          }
        }
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
  -h, --help     Show this help message

EXAMPLES:
  qcr chk                    # Validate all configurations
  qcr chk openai-gpt4        # Validate specific configuration
  qcr chk azure-gpt35 -v     # Validate configuration with detailed output

DESCRIPTION:
  The 'chk' command validates configurations to ensure they are properly
  set up and can be used successfully. It performs the following checks:
  
  - Configuration exists in the configuration file
  - Referenced provider exists in the providers section
  - Referenced model exists in the provider's model list
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
}