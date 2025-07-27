/**
 * Unit tests for the chk command functionality
 */

import { 
  chkCommand,
  handleChkCommand,
  parseChkCommandArgs,
  validateConfiguration,
  ChkCommandOptions
} from '../src/commands';
import * as persistence from '../src/persistence';
import { ConfigFile } from '../src/types';

// Mock persistence module
jest.mock('../src/persistence');
const mockDiscoverAndLoadConfig = persistence.discoverAndLoadConfig as jest.MockedFunction<typeof persistence.discoverAndLoadConfig>;

// Sample configuration for testing
const sampleConfig: ConfigFile = {
  default_config: [{ name: 'openai-gpt4' }],
  configs: [{
    config: [
      { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
      { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' },
      { name: 'anthropic-claude', provider: 'anthropic', model: 'claude-3-opus' },
      { name: 'invalid-provider', provider: 'nonexistent', model: 'some-model' },
      { name: 'invalid-model', provider: 'openai', model: 'nonexistent-model' }
    ]
  }],
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
        base_url: 'https://test.openai.azure.com/openai',
        models: [
          { model: 'gpt-35-turbo' },
          { model: 'gpt-4' }
        ]
      }
    },
    {
      provider: 'anthropic',
      env: {
        api_key: '',  // Empty API key to test warning
        base_url: 'https://api.anthropic.com/v1',
        models: [
          { model: 'claude-3-opus' },
          { model: 'claude-3-sonnet' }
        ]
      }
    },
    {
      provider: 'empty-models',
      env: {
        api_key: 'test-key',
        base_url: 'https://example.com',
        models: []  // Empty models to test warning
      }
    }
  ]
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseChkCommandArgs', () => {
  it('should parse command without arguments', () => {
    const result = parseChkCommandArgs([]);
    
    expect(result.valid).toBe(true);
    expect(result.options?.configName).toBeUndefined();
    expect(result.options?.verbose).toBeUndefined();
  });

  it('should parse configuration name', () => {
    const result = parseChkCommandArgs(['openai-gpt4']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.configName).toBe('openai-gpt4');
  });

  it('should parse verbose flag', () => {
    const result = parseChkCommandArgs(['-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.verbose).toBe(true);
  });

  it('should parse --verbose flag', () => {
    const result = parseChkCommandArgs(['--verbose']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.verbose).toBe(true);
  });

  it('should parse configuration name with verbose flag', () => {
    const result = parseChkCommandArgs(['azure-gpt35', '-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.configName).toBe('azure-gpt35');
    expect(result.options?.verbose).toBe(true);
  });

  it('should parse help flag', () => {
    const result = parseChkCommandArgs(['-h']);
    
    expect(result.valid).toBe(true);
    expect(result.showHelp).toBe(true);
  });

  it('should parse --help flag', () => {
    const result = parseChkCommandArgs(['--help']);
    
    expect(result.valid).toBe(true);
    expect(result.showHelp).toBe(true);
  });

  it('should fail with unknown option', () => {
    const result = parseChkCommandArgs(['--unknown']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unknown option: --unknown. Use --help for usage information.');
  });

  it('should fail with too many arguments', () => {
    const result = parseChkCommandArgs(['config1', 'config2']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Too many arguments. Expected at most one configuration name, got: config1, config2');
  });
});

describe('validateConfiguration', () => {
  it('should validate a valid configuration', () => {
    const result = validateConfiguration('openai-gpt4', sampleConfig);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0); // No warnings for valid configuration
    expect(result.provider).toEqual({
      name: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      modelCount: 2
    });
    expect(result.model).toEqual({
      name: 'gpt-4',
      isSupported: true
    });
  });

  it('should detect non-existent configuration', () => {
    const result = validateConfiguration('nonexistent', sampleConfig);
    
    expect(result.configName).toBe('nonexistent');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Configuration 'nonexistent' not found");
    expect(result.provider).toBeUndefined();
    expect(result.model).toBeUndefined();
  });

  it('should detect non-existent provider', () => {
    const result = validateConfiguration('invalid-provider', sampleConfig);
    
    expect(result.configName).toBe('invalid-provider');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Provider 'nonexistent' not found in providers section");
    expect(result.provider).toBeUndefined();
    expect(result.model).toBeUndefined();
  });

  it('should detect non-existent model', () => {
    const result = validateConfiguration('invalid-model', sampleConfig);
    
    expect(result.configName).toBe('invalid-model');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Model 'nonexistent-model' not found in provider 'openai'");
    expect(result.provider).toBeDefined();
    expect(result.model).toBeUndefined();
  });

  it('should warn about empty API key', () => {
    const result = validateConfiguration('anthropic-claude', sampleConfig);
    
    expect(result.configName).toBe('anthropic-claude');
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("No API key configured for provider 'anthropic'");
  });

  it('should warn about provider with no models', () => {
    // Add a configuration that uses the empty-models provider
    const configWithEmptyModels: ConfigFile = {
      ...sampleConfig,
      configs: [{
        config: [
          ...(sampleConfig.configs[0]?.config || []),
          { name: 'empty-provider', provider: 'empty-models', model: 'any-model' }
        ]
      }]
    };

    const result = validateConfiguration('empty-provider', configWithEmptyModels);
    
    expect(result.configName).toBe('empty-provider');
    expect(result.isValid).toBe(false); // Invalid because model doesn't exist
    expect(result.warnings).toContain("Provider 'empty-models' has no models configured");
  });

  it('should not warn about default configuration for non-default config', () => {
    const result = validateConfiguration('azure-gpt35', sampleConfig);
    
    expect(result.configName).toBe('azure-gpt35');
    expect(result.isValid).toBe(true);
    expect(result.warnings).not.toContain('This is the default configuration');
  });
});

describe('chkCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
  });

  it('should validate specific valid configuration', async () => {
    const options: ChkCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Configuration 'openai-gpt4' is valid");
    expect(result.details).toBe(''); // No warnings or errors, so details should be empty
    expect(result.exitCode).toBe(0);
  });

  it('should validate specific invalid configuration', async () => {
    const options: ChkCommandOptions = {
      configName: 'invalid-provider'
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Configuration 'invalid-provider' is invalid");
    expect(result.details).toContain("Provider 'nonexistent' not found in providers section");
    expect(result.exitCode).toBe(1);
  });

  it('should validate specific configuration with verbose output', async () => {
    const options: ChkCommandOptions = {
      configName: 'openai-gpt4',
      verbose: true
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Provider details:');
    expect(result.details).toContain('Name: openai');
    expect(result.details).toContain('Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('Available models: 2');
    expect(result.details).toContain('Model details:');
    expect(result.details).toContain('Name: gpt-4');
    expect(result.details).toContain('Supported: Yes');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should validate all configurations', async () => {
    const options: ChkCommandOptions = {};

    const result = await chkCommand(options);

    expect(result.success).toBe(false); // Some configurations are invalid
    expect(result.message).toContain('2 of 5 configurations are invalid');
    expect(result.details).toContain('✓ openai-gpt4');
    expect(result.details).toContain('✓ azure-gpt35');
    expect(result.details).toContain('✓ anthropic-claude');
    expect(result.details).toContain('✗ invalid-provider');
    expect(result.details).toContain('✗ invalid-model');
    expect(result.exitCode).toBe(1);
  });

  it('should validate all configurations with verbose output', async () => {
    const options: ChkCommandOptions = {
      verbose: true
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(false);
    expect(result.details).toContain('Errors: Provider \'nonexistent\' not found in providers section');
    expect(result.details).toContain('Warnings: No API key configured for provider \'anthropic\'');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should handle non-existent configuration', async () => {
    const options: ChkCommandOptions = {
      configName: 'nonexistent'
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Configuration 'nonexistent' does not exist");
    expect(result.details).toContain('Available configurations: openai-gpt4, azure-gpt35, anthropic-claude, invalid-provider, invalid-model');
    expect(result.exitCode).toBe(1);
  });

  it('should handle configuration file not found', async () => {
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found in current directory'));

    const options: ChkCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('No configuration file found');
    expect(result.details).toBe('No configuration file found in current directory');
    expect(result.exitCode).toBe(1);
  });

  it('should handle invalid configuration file', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: false, errors: ['Invalid structure'], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ChkCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await chkCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file validation failed');
    expect(result.details).toBe('Errors: Invalid structure');
    expect(result.exitCode).toBe(1);
  });

  it('should handle empty configuration file', async () => {
    const emptyConfig: ConfigFile = {
      configs: [],
      providers: []
    };

    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: emptyConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ChkCommandOptions = {};

    const result = await chkCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('No configurations found');
    expect(result.details).toBe('Add configurations to your configuration file to validate them.');
    expect(result.exitCode).toBe(1);
  });

  it('should handle all valid configurations', async () => {
    const validConfig: ConfigFile = {
      default_config: [{ name: 'openai-gpt4' }],
      configs: [{
        config: [
          { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
          { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' }
        ]
      }],
      providers: [
        {
          provider: 'openai',
          env: {
            api_key: 'test-openai-key',
            base_url: 'https://api.openai.com/v1',
            models: [{ model: 'gpt-4' }]
          }
        },
        {
          provider: 'azure',
          env: {
            api_key: 'test-azure-key',
            base_url: 'https://test.openai.azure.com/openai',
            models: [{ model: 'gpt-35-turbo' }]
          }
        }
      ]
    };

    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: validConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ChkCommandOptions = {};

    const result = await chkCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe('All 2 configurations are valid');
    expect(result.exitCode).toBe(0);
  });
});

describe('handleChkCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
  });

  it('should handle valid configuration validation', async () => {
    const result = await handleChkCommand(['openai-gpt4']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Configuration 'openai-gpt4' is valid");
  });

  it('should handle verbose flag', async () => {
    const result = await handleChkCommand(['openai-gpt4', '-v']);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Provider details:');
    expect(result.details).toContain('Model details:');
  });

  it('should handle help flag', async () => {
    const result = await handleChkCommand(['-h']);

    expect(result.success).toBe(true);
    expect(result.message).toContain('qcr chk - Validate configuration');
    expect(result.message).toContain('USAGE:');
    expect(result.message).toContain('EXAMPLES:');
  });

  it('should handle invalid arguments', async () => {
    const result = await handleChkCommand(['--invalid']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unknown option: --invalid. Use --help for usage information.');
    expect(result.exitCode).toBe(1);
  });

  it('should handle all configurations validation', async () => {
    const result = await handleChkCommand([]);

    expect(result.success).toBe(false); // Some configurations are invalid
    expect(result.message).toContain('configurations are invalid');
  });

  it('should handle unexpected errors', async () => {
    mockDiscoverAndLoadConfig.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await handleChkCommand(['openai-gpt4']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected error occurred while validating configuration');
    expect(result.details).toBe('Unexpected error');
    expect(result.exitCode).toBe(1);
  });
});