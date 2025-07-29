/**
 * Startup flow validation and initialization for Qwen Code Router
 * 
 * This module implements the proper startup flow as described in desc.md:
 * 1. Check configuration file existence
 * 2. Check default configuration existence
 * 3. Validate default configuration
 * 4. Set environment variables to default configuration
 * 5. Ready to launch Qwen Code
 */

import { discoverAndLoadConfig } from './persistence';
import { getCurrentDefaultConfiguration, resolveConfigurationByName } from './resolver';
import { validateEnvironmentVariables, getCurrentEnvironmentVariables, REQUIRED_ENV_VARS } from './environment';
import { ConfigFile } from './types';
import {
  createSuccessResult,
  EXIT_CODES
} from './errors';
import { CommandResult } from './commands';

/**
 * Startup flow result with detailed information
 */
export interface StartupFlowResult {
  /** Whether startup flow completed successfully */
  success: boolean;
  /** Current step in the startup flow */
  currentStep: StartupStep;
  /** Configuration file that was loaded (if successful) */
  configFile?: ConfigFile;
  /** Configuration file path (if found) */
  configFilePath?: string;
  /** Default configuration name (if found) */
  defaultConfigName?: string;
  /** Error message if startup failed */
  errorMessage?: string;
  /** Detailed error information */
  errorDetails?: string;
  /** Exit code for the process */
  exitCode: number;
}

/**
 * Startup flow steps
 */
export enum StartupStep {
  CHECKING_CONFIG_FILE = 'checking_config_file',
  CHECKING_DEFAULT_CONFIG = 'checking_default_config',
  VALIDATING_DEFAULT_CONFIG = 'validating_default_config',
  SETTING_ENVIRONMENT = 'setting_environment',
  READY = 'ready',
  FAILED = 'failed'
}

/**
 * Executes the complete startup flow validation
 * @param currentDir - Current working directory (optional)
 * @returns StartupFlowResult with detailed flow information
 */
export async function executeStartupFlow(currentDir?: string): Promise<StartupFlowResult> {
  try {
    // Step 1: Check configuration file existence
    let config: ConfigFile;
    let validation: any;
    let filePath: string;

    try {
      const result = await discoverAndLoadConfig(currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No configuration file found')) {
        // Phase 1 startup flow: Check for environment variable fallback
        const envFallbackResult = checkEnvironmentVariableFallback();
        if (envFallbackResult.success) {
          return envFallbackResult;
        } else {
          return {
            success: false,
            currentStep: StartupStep.FAILED,
            errorMessage: 'Configuration file not found and environment variables not set',
            errorDetails: envFallbackResult.errorDetails || error.message,
            exitCode: EXIT_CODES.CONFIG_NOT_FOUND
          };
        }
      } else {
        return {
          success: false,
          currentStep: StartupStep.FAILED,
          errorMessage: 'Failed to load configuration file',
          errorDetails: error instanceof Error ? error.message : 'Unknown error',
          exitCode: EXIT_CODES.CONFIG_INVALID
        };
      }
    }

    // Validate configuration file structure
    if (!validation.isValid) {
      return {
        success: false,
        currentStep: StartupStep.FAILED,
        configFile: config,
        configFilePath: filePath,
        errorMessage: 'Configuration file validation failed',
        errorDetails: `Errors: ${validation.errors.join(', ')}`,
        exitCode: EXIT_CODES.CONFIG_VALIDATION_FAILED
      };
    }

    // Step 2: Check default configuration existence
    const defaultConfigName = getCurrentDefaultConfiguration(config);
    if (!defaultConfigName) {
      return {
        success: false,
        currentStep: StartupStep.CHECKING_DEFAULT_CONFIG,
        configFile: config,
        configFilePath: filePath,
        errorMessage: 'No default configuration set',
        errorDetails: 'Default configuration is required for startup flow. Use "qcr set-default [config_name]" to set one.',
        exitCode: EXIT_CODES.CONFIG_INVALID
      };
    }

    // Step 3: Validate default configuration
    const resolutionResult = resolveConfigurationByName(defaultConfigName, config);
    if (!resolutionResult.success) {
      return {
        success: false,
        currentStep: StartupStep.VALIDATING_DEFAULT_CONFIG,
        configFile: config,
        configFilePath: filePath,
        defaultConfigName,
        errorMessage: `Default configuration '${defaultConfigName}' is invalid`,
        errorDetails: resolutionResult.error || 'Configuration resolution failed',
        exitCode: EXIT_CODES.CONFIG_INVALID
      };
    }

    // Step 4: Set environment variables to default configuration
    // Environment variables are already set by resolveConfigurationByName

    // Step 5: Validate that environment variables were set correctly
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return {
        success: false,
        currentStep: StartupStep.SETTING_ENVIRONMENT,
        configFile: config,
        configFilePath: filePath,
        defaultConfigName,
        errorMessage: 'Environment variables validation failed after setting default configuration',
        errorDetails: `Errors: ${envValidation.errors.join(', ')}`,
        exitCode: EXIT_CODES.ENVIRONMENT_ERROR
      };
    }

    // Startup flow completed successfully
    return {
      success: true,
      currentStep: StartupStep.READY,
      configFile: config,
      configFilePath: filePath,
      defaultConfigName,
      exitCode: EXIT_CODES.SUCCESS
    };

  } catch (error) {
    return {
      success: false,
      currentStep: StartupStep.FAILED,
      errorMessage: 'Unexpected error during startup flow',
      errorDetails: error instanceof Error ? error.message : 'Unknown error',
      exitCode: EXIT_CODES.GENERAL_ERROR
    };
  }
}

