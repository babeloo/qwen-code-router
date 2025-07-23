/**
 * Unit tests for TypeScript interfaces and type definitions
 * Tests type validation and interface structure compliance
 */

import {
  ModelEntry,
  ProviderEnv,
  Provider,
  ConfigEntry,
  Config,
  DefaultConfig,
  ConfigFile,
  EnvironmentVariables,
  ValidationResult,
  ConfigFileFormat,
  SupportedProvider,
  CommandArgs,
  ConfigDiscoveryResult
} from '../src/types';

describe('Type Definitions', () => {
  describe('ModelEntry', () => {
    it('should accept valid model entry', () => {
      const modelEntry: ModelEntry = {
        model: 'gpt-4'
      };
      
      expect(modelEntry.model).toBe('gpt-4');
      expect(typeof modelEntry.model).toBe('string');
    });

    it('should require model property', () => {
      // TypeScript compilation test - this should fail if model is missing
      const createModelEntry = (model: string): ModelEntry => ({ model });
      const result = createModelEntry('gpt-3.5-turbo');
      
      expect(result).toHaveProperty('model');
    });
  });

  describe('ProviderEnv', () => {
    it('should accept valid provider environment', () => {
      const providerEnv: ProviderEnv = {
        api_key: 'test-api-key',
        base_url: 'https://api.openai.com/v1',
        models: [
          { model: 'gpt-4' },
          { model: 'gpt-3.5-turbo' }
        ]
      };

      expect(providerEnv.api_key).toBe('test-api-key');
      expect(providerEnv.base_url).toBe('https://api.openai.com/v1');
      expect(providerEnv.models).toHaveLength(2);
      expect(providerEnv.models[0]?.model).toBe('gpt-4');
    });

    it('should require all properties', () => {
      const createProviderEnv = (api_key: string, base_url: string, models: ModelEntry[]): ProviderEnv => ({
        api_key,
        base_url,
        models
      });

      const result = createProviderEnv('key', 'url', []);
      expect(result).toHaveProperty('api_key');
      expect(result).toHaveProperty('base_url');
      expect(result).toHaveProperty('models');
    });
  });

  describe('Provider', () => {
    it('should accept valid provider', () => {
      const provider: Provider = {
        provider: 'openai',
        env: {
          api_key: 'test-key',
          base_url: 'https://api.openai.com/v1',
          models: [{ model: 'gpt-4' }]
        }
      };

      expect(provider.provider).toBe('openai');
      expect(provider.env.api_key).toBe('test-key');
    });
  });

  describe('ConfigEntry', () => {
    it('should accept valid config entry', () => {
      const configEntry: ConfigEntry = {
        name: 'openai-gpt4',
        provider: 'openai',
        model: 'gpt-4'
      };

      expect(configEntry.name).toBe('openai-gpt4');
      expect(configEntry.provider).toBe('openai');
      expect(configEntry.model).toBe('gpt-4');
    });
  });

  describe('Config', () => {
    it('should accept valid configuration', () => {
      const config: Config = {
        config: [
          {
            name: 'openai-gpt4',
            provider: 'openai',
            model: 'gpt-4'
          }
        ]
      };

      expect(config.config).toHaveLength(1);
      expect(config.config[0]?.name).toBe('openai-gpt4');
      expect(config.config[0]?.provider).toBe('openai');
    });

    it('should support multiple config entries', () => {
      const config: Config = {
        config: [
          { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
          { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' }
        ]
      };

      expect(config.config).toHaveLength(2);
    });
  });

  describe('DefaultConfig', () => {
    it('should accept valid default config', () => {
      const defaultConfig: DefaultConfig = {
        name: 'openai-gpt4'
      };

      expect(defaultConfig.name).toBe('openai-gpt4');
    });
  });

  describe('ConfigFile', () => {
    it('should accept complete configuration file', () => {
      const configFile: ConfigFile = {
        default_config: [{ name: 'openai-gpt4' }],
        configs: [
          {
            config: [{ name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' }]
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

      expect(configFile.configs).toHaveLength(1);
      expect(configFile.providers).toHaveLength(1);
      expect(configFile.default_config).toHaveLength(1);
    });

    it('should allow optional default_config', () => {
      const configFile: ConfigFile = {
        configs: [
          {
            config: [{ name: 'test-config', provider: 'openai', model: 'gpt-4' }]
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

      expect(configFile.default_config).toBeUndefined();
      expect(configFile.configs).toHaveLength(1);
      expect(configFile.providers).toHaveLength(1);
    });
  });

  describe('EnvironmentVariables', () => {
    it('should accept valid environment variables', () => {
      const envVars: EnvironmentVariables = {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
        OPENAI_MODEL: 'gpt-4'
      };

      expect(envVars.OPENAI_API_KEY).toBe('test-key');
      expect(envVars.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(envVars.OPENAI_MODEL).toBe('gpt-4');
    });
  });

  describe('ValidationResult', () => {
    it('should accept valid validation result', () => {
      const validResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validResult.warnings).toHaveLength(0);
    });

    it('should accept validation result with errors', () => {
      const invalidResult: ValidationResult = {
        isValid: false,
        errors: ['Missing API key', 'Invalid URL'],
        warnings: ['Deprecated model']
      };

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
      expect(invalidResult.warnings).toHaveLength(1);
    });
  });

  describe('Type Aliases', () => {
    it('should accept valid ConfigFileFormat values', () => {
      const jsonFormat: ConfigFileFormat = 'json';
      const yamlFormat: ConfigFileFormat = 'yaml';

      expect(jsonFormat).toBe('json');
      expect(yamlFormat).toBe('yaml');
    });

    it('should accept valid SupportedProvider values', () => {
      const providers: SupportedProvider[] = ['openai', 'azure', 'anthropic', 'google'];
      
      providers.forEach(provider => {
        expect(['openai', 'azure', 'anthropic', 'google']).toContain(provider);
      });
    });
  });

  describe('CommandArgs', () => {
    it('should accept valid command arguments', () => {
      const commandArgs: CommandArgs = {
        command: 'use',
        args: ['openai-gpt4']
      };

      expect(commandArgs.command).toBe('use');
      expect(commandArgs.args).toHaveLength(1);
      expect(commandArgs.args[0]).toBe('openai-gpt4');
    });

    it('should accept empty args array', () => {
      const commandArgs: CommandArgs = {
        command: 'list',
        args: []
      };

      expect(commandArgs.args).toHaveLength(0);
    });
  });

  describe('ConfigDiscoveryResult', () => {
    it('should accept successful discovery result', () => {
      const discoveryResult: ConfigDiscoveryResult = {
        filePath: '/path/to/config.yaml',
        format: 'yaml',
        found: true
      };

      expect(discoveryResult.filePath).toBe('/path/to/config.yaml');
      expect(discoveryResult.format).toBe('yaml');
      expect(discoveryResult.found).toBe(true);
    });

    it('should accept failed discovery result', () => {
      const discoveryResult: ConfigDiscoveryResult = {
        filePath: null,
        format: null,
        found: false
      };

      expect(discoveryResult.filePath).toBeNull();
      expect(discoveryResult.format).toBeNull();
      expect(discoveryResult.found).toBe(false);
    });
  });
});

describe('Type Compatibility', () => {
  it('should ensure ConfigFile structure matches design requirements', () => {
    // Test that our interfaces match the expected JSON/YAML structure
    const sampleConfigFile: ConfigFile = {
      default_config: [
        { name: 'openai-gpt4' }
      ],
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
            api_key: 'YOUR_OPENAI_API_KEY',
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
            api_key: 'YOUR_AZURE_API_KEY',
            base_url: 'https://myazure.openai.azure.com/openai',
            models: [
              { model: 'gpt-35-turbo' },
              { model: 'gpt-4' }
            ]
          }
        }
      ]
    };

    // Verify structure matches design document examples
    expect(sampleConfigFile.default_config?.[0]?.name).toBe('openai-gpt4');
    expect(sampleConfigFile.configs).toHaveLength(1);
    expect(sampleConfigFile.configs[0]?.config).toHaveLength(2);
    expect(sampleConfigFile.providers).toHaveLength(2);
    
    // Verify provider structure
    const openaiProvider = sampleConfigFile.providers.find(p => p.provider === 'openai');
    expect(openaiProvider).toBeDefined();
    expect(openaiProvider?.env.base_url).toBe('https://api.openai.com/v1');
    expect(openaiProvider?.env.models).toHaveLength(2);
  });
});