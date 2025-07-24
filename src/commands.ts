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
import { discoverAndLoadConfig } from './persistence';
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