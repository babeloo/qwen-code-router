/**
 * 'use' command implementation for Qwen Code Router CLI
 */

import {
  resolveConfigurationByName,
  getAllConfigurationNames,
  getCurrentDefaultConfiguration
} from '../resolver';
import { loadConfigFile } from '../command-utils';
import { validateEnvironmentVariables } from '../environment';
import {
  createErrorResult,
  createSuccessResult,
  configValidationError,
  configNotFoundError,
  noDefaultConfigError,
  unexpectedError,
  invalidArgumentsError,
  environmentValidationError
} from '../errors';
import { CommandResult } from '../commands';

/**
 * Options for the use command
 */
export interface UseCommandOptions {
  /** Configuration name to use (optional - uses default if not provided) */
  configName?: string | undefined;
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
    // Load configuration file
    const loadResult = await loadConfigFile(options.currentDir);
    
    if (!loadResult.success) {
      return loadResult.errorResult;
    }
    
    const { config, validation, filePath } = loadResult;

    // Check if configuration file is valid
    if (!validation.isValid) {
      return createErrorResult(configValidationError(validation.errors, validation.warnings));
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
        return createErrorResult(noDefaultConfigError(availableConfigs));
      }
      targetConfigName = defaultConfig;
      useDefault = true;
    }

    // Resolve the configuration
    const resolutionResult = resolveConfigurationByName(targetConfigName, config);

    if (!resolutionResult.success) {
      const availableConfigs = getAllConfigurationNames(config);
      return createErrorResult(configNotFoundError(targetConfigName, availableConfigs));
    }

    // Validate that environment variables were set correctly
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return createErrorResult(environmentValidationError(envValidation.errors, envValidation.warnings));
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
        details += `\nWarnings:\n${envValidation.warnings.map(w => `  ⚠ ${w}`).join('\n')}`;
      }
    }

    return createSuccessResult(message, details);
  } catch (error) {
    return createErrorResult(unexpectedError('use command execution', error));
  }
}

/**
 * Shows help information for the use command
 * @returns CommandResult with help information
 */
export function useCommandHelp(): CommandResult {
  // Import here to avoid circular dependency
  const { getUseCommandHelp } = require('../help');
  return getUseCommandHelp();
}

/**
 * Validates command arguments for the use command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseUseCommandArgs(args: string[]): {
  valid: boolean;
  options?: UseCommandOptions | undefined;
  error?: string | undefined;
  showHelp?: boolean | undefined;
} {
  const options: UseCommandOptions = {};
  const remainingArgs: string[] = [];
  
  // Manual parsing for options
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
      remainingArgs.push(arg);
    }
  }

  // Validate remaining arguments
  if (remainingArgs.length > 1) {
    return {
      valid: false,
      error: `Too many arguments. Expected at most one configuration name, got: ${remainingArgs.join(', ')}`
    };
  }

  if (remainingArgs.length > 0) {
    options.configName = remainingArgs[0];
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