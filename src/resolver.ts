/**
 * Configuration resolution logic for Qwen Code Router
 * 
 * This module handles resolving configurations from config names to environment variables,
 * provider-model mapping for /router command, and default configuration handling.
 */

import {
  ConfigFile,
  ConfigEntry,
  Provider,
  EnvironmentVariables,
  ValidationResult
} from './types';
import {
  setEnvironmentVariablesFromObject,
  createEnvironmentVariables
} from './environment';

/**
 * Built-in provider mappings for predefined providers
 */
export const BUILT_IN_PROVIDERS: Record<string, {
  baseUrl: string;
  models: string[];
}> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
  },
  azure: {
    baseUrl: 'https://[resource].openai.azure.com/openai',
    models: ['gpt-4', 'gpt-35-turbo', 'gpt-35-turbo-16k']
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1', 'claude-2.0']
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro']
  }
};

/**
 * Configuration resolution result
 */
export interface ResolutionResult {
  /** Whether the resolution was successful */
  success: boolean;
  /** Environment variables that were set (if successful) */
  environmentVariables?: EnvironmentVariables;
  /** Error message if resolution failed */
  error?: string;
  /** Configuration entry that was resolved */
  configEntry?: ConfigEntry;
  /** Provider that was used */
  provider?: Provider;
  /** Whether a built-in provider was used */
  usedBuiltInProvider?: boolean;
}

/**
 * Resolves a configuration by name and sets environment variables
 * @param configName - Name of the configuration to resolve
 * @param configFile - Configuration file containing all configurations and providers
 * @returns ResolutionResult with success status and details
 */
export function resolveConfigurationByName(configName: string, configFile: ConfigFile): ResolutionResult {
  try {
    // Find the configuration entry
    const configEntry = findConfigurationByName(configName, configFile);
    if (!configEntry) {
      const availableConfigs = getAllConfigurationNames(configFile);
      return {
        success: false,
        error: `Configuration "${configName}" not found. Available configurations: ${availableConfigs.join(', ')}`
      };
    }

    // Find the provider for this configuration
    const provider = findProviderByName(configEntry.provider, configFile);
    if (!provider) {
      const availableProviders = getAllProviderNames(configFile);
      return {
        success: false,
        error: `Provider "${configEntry.provider}" not found for configuration "${configName}". Available providers: ${availableProviders.join(', ')}`
      };
    }

    // Validate that the model is supported by the provider
    const modelSupported = provider.env.models.some(m => m.model === configEntry.model);
    if (!modelSupported) {
      const supportedModels = provider.env.models.map(m => m.model);
      return {
        success: false,
        error: `Model "${configEntry.model}" is not supported by provider "${provider.provider}". Supported models: ${supportedModels.join(', ')}`
      };
    }

    // Create environment variables
    const envVars = createEnvironmentVariables(configEntry, provider);

    // Set environment variables
    setEnvironmentVariablesFromObject(envVars);

    return {
      success: true,
      environmentVariables: envVars,
      configEntry,
      provider,
      usedBuiltInProvider: false
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during configuration resolution'
    };
  }
}

/**
 * Resolves configuration by provider and model, supporting both built-in and configured providers
 * @param providerName - Name of the provider
 * @param modelName - Name of the model
 * @param configFile - Configuration file (optional, used for configured providers)
 * @returns ResolutionResult with success status and details
 */
export function resolveConfigurationByProviderModel(
  providerName: string,
  modelName: string,
  configFile?: ConfigFile
): ResolutionResult {
  const normalizedProvider = providerName.toLowerCase();

  try {
    // First, try to find in configuration file if provided
    if (configFile) {
      const configResult = resolveFromConfiguredProvider(normalizedProvider, modelName, configFile);
      if (configResult.success) {
        return configResult;
      }
    }

    // Fall back to built-in providers
    return resolveFromBuiltInProvider(normalizedProvider, modelName);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during provider-model resolution'
    };
  }
}

/**
 * Resolves configuration using configured providers from configuration file
 * @param providerName - Name of the provider (normalized to lowercase)
 * @param modelName - Name of the model
 * @param configFile - Configuration file containing providers
 * @returns ResolutionResult
 */
