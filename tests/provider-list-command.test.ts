/**
 * Unit tests for the provider list command functionality
 */

import { 
  listProviders,
  listProviderCommand,
  parseListCommandArgs,
  handleListCommand,
  ListCommandOptions,
  listBuiltinProviders,
  BUILTIN_PROVIDERS
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
});

describe('parseListCommandArgs - Provider Commands', () => {
  it('should parse provider subcommand correctly', () => {
    const result = parseListCommandArgs(['provider']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.shortForm).toBeUndefined();
  });

  it('should parse -p short form correctly', () => {
    const result = parseListCommandArgs(['-p']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.shortForm).toBe(true);
  });

  it('should parse --all flag with provider', () => {
    const result = parseListCommandArgs(['provider', '--all']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.all).toBe(true);
  });

  it('should parse --all flag with -p', () => {
    const result = parseListCommandArgs(['-p', '--all']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.shortForm).toBe(true);
    expect(result.options?.all).toBe(true);
  });

  it('should parse provider name with provider subcommand', () => {
    const result = parseListCommandArgs(['provider', 'openai']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.provider).toBe('openai');
  });

  it('should parse provider name with -p', () => {
    const result = parseListCommandArgs(['-p', 'azure']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.shortForm).toBe(true);
    expect(result.options?.provider).toBe('azure');
  });

  it('should parse verbose flag with provider commands', () => {
    const result = parseListCommandArgs(['-p', '-v', '--all']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.verbose).toBe(true);
    expect(result.options?.all).toBe(true);
  });

  it('should fail when --all is used without provider subcommand', () => {
    const result = parseListCommandArgs(['config', '--all']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('--all flag can only be used with provider subcommand');
  });

  it('should fail when provider name is used without provider subcommand', () => {
    const result = parseListCommandArgs(['config', 'openai']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Too many arguments. Unexpected argument: openai');
  });

  it('should fail with too many arguments', () => {
    const result = parseListCommandArgs(['-p', 'openai', 'extra']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Too many arguments. Unexpected argument: extra');
  });
});

describe('listProviders', () => {
  it('should list providers without verbose mode', () => {
    const result = listProviders(sampleConfig);
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers:');
    expect(result.details).toContain('openai');
    expect(result.details).toContain('azure');
    expect(result.details).toContain('anthropic');
    expect(result.details).not.toContain('models');
    expect(result.exitCode).toBe(0);
  });

  it('should list providers with verbose mode', () => {
    const result = listProviders(sampleConfig, { verbose: true });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers:');
    expect(result.details).toContain('openai - 2 models (https://api.openai.com/v1)');
    expect(result.details).toContain('azure - 2 models (https://test.openai.azure.com/openai)');
    expect(result.details).toContain('anthropic - 2 models (https://api.anthropic.com/v1)');
    expect(result.exitCode).toBe(0);
  });

  it('should show tree structure with --all flag', () => {
    const result = listProviders(sampleConfig, { all: true });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers and models:');
    expect(result.details).toContain('openai');
    expect(result.details).toContain('  └─ gpt-4');
    expect(result.details).toContain('  └─ gpt-3.5-turbo');
    expect(result.details).toContain('azure');
    expect(result.details).toContain('  └─ gpt-35-turbo');
    expect(result.details).toContain('anthropic');
    expect(result.details).toContain('  └─ claude-3-opus');
    expect(result.details).toContain('  └─ claude-3-sonnet');
    expect(result.exitCode).toBe(0);
  });

  it('should show tree structure with verbose and --all flags', () => {
    const result = listProviders(sampleConfig, { all: true, verbose: true });
    
    expect(result.success).toBe(true);
    expect(result.details).toContain('openai');
    expect(result.details).toContain('  └─ gpt-4');
    expect(result.details).toContain('     Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('azure');
    expect(result.details).toContain('     Base URL: https://test.openai.azure.com/openai');
  });

  it('should show models for specific provider', () => {
    const result = listProviders(sampleConfig, { provider: 'openai' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for provider 'openai':");
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('gpt-3.5-turbo');
    expect(result.details).not.toContain('azure');
    expect(result.exitCode).toBe(0);
  });

  it('should show models for specific provider with verbose', () => {
    const result = listProviders(sampleConfig, { provider: 'azure', verbose: true });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for provider 'azure':");
    expect(result.details).toContain('gpt-35-turbo');
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('Provider details:');
    expect(result.details).toContain('Base URL: https://test.openai.azure.com/openai');
    expect(result.details).toContain('Total models: 2');
  });

  it('should handle case-insensitive provider names', () => {
    const result = listProviders(sampleConfig, { provider: 'OPENAI' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for provider 'openai':");
    expect(result.details).toContain('gpt-4');
  });

  it('should fail when provider not found', () => {
    const result = listProviders(sampleConfig, { provider: 'nonexistent' });
    
    expect(result.success).toBe(false);
    expect(result.message).toBe("Provider 'nonexistent' not found");
    expect(result.details).toBe('Available providers: openai, azure, anthropic');
    expect(result.exitCode).toBe(1);
  });

  it('should handle empty providers list', () => {
    const emptyConfig: ConfigFile = {
      configs: [],
      providers: []
    };

    const result = listProviders(emptyConfig);
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('No providers found');
    expect(result.details).toBe('Add providers to your configuration file to get started.');
    expect(result.exitCode).toBe(0);
  });
});

describe('listProviderCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
  });

  it('should successfully list providers', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider'
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers:');
    expect(result.details).toContain('openai');
    expect(result.details).toContain('azure');
    expect(result.details).toContain('anthropic');
    expect(result.exitCode).toBe(0);
  });

  it('should show verbose output when requested', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider',
      verbose: true
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.details).toContain('openai - 2 models (https://api.openai.com/v1)');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should show tree structure with --all flag', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider',
      all: true
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers and models:');
    expect(result.details).toContain('  └─ gpt-4');
    expect(result.details).toContain('  └─ claude-3-opus');
  });

  it('should show models for specific provider', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider',
      provider: 'openai'
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for provider 'openai':");
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('gpt-3.5-turbo');
  });

  it('should fail when configuration file not found', async () => {
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found in current directory'));

    const options: ListCommandOptions = {
      subcommand: 'provider'
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('No configuration file found');
    expect(result.details).toBe('No configuration file found in current directory');
    expect(result.exitCode).toBe(1);
  });

  it('should fail when configuration file is invalid', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: false, errors: ['Invalid structure'], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ListCommandOptions = {
      subcommand: 'provider'
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file validation failed');
    expect(result.details).toBe('Errors: Invalid structure');
    expect(result.exitCode).toBe(1);
  });
});

describe('handleListCommand - Provider Integration', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
  });

  it('should handle provider subcommand', async () => {
    const result = await handleListCommand(['provider']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers:');
    expect(result.details).toContain('openai');
  });

  it('should handle -p short form', async () => {
    const result = await handleListCommand(['-p']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers:');
    expect(result.details).toContain('openai');
  });

  it('should handle -p with --all flag', async () => {
    const result = await handleListCommand(['-p', '--all']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers and models:');
    expect(result.details).toContain('  └─ gpt-4');
  });

  it('should handle -p with provider name', async () => {
    const result = await handleListCommand(['-p', 'openai']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for provider 'openai':");
    expect(result.details).toContain('gpt-4');
  });

  it('should handle provider with verbose flag', async () => {
    const result = await handleListCommand(['provider', '-v']);

    expect(result.success).toBe(true);
    expect(result.details).toContain('2 models');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should handle complex provider command', async () => {
    const result = await handleListCommand(['-p', '--all', '-v']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available providers and models:');
    expect(result.details).toContain('  └─ gpt-4');
    expect(result.details).toContain('     Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });
});

describe('Error handling for provider commands', () => {
  it('should handle listProviders function errors', () => {
    // Create a config that will cause an error in listProviders
    const invalidConfig = {
      ...sampleConfig,
      providers: null as any
    };

    const result = listProviders(invalidConfig);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to list providers');
    expect(result.exitCode).toBe(1);
  });

  it('should handle unexpected errors in listProviderCommand', async () => {
    mockDiscoverAndLoadConfig.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const options: ListCommandOptions = {
      subcommand: 'provider'
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected error occurred while listing providers');
    expect(result.details).toBe('Unexpected error');
    expect(result.exitCode).toBe(1);
  });
});
// Built-in providers tests
describe('parseListCommandArgs - Built-in Provider Commands', () => {
  it('should parse -f flag correctly', () => {
    const result = parseListCommandArgs(['-f']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.builtinProviders).toBe(true);
  });

  it('should parse -f with provider name', () => {
    const result = parseListCommandArgs(['-f', 'openai']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.builtinProviders).toBe(true);
    expect(result.options?.provider).toBe('openai');
  });

  it('should parse -f with verbose flag', () => {
    const result = parseListCommandArgs(['-f', '-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.builtinProviders).toBe(true);
    expect(result.options?.verbose).toBe(true);
  });

  it('should fail when --all is used with -f flag', () => {
    const result = parseListCommandArgs(['-f', '--all']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('--all flag cannot be used with -f (built-in providers) flag');
  });

  it('should parse complex -f command', () => {
    const result = parseListCommandArgs(['-f', 'anthropic', '-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('provider');
    expect(result.options?.builtinProviders).toBe(true);
    expect(result.options?.provider).toBe('anthropic');
    expect(result.options?.verbose).toBe(true);
  });
});

describe('listBuiltinProviders', () => {
  it('should list all built-in providers without verbose mode', () => {
    const result = listBuiltinProviders();
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available built-in providers:');
    expect(result.details).toContain('openai (OpenAI)');
    expect(result.details).toContain('azure (Azure OpenAI)');
    expect(result.details).toContain('anthropic (Anthropic)');
    expect(result.details).toContain('google (Google AI)');
    expect(result.details).toContain("Use 'qcr list -f [provider]' to see models for a specific provider.");
    expect(result.exitCode).toBe(0);
  });

  it('should list all built-in providers with verbose mode', () => {
    const result = listBuiltinProviders({ verbose: true });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available built-in providers:');
    expect(result.details).toContain('openai (OpenAI) - ');
    expect(result.details).toContain('models');
    expect(result.details).toContain('Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('azure (Azure OpenAI) - ');
    expect(result.details).toContain('Base URL: https://[resource].openai.azure.com/openai');
    expect(result.details).toContain('anthropic (Anthropic) - ');
    expect(result.details).toContain('Base URL: https://api.anthropic.com/v1');
    expect(result.details).toContain('google (Google AI) - ');
    expect(result.details).toContain('Base URL: https://generativelanguage.googleapis.com/v1');
    expect(result.exitCode).toBe(0);
  });

  it('should show models for specific built-in provider - openai', () => {
    const result = listBuiltinProviders({ provider: 'openai' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'openai' (OpenAI):");
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('gpt-4-turbo');
    expect(result.details).toContain('gpt-3.5-turbo');
    expect(result.details).not.toContain('claude');
    expect(result.details).not.toContain('gemini');
    expect(result.exitCode).toBe(0);
  });

  it('should show models for specific built-in provider - azure', () => {
    const result = listBuiltinProviders({ provider: 'azure' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'azure' (Azure OpenAI):");
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('gpt-35-turbo');
    expect(result.details).toContain('gpt-35-turbo-16k');
    expect(result.details).not.toContain('claude');
    expect(result.exitCode).toBe(0);
  });

  it('should show models for specific built-in provider - anthropic', () => {
    const result = listBuiltinProviders({ provider: 'anthropic' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'anthropic' (Anthropic):");
    expect(result.details).toContain('claude-3-opus-20240229');
    expect(result.details).toContain('claude-3-sonnet-20240229');
    expect(result.details).toContain('claude-3-haiku-20240307');
    expect(result.details).toContain('claude-2.1');
    expect(result.details).not.toContain('gpt');
    expect(result.exitCode).toBe(0);
  });

  it('should show models for specific built-in provider - google', () => {
    const result = listBuiltinProviders({ provider: 'google' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'google' (Google AI):");
    expect(result.details).toContain('gemini-pro');
    expect(result.details).toContain('gemini-pro-vision');
    expect(result.details).toContain('gemini-1.5-pro');
    expect(result.details).toContain('gemini-1.5-flash');
    expect(result.details).not.toContain('gpt');
    expect(result.details).not.toContain('claude');
    expect(result.exitCode).toBe(0);
  });

  it('should show models for specific built-in provider with verbose', () => {
    const result = listBuiltinProviders({ provider: 'openai', verbose: true });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'openai' (OpenAI):");
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('Provider details:');
    expect(result.details).toContain('Name: OpenAI');
    expect(result.details).toContain('Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('Total models: ');
  });

  it('should handle case-insensitive built-in provider names', () => {
    const result = listBuiltinProviders({ provider: 'OPENAI' });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'openai' (OpenAI):");
    expect(result.details).toContain('gpt-4');
  });

  it('should fail when built-in provider not found', () => {
    const result = listBuiltinProviders({ provider: 'nonexistent' });
    
    expect(result.success).toBe(false);
    expect(result.message).toBe("Built-in provider 'nonexistent' not found");
    expect(result.details).toBe('Available built-in providers: openai, azure, anthropic, google');
    expect(result.exitCode).toBe(1);
  });

  it('should handle errors gracefully', () => {
    // This test verifies error handling in the function
    const result = listBuiltinProviders({ provider: 'openai' });
    
    // Should still work normally since BUILTIN_PROVIDERS is a constant
    expect(result.success).toBe(true);
  });
});

describe('listProviderCommand - Built-in Providers', () => {
  it('should list built-in providers when -f flag is used', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider',
      builtinProviders: true
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available built-in providers:');
    expect(result.details).toContain('openai (OpenAI)');
    expect(result.details).toContain('azure (Azure OpenAI)');
    expect(result.details).toContain('anthropic (Anthropic)');
    expect(result.details).toContain('google (Google AI)');
    expect(result.exitCode).toBe(0);
  });

  it('should show verbose built-in providers when requested', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider',
      builtinProviders: true,
      verbose: true
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('Base URL: https://api.anthropic.com/v1');
  });

  it('should show models for specific built-in provider', async () => {
    const options: ListCommandOptions = {
      subcommand: 'provider',
      builtinProviders: true,
      provider: 'openai'
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'openai' (OpenAI):");
    expect(result.details).toContain('gpt-4');
    expect(result.details).toContain('gpt-3.5-turbo');
  });

  it('should not require configuration file for built-in providers', async () => {
    // Don't mock discoverAndLoadConfig to simulate no config file
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

    const options: ListCommandOptions = {
      subcommand: 'provider',
      builtinProviders: true
    };

    const result = await listProviderCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available built-in providers:');
    expect(result.details).toContain('openai (OpenAI)');
  });
});

describe('handleListCommand - Built-in Provider Integration', () => {
  it('should handle -f flag', async () => {
    const result = await handleListCommand(['-f']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available built-in providers:');
    expect(result.details).toContain('openai (OpenAI)');
    expect(result.details).toContain('azure (Azure OpenAI)');
  });

  it('should handle -f with provider name', async () => {
    const result = await handleListCommand(['-f', 'openai']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'openai' (OpenAI):");
    expect(result.details).toContain('gpt-4');
  });

  it('should handle -f with verbose flag', async () => {
    const result = await handleListCommand(['-f', '-v']);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Base URL: https://api.openai.com/v1');
    expect(result.details).toContain('Base URL: https://api.anthropic.com/v1');
  });

  it('should handle -f with provider name and verbose', async () => {
    const result = await handleListCommand(['-f', 'anthropic', '-v']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Models for built-in provider 'anthropic' (Anthropic):");
    expect(result.details).toContain('claude-3-opus-20240229');
    expect(result.details).toContain('Provider details:');
    expect(result.details).toContain('Name: Anthropic');
    expect(result.details).toContain('Base URL: https://api.anthropic.com/v1');
  });

  it('should fail when invalid built-in provider specified', async () => {
    const result = await handleListCommand(['-f', 'invalid']);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Built-in provider 'invalid' not found");
    expect(result.details).toBe('Available built-in providers: openai, azure, anthropic, google');
  });
});

describe('BUILTIN_PROVIDERS constant', () => {
  it('should have all expected providers', () => {
    expect(BUILTIN_PROVIDERS).toHaveProperty('openai');
    expect(BUILTIN_PROVIDERS).toHaveProperty('azure');
    expect(BUILTIN_PROVIDERS).toHaveProperty('anthropic');
    expect(BUILTIN_PROVIDERS).toHaveProperty('google');
  });

  it('should have correct structure for each provider', () => {
    Object.values(BUILTIN_PROVIDERS).forEach(provider => {
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('base_url');
      expect(provider).toHaveProperty('models');
      expect(Array.isArray(provider.models)).toBe(true);
      expect(provider.models.length).toBeGreaterThan(0);
    });
  });

  it('should have expected models for OpenAI', () => {
    const openaiModels = BUILTIN_PROVIDERS.openai.models;
    expect(openaiModels).toContain('gpt-4');
    expect(openaiModels).toContain('gpt-3.5-turbo');
    expect(openaiModels).toContain('gpt-4-turbo');
  });

  it('should have expected models for Azure', () => {
    const azureModels = BUILTIN_PROVIDERS.azure.models;
    expect(azureModels).toContain('gpt-4');
    expect(azureModels).toContain('gpt-35-turbo');
    expect(azureModels).toContain('gpt-35-turbo-16k');
  });

  it('should have expected models for Anthropic', () => {
    const anthropicModels = BUILTIN_PROVIDERS.anthropic.models;
    expect(anthropicModels).toContain('claude-3-opus-20240229');
    expect(anthropicModels).toContain('claude-3-sonnet-20240229');
    expect(anthropicModels).toContain('claude-2.1');
  });

  it('should have expected models for Google', () => {
    const googleModels = BUILTIN_PROVIDERS.google.models;
    expect(googleModels).toContain('gemini-pro');
    expect(googleModels).toContain('gemini-1.5-pro');
    expect(googleModels).toContain('gemini-1.5-flash');
  });
});