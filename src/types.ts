/**
 * Core data model interfaces for Qwen Code Router
 * 
 * These interfaces define the structure of configuration files and internal data models
 * used throughout the application for managing API configurations for different LLM providers.
 */

/**
 * Represents a single model entry within a provider's supported models list
 */
export interface ModelEntry {
  /** The model identifier (e.g., "gpt-4", "gpt-3.5-turbo") */
  model: string;
}

/**
 * Environment configuration for a specific provider
 * Contains API credentials and endpoint information
 */
export interface ProviderEnv {
  /** API key for authentication with the provider */
  api_key: string;
  /** Base URL for the provider's API endpoint */
  base_url: string;
  /** List of models supported by this provider */
  models: ModelEntry[];
}

/**
 * Complete provider definition including name and environment configuration
 */
export interface Provider {
  /** Provider identifier (e.g., "openai", "azure", "anthropic") */
  provider: string;
  /** Environment configuration for this provider */
  env: ProviderEnv;
}

/**
 * A single configuration entry that maps a provider to a specific model
 */
export interface ConfigEntry {
  /** The provider to use for this configuration */
  provider: string;
  /** The specific model to use from the provider */
  model: string;
}

/**
 * A named configuration that can contain multiple provider-model pairs
 */
export interface Config {
  /** Unique name for this configuration */
  config_name: string;
  /** Array of provider-model configurations */
  config: ConfigEntry[];
}

/**
 * Default configuration marker
 */
export interface DefaultConfig {
  /** Name of the configuration to use as default */
  config_name: string;
}

/**
 * Complete configuration file structure
 * This is the root interface for configuration files (JSON/YAML)
 */
export interface ConfigFile {
  /** Optional default configuration settings */
  default_config?: DefaultConfig[];
  /** Array of named configurations */
  configs: Config[];
  /** Array of provider definitions */
  providers: Provider[];
}

/**
 * Environment variables that the tool manages
 */
export interface EnvironmentVariables {
  /** OpenAI API key environment variable */
  OPENAI_API_KEY: string;
  /** OpenAI base URL environment variable */
  OPENAI_BASE_URL: string;
  /** OpenAI model environment variable */
  OPENAI_MODEL: string;
}

/**
 * Validation result for configuration checks
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** Array of error messages if validation failed */
  errors: string[];
  /** Array of warning messages */
  warnings: string[];
}

/**
 * Configuration file format types
 */
export type ConfigFileFormat = 'json' | 'yaml';

/**
 * Supported provider names (case-insensitive)
 */
export type SupportedProvider = 'openai' | 'azure' | 'anthropic' | 'google';

/**
 * Command line argument types for different operations
 */
export interface CommandArgs {
  /** Command name */
  command: string;
  /** Additional arguments */
  args: string[];
}

/**
 * Configuration discovery result
 */
export interface ConfigDiscoveryResult {
  /** Path to the found configuration file */
  filePath: string | null;
  /** Format of the configuration file */
  format: ConfigFileFormat | null;
  /** Whether a configuration file was found */
  found: boolean;
}