function resolveFromConfiguredProvider(providerName: string, modelName: string, configFile: ConfigFile): ResolutionResult {
  // Find the provider in configuration file
  const provider = configFile.providers.find(p => p.provider.toLowerCase() === providerName);
  if (!provider) {
    return {
      success: false,
      error: `Provider "${providerName}" not found in configuration file`
    };
  }

  // Check if model is supported by this provider
  const modelSupported = provider.env.models.some(m => m.model === modelName);
  if (!modelSupported) {
    const supportedModels = provider.env.models.map(m => m.model);
    return {
      success: false,
      error: `Model "${modelName}" is not supported by configured provider "${providerName}". Supported models: ${supportedModels.join(', ')}`
    };
  }

  // Create a temporary configuration entry
  const configEntry: ConfigEntry = {
    name: `${providerName}-${modelName}`,
    provider: provider.provider,
    model: modelName
  };

  // Create environment variables
  const envVars = createEnvironmentVariables(configEntry, provider);

  // Set environment variables
  setEnvironmentVariablesFromObject(envVars);

  return {
    success: true,
    environmentVariables: envVars,
    configEntry,
    provider,
    usedBuiltInProvider: false
  };
}

/**
 * Resolves configuration using built-in provider mappings
 * @param providerName - Name of the provider (normalized to lowercase)
 * @param modelName - Name of the model
 * @returns ResolutionResult
 */
function resolveFromBuiltInProvider(providerName: string, modelName: string): ResolutionResult {
  const builtInProvider = BUILT_IN_PROVIDERS[providerName];
  if (!builtInProvider) {
    const availableProviders = Object.keys(BUILT_IN_PROVIDERS);
    return {
      success: false,
      error: `Built-in provider "${providerName}" not found. Available built-in providers: ${availableProviders.join(', ')}`
    };
  }

  // Check if model is supported by built-in provider
  if (!builtInProvider.models.includes(modelName)) {
    return {
      success: false,
      error: `Model "${modelName}" is not supported by built-in provider "${providerName}". Supported models: ${builtInProvider.models.join(', ')}`
    };
  }

  // Get API key from environment variables
  const apiKey = getApiKeyForProvider(providerName);
  if (!apiKey) {
    const envVarName = `${providerName.toUpperCase()}_API_KEY`;
    return {
      success: false,
      error: `API key not found for provider "${providerName}". Please set ${envVarName} or OPENAI_API_KEY environment variable.`
    };
  }

  // Generate base URL for provider
  const baseUrl = generateBaseUrlForProvider(providerName, modelName, builtInProvider.baseUrl);

  // Create environment variables
  const envVars: EnvironmentVariables = {
    OPENAI_API_KEY: apiKey,
    OPENAI_BASE_URL: baseUrl,
    OPENAI_MODEL: modelName
  };

  // Set environment variables
  setEnvironmentVariablesFromObject(envVars);

  // Create temporary configuration entry and provider for result
  const configEntry: ConfigEntry = {
    name: `${providerName}-${modelName}`,
    provider: providerName,
    model: modelName
  };

  const provider: Provider = {
    provider: providerName,
    env: {
      api_key: apiKey,
      base_url: baseUrl,
      models: builtInProvider.models.map(model => ({ model }))
    }
  };

  return {
    success: true,
    environmentVariables: envVars,
    configEntry,
    provider,
    usedBuiltInProvider: true
  };
}

/**
 * Resolves the default configuration and sets environment variables
 * @param configFile - Configuration file containing default configuration
 * @returns ResolutionResult with success status and details
 */
export function resolveDefaultConfiguration(configFile: ConfigFile): ResolutionResult {
  try {
    // Check if default configuration is defined
    if (!configFile.default_config || configFile.default_config.length === 0) {
      return {
        success: false,
        error: 'No default configuration is set. Use "qcr set-default [config_name]" to set a default configuration.'
      };
    }

    // Get the default configuration name
    const defaultConfigName = configFile.default_config[0]!.name;

    // Resolve the default configuration
    return resolveConfigurationByName(defaultConfigName, configFile);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during default configuration resolution'
    };
  }
}

/**
 * Sets the default configuration in the configuration file
 * @param configName - Name of the configuration to set as default
 * @param configFile - Configuration file to update
 * @returns ValidationResult indicating success or failure
 */
export function setDefaultConfiguration(configName: string, configFile: ConfigFile): ValidationResult {
  try {
    // Validate that the configuration exists
    const configEntry = findConfigurationByName(configName, configFile);
    if (!configEntry) {
      const availableConfigs = getAllConfigurationNames(configFile);
      return {
        isValid: false,
        errors: [`Configuration "${configName}" not found. Available configurations: ${availableConfigs.join(', ')}`],
        warnings: []
      };
    }

    // Update the default configuration
    configFile.default_config = [{ name: configName }];

    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error occurred while setting default configuration'],
      warnings: []
    };
  }
}

