/**
 * Environment variable management for Qwen Code Router
 * 
 * This module handles setting, validating, and clearing environment variables
 * required by Qwen Code (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL).
 */

import {
  ConfigEntry,
  Provider,
  EnvironmentVariables,
  ValidationResult
} from './types';

/**
 * Required environment variable names for Qwen Code
 */
export const REQUIRED_ENV_VARS = {
  API_KEY: 'OPENAI_API_KEY',
  BASE_URL: 'OPENAI_BASE_URL',
  MODEL: 'OPENAI_MODEL'
} as const;

/**
 * Sets environment variables based on a configuration entry and provider information
 * @param configEntry - The configuration entry containing provider and model
 * @param provider - The provider information containing API credentials
 * @returns void
 */
export function setEnvironmentVariables(configEntry: ConfigEntry, provider: Provider): void {
  if (!configEntry) {
    throw new Error('Configuration entry is required');
  }

  if (!provider) {
    throw new Error('Provider information is required');
  }

  // Validate that the config entry matches the provider
  if (configEntry.provider !== provider.provider) {
    throw new Error(`Configuration provider "${configEntry.provider}" does not match provider "${provider.provider}"`);
  }

  // Validate that the model is supported by the provider
  const modelSupported = provider.env.models.some(m => m.model === configEntry.model);
  if (!modelSupported) {
    throw new Error(`Model "${configEntry.model}" is not supported by provider "${provider.provider}"`);
  }

  // Set the environment variables
  process.env[REQUIRED_ENV_VARS.API_KEY] = provider.env.api_key;
  process.env[REQUIRED_ENV_VARS.BASE_URL] = provider.env.base_url;
  process.env[REQUIRED_ENV_VARS.MODEL] = configEntry.model;
}

/**
 * Sets environment variables from a complete EnvironmentVariables object
 * @param envVars - Environment variables object
 * @returns void
 */
export function setEnvironmentVariablesFromObject(envVars: EnvironmentVariables): void {
  if (!envVars) {
    throw new Error('Environment variables object is required');
  }

  process.env[REQUIRED_ENV_VARS.API_KEY] = envVars.OPENAI_API_KEY;
  process.env[REQUIRED_ENV_VARS.BASE_URL] = envVars.OPENAI_BASE_URL;
  process.env[REQUIRED_ENV_VARS.MODEL] = envVars.OPENAI_MODEL;
}

/**
 * Validates that all required environment variables are set and valid
 * @returns ValidationResult with detailed information about missing or invalid variables
 */