/**
 * Validates the startup flow without actually setting environment variables
 * @param currentDir - Current working directory (optional)
 * @returns StartupFlowResult with validation information
 */
export async function validateStartupFlow(currentDir?: string): Promise<StartupFlowResult> {
  try {
    // Step 1: Check configuration file existence
    let config: ConfigFile;
    let validation: any;
    let filePath: string;

    try {
      const result = await discoverAndLoadConfig(currentDir);
      config = result.config;
      validation = result.validation;
      filePath = result.filePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No configuration file found')) {
        // Phase 1 startup flow: Check for environment variable fallback
        const envFallbackResult = checkEnvironmentVariableFallback();
        if (envFallbackResult.success) {
          return envFallbackResult;
        } else {
          return {
            success: false,
            currentStep: StartupStep.CHECKING_CONFIG_FILE,
            errorMessage: 'Configuration file not found and environment variables not set',
            errorDetails: envFallbackResult.errorDetails || error.message,
            exitCode: EXIT_CODES.CONFIG_NOT_FOUND
          };
        }
      } else {
        return {
          success: false,
          currentStep: StartupStep.CHECKING_CONFIG_FILE,
          errorMessage: 'Failed to load configuration file',
          errorDetails: error instanceof Error ? error.message : 'Unknown error',
          exitCode: EXIT_CODES.CONFIG_INVALID
        };
      }
    }

    // Validate configuration file structure
    if (!validation.isValid) {
      return {
        success: false,
        currentStep: StartupStep.CHECKING_CONFIG_FILE,
        configFile: config,
        configFilePath: filePath,
        errorMessage: 'Configuration file validation failed',
        errorDetails: `Errors: ${validation.errors.join(', ')}`,
        exitCode: EXIT_CODES.CONFIG_VALIDATION_FAILED
      };
    }

    // Step 2: Check default configuration existence
    const defaultConfigName = getCurrentDefaultConfiguration(config);
    if (!defaultConfigName) {
      return {
        success: false,
        currentStep: StartupStep.CHECKING_DEFAULT_CONFIG,
        configFile: config,
        configFilePath: filePath,
        errorMessage: 'No default configuration set',
        errorDetails: 'Default configuration is required for startup flow. Use "qcr set-default [config_name]" to set one.',
        exitCode: EXIT_CODES.CONFIG_INVALID
      };
    }

    // Step 3: Validate default configuration (without setting environment variables)
    const resolutionResult = resolveConfigurationByName(defaultConfigName, config, false); // Don't set env vars
    if (!resolutionResult.success) {
      return {
        success: false,
        currentStep: StartupStep.VALIDATING_DEFAULT_CONFIG,
        configFile: config,
        configFilePath: filePath,
        defaultConfigName,
        errorMessage: `Default configuration '${defaultConfigName}' is invalid`,
        errorDetails: resolutionResult.error || 'Configuration resolution failed',
        exitCode: EXIT_CODES.CONFIG_INVALID
      };
    }

    // Validation completed successfully
    return {
      success: true,
      currentStep: StartupStep.READY,
      configFile: config,
      configFilePath: filePath,
      defaultConfigName,
      exitCode: EXIT_CODES.SUCCESS
    };

  } catch (error) {
    return {
      success: false,
      currentStep: StartupStep.FAILED,
      errorMessage: 'Unexpected error during startup flow validation',
      errorDetails: error instanceof Error ? error.message : 'Unknown error',
      exitCode: EXIT_CODES.GENERAL_ERROR
    };
  }
}

