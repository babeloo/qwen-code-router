/**
 * Configuration validation logic for Qwen Code Router
 * 
 * This module provides comprehensive validation functions for configuration files,
 * including structure validation, provider-model cross-validation, and hierarchical validation.
 */

import {
  ConfigFile,
  Config,
  Provider,
  ConfigEntry,
  DefaultConfig,
  ValidationResult,
  ModelEntry,
  ProviderEnv
} from './types';

/**
 * Validates the complete configuration file structure
 * @param config - The configuration file to validate
 * @returns ValidationResult with detailed error and warning information
 */
export function validateConfigFile(config: ConfigFile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate basic structure
  if (!config) {
    errors.push('Configuration file is null or undefined');
    return { isValid: false, errors, warnings };
  }

  // Validate required top-level properties
  if (!Array.isArray(config.configs)) {
    errors.push('Missing or invalid "configs" array');
  }

  if (!Array.isArray(config.providers)) {
    errors.push('Missing or invalid "providers" array');
  }

  // Validate default_config if present
  if (config.default_config !== undefined) {
    const defaultConfigResult = validateDefaultConfig(config.default_config, config.configs);
    errors.push(...defaultConfigResult.errors);
    warnings.push(...defaultConfigResult.warnings);
  }

  // Validate each configuration
  if (Array.isArray(config.configs)) {
    config.configs.forEach((cfg, index) => {
      const configResult = validateConfig(cfg, index);
      errors.push(...configResult.errors);
      warnings.push(...configResult.warnings);
    });
  }

  // Validate each provider
  if (Array.isArray(config.providers)) {
    config.providers.forEach((provider, index) => {
      const providerResult = validateProvider(provider, index);
      errors.push(...providerResult.errors);
      warnings.push(...providerResult.warnings);
    });
  }

  // Cross-validation: ensure configs reference valid providers and models
  if (Array.isArray(config.configs) && Array.isArray(config.providers)) {
    const crossValidationResult = validateProviderModelCrossReferences(config.configs, config.providers);
    errors.push(...crossValidationResult.errors);
    warnings.push(...crossValidationResult.warnings);
  }

  // Check for duplicate configuration names
  if (Array.isArray(config.configs)) {
    const duplicateResult = validateUniqueConfigNames(config.configs);
    errors.push(...duplicateResult.errors);
    warnings.push(...duplicateResult.warnings);
  }

  // Check for duplicate provider names
  if (Array.isArray(config.providers)) {
    const duplicateResult = validateUniqueProviderNames(config.providers);
    errors.push(...duplicateResult.errors);
    warnings.push(...duplicateResult.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates default configuration settings
 * @param defaultConfig - The default configuration array
 * @param configs - Available configurations to validate against
 * @returns ValidationResult
 */
export function validateDefaultConfig(defaultConfig: DefaultConfig[], configs: Config[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(defaultConfig)) {
    errors.push('default_config must be an array');
    return { isValid: false, errors, warnings };
  }

  if (defaultConfig.length === 0) {
    warnings.push('default_config array is empty');
    return { isValid: true, errors, warnings };
  }

  if (defaultConfig.length > 1) {
    warnings.push('Multiple default configurations found, only the first will be used');
  }

  const defaultCfg = defaultConfig[0];
  if (!defaultCfg || typeof defaultCfg.name !== 'string') {
    errors.push('default_config[0] must have a valid name string');
    return { isValid: false, errors, warnings };
  }

  if (!defaultCfg.name.trim()) {
    errors.push('default_config name cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Check if the referenced configuration exists
  if (Array.isArray(configs)) {
    const configExists = configs.some(cfg => 
      cfg.config && cfg.config.some(entry => entry.name === defaultCfg.name)
    );
    if (!configExists) {
      errors.push(`Default configuration "${defaultCfg.name}" does not exist in configs array`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single configuration
 * @param config - The configuration to validate
 * @param index - Index of the configuration for error reporting
 * @returns ValidationResult
 */
export function validateConfig(config: Config, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `configs[${index}]`;

  if (!config) {
    errors.push(`${prefix}: Configuration is null or undefined`);
    return { isValid: false, errors, warnings };
  }

  // Validate config array
  if (!Array.isArray(config.config)) {
    errors.push(`${prefix}: config must be an array`);
  } else {
    if (config.config.length === 0) {
      errors.push(`${prefix}: config array cannot be empty`);
    }

    config.config.forEach((entry, entryIndex) => {
      const entryResult = validateConfigEntry(entry, `${prefix}.config[${entryIndex}]`);
      errors.push(...entryResult.errors);
      warnings.push(...entryResult.warnings);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single configuration entry
 * @param entry - The configuration entry to validate
 * @param prefix - Prefix for error messages
 * @returns ValidationResult
 */
export function validateConfigEntry(entry: ConfigEntry, prefix: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!entry) {
    errors.push(`${prefix}: Configuration entry is null or undefined`);
    return { isValid: false, errors, warnings };
  }

  // Validate name
  if (typeof entry.name !== 'string') {
    errors.push(`${prefix}: name must be a string`);
  } else if (!entry.name.trim()) {
    errors.push(`${prefix}: name cannot be empty`);
  }

  // Validate provider
  if (typeof entry.provider !== 'string') {
    errors.push(`${prefix}: provider must be a string`);
  } else if (!entry.provider.trim()) {
    errors.push(`${prefix}: provider cannot be empty`);
  }

  // Validate model
  if (typeof entry.model !== 'string') {
    errors.push(`${prefix}: model must be a string`);
  } else if (!entry.model.trim()) {
    errors.push(`${prefix}: model cannot be empty`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single provider
 * @param provider - The provider to validate
 * @param index - Index of the provider for error reporting
 * @returns ValidationResult
 */
export function validateProvider(provider: Provider, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `providers[${index}]`;

  if (!provider) {
    errors.push(`${prefix}: Provider is null or undefined`);
    return { isValid: false, errors, warnings };
  }

  // Validate provider name
  if (typeof provider.provider !== 'string') {
    errors.push(`${prefix}: provider must be a string`);
  } else if (!provider.provider.trim()) {
    errors.push(`${prefix}: provider cannot be empty`);
  }

  // Validate env object
  if (!provider.env) {
    errors.push(`${prefix}: env object is required`);
  } else {
    const envResult = validateProviderEnv(provider.env, `${prefix}.env`);
    errors.push(...envResult.errors);
    warnings.push(...envResult.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates provider environment configuration
 * @param env - The provider environment to validate
 * @param prefix - Prefix for error messages
 * @returns ValidationResult
 */
export function validateProviderEnv(env: ProviderEnv, prefix: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env) {
    errors.push(`${prefix}: Provider environment is null or undefined`);
    return { isValid: false, errors, warnings };
  }

  // Validate api_key
  if (typeof env.api_key !== 'string') {
    errors.push(`${prefix}: api_key must be a string`);
  } else if (!env.api_key.trim()) {
    errors.push(`${prefix}: api_key cannot be empty`);
  }

  // Validate base_url
  if (typeof env.base_url !== 'string') {
    errors.push(`${prefix}: base_url must be a string`);
  } else if (!env.base_url.trim()) {
    errors.push(`${prefix}: base_url cannot be empty`);
  } else {
    // Validate URL format
    try {
      new URL(env.base_url);
    } catch (error) {
      errors.push(`${prefix}: base_url is not a valid URL format`);
    }
  }

  // Validate models array
  if (!Array.isArray(env.models)) {
    errors.push(`${prefix}: models must be an array`);
  } else {
    if (env.models.length === 0) {
      warnings.push(`${prefix}: models array is empty`);
    }

    env.models.forEach((model, modelIndex) => {
      const modelResult = validateModelEntry(model, `${prefix}.models[${modelIndex}]`);
      errors.push(...modelResult.errors);
      warnings.push(...modelResult.warnings);
    });

    // Check for duplicate model names
    const modelNames = env.models
      .filter(m => m && typeof m.model === 'string')
      .map(m => m.model)
      .filter(name => typeof name === 'string');
    const duplicateModels = modelNames.filter((name, index) => modelNames.indexOf(name) !== index);
    if (duplicateModels.length > 0) {
      warnings.push(`${prefix}: Duplicate model names found: ${[...new Set(duplicateModels)].join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single model entry
 * @param model - The model entry to validate
 * @param prefix - Prefix for error messages
 * @returns ValidationResult
 */
export function validateModelEntry(model: ModelEntry, prefix: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!model) {
    errors.push(`${prefix}: Model entry is null or undefined`);
    return { isValid: false, errors, warnings };
  }

  // Validate model name
  if (typeof model.model !== 'string') {
    errors.push(`${prefix}: model must be a string`);
  } else if (!model.model.trim()) {
    errors.push(`${prefix}: model cannot be empty`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates cross-references between configurations and providers
 * @param configs - Array of configurations
 * @param providers - Array of providers
 * @returns ValidationResult
 */
export function validateProviderModelCrossReferences(configs: Config[], providers: Provider[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Create lookup maps for efficient validation
  const providerMap = new Map<string, Provider>();
  providers.forEach(provider => {
    if (typeof provider.provider === 'string') {
      providerMap.set(provider.provider, provider);
    }
  });

  configs.forEach((config, configIndex) => {
    if (!Array.isArray(config.config)) return;

    config.config.forEach((entry, entryIndex) => {
      const prefix = `configs[${configIndex}].config[${entryIndex}]`;

      // Check if provider exists
      if (typeof entry.provider === 'string' && entry.provider.trim()) {
        const provider = providerMap.get(entry.provider);
        if (!provider) {
          errors.push(`${prefix}: Provider "${entry.provider}" not found in providers array`);
        } else {
          // Check if model exists in provider's models
          if (typeof entry.model === 'string' && entry.model.trim()) {
            const modelExists = provider.env?.models?.some(m => m.model === entry.model);
            if (!modelExists) {
              errors.push(`${prefix}: Model "${entry.model}" not found in provider "${entry.provider}" models list`);
            }
          }
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates that configuration names are unique
 * @param configs - Array of configurations
 * @returns ValidationResult
 */
export function validateUniqueConfigNames(configs: Config[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collect all configuration entry names from all config groups
  const configNames: string[] = [];
  configs.forEach(cfg => {
    if (Array.isArray(cfg.config)) {
      cfg.config.forEach(entry => {
        if (typeof entry.name === 'string') {
          configNames.push(entry.name);
        }
      });
    }
  });

  const duplicateNames = configNames.filter((name, index) => configNames.indexOf(name) !== index);
  
  if (duplicateNames.length > 0) {
    errors.push(`Duplicate configuration names found: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates that provider names are unique
 * @param providers - Array of providers
 * @returns ValidationResult
 */
export function validateUniqueProviderNames(providers: Provider[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const providerNames = providers
    .map(provider => provider.provider)
    .filter(name => typeof name === 'string');

  const duplicateNames = providerNames.filter((name, index) => providerNames.indexOf(name) !== index);
  
  if (duplicateNames.length > 0) {
    errors.push(`Duplicate provider names found: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a specific configuration by name
 * @param configName - Name of the configuration to validate
 * @param configFile - The complete configuration file
 * @returns ValidationResult
 */
export function validateConfigurationByName(configName: string, configFile: ConfigFile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!configName || typeof configName !== 'string') {
    errors.push('Configuration name must be a non-empty string');
    return { isValid: false, errors, warnings };
  }

  // Find the configuration entry by name across all config groups
  let foundConfigEntry: ConfigEntry | null = null;
  let foundConfigGroup: Config | null = null;
  
  for (const cfg of configFile.configs || []) {
    if (Array.isArray(cfg.config)) {
      const entry = cfg.config.find(entry => entry.name === configName);
      if (entry) {
        foundConfigEntry = entry;
        foundConfigGroup = cfg;
        break;
      }
    }
  }
  
  if (!foundConfigEntry || !foundConfigGroup) {
    errors.push(`Configuration "${configName}" not found`);
    const availableConfigs: string[] = [];
    configFile.configs?.forEach(cfg => {
      if (Array.isArray(cfg.config)) {
        cfg.config.forEach(entry => {
          if (typeof entry.name === 'string') {
            availableConfigs.push(entry.name);
          }
        });
      }
    });
    if (availableConfigs.length > 0) {
      errors.push(`Available configurations: ${availableConfigs.join(', ')}`);
    }
    return { isValid: false, errors, warnings };
  }

  // Validate the specific configuration group
  const configResult = validateConfig(foundConfigGroup, 0);
  errors.push(...configResult.errors);
  warnings.push(...configResult.warnings);

  // Validate cross-references for this specific configuration
  if (configFile.providers) {
    const crossValidationResult = validateProviderModelCrossReferences([foundConfigGroup], configFile.providers);
    errors.push(...crossValidationResult.errors);
    warnings.push(...crossValidationResult.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}