export function validateEnvironmentVariables(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if all required environment variables are set
  const apiKey = process.env[REQUIRED_ENV_VARS.API_KEY];
  const baseUrl = process.env[REQUIRED_ENV_VARS.BASE_URL];
  const model = process.env[REQUIRED_ENV_VARS.MODEL];

  if (!apiKey) {
    errors.push(`Missing required environment variable: ${REQUIRED_ENV_VARS.API_KEY}`);
  } else if (!apiKey.trim()) {
    errors.push(`Environment variable ${REQUIRED_ENV_VARS.API_KEY} cannot be empty`);
  }

  if (!baseUrl) {
    errors.push(`Missing required environment variable: ${REQUIRED_ENV_VARS.BASE_URL}`);
  } else if (!baseUrl.trim()) {
    errors.push(`Environment variable ${REQUIRED_ENV_VARS.BASE_URL} cannot be empty`);
  } else {
    // Validate URL format
    try {
      new URL(baseUrl);
    } catch (error) {
      errors.push(`Environment variable ${REQUIRED_ENV_VARS.BASE_URL} is not a valid URL: ${baseUrl}`);
    }
  }

  if (!model) {
    errors.push(`Missing required environment variable: ${REQUIRED_ENV_VARS.MODEL}`);
  } else if (!model.trim()) {
    errors.push(`Environment variable ${REQUIRED_ENV_VARS.MODEL} cannot be empty`);
  }

  // Additional validation warnings
  if (apiKey && apiKey.length < 10) {
    warnings.push(`${REQUIRED_ENV_VARS.API_KEY} seems unusually short, please verify it's correct`);
  }

  if (baseUrl && !baseUrl.startsWith('https://')) {
    warnings.push(`${REQUIRED_ENV_VARS.BASE_URL} does not use HTTPS, which may not be secure`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gets the current environment variables as an EnvironmentVariables object
 * @returns EnvironmentVariables object with current values (may contain undefined values)
 */
export function getCurrentEnvironmentVariables(): Partial<EnvironmentVariables> {
  const result: Partial<EnvironmentVariables> = {};
  
  const apiKey = process.env[REQUIRED_ENV_VARS.API_KEY];
  if (apiKey !== undefined) {
    result.OPENAI_API_KEY = apiKey;
  }
  
  const baseUrl = process.env[REQUIRED_ENV_VARS.BASE_URL];
  if (baseUrl !== undefined) {
    result.OPENAI_BASE_URL = baseUrl;
  }
  
  const model = process.env[REQUIRED_ENV_VARS.MODEL];
  if (model !== undefined) {
    result.OPENAI_MODEL = model;
  }
  
  return result;
}

/**
 * Gets the current environment variables as a complete EnvironmentVariables object
 * Throws an error if any required variables are missing
 * @returns Complete EnvironmentVariables object
 * @throws Error if any required environment variables are missing
 */
export function getRequiredEnvironmentVariables(): EnvironmentVariables {
  const validation = validateEnvironmentVariables();
  
  if (!validation.isValid) {
    throw new Error(`Missing required environment variables: ${validation.errors.join(', ')}`);
  }

  return {
    OPENAI_API_KEY: process.env[REQUIRED_ENV_VARS.API_KEY]!,
    OPENAI_BASE_URL: process.env[REQUIRED_ENV_VARS.BASE_URL]!,
    OPENAI_MODEL: process.env[REQUIRED_ENV_VARS.MODEL]!
  };
}

/**
 * Clears all Qwen Code related environment variables
 * @returns void
 */
export function clearEnvironmentVariables(): void {
  delete process.env[REQUIRED_ENV_VARS.API_KEY];
  delete process.env[REQUIRED_ENV_VARS.BASE_URL];
  delete process.env[REQUIRED_ENV_VARS.MODEL];
}

/**
 * Backs up current environment variables before making changes
 * @returns Partial<EnvironmentVariables> - Current environment variable values
 */
export function backupEnvironmentVariables(): Partial<EnvironmentVariables> {
  return getCurrentEnvironmentVariables();
}

/**
 * Restores environment variables from a backup
 * @param backup - Previously backed up environment variables
 * @returns void
 */
export function restoreEnvironmentVariables(backup: Partial<EnvironmentVariables>): void {
  // Clear current variables first
  clearEnvironmentVariables();

  // Restore from backup (only set if value exists in backup)
  if (backup.OPENAI_API_KEY !== undefined) {
    process.env[REQUIRED_ENV_VARS.API_KEY] = backup.OPENAI_API_KEY;
  }
  if (backup.OPENAI_BASE_URL !== undefined) {
    process.env[REQUIRED_ENV_VARS.BASE_URL] = backup.OPENAI_BASE_URL;
  }
  if (backup.OPENAI_MODEL !== undefined) {
    process.env[REQUIRED_ENV_VARS.MODEL] = backup.OPENAI_MODEL;
  }
}

/**
 * Checks if all required environment variables are currently set
 * @returns boolean - True if all required variables are set and non-empty
 */
export function areEnvironmentVariablesSet(): boolean {
  const validation = validateEnvironmentVariables();
  return validation.isValid;
}

/**
 * Gets a summary of current environment variable status
 * @returns Object with status information for each required variable
 */
export function getEnvironmentVariableStatus(): {
  [key: string]: {
    name: string;
    isSet: boolean;
    isEmpty: boolean;
    value?: string;
  };
} {
  const apiKey = process.env[REQUIRED_ENV_VARS.API_KEY];
  const baseUrl = process.env[REQUIRED_ENV_VARS.BASE_URL];
  const model = process.env[REQUIRED_ENV_VARS.MODEL];

  const result: {
    [key: string]: {
      name: string;
      isSet: boolean;
      isEmpty: boolean;
      value?: string;
    };
  } = {};

  result['apiKey'] = {
    name: REQUIRED_ENV_VARS.API_KEY,
    isSet: apiKey !== undefined,
    isEmpty: !apiKey || !apiKey.trim()
  };
  if (apiKey) {
    result['apiKey'].value = `${apiKey.substring(0, 8)}...`; // Masked for security
  }

  result['baseUrl'] = {
    name: REQUIRED_ENV_VARS.BASE_URL,
    isSet: baseUrl !== undefined,
    isEmpty: !baseUrl || !baseUrl.trim()
  };
  if (baseUrl) {
    result['baseUrl'].value = baseUrl;
  }

  result['model'] = {
    name: REQUIRED_ENV_VARS.MODEL,
    isSet: model !== undefined,
    isEmpty: !model || !model.trim()
  };
  if (model) {
    result['model'].value = model;
  }

  return result;
}

/**
 * Validates environment variables against a specific provider's configuration
 * @param provider - Provider to validate against
 * @returns ValidationResult with provider-specific validation
 */
export function validateEnvironmentVariablesAgainstProvider(provider: Provider): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // First run basic validation
  const basicValidation = validateEnvironmentVariables();
  errors.push(...basicValidation.errors);
  warnings.push(...basicValidation.warnings);

  // If basic validation fails, return early
  if (!basicValidation.isValid) {
    return { isValid: false, errors, warnings };
  }

  // Get current environment variables
  const currentEnv = getRequiredEnvironmentVariables();

  // Validate API key matches provider
  if (currentEnv.OPENAI_API_KEY !== provider.env.api_key) {
    errors.push(`Current API key does not match provider "${provider.provider}" configuration`);
  }

  // Validate base URL matches provider
  if (currentEnv.OPENAI_BASE_URL !== provider.env.base_url) {
    errors.push(`Current base URL does not match provider "${provider.provider}" configuration`);
  }

  // Validate model is supported by provider
  const modelSupported = provider.env.models.some(m => m.model === currentEnv.OPENAI_MODEL);
  if (!modelSupported) {
    errors.push(`Current model "${currentEnv.OPENAI_MODEL}" is not supported by provider "${provider.provider}"`);
    const supportedModels = provider.env.models.map(m => m.model).join(', ');
    errors.push(`Supported models for provider "${provider.provider}": ${supportedModels}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates an EnvironmentVariables object from a configuration entry and provider
 * @param configEntry - Configuration entry
 * @param provider - Provider information
 * @returns EnvironmentVariables object
 */
export function createEnvironmentVariables(configEntry: ConfigEntry, provider: Provider): EnvironmentVariables {
  if (!configEntry) {
    throw new Error('Configuration entry is required');
  }

  if (!provider) {
    throw new Error('Provider information is required');
  }

  // Validate that the config entry matches the provider
  if (configEntry.provider !== provider.provider) {
    throw new Error(`Configuration provider "${configEntry.provider}" does not match provider "${provider.provider}"`);
  }

  // Validate that the model is supported by the provider
  const modelSupported = provider.env.models.some(m => m.model === configEntry.model);
  if (!modelSupported) {
    throw new Error(`Model "${configEntry.model}" is not supported by provider "${provider.provider}"`);
  }

  return {
    OPENAI_API_KEY: provider.env.api_key,
    OPENAI_BASE_URL: provider.env.base_url,
    OPENAI_MODEL: configEntry.model
  };
}