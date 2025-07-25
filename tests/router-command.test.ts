/**
 * Unit tests for the router command functionality
 */

import { 
  routerCommand,
  handleRouterCommand,
  parseRouterCommandArgs,
  RouterCommandOptions
} from '../src/commands';
import * as persistence from '../src/persistence';
import * as resolver from '../src/resolver';
import { ConfigFile } from '../src/types';

// Mock persistence and resolver modules
jest.mock('../src/persistence');
jest.mock('../src/resolver');
const mockDiscoverAndLoadConfig = persistence.discoverAndLoadConfig as jest.MockedFunction<typeof persistence.discoverAndLoadConfig>;
const mockResolveConfigurationByName = resolver.resolveConfigurationByName as jest.MockedFunction<typeof resolver.resolveConfigurationByName>;

// Sample configuration for testing
const sampleConfig: ConfigFile = {
  default_config: [{ name: 'openai-gpt4' }],
  configs: [{
    config: [
      { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
      { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' },
      { name: 'anthropic-claude', provider: 'anthropic', model: 'claude-3-opus' }
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
          { model: 'gpt-3.5-turbo' },
          { model: 'gpt-4-turbo' }
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
  jest.clearAllMocks();
  // Clear environment variables
  delete process.env['OPENAI_API_KEY'];
  delete process.env['OPENAI_BASE_URL'];
  delete process.env['OPENAI_MODEL'];
});

describe('parseRouterCommandArgs', () => {
  it('should parse provider and model', () => {
    const result = parseRouterCommandArgs(['openai', 'gpt-4']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.provider).toBe('openai');
    expect(result.options?.model).toBe('gpt-4');
  });

  it('should parse provider, model and verbose flag', () => {
    const result = parseRouterCommandArgs(['azure', 'gpt-35-turbo', '-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.provider).toBe('azure');
    expect(result.options?.model).toBe('gpt-35-turbo');
    expect(result.options?.verbose).toBe(true);
  });

  it('should parse --verbose flag', () => {
    const result = parseRouterCommandArgs(['anthropic', 'claude-3-opus', '--verbose']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.provider).toBe('anthropic');
    expect(result.options?.model).toBe('claude-3-opus');
    expect(result.options?.verbose).toBe(true);
  });

  it('should parse help flag', () => {
    const result = parseRouterCommandArgs(['-h']);
    
    expect(result.valid).toBe(true);
    expect(result.showHelp).toBe(true);
  });

  it('should parse --help flag', () => {
    const result = parseRouterCommandArgs(['--help']);
    
    expect(result.valid).toBe(true);
    expect(result.showHelp).toBe(true);
  });

  it('should fail with missing provider', () => {
    const result = parseRouterCommandArgs([]);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Provider name is required. Use --help for usage information.');
  });

  it('should fail with missing model', () => {
    const result = parseRouterCommandArgs(['openai']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Model name is required. Use --help for usage information.');
  });

  it('should fail with too many arguments', () => {
    const result = parseRouterCommandArgs(['openai', 'gpt-4', 'extra']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Too many arguments. Expected provider and model, got: openai, gpt-4, extra');
  });

  it('should fail with unknown option', () => {
    const result = parseRouterCommandArgs(['openai', 'gpt-4', '--unknown']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unknown option: --unknown. Use --help for usage information.');
  });
});

describe('routerCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    mockResolveConfigurationByName.mockImplementation(() => {
      // Set environment variables as the real function would do
      process.env['OPENAI_API_KEY'] = 'test-openai-key';
      process.env['OPENAI_BASE_URL'] = 'https://api.openai.com/v1';
      process.env['OPENAI_MODEL'] = 'gpt-4';
      
      return {
        success: true,
        configEntry: { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
        provider: {
          provider: 'openai',
          env: {
            api_key: 'test-openai-key',
            base_url: 'https://api.openai.com/v1',
            models: [{ model: 'gpt-4' }]
          }
        },
        environmentVariables: {
          OPENAI_API_KEY: 'test-openai-key',
          OPENAI_BASE_URL: 'https://api.openai.com/v1',
          OPENAI_MODEL: 'gpt-4'
        }
      };
    });
  });

  it('should activate existing configuration by provider/model match', async () => {
    const options: RouterCommandOptions = {
      provider: 'openai',
      model: 'gpt-4'
    };

    const result = await routerCommand(options);

    if (!result.success) {
      console.log('Router command failed:', result.message, result.details);
    }
    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'openai' with model 'gpt-4'");
    expect(result.details).toContain("configuration 'openai-gpt4'");
    expect(result.exitCode).toBe(0);
  });

  it('should activate configuration with case-insensitive matching', async () => {
    const options: RouterCommandOptions = {
      provider: 'OPENAI',
      model: 'GPT-4'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'openai' with model 'gpt-4'");
  });

  it('should activate provider directly when no named configuration exists', async () => {
    const options: RouterCommandOptions = {
      provider: 'openai',
      model: 'gpt-3.5-turbo'  // Model exists in provider but no named config
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'openai' with model 'gpt-3.5-turbo'");
    expect(result.details).toContain('configuration file provider');
    expect(process.env['OPENAI_API_KEY']).toBe('test-openai-key');
    expect(process.env['OPENAI_BASE_URL']).toBe('https://api.openai.com/v1');
    expect(process.env['OPENAI_MODEL']).toBe('gpt-3.5-turbo');
  });

  it('should activate built-in provider when API key is set', async () => {
    // Mock no config file found
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));
    
    // Set API key for built-in provider
    process.env['OPENAI_API_KEY'] = 'user-api-key';

    const options: RouterCommandOptions = {
      provider: 'google',
      model: 'gemini-pro'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'google' with model 'gemini-pro'");
    expect(result.details).toContain("built-in provider 'Google AI'");
    expect(process.env['OPENAI_BASE_URL']).toBe('https://generativelanguage.googleapis.com/v1');
    expect(process.env['OPENAI_MODEL']).toBe('gemini-pro');
  });

  it('should fail when built-in provider used without API key', async () => {
    // Mock no config file found
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

    const options: RouterCommandOptions = {
      provider: 'google',
      model: 'gemini-pro'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("API key not set for built-in provider 'google'");
    expect(result.details).toContain('Please set the OPENAI_API_KEY environment variable');
    expect(result.exitCode).toBe(1);
  });

  it('should show verbose output when requested', async () => {
    const options: RouterCommandOptions = {
      provider: 'openai',
      model: 'gpt-4',
      verbose: true
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Provider: openai');
    expect(result.details).toContain('Model: gpt-4');
    expect(result.details).toContain('Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('Environment variables set:');
    expect(result.details).toContain('OPENAI_API_KEY: test-ope...');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should fail when provider not found', async () => {
    const options: RouterCommandOptions = {
      provider: 'nonexistent',
      model: 'some-model'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Provider 'nonexistent' not found");
    expect(result.details).toContain('Available providers: openai, azure, anthropic, google');
    expect(result.exitCode).toBe(1);
  });

  it('should fail when model not found in provider', async () => {
    const options: RouterCommandOptions = {
      provider: 'openai',
      model: 'nonexistent-model'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Model 'nonexistent-model' not found in provider 'openai'");
    expect(result.details).toContain('Available models for \'openai\': gpt-4, gpt-3.5-turbo, gpt-4-turbo');
    expect(result.exitCode).toBe(1);
  });

  it('should fail when configuration file is invalid', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: false, errors: ['Invalid structure'], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: RouterCommandOptions = {
      provider: 'openai',
      model: 'gpt-4'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file validation failed');
    expect(result.details).toBe('Errors: Invalid structure');
    expect(result.exitCode).toBe(1);
  });

  it('should fail when configuration resolution fails', async () => {
    mockResolveConfigurationByName.mockReturnValue({
      success: false,
      error: 'Configuration resolution failed'
    });

    const options: RouterCommandOptions = {
      provider: 'openai',
      model: 'gpt-4'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to activate configuration 'openai-gpt4'");
    expect(result.details).toBe('Configuration resolution failed');
    expect(result.exitCode).toBe(1);
  });

  it('should handle case-insensitive model matching in built-in providers', async () => {
    // Mock no config file found
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));
    
    // Set API key for built-in provider
    process.env['OPENAI_API_KEY'] = 'user-api-key';

    const options: RouterCommandOptions = {
      provider: 'anthropic',
      model: 'CLAUDE-3-OPUS-20240229'  // Uppercase model name
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'anthropic' with model 'claude-3-opus-20240229'");
    expect(process.env['OPENAI_MODEL']).toBe('claude-3-opus-20240229');
  });

  it('should preserve exact model case from configuration', async () => {
    // Mock for azure configuration
    mockResolveConfigurationByName.mockImplementationOnce(() => {
      // Set environment variables for azure
      process.env['OPENAI_API_KEY'] = 'test-azure-key';
      process.env['OPENAI_BASE_URL'] = 'https://test.openai.azure.com/openai';
      process.env['OPENAI_MODEL'] = 'gpt-35-turbo';
      
      return {
        success: true,
        configEntry: { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' },
        provider: {
          provider: 'azure',
          env: {
            api_key: 'test-azure-key',
            base_url: 'https://test.openai.azure.com/openai',
            models: [{ model: 'gpt-35-turbo' }]
          }
        },
        environmentVariables: {
          OPENAI_API_KEY: 'test-azure-key',
          OPENAI_BASE_URL: 'https://test.openai.azure.com/openai',
          OPENAI_MODEL: 'gpt-35-turbo'
        }
      };
    });

    const options: RouterCommandOptions = {
      provider: 'azure',
      model: 'gpt-35-turbo'
    };

    const result = await routerCommand(options);

    expect(result.success).toBe(true);
    expect(process.env['OPENAI_MODEL']).toBe('gpt-35-turbo');
  });
});

describe('handleRouterCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    mockResolveConfigurationByName.mockImplementation(() => {
      // Set environment variables as the real function would do
      process.env['OPENAI_API_KEY'] = 'test-openai-key';
      process.env['OPENAI_BASE_URL'] = 'https://api.openai.com/v1';
      process.env['OPENAI_MODEL'] = 'gpt-4';
      
      return {
        success: true,
        configEntry: { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
        provider: {
          provider: 'openai',
          env: {
            api_key: 'test-openai-key',
            base_url: 'https://api.openai.com/v1',
            models: [{ model: 'gpt-4' }]
          }
        },
        environmentVariables: {
          OPENAI_API_KEY: 'test-openai-key',
          OPENAI_BASE_URL: 'https://api.openai.com/v1',
          OPENAI_MODEL: 'gpt-4'
        }
      };
    });
  });

  it('should handle valid router command', async () => {
    const result = await handleRouterCommand(['openai', 'gpt-4']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'openai' with model 'gpt-4'");
  });

  it('should handle verbose flag', async () => {
    const result = await handleRouterCommand(['openai', 'gpt-4', '-v']);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Provider: openai');
    expect(result.details).toContain('Environment variables set:');
  });

  it('should handle help flag', async () => {
    const result = await handleRouterCommand(['-h']);

    expect(result.success).toBe(true);
    expect(result.message).toContain('/router - Quick configuration via provider/model');
    expect(result.message).toContain('USAGE:');
    expect(result.message).toContain('EXAMPLES:');
  });

  it('should handle invalid arguments', async () => {
    const result = await handleRouterCommand(['--invalid']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unknown option: --invalid. Use --help for usage information.');
    expect(result.exitCode).toBe(1);
  });

  it('should handle missing arguments', async () => {
    const result = await handleRouterCommand(['openai']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Model name is required. Use --help for usage information.');
    expect(result.exitCode).toBe(1);
  });

  it('should handle unexpected errors', async () => {
    // Mock a successful config load but then throw error in resolveConfigurationByName
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    
    mockResolveConfigurationByName.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await handleRouterCommand(['openai', 'gpt-4']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected error occurred while executing router command');
    expect(result.details).toBe('Unexpected error');
    expect(result.exitCode).toBe(1);
  });

  it('should handle built-in provider activation', async () => {
    // Mock no config file found
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));
    
    // Set API key for built-in provider
    process.env['OPENAI_API_KEY'] = 'user-api-key';

    const result = await handleRouterCommand(['google', 'gemini-pro']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'google' with model 'gemini-pro'");
    expect(result.details).toContain("built-in provider 'Google AI'");
  });

  it('should handle case-insensitive provider and model names', async () => {
    const result = await handleRouterCommand(['OPENAI', 'GPT-4']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully activated provider 'openai' with model 'gpt-4'");
  });
});