/**
 * Gets API key for a specific provider from environment variables
 * @param providerName - Name of the provider
 * @returns API key string or null if not found
 */
function getApiKeyForProvider(providerName: string): string | null {
  // First check for provider-specific API key
  const providerEnvVar = `${providerName.toUpperCase()}_API_KEY`;
  const providerSpecificKey = process.env[providerEnvVar];
  
  if (providerSpecificKey && providerSpecificKey.trim()) {
    return providerSpecificKey;
  }

  // Fall back to OPENAI_API_KEY
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (openaiKey && openaiKey.trim()) {
    return openaiKey;
  }

  return null;
}

/**
 * Generates base URL for a provider, handling special cases like Azure
 * @param providerName - Name of the provider
 * @param modelName - Name of the model (used for Azure resource name)
 * @param templateUrl - Template URL from built-in provider
 * @returns Generated base URL
 */
function generateBaseUrlForProvider(providerName: string, modelName: string, templateUrl: string): string {
  if (providerName === 'azure') {
    // For Azure, replace [resource] placeholder with model name (converted to valid resource name)
    const resourceName = modelName.toLowerCase().replace(/_/g, '-');
    return templateUrl.replace('[resource]', resourceName);
  }

  return templateUrl;
}

/**
 * Finds a configuration entry by name
 * @param configName - Name of the configuration to find
 * @param configFile - Configuration file to search in
 * @returns ConfigEntry or null if not found
 */
export function findConfigurationByName(configName: string, configFile: ConfigFile): ConfigEntry | null {
  for (const configGroup of configFile.configs) {
    const config = configGroup.config.find(c => c.name === configName);
    if (config) {
      return config;
    }
  }
  return null;
}

/**
 * Finds a provider by name
 * @param providerName - Name of the provider to find
 * @param configFile - Configuration file to search in
 * @returns Provider or null if not found
 */
export function findProviderByName(providerName: string, configFile: ConfigFile): Provider | null {
  return configFile.providers.find(p => p.provider === providerName) || null;
}

/**
 * Gets all configuration names from the configuration file
 * @param configFile - Configuration file to extract names from
 * @returns Array of configuration names
 */
export function getAllConfigurationNames(configFile: ConfigFile): string[] {
  const names: string[] = [];
  for (const configGroup of configFile.configs) {
    for (const config of configGroup.config) {
      names.push(config.name);
    }
  }
  return names;
}

/**
 * Gets all provider names from the configuration file
 * @param configFile - Configuration file to extract provider names from
 * @returns Array of provider names
 */
export function getAllProviderNames(configFile: ConfigFile): string[] {
  return configFile.providers.map(p => p.provider);
}

/**
 * Gets all models for a specific provider from the configuration file
 * @param providerName - Name of the provider
 * @param configFile - Configuration file to search in
 * @returns Array of model names or null if provider not found
 */
export function getModelsForProvider(providerName: string, configFile: ConfigFile): string[] | null {
  const provider = findProviderByName(providerName, configFile);
  if (!provider) {
    return null;
  }
  return provider.env.models.map(m => m.model);
}

/**
 * Gets all models for a built-in provider
 * @param providerName - Name of the built-in provider
 * @returns Array of model names or null if provider not found
 */
export function getModelsForBuiltInProvider(providerName: string): string[] | null {
  const normalizedProvider = providerName.toLowerCase();
  const builtInProvider = BUILT_IN_PROVIDERS[normalizedProvider];
  if (!builtInProvider) {
    return null;
  }
  return [...builtInProvider.models];
}

/**
 * Gets all built-in provider names
 * @returns Array of built-in provider names
 */
export function getBuiltInProviderNames(): string[] {
  return Object.keys(BUILT_IN_PROVIDERS);
}

/**
 * Checks if a provider is a built-in provider
 * @param providerName - Name of the provider to check
 * @returns True if provider is built-in, false otherwise
 */
export function isBuiltInProvider(providerName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_PROVIDERS, providerName.toLowerCase());
}

/**
 * Gets the current default configuration name from the configuration file
 * @param configFile - Configuration file to check
 * @returns Default configuration name or null if not set
 */
export function getCurrentDefaultConfiguration(configFile: ConfigFile): string | null {
  if (!configFile.default_config || configFile.default_config.length === 0) {
    return null;
  }
  return configFile.default_config[0]!.name;
}

/**
 * Validates that a configuration can be resolved successfully
 * @param configName - Name of the configuration to validate
 * @param configFile - Configuration file containing the configuration
 * @returns ValidationResult with detailed validation information
 */