/**
 * Gets a human-readable description of the startup step
 * @param step - Startup step
 * @returns Human-readable description
 */
export function getStartupStepDescription(step: StartupStep): string {
  switch (step) {
    case StartupStep.CHECKING_CONFIG_FILE:
      return 'Checking configuration file existence';
    case StartupStep.CHECKING_DEFAULT_CONFIG:
      return 'Checking default configuration existence';
    case StartupStep.VALIDATING_DEFAULT_CONFIG:
      return 'Validating default configuration';
    case StartupStep.SETTING_ENVIRONMENT:
      return 'Setting environment variables';
    case StartupStep.READY:
      return 'Ready to launch Qwen Code';
    case StartupStep.FAILED:
      return 'Startup flow failed';
    default:
      return 'Unknown step';
  }
}

/**
 * Formats startup flow result as a command result
 * @param result - Startup flow result
 * @returns CommandResult for display
 */
export function formatStartupFlowResult(result: StartupFlowResult): CommandResult {
  if (result.success) {
    let message = 'Startup flow validation completed successfully';
    let details = `Step: ${getStartupStepDescription(result.currentStep)}`;
    
    if (result.configFilePath) {
      details += `\nConfiguration file: ${result.configFilePath}`;
    }
    
    if (result.defaultConfigName) {
      details += `\nDefault configuration: ${result.defaultConfigName}`;
    }

    return createSuccessResult(message, details);
  } else {
    let message = result.errorMessage || 'Startup flow validation failed';
    let details = `Failed at step: ${getStartupStepDescription(result.currentStep)}`;
    
    if (result.errorDetails) {
      details += `\n\nError details:\n${result.errorDetails}`;
    }

    if (result.configFilePath) {
      details += `\n\nConfiguration file: ${result.configFilePath}`;
    }

    // Add suggestions based on the failure step
    const suggestions = getStartupFlowSuggestions(result.currentStep);
    if (suggestions.length > 0) {
      details += `\n\nSuggestions:\n${suggestions.map(s => `  • ${s}`).join('\n')}`;
    }

    return {
      success: false,
      message,
      details,
      exitCode: result.exitCode
    };
  }
}

/**
 * Gets suggestions for fixing startup flow issues
 * @param step - Failed startup step
 * @returns Array of suggestions
 */
export function getStartupFlowSuggestions(step: StartupStep): string[] {
  switch (step) {
    case StartupStep.CHECKING_CONFIG_FILE:
      return [
        'Create a configuration file (config.yaml or config.json)',
        'Check file permissions and accessibility',
        'Verify file format (YAML or JSON)',
        'Use example configuration files as reference'
      ];
    case StartupStep.CHECKING_DEFAULT_CONFIG:
      return [
        'Set a default configuration using "qcr set-default [config_name]"',
        'Add a default_config section to your configuration file',
        'Use "qcr list config" to see available configurations'
      ];
    case StartupStep.VALIDATING_DEFAULT_CONFIG:
      return [
        'Check that the default configuration references a valid provider',
        'Verify that the model is supported by the provider',
        'Use "qcr chk [config_name]" to validate the configuration',
        'Update the configuration with correct provider and model names'
      ];
    case StartupStep.SETTING_ENVIRONMENT:
      return [
        'Check that all required environment variables are properly set',
        'Verify API key format and validity',
        'Ensure base URL is a valid HTTPS endpoint',
        'Confirm model name is correct'
      ];
    default:
      return [
        'Check the configuration file for any issues',
        'Ensure all required dependencies are installed',
        'Try running individual commands to diagnose the issue'
      ];
  }
}

