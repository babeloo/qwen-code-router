/**
 * Unit tests for configuration validation logic
 * Tests all validation functions with various scenarios including edge cases
 */

import {
  validateConfigFile,
  validateDefaultConfig,
  validateConfig,
  validateConfigEntry,
  validateProvider,
  validateProviderEnv,
  validateModelEntry,
  validateProviderModelCrossReferences,
  validateUniqueConfigNames,
  validateUniqueProviderNames,
  validateConfigurationByName
} from '../src/validation';

import {
  ConfigFile,
  Config,
  Provider,
  ConfigEntry,
  ModelEntry,
  ProviderEnv
} from '../src/types';

describe('Configuration Validation', () => {
  // Sample valid configuration for testing
  const validConfigFile: ConfigFile = {
    default_config: [{ name: 'openai-gpt4' }],
    configs: [
      {
        config: [
          { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
          { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' }
        ]
      }
    ],
    providers: [
      {
        provider: 'openai',
        env: {
          api_key: 'test-key',
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
          api_key: 'azure-key',
          base_url: 'https://myazure.openai.azure.com/openai',
          models: [
            { model: 'gpt-35-turbo' },
            { model: 'gpt-4' }
          ]
        }
      }
    ]
  };

  describe('validateConfigFile', () => {
    it('should validate a complete valid configuration file', () => {
      const result = validateConfigFile(validConfigFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined configuration', () => {
      const result = validateConfigFile(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration file is null or undefined');
    });

    it('should reject configuration without configs array', () => {
      const invalidConfig = { ...validConfigFile };
      delete (invalidConfig as any).configs;
      
      const result = validateConfigFile(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing or invalid "configs" array');
    });

    it('should reject configuration without providers array', () => {
      const invalidConfig = { ...validConfigFile };
      delete (invalidConfig as any).providers;
      
      const result = validateConfigFile(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing or invalid "providers" array');
    });

    it('should validate configuration without default_config', () => {
      const configWithoutDefault = { ...validConfigFile };
      delete configWithoutDefault.default_config;
      
      const result = validateConfigFile(configWithoutDefault);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect duplicate configuration names', () => {
      const configWithDuplicates: ConfigFile = {
        ...validConfigFile,
        configs: [
          { 
            config: [
              { name: 'duplicate', provider: 'openai', model: 'gpt-4' },
              { name: 'duplicate', provider: 'azure', model: 'gpt-35-turbo' }
            ]
          }
        ]
      };
      
      const result = validateConfigFile(configWithDuplicates);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Duplicate configuration names'))).toBe(true);
    });

    it('should detect duplicate provider names', () => {
      const configWithDuplicateProviders: ConfigFile = {
        ...validConfigFile,
        providers: [
          {
            provider: 'duplicate',
            env: { api_key: 'key1', base_url: 'https://api1.com', models: [{ model: 'model1' }] }
          },
          {
            provider: 'duplicate',
            env: { api_key: 'key2', base_url: 'https://api2.com', models: [{ model: 'model2' }] }
          }
        ]
      };
      
      const result = validateConfigFile(configWithDuplicateProviders);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Duplicate provider names'))).toBe(true);
    });
  });

  describe('validateDefaultConfig', () => {
    it('should validate valid default configuration', () => {
      const defaultConfig = [{ name: 'openai-gpt4' }];
      const configs = validConfigFile.configs;
      
      const result = validateDefaultConfig(defaultConfig, configs);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array default configuration', () => {
      const result = validateDefaultConfig('invalid' as any, []);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('default_config must be an array');
    });

    it('should warn about empty default configuration array', () => {
      const result = validateDefaultConfig([], []);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('default_config array is empty');
    });

    it('should warn about multiple default configurations', () => {
      const multipleDefaults = [
        { name: 'config1' },
        { name: 'config2' }
      ];
      
      const result = validateDefaultConfig(multipleDefaults, []);
      
      expect(result.warnings).toContain('Multiple default configurations found, only the first will be used');
    });

    it('should reject default configuration with invalid name', () => {
      const invalidDefault = [{ name: '' }];
      
      const result = validateDefaultConfig(invalidDefault, []);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('default_config name cannot be empty');
    });

    it('should reject default configuration referencing non-existent config', () => {
      const defaultConfig = [{ name: 'non-existent' }];
      const configs = [{ config: [{ name: 'existing', provider: 'openai', model: 'gpt-4' }] }];
      
      const result = validateDefaultConfig(defaultConfig, configs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Default configuration "non-existent" does not exist in configs array');
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config: Config = {
        config: [{ name: 'test-config', provider: 'openai', model: 'gpt-4' }]
      };
      
      const result = validateConfig(config, 0);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null configuration', () => {
      const result = validateConfig(null as any, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('configs[0]: Configuration is null or undefined');
    });

    it('should reject configuration with empty config array', () => {
      const config: Config = {
        config: []
      };
      
      const result = validateConfig(config, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('configs[0]: config array cannot be empty');
    });

    it('should reject configuration with non-array config', () => {
      const config = {
        config: 'invalid'
      } as any;
      
      const result = validateConfig(config, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('configs[0]: config must be an array');
    });
  });

  describe('validateConfigEntry', () => {
    it('should validate valid configuration entry', () => {
      const entry: ConfigEntry = { name: 'test-config', provider: 'openai', model: 'gpt-4' };
      
      const result = validateConfigEntry(entry, 'test');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null configuration entry', () => {
      const result = validateConfigEntry(null as any, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: Configuration entry is null or undefined');
    });

    it('should reject entry with empty name', () => {
      const entry: ConfigEntry = { name: '', provider: 'openai', model: 'gpt-4' };
      
      const result = validateConfigEntry(entry, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: name cannot be empty');
    });

    it('should reject entry with empty provider', () => {
      const entry: ConfigEntry = { name: 'test-config', provider: '', model: 'gpt-4' };
      
      const result = validateConfigEntry(entry, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: provider cannot be empty');
    });

    it('should reject entry with empty model', () => {
      const entry: ConfigEntry = { name: 'test-config', provider: 'openai', model: '' };
      
      const result = validateConfigEntry(entry, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: model cannot be empty');
    });
  });

  describe('validateProvider', () => {
    it('should validate valid provider', () => {
      const provider: Provider = {
        provider: 'openai',
        env: {
          api_key: 'test-key',
          base_url: 'https://api.openai.com/v1',
          models: [{ model: 'gpt-4' }]
        }
      };
      
      const result = validateProvider(provider, 0);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null provider', () => {
      const result = validateProvider(null as any, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('providers[0]: Provider is null or undefined');
    });

    it('should reject provider with empty name', () => {
      const provider: Provider = {
        provider: '',
        env: {
          api_key: 'test-key',
          base_url: 'https://api.openai.com/v1',
          models: [{ model: 'gpt-4' }]
        }
      };
      
      const result = validateProvider(provider, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('providers[0]: provider cannot be empty');
    });

    it('should reject provider without env object', () => {
      const provider = { provider: 'openai' } as any;
      
      const result = validateProvider(provider, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('providers[0]: env object is required');
    });
  });

  describe('validateProviderEnv', () => {
    it('should validate valid provider environment', () => {
      const env: ProviderEnv = {
        api_key: 'test-key',
        base_url: 'https://api.openai.com/v1',
        models: [{ model: 'gpt-4' }]
      };
      
      const result = validateProviderEnv(env, 'test');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null provider environment', () => {
      const result = validateProviderEnv(null as any, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: Provider environment is null or undefined');
    });

    it('should reject environment with empty api_key', () => {
      const env: ProviderEnv = {
        api_key: '',
        base_url: 'https://api.openai.com/v1',
        models: [{ model: 'gpt-4' }]
      };
      
      const result = validateProviderEnv(env, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: api_key cannot be empty');
    });

    it('should reject environment with invalid base_url', () => {
      const env: ProviderEnv = {
        api_key: 'test-key',
        base_url: 'invalid-url',
        models: [{ model: 'gpt-4' }]
      };
      
      const result = validateProviderEnv(env, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: base_url is not a valid URL format');
    });

    it('should warn about empty models array', () => {
      const env: ProviderEnv = {
        api_key: 'test-key',
        base_url: 'https://api.openai.com/v1',
        models: []
      };
      
      const result = validateProviderEnv(env, 'test');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('test: models array is empty');
    });

    it('should warn about duplicate model names', () => {
      const env: ProviderEnv = {
        api_key: 'test-key',
        base_url: 'https://api.openai.com/v1',
        models: [
          { model: 'gpt-4' },
          { model: 'gpt-4' },
          { model: 'gpt-3.5-turbo' }
        ]
      };
      
      const result = validateProviderEnv(env, 'test');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('Duplicate model names'))).toBe(true);
    });
  });

  describe('validateModelEntry', () => {
    it('should validate valid model entry', () => {
      const model: ModelEntry = { model: 'gpt-4' };
      
      const result = validateModelEntry(model, 'test');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null model entry', () => {
      const result = validateModelEntry(null as any, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: Model entry is null or undefined');
    });

    it('should reject model entry with empty model name', () => {
      const model: ModelEntry = { model: '' };
      
      const result = validateModelEntry(model, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test: model cannot be empty');
    });
  });

  describe('validateProviderModelCrossReferences', () => {
    it('should validate valid cross-references', () => {
      const result = validateProviderModelCrossReferences(validConfigFile.configs, validConfigFile.providers);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect reference to non-existent provider', () => {
      const configs: Config[] = [
        {
          config: [{ name: 'test-config', provider: 'non-existent', model: 'gpt-4' }]
        }
      ];
      
      const result = validateProviderModelCrossReferences(configs, validConfigFile.providers);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('configs[0].config[0]: Provider "non-existent" not found in providers array');
    });

    it('should detect reference to non-existent model', () => {
      const configs: Config[] = [
        {
          config: [{ name: 'test-config', provider: 'openai', model: 'non-existent-model' }]
        }
      ];
      
      const result = validateProviderModelCrossReferences(configs, validConfigFile.providers);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('configs[0].config[0]: Model "non-existent-model" not found in provider "openai" models list');
    });
  });

  describe('validateUniqueConfigNames', () => {
    it('should pass for unique configuration names', () => {
      const result = validateUniqueConfigNames(validConfigFile.configs);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate configuration names', () => {
      const configs: Config[] = [
        { 
          config: [
            { name: 'duplicate', provider: 'openai', model: 'gpt-4' },
            { name: 'duplicate', provider: 'azure', model: 'gpt-35-turbo' },
            { name: 'unique', provider: 'openai', model: 'gpt-3.5-turbo' }
          ]
        }
      ];
      
      const result = validateUniqueConfigNames(configs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate configuration names found: duplicate');
    });
  });

  describe('validateUniqueProviderNames', () => {
    it('should pass for unique provider names', () => {
      const result = validateUniqueProviderNames(validConfigFile.providers);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate provider names', () => {
      const providers: Provider[] = [
        {
          provider: 'duplicate',
          env: { api_key: 'key1', base_url: 'https://api1.com', models: [] }
        },
        {
          provider: 'duplicate',
          env: { api_key: 'key2', base_url: 'https://api2.com', models: [] }
        }
      ];
      
      const result = validateUniqueProviderNames(providers);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate provider names found: duplicate');
    });
  });

  describe('validateConfigurationByName', () => {
    it('should validate existing configuration by name', () => {
      const result = validateConfigurationByName('openai-gpt4', validConfigFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty configuration name', () => {
      const result = validateConfigurationByName('', validConfigFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration name must be a non-empty string');
    });

    it('should reject non-existent configuration name', () => {
      const result = validateConfigurationByName('non-existent', validConfigFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration "non-existent" not found');
      expect(result.errors.some(error => error.includes('Available configurations:'))).toBe(true);
    });

    it('should validate cross-references for specific configuration', () => {
      const configWithInvalidRef: ConfigFile = {
        ...validConfigFile,
        configs: [
          {
            config: [{ name: 'invalid-config', provider: 'non-existent', model: 'gpt-4' }]
          }
        ]
      };
      
      const result = validateConfigurationByName('invalid-config', configWithInvalidRef);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Provider "non-existent" not found'))).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle configuration with mixed valid and invalid entries', () => {
      const mixedConfig: ConfigFile = {
        configs: [
          {
            config: [
              { name: 'valid-config', provider: 'openai', model: 'gpt-4' },
              { name: '', provider: '', model: '' }
            ]
          }
        ],
        providers: [
          {
            provider: 'openai',
            env: {
              api_key: 'test-key',
              base_url: 'https://api.openai.com/v1',
              models: [{ model: 'gpt-4' }]
            }
          }
        ]
      };
      
      const result = validateConfigFile(mixedConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle provider with mixed valid and invalid models', () => {
      const env: ProviderEnv = {
        api_key: 'test-key',
        base_url: 'https://api.openai.com/v1',
        models: [
          { model: 'gpt-4' },
          { model: '' },
          null as any,
          { model: 'gpt-3.5-turbo' }
        ]
      };
      
      const result = validateProviderEnv(env, 'test');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});