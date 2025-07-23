/**
 * Unit tests for configuration resolution logic
 * Tests resolving configurations by name, provider-model pairs, and default configurations
 */

import {
  resolveConfigurationByName,
  resolveConfigurationByProviderModel,
  resolveDefaultConfiguration,
  setDefaultConfiguration,
  findConfigurationByName,
  findProviderByName,
  getAllConfigurationNames,
  getAllProviderNames,
  getModelsForProvider,
  getModelsForBuiltInProvider,
  getBuiltInProviderNames,
  isBuiltInProvider,
  getCurrentDefaultConfiguration,
  validateConfigurationResolution,
  validateProviderModelResolution,
  BUILT_IN_PROVIDERS
} from '../src/resolver';
import { ConfigFile } from '../src/types';
import { REQUIRED_ENV_VARS } from '../src/environment';

describe('Configuration Resolution Logic', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };

  // Sample configuration file for testing
  const sampleConfigFile: ConfigFile = {
    default_config: [{ name: 'openai-gpt4' }],
    configs: [
      {
        config: [
          {
            name: 'openai-gpt4',
            provider: 'openai',
            model: 'gpt-4'
          },
          {
            name: 'azure-gpt35',
            provider: 'azure',
            model: 'gpt-35-turbo'
          },
          {
            name: 'anthropic-claude',
            provider: 'anthropic',
            model: 'claude-3-opus'
          }
        ]
      }
    ],
    providers: [
      {
        provider: 'openai',
        env: {
          api_key: 'test-openai-key',
          base_url: 'https://api.openai.com/v1',
          models: [
            { model: 'gpt-4' },
            { model: 'gpt-3.5-turbo' }
          ]
        }
      },
      {
        provider: 'azure',
        env: {
          api_key: 'test-azure-key',
          base_url: 'https://myazure.openai.azure.com/openai',
          models: [
            { model: 'gpt-35-turbo' },
            { model: 'gpt-4' }
          ]
        }
      },
      {
        provider: 'anthropic',
        env: {
          api_key: 'test-anthropic-key',
          base_url: 'https://api.anthropic.com/v1',
          models: [
            { model: 'claude-3-opus' },
            { model: 'claude-3-sonnet' }
          ]
        }
      }
    ]
  };

  beforeEach(() => {
    // Reset environment variables before each test
    Object.keys(REQUIRED_ENV_VARS).forEach(key => {
      const envVar = REQUIRED_ENV_VARS[key as keyof typeof REQUIRED_ENV_VARS];
      delete process.env[envVar];
    });
    
    // Clear provider-specific API keys
    delete process.env['OPENAI_API_KEY'];
    delete process.env['AZURE_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
  });

  afterAll(() => {
    // Restore original environment variables after all tests
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe('resolveConfigurationByName', () => {
    it('should resolve configuration by name successfully', () => {
      const result = resolveConfigurationByName('openai-gpt4', sampleConfigFile);
      
      expect(result.success).toBe(true);
      expect(result.environmentVariables).toEqual({
        OPENAI_API_KEY: 'test-openai-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
        OPENAI_MODEL: 'gpt-4'
      });
      expect(result.configEntry?.name).toBe('openai-gpt4');
      expect(result.provider?.provider).toBe('openai');
      expect(result.usedBuiltInProvider).toBe(false);
      
      // Verify environment variables were set
      expect(process.env['OPENAI_API_KEY']).toBe('test-openai-key');
      expect(process.env['OPENAI_BASE_URL']).toBe('https://api.openai.com/v1');
      expect(process.env['OPENAI_MODEL']).toBe('gpt-4');
    });

    it('should fail when configuration does not exist', () => {
      const result = resolveConfigurationByName('nonexistent', sampleConfigFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration \"nonexistent\" not found');
      expect(result.error).toContain('Available configurations:');
    });

    it('should fail when provider does not exist', () => {
      const configWithMissingProvider: ConfigFile = {
        configs: [
          {
            config: [
              {
                name: 'test-config',
                provider: 'nonexistent-provider',
                model: 'test-model'
              }
            ]
          }
        ],
        providers: []
      };

      const result = resolveConfigurationByName('test-config', configWithMissingProvider);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider \"nonexistent-provider\" not found');
    });

    it('should fail when model is not supported by provider', () => {
      const result = resolveConfigurationByName('azure-gpt35', {
        ...sampleConfigFile,
        configs: [
          {
            config: [
              {
                name: 'azure-gpt35',
                provider: 'azure',
                model: 'unsupported-model'
              }
            ]
          }
        ]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Model \"unsupported-model\" is not supported by provider \"azure\"');
    });
  });

  describe('resolveConfigurationByProviderModel', () => {
    it('should resolve using configured provider when available', () => {
      const result = resolveConfigurationByProviderModel('openai', 'gpt-4', sampleConfigFile);
      
      expect(result.success).toBe(true);
      expect(result.environmentVariables).toEqual({
        OPENAI_API_KEY: 'test-openai-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
        OPENAI_MODEL: 'gpt-4'
      });
      expect(result.usedBuiltInProvider).toBe(false);
    });

    it('should resolve using built-in provider when configured provider not available', () => {
      process.env['OPENAI_API_KEY'] = 'test-builtin-key';
      
      const result = resolveConfigurationByProviderModel('google', 'gemini-pro');
      
      expect(result.success).toBe(true);
      expect(result.environmentVariables).toEqual({
        OPENAI_API_KEY: 'test-builtin-key',
        OPENAI_BASE_URL: 'https://generativelanguage.googleapis.com/v1',
        OPENAI_MODEL: 'gemini-pro'
      });
      expect(result.usedBuiltInProvider).toBe(true);
    });

    it('should use provider-specific API key for built-in providers', () => {
      process.env['GOOGLE_API_KEY'] = 'test-google-key';
      
      const result = resolveConfigurationByProviderModel('google', 'gemini-pro');
      
      expect(result.success).toBe(true);
      expect(result.environmentVariables?.OPENAI_API_KEY).toBe('test-google-key');
    });

    it('should handle Azure resource name generation', () => {
      process.env['AZURE_API_KEY'] = 'test-azure-key';
      
      const result = resolveConfigurationByProviderModel('azure', 'gpt-35-turbo');
      
      expect(result.success).toBe(true);
      expect(result.environmentVariables?.OPENAI_BASE_URL).toBe('https://gpt-35-turbo.openai.azure.com/openai');
    });

    it('should fail when provider is not found', () => {
      const result = resolveConfigurationByProviderModel('nonexistent', 'test-model');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Built-in provider \"nonexistent\" not found');
    });

    it('should fail when model is not supported by built-in provider', () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      
      const result = resolveConfigurationByProviderModel('openai', 'unsupported-model');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Model \"unsupported-model\" is not supported by built-in provider \"openai\"');
    });

    it('should fail when API key is not available for built-in provider', () => {
      const result = resolveConfigurationByProviderModel('openai', 'gpt-4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not found for provider \"openai\"');
    });

    it('should handle case-insensitive provider names', () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      
      const result = resolveConfigurationByProviderModel('OpEnAi', 'gpt-4');
      
      expect(result.success).toBe(true);
      expect(result.environmentVariables?.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
    });
  });

  describe('resolveDefaultConfiguration', () => {
    it('should resolve default configuration successfully', () => {
      const result = resolveDefaultConfiguration(sampleConfigFile);
      
      expect(result.success).toBe(true);
      expect(result.configEntry?.name).toBe('openai-gpt4');
      expect(result.environmentVariables).toEqual({
        OPENAI_API_KEY: 'test-openai-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
        OPENAI_MODEL: 'gpt-4'
      });
    });

    it('should fail when no default configuration is set', () => {
      const configWithoutDefault: ConfigFile = {
        configs: sampleConfigFile.configs,
        providers: sampleConfigFile.providers
      };

      const result = resolveDefaultConfiguration(configWithoutDefault);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No default configuration is set');
    });

    it('should fail when default configuration does not exist', () => {
      const configWithInvalidDefault: ConfigFile = {
        ...sampleConfigFile,
        default_config: [{ name: 'nonexistent-config' }]
      };

      const result = resolveDefaultConfiguration(configWithInvalidDefault);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration \"nonexistent-config\" not found');
    });
  });

  describe('setDefaultConfiguration', () => {
    it('should set default configuration successfully', () => {
      const configFile = { ...sampleConfigFile };
      const result = setDefaultConfiguration('azure-gpt35', configFile);
      
      expect(result.isValid).toBe(true);
      expect(configFile.default_config).toEqual([{ name: 'azure-gpt35' }]);
    });

    it('should fail when configuration does not exist', () => {
      const configFile = { ...sampleConfigFile };
      const result = setDefaultConfiguration('nonexistent', configFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Configuration \"nonexistent\" not found');
    });
  });

  describe('findConfigurationByName', () => {
    it('should find existing configuration', () => {
      const config = findConfigurationByName('openai-gpt4', sampleConfigFile);
      
      expect(config).not.toBeNull();
      expect(config?.name).toBe('openai-gpt4');
      expect(config?.provider).toBe('openai');
      expect(config?.model).toBe('gpt-4');
    });

    it('should return null for non-existent configuration', () => {
      const config = findConfigurationByName('nonexistent', sampleConfigFile);
      
      expect(config).toBeNull();
    });
  });

  describe('findProviderByName', () => {
    it('should find existing provider', () => {
      const provider = findProviderByName('openai', sampleConfigFile);
      
      expect(provider).not.toBeNull();
      expect(provider?.provider).toBe('openai');
      expect(provider?.env.api_key).toBe('test-openai-key');
    });

    it('should return null for non-existent provider', () => {
      const provider = findProviderByName('nonexistent', sampleConfigFile);
      
      expect(provider).toBeNull();
    });
  });

  describe('getAllConfigurationNames', () => {
    it('should return all configuration names', () => {
      const names = getAllConfigurationNames(sampleConfigFile);
      
      expect(names).toEqual(['openai-gpt4', 'azure-gpt35', 'anthropic-claude']);
    });

    it('should return empty array for empty configuration', () => {
      const emptyConfig: ConfigFile = { configs: [], providers: [] };
      const names = getAllConfigurationNames(emptyConfig);
      
      expect(names).toEqual([]);
    });
  });

  describe('getAllProviderNames', () => {
    it('should return all provider names', () => {
      const names = getAllProviderNames(sampleConfigFile);
      
      expect(names).toEqual(['openai', 'azure', 'anthropic']);
    });

    it('should return empty array for empty providers', () => {
      const emptyConfig: ConfigFile = { configs: [], providers: [] };
      const names = getAllProviderNames(emptyConfig);
      
      expect(names).toEqual([]);
    });
  });

  describe('getModelsForProvider', () => {
    it('should return models for existing provider', () => {
      const models = getModelsForProvider('openai', sampleConfigFile);
      
      expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('should return null for non-existent provider', () => {
      const models = getModelsForProvider('nonexistent', sampleConfigFile);
      
      expect(models).toBeNull();
    });
  });

  describe('getModelsForBuiltInProvider', () => {
    it('should return models for built-in provider', () => {
      const models = getModelsForBuiltInProvider('openai');
      
      expect(models).toEqual(BUILT_IN_PROVIDERS['openai']!.models);
    });

    it('should return null for non-existent built-in provider', () => {
      const models = getModelsForBuiltInProvider('nonexistent');
      
      expect(models).toBeNull();
    });

    it('should handle case-insensitive provider names', () => {
      const models = getModelsForBuiltInProvider('OpEnAi');
      
      expect(models).toEqual(BUILT_IN_PROVIDERS['openai']!.models);
    });
  });

  describe('getBuiltInProviderNames', () => {
    it('should return all built-in provider names', () => {
      const names = getBuiltInProviderNames();
      
      expect(names).toEqual(['openai', 'azure', 'anthropic', 'google']);
    });
  });

  describe('isBuiltInProvider', () => {
    it('should return true for built-in providers', () => {
      expect(isBuiltInProvider('openai')).toBe(true);
      expect(isBuiltInProvider('OpEnAi')).toBe(true);
      expect(isBuiltInProvider('azure')).toBe(true);
      expect(isBuiltInProvider('anthropic')).toBe(true);
      expect(isBuiltInProvider('google')).toBe(true);
    });

    it('should return false for non-built-in providers', () => {
      expect(isBuiltInProvider('custom-provider')).toBe(false);
      expect(isBuiltInProvider('nonexistent')).toBe(false);
    });
  });

  describe('getCurrentDefaultConfiguration', () => {
    it('should return current default configuration name', () => {
      const defaultName = getCurrentDefaultConfiguration(sampleConfigFile);
      
      expect(defaultName).toBe('openai-gpt4');
    });

    it('should return null when no default is set', () => {
      const configWithoutDefault: ConfigFile = {
        configs: sampleConfigFile.configs,
        providers: sampleConfigFile.providers
      };

      const defaultName = getCurrentDefaultConfiguration(configWithoutDefault);
      
      expect(defaultName).toBeNull();
    });
  });

  describe('validateConfigurationResolution', () => {
    it('should validate successful configuration', () => {
      const result = validateConfigurationResolution('openai-gpt4', sampleConfigFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing configuration', () => {
      const result = validateConfigurationResolution('nonexistent', sampleConfigFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Configuration \"nonexistent\" not found');
    });

    it('should detect missing provider', () => {
      const configWithMissingProvider: ConfigFile = {
        configs: [
          {
            config: [
              {
                name: 'test-config',
                provider: 'nonexistent-provider',
                model: 'test-model'
              }
            ]
          }
        ],
        providers: []
      };

      const result = validateConfigurationResolution('test-config', configWithMissingProvider);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Provider \"nonexistent-provider\" not found');
    });

    it('should detect unsupported model', () => {
      const configWithUnsupportedModel: ConfigFile = {
        ...sampleConfigFile,
        configs: [
          {
            config: [
              {
                name: 'test-config',
                provider: 'openai',
                model: 'unsupported-model'
              }
            ]
          }
        ]
      };

      const result = validateConfigurationResolution('test-config', configWithUnsupportedModel);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Model \"unsupported-model\" is not supported');
    });

    it('should detect missing API key', () => {
      const configWithMissingApiKey: ConfigFile = {
        ...sampleConfigFile,
        providers: [
          {
            provider: 'openai',
            env: {
              api_key: '',
              base_url: 'https://api.openai.com/v1',
              models: [{ model: 'gpt-4' }]
            }
          }
        ]
      };

      const result = validateConfigurationResolution('openai-gpt4', configWithMissingApiKey);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Provider \"openai\" is missing API key');
    });

    it('should detect invalid URL', () => {
      const configWithInvalidUrl: ConfigFile = {
        ...sampleConfigFile,
        providers: [
          {
            provider: 'openai',
            env: {
              api_key: 'test-key',
              base_url: 'invalid-url',
              models: [{ model: 'gpt-4' }]
            }
          }
        ]
      };

      const result = validateConfigurationResolution('openai-gpt4', configWithInvalidUrl);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Provider \"openai\" has invalid base URL');
    });

    it('should generate warnings for potential issues', () => {
      const configWithWarnings: ConfigFile = {
        ...sampleConfigFile,
        providers: [
          {
            provider: 'openai',
            env: {
              api_key: 'short',
              base_url: 'http://api.openai.com/v1',
              models: [{ model: 'gpt-4' }]
            }
          }
        ]
      };

      const result = validateConfigurationResolution('openai-gpt4', configWithWarnings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('API key for provider \"openai\" seems unusually short');
      expect(result.warnings).toContain('Base URL for provider \"openai\" does not use HTTPS');
    });
  });

  describe('validateProviderModelResolution', () => {
    it('should validate configured provider successfully', () => {
      const result = validateProviderModelResolution('openai', 'gpt-4', sampleConfigFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate built-in provider successfully', () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      
      const result = validateProviderModelResolution('google', 'gemini-pro');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing API key for built-in provider', () => {
      const result = validateProviderModelResolution('openai', 'gpt-4');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('API key not found for provider \"openai\"');
    });

    it('should detect unsupported model for built-in provider', () => {
      process.env['OPENAI_API_KEY'] = 'test-key';
      
      const result = validateProviderModelResolution('openai', 'unsupported-model');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Model \"unsupported-model\" is not supported by built-in provider \"openai\"');
    });

    it('should detect unknown provider', () => {
      const result = validateProviderModelResolution('nonexistent', 'test-model');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Provider \"nonexistent\" not found');
    });
  });
});