/**
 * Checks if the system is ready to launch Qwen Code
 * @param currentDir - Current working directory (optional)
 * @returns Promise<boolean> - True if ready to launch
 */
export async function isReadyToLaunch(currentDir?: string): Promise<boolean> {
  const result = await validateStartupFlow(currentDir);
  return result.success && result.currentStep === StartupStep.READY;
}

/**
 * Gets the current startup status without modifying anything
 * @param currentDir - Current working directory (optional)
 * @returns StartupFlowResult with current status
 */
export async function getStartupStatus(currentDir?: string): Promise<StartupFlowResult> {
  return await validateStartupFlow(currentDir);
}

/**
 * Checks for environment variable fallback when configuration file doesn't exist
 * This implements Phase 1 startup flow requirement 6.3, 6.4, 6.5
 * @returns StartupFlowResult indicating success or failure of environment variable fallback
 */
function checkEnvironmentVariableFallback(): StartupFlowResult {
  try {
    // Check if all required environment variables are already set
    const currentEnv = getCurrentEnvironmentVariables();
    
    const hasApiKey = currentEnv.OPENAI_API_KEY && currentEnv.OPENAI_API_KEY.trim() !== '';
    const hasBaseUrl = currentEnv.OPENAI_BASE_URL && currentEnv.OPENAI_BASE_URL.trim() !== '';
    const hasModel = currentEnv.OPENAI_MODEL && currentEnv.OPENAI_MODEL.trim() !== '';

    if (hasApiKey && hasBaseUrl && hasModel) {
      // All required environment variables are present, validate them
      const envValidation = validateEnvironmentVariables();
      
      if (envValidation.isValid) {
        return {
          success: true,
          currentStep: StartupStep.READY,
          exitCode: EXIT_CODES.SUCCESS
        };
      } else {
        return {
          success: false,
          currentStep: StartupStep.FAILED,
          errorMessage: 'Environment variables are set but invalid',
          errorDetails: `Validation errors: ${envValidation.errors.join(', ')}`,
          exitCode: EXIT_CODES.ENVIRONMENT_ERROR
        };
      }
    } else {
      // Not all required environment variables are present
      const missingVars: string[] = [];
      if (!hasApiKey) missingVars.push(REQUIRED_ENV_VARS.API_KEY);
      if (!hasBaseUrl) missingVars.push(REQUIRED_ENV_VARS.BASE_URL);
      if (!hasModel) missingVars.push(REQUIRED_ENV_VARS.MODEL);

      return {
        success: false,
        currentStep: StartupStep.FAILED,
        errorMessage: 'Configuration file not found and required environment variables not set',
        errorDetails: `Missing environment variables: ${missingVars.join(', ')}\n\n` +
                     'Either create a configuration file or set all required environment variables:\n' +
                     `  ${REQUIRED_ENV_VARS.API_KEY}=your_api_key\n` +
                     `  ${REQUIRED_ENV_VARS.BASE_URL}=your_base_url\n` +
                     `  ${REQUIRED_ENV_VARS.MODEL}=your_model`,
        exitCode: EXIT_CODES.CONFIG_NOT_FOUND
      };
    }
  } catch (error) {
    return {
      success: false,
      currentStep: StartupStep.FAILED,
      errorMessage: 'Error during environment variable fallback check',
      errorDetails: error instanceof Error ? error.message : 'Unknown error',
      exitCode: EXIT_CODES.GENERAL_ERROR
    };
  }
}