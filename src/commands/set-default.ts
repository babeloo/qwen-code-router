/**
 * 'set-default' command implementation for Qwen Code Router CLI
 */

import { loadConfigFile } from '../command-utils';
import { getAllConfigurationNames, getCurrentDefaultConfiguration } from '../resolver';
import { saveConfigFile } from '../persistence';
import {
  createErrorResult,
  createSuccessResult,
  configValidationError,
  configNotFoundError,
  fileOperationError,
  unexpectedError,
  invalidArgumentsError
} from '../errors';
import { CommandResult } from '../commands';
import { parseFlags } from '../command-args';

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
  const { getSetDefaultCommandHelp } = require('../help');
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
  // Check for unknown flags first
  for (const arg of args) {
    if (arg && arg.startsWith('-') && arg !== '-h' && arg !== '--help' && arg !== '-v' && arg !== '--verbose') {
      // If it's a flag and not a configuration name, treat it as unknown option
      return {
        valid: false,
        error: `Unknown option: ${arg}`
      };
    }
  }

  const { parsedFlags, remainingArgs } = parseFlags(args, {
    help: ['-h', '--help'],
    verbose: ['-v', '--verbose']
  });

  if (parsedFlags['help']) {
    return { valid: true, showHelp: true };
  }

  // 验证参数数量
  if (remainingArgs.length === 0) {
    return {
      valid: false,
      error: 'Configuration name is required'
    };
  }
  
  if (remainingArgs.length > 1) {
    return {
      valid: false,
      error: `Too many arguments. Expected exactly one configuration name, got: ${remainingArgs.join(', ')}`
    };
  }

  const options: SetDefaultCommandOptions = {
    configName: remainingArgs[0]!,
  };
  
  // Only add verbose property if it was explicitly set
  if (parsedFlags['verbose']) {
    options.verbose = true;
  }

  return {
    valid: true,
    options
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