/**
 * Command handlers for Qwen Code Router CLI
 *
 * This module implements shared utilities and types for CLI commands.
 */

import {
  getAllConfigurationNames,
  getCurrentDefaultConfiguration
} from './resolver';
import { validateEnvironmentVariables } from './environment';
import { ConfigFile } from './types';

// Export handler functions from individual command files
export { handleUseCommand } from './commands/use';
export { handleRunCommand } from './commands/run';
export { handleSetDefaultCommand } from './commands/set-default';
export { handleListCommand } from './commands/list';
export { handleChkCommand } from './commands/chk';
export { handleRouterCommand } from './commands/router';

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