/**
 * Unit tests for the list command functionality
 */

import { handleListCommand, listConfigurations } from '../src/commands';
import { listConfigCommand, parseListCommandArgs, listCommandHelp, ListCommandOptions } from '../src/commands/list';
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

describe('parseListCommandArgs', () => {
  it('should parse config subcommand correctly', () => {
    const result = parseListCommandArgs(['config']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('config');
    expect(result.options?.verbose).toBeUndefined();
    expect(result.showHelp).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should parse help flag correctly', () => {
    const result1 = parseListCommandArgs(['-h']);
    const result2 = parseListCommandArgs(['--help']);
    
    expect(result1.valid).toBe(true);
    expect(result1.showHelp).toBe(true);
    
    expect(result2.valid).toBe(true);
    expect(result2.showHelp).toBe(true);
  });

  it('should parse verbose flag correctly', () => {
    const result1 = parseListCommandArgs(['-v', 'config']);
    const result2 = parseListCommandArgs(['--verbose', 'config']);
    
    expect(result1.valid).toBe(true);
    expect(result1.options?.verbose).toBe(true);
    expect(result1.options?.subcommand).toBe('config');
    
    expect(result2.valid).toBe(true);
    expect(result2.options?.verbose).toBe(true);
    expect(result2.options?.subcommand).toBe('config');
  });

  it('should handle mixed arguments correctly', () => {
    const result = parseListCommandArgs(['config', '-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('config');
    expect(result.options?.verbose).toBe(true);
  });

  it('should handle no arguments', () => {
    const result = parseListCommandArgs([]);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBeUndefined();
    expect(result.options?.verbose).toBeUndefined();
  });

  it('should fail with unknown subcommand', () => {
    const result = parseListCommandArgs(['unknown']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unknown subcommand: unknown. Available subcommands: config, provider');
  });

  it('should fail when too many arguments provided', () => {
    const result = parseListCommandArgs(['config', 'extra']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Too many arguments. Unexpected argument: extra');
  });

  it('should fail with unknown option', () => {
    const result = parseListCommandArgs(['--unknown', 'config']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unknown option: --unknown. Use --help for usage information.');
  });

  it('should handle undefined arguments', () => {
    const result = parseListCommandArgs([undefined as any, 'config', undefined as any]);
    
    expect(result.valid).toBe(true);
    expect(result.options?.subcommand).toBe('config');
  });
});

describe('listCommandHelp', () => {
  it('should return help information', () => {
    const result = listCommandHelp();
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('qcr list - List configurations and providers');
    expect(result.message).toContain('USAGE:');
    expect(result.message).toContain('SUBCOMMANDS:');
    expect(result.message).toContain('EXAMPLES:');
    expect(result.message).toContain('DESCRIPTION:');
  });
});

describe('listConfigurations', () => {
  it('should list configurations without verbose mode', () => {
    const result = listConfigurations(sampleConfig);
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available configurations:');
    expect(result.details).toContain('openai-gpt4 (default)');
    expect(result.details).toContain('azure-gpt35');
    expect(result.details).toContain('anthropic-claude');
    expect(result.details).not.toContain('Provider:');
    expect(result.exitCode).toBe(0);
  });

  it('should list configurations with verbose mode', () => {
    const result = listConfigurations(sampleConfig, { verbose: true });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Available configurations:');
    expect(result.details).toContain('openai-gpt4 (default) - Provider: openai, Model: gpt-4');
    expect(result.details).toContain('azure-gpt35 - Provider: azure, Model: gpt-35-turbo');
    expect(result.details).toContain('anthropic-claude - Provider: anthropic, Model: claude-3-opus');
    expect(result.exitCode).toBe(0);
  });

  it('should handle empty configuration list', () => {
    const emptyConfig: ConfigFile = {
      configs: [],
      providers: []
    };

    const result = listConfigurations(emptyConfig);
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('No configurations found');
    expect(result.details).toBe('Add configurations to your configuration file to get started.');
    expect(result.exitCode).toBe(0);
  });

  it('should handle configuration without default', () => {
    const configWithoutDefault: ConfigFile = {
      ...sampleConfig,
      default_config: []
    };

    const result = listConfigurations(configWithoutDefault);
    
    expect(result.success).toBe(true);
    expect(result.details).toContain('openai-gpt4');
    expect(result.details).toContain('azure-gpt35');
    expect(result.details).toContain('anthropic-claude');
    expect(result.details).not.toContain('(default)');
  });
});

describe('listConfigCommand', () => {
  it('should successfully list configurations', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ListCommandOptions = {
      subcommand: 'config'
    };

    const result = await listConfigCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available configurations:');
    expect(result.details).toContain('openai-gpt4 (default)');
    expect(result.details).toContain('azure-gpt35');
    expect(result.details).toContain('anthropic-claude');
    expect(result.exitCode).toBe(0);
  });

  it('should show verbose output when requested', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ListCommandOptions = {
      subcommand: 'config',
      verbose: true
    };

    const result = await listConfigCommand(options);

    expect(result.success).toBe(true);
    expect(result.details).toContain('openai-gpt4 (default) - Provider: openai, Model: gpt-4');
    expect(result.details).toContain('azure-gpt35 - Provider: azure, Model: gpt-35-turbo');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should fail when configuration file not found', async () => {
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found in current directory'));

    const options: ListCommandOptions = {
      subcommand: 'config'
    };

    const result = await listConfigCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file not found');
    expect(result.details).toContain('Searched in the following locations');
    expect(result.exitCode).toBe(3);
  });

  it('should fail when configuration file is invalid', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: false, errors: ['Invalid structure'], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: ListCommandOptions = {
      subcommand: 'config'
    };

    const result = await listConfigCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file validation failed');
    expect(result.details).toBe('Errors: Invalid structure');
    expect(result.exitCode).toBe(1);
  });

  it('should handle unexpected errors', async () => {
    mockDiscoverAndLoadConfig.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const options: ListCommandOptions = {
      subcommand: 'config'
    };

    const result = await listConfigCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected error occurred while listing configurations');
    expect(result.details).toBe('Unexpected error');
    expect(result.exitCode).toBe(1);
  });
});

describe('handleListCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
  });

  it('should show help when help flag is provided', async () => {
    const result = await handleListCommand(['--help']);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('qcr list - List configurations and providers');
    expect(result.exitCode).toBe(0);
  });

  it('should show help when no subcommand is provided', async () => {
    const result = await handleListCommand([]);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('qcr list - List configurations and providers');
    expect(result.exitCode).toBe(0);
  });

  it('should handle config subcommand', async () => {
    const result = await handleListCommand(['config']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available configurations:');
    expect(result.details).toContain('openai-gpt4 (default)');
  });

  it('should handle config subcommand with verbose flag', async () => {
    const result = await handleListCommand(['config', '-v']);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Provider: openai, Model: gpt-4');
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should handle invalid arguments', async () => {
    const result = await handleListCommand(['config', 'extra']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Too many arguments. Unexpected argument: extra');
    expect(result.exitCode).toBe(1);
  });

  it('should handle unknown subcommand', async () => {
    const result = await handleListCommand(['unknown']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unknown subcommand: unknown. Available subcommands: config, provider');
    expect(result.exitCode).toBe(1);
  });

  it('should handle unknown options', async () => {
    const result = await handleListCommand(['--unknown', 'config']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unknown option: --unknown. Use --help for usage information.');
    expect(result.exitCode).toBe(1);
  });
});

describe('Integration with existing listConfigurations function', () => {
  it('should properly integrate with existing listConfigurations function', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const result = await listConfigCommand({ subcommand: 'config', verbose: true });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Available configurations:');
    
    // Verify that the existing listConfigurations function behavior is preserved
    expect(result.details).toContain('openai-gpt4 (default) - Provider: openai, Model: gpt-4');
    expect(result.details).toContain('azure-gpt35 - Provider: azure, Model: gpt-35-turbo');
    expect(result.details).toContain('anthropic-claude - Provider: anthropic, Model: claude-3-opus');
    
    // Verify that additional file path information is added
    expect(result.details).toContain('Configuration file: /test/config.yaml');
  });

  it('should handle empty configurations properly', async () => {
    const emptyConfig: ConfigFile = {
      configs: [],
      providers: []
    };

    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: emptyConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const result = await listConfigCommand({ subcommand: 'config' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('No configurations found');
    expect(result.details).toBe('Add configurations to your configuration file to get started.');
  });
});