export function validateConfigurationResolution(configName: string, configFile: ConfigFile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if configuration exists
    const configEntry = findConfigurationByName(configName, configFile);
    if (!configEntry) {
      const availableConfigs = getAllConfigurationNames(configFile);
      errors.push(`Configuration "${configName}" not found. Available configurations: ${availableConfigs.join(', ')}`);
      return { isValid: false, errors, warnings };
    }

    // Check if provider exists
    const provider = findProviderByName(configEntry.provider, configFile);
    if (!provider) {
      const availableProviders = getAllProviderNames(configFile);
      errors.push(`Provider "${configEntry.provider}" not found for configuration "${configName}". Available providers: ${availableProviders.join(', ')}`);
      return { isValid: false, errors, warnings };
    }

    // Check if model is supported by provider
    const modelSupported = provider.env.models.some(m => m.model === configEntry.model);
    if (!modelSupported) {
      const supportedModels = provider.env.models.map(m => m.model);
      errors.push(`Model "${configEntry.model}" is not supported by provider "${provider.provider}". Supported models: ${supportedModels.join(', ')}`);
    }

    // Validate provider configuration
    if (!provider.env.api_key || !provider.env.api_key.trim()) {
      errors.push(`Provider "${provider.provider}" is missing API key`);
    }

    if (!provider.env.base_url || !provider.env.base_url.trim()) {
      errors.push(`Provider "${provider.provider}" is missing base URL`);
    } else {
      // Validate URL format
      try {
        new URL(provider.env.base_url);
      } catch {
        errors.push(`Provider "${provider.provider}" has invalid base URL: ${provider.env.base_url}`);
      }
    }

    // Add warnings for potential issues
    if (provider.env.api_key && provider.env.api_key.length < 10) {
      warnings.push(`API key for provider "${provider.provider}" seems unusually short`);
    }

    if (provider.env.base_url && !provider.env.base_url.startsWith('https://')) {
      warnings.push(`Base URL for provider "${provider.provider}" does not use HTTPS`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error during validation');
    return { isValid: false, errors, warnings };
  }
}

/**
 * Validates that a provider-model combination can be resolved
 * @param providerName - Name of the provider
 * @param modelName - Name of the model
 * @param configFile - Configuration file (optional, for configured providers)
 * @returns ValidationResult with detailed validation information
 */
export function validateProviderModelResolution(
  providerName: string,
  modelName: string,
  configFile?: ConfigFile
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedProvider = providerName.toLowerCase();

  try {
    // First check configured providers if config file is provided
    if (configFile) {
      const provider = findProviderByName(providerName, configFile);
      if (provider) {
        // Validate configured provider
        const modelSupported = provider.env.models.some(m => m.model === modelName);
        if (!modelSupported) {
          const supportedModels = provider.env.models.map(m => m.model);
          errors.push(`Model "${modelName}" is not supported by configured provider "${providerName}". Supported models: ${supportedModels.join(', ')}`);
        }

        if (!provider.env.api_key || !provider.env.api_key.trim()) {
          errors.push(`Configured provider "${providerName}" is missing API key`);
        }

        if (!provider.env.base_url || !provider.env.base_url.trim()) {
          errors.push(`Configured provider "${providerName}" is missing base URL`);
        }

        return { isValid: errors.length === 0, errors, warnings };
      }
    }

    // Check built-in providers
    const builtInProvider = BUILT_IN_PROVIDERS[normalizedProvider];
    if (!builtInProvider) {
      const availableBuiltIn = Object.keys(BUILT_IN_PROVIDERS);
      const availableConfigured = configFile ? getAllProviderNames(configFile) : [];
      const allAvailable = [...availableConfigured, ...availableBuiltIn];
      errors.push(`Provider "${providerName}" not found. Available providers: ${allAvailable.join(', ')}`);
      return { isValid: false, errors, warnings };
    }

    // Validate model for built-in provider
    if (!builtInProvider.models.includes(modelName)) {
      errors.push(`Model "${modelName}" is not supported by built-in provider "${providerName}". Supported models: ${builtInProvider.models.join(', ')}`);
    }

    // Check if API key is available
    const apiKey = getApiKeyForProvider(normalizedProvider);
    if (!apiKey) {
      const envVarName = `${normalizedProvider.toUpperCase()}_API_KEY`;
      errors.push(`API key not found for provider "${providerName}". Please set ${envVarName} or OPENAI_API_KEY environment variable.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error during validation');
    return { isValid: false, errors, warnings };
  }
}