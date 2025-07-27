/**
 * Unit tests for the set-default command functionality
 */

import { handleSetDefaultCommand } from '../src/commands';
import { setDefaultCommand, parseSetDefaultCommandArgs, setDefaultCommandHelp, SetDefaultCommandOptions } from '../src/commands/set-default';
import * as persistence from '../src/persistence';
import * as resolver from '../src/resolver';
import { ConfigFile } from '../src/types';

// Mock persistence module
jest.mock('../src/persistence');
const mockDiscoverAndLoadConfig = persistence.discoverAndLoadConfig as jest.MockedFunction<typeof persistence.discoverAndLoadConfig>;
const mockSaveConfigFile = persistence.saveConfigFile as jest.MockedFunction<typeof persistence.saveConfigFile>;

// Mock resolver module
jest.mock('../src/resolver');
const mockGetAllConfigurationNames = resolver.getAllConfigurationNames as jest.MockedFunction<typeof resolver.getAllConfigurationNames>;
const mockGetCurrentDefaultConfiguration = resolver.getCurrentDefaultConfiguration as jest.MockedFunction<typeof resolver.getCurrentDefaultConfiguration>;

// Sample configuration for testing
const sampleConfig: ConfigFile = {
  default_config: [{ name: 'openai-gpt4' }],
  configs: [{
    config: [
      { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
      { name: 'azure-gpt35', provider: 'azure', model: 'gpt-35-turbo' },
      { name: 'anthropic-claude', provider: 'anthropic', model: 'claude-3' }
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
    }
  ]
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseSetDefaultCommandArgs', () => {
  it('should parse configuration name correctly', () => {
    const result = parseSetDefaultCommandArgs(['openai-gpt4']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.configName).toBe('openai-gpt4');
    expect(result.options?.verbose).toBeUndefined();
    expect(result.showHelp).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should parse help flag correctly', () => {
    const result1 = parseSetDefaultCommandArgs(['-h']);
    const result2 = parseSetDefaultCommandArgs(['--help']);
    
    expect(result1.valid).toBe(true);
    expect(result1.showHelp).toBe(true);
    
    expect(result2.valid).toBe(true);
    expect(result2.showHelp).toBe(true);
  });

  it('should parse verbose flag correctly', () => {
    const result1 = parseSetDefaultCommandArgs(['-v', 'openai-gpt4']);
    const result2 = parseSetDefaultCommandArgs(['--verbose', 'azure-gpt35']);
    
    expect(result1.valid).toBe(true);
    expect(result1.options?.verbose).toBe(true);
    expect(result1.options?.configName).toBe('openai-gpt4');
    
    expect(result2.valid).toBe(true);
    expect(result2.options?.verbose).toBe(true);
    expect(result2.options?.configName).toBe('azure-gpt35');
  });

  it('should handle mixed arguments correctly', () => {
    const result = parseSetDefaultCommandArgs(['openai-gpt4', '-v']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.configName).toBe('openai-gpt4');
    expect(result.options?.verbose).toBe(true);
  });

  it('should fail when no configuration name provided', () => {
    const result = parseSetDefaultCommandArgs([]);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Configuration name is required');
  });

  it('should fail when too many arguments provided', () => {
    const result = parseSetDefaultCommandArgs(['config1', 'config2']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Too many arguments. Expected exactly one configuration name, got: config1, config2');
  });

  it('should fail with unknown option', () => {
    const result = parseSetDefaultCommandArgs(['--unknown', 'config1']);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unknown option: --unknown');
  });

  it('should handle undefined arguments', () => {
    const result = parseSetDefaultCommandArgs([undefined as any, 'openai-gpt4', undefined as any]);
    
    expect(result.valid).toBe(true);
    expect(result.options?.configName).toBe('openai-gpt4');
  });
});

describe('setDefaultCommandHelp', () => {
  it('should return help information', () => {
    const result = setDefaultCommandHelp();
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('qcr set-default - Set default configuration');
    expect(result.message).toContain('USAGE:');
    expect(result.message).toContain('EXAMPLES:');
    expect(result.message).toContain('DESCRIPTION:');
  });
});

describe('setDefaultCommand', () => {
  it('should successfully set default configuration', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35', 'anthropic-claude']);
    mockGetCurrentDefaultConfiguration.mockReturnValue('openai-gpt4');
    mockSaveConfigFile.mockResolvedValue();

    const options: SetDefaultCommandOptions = {
      configName: 'azure-gpt35'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully set 'azure-gpt35' as the default configuration");
    expect(result.details).toBe('Previous default: openai-gpt4');
    expect(result.exitCode).toBe(0);
    expect(mockSaveConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        default_config: [{ name: 'azure-gpt35' }]
      }),
      '/test/config.yaml'
    );
  });

  it('should handle setting same configuration as default', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35', 'anthropic-claude']);
    mockGetCurrentDefaultConfiguration.mockReturnValue('openai-gpt4');
    mockSaveConfigFile.mockResolvedValue();

    const options: SetDefaultCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully set 'openai-gpt4' as the default configuration");
    expect(result.details).toBe("'openai-gpt4' was already the default configuration");
    expect(result.exitCode).toBe(0);
  });

  it('should handle no previous default configuration', async () => {
    const configWithoutDefault: ConfigFile = { 
      ...sampleConfig, 
      default_config: [] 
    };
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: configWithoutDefault,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35', 'anthropic-claude']);
    mockGetCurrentDefaultConfiguration.mockReturnValue(null);
    mockSaveConfigFile.mockResolvedValue();

    const options: SetDefaultCommandOptions = {
      configName: 'azure-gpt35'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully set 'azure-gpt35' as the default configuration");
    expect(result.details).toBe('No previous default configuration was set');
    expect(result.exitCode).toBe(0);
  });

  it('should show verbose output when requested', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35', 'anthropic-claude']);
    mockGetCurrentDefaultConfiguration.mockReturnValue('openai-gpt4');
    mockSaveConfigFile.mockResolvedValue();

    const options: SetDefaultCommandOptions = {
      configName: 'azure-gpt35',
      verbose: true
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(true);
    expect(result.details).toContain('Configuration file: /test/config.yaml');
    expect(result.details).toContain('Available configurations: openai-gpt4, azure-gpt35, anthropic-claude');
  });

  it('should fail when configuration file not found', async () => {
    mockDiscoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found in current directory'));

    const options: SetDefaultCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file not found');
    expect(result.details).toContain('Searched in the following locations:');
    expect(result.exitCode).toBe(3);
  });

  it('should fail when configuration file is invalid', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: false, errors: ['Invalid structure'], warnings: [] },
      filePath: '/test/config.yaml'
    });

    const options: SetDefaultCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Configuration file validation failed');
    expect(result.details).toContain('Configuration validation errors:');
    expect(result.details).toContain('Invalid structure');
    expect(result.exitCode).toBe(5);
  });

  it('should fail when specified configuration does not exist', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35']);

    const options: SetDefaultCommandOptions = {
      configName: 'nonexistent-config'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Configuration not found: 'nonexistent-config'");
    expect(result.details).toContain('Available options:');
    expect(result.details).toContain('openai-gpt4');
    expect(result.details).toContain('azure-gpt35');
    expect(result.exitCode).toBe(4);
  });

  it('should fail when unable to save configuration file', async () => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35']);
    mockSaveConfigFile.mockRejectedValue(new Error('Permission denied'));

    const options: SetDefaultCommandOptions = {
      configName: 'azure-gpt35'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to save file');
    expect(result.details).toContain('Permission denied');
    expect(result.exitCode).toBe(1);
  });

  it('should handle unexpected errors', async () => {
    mockDiscoverAndLoadConfig.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const options: SetDefaultCommandOptions = {
      configName: 'openai-gpt4'
    };

    const result = await setDefaultCommand(options);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected error occurred during set-default command execution');
    expect(result.details).toContain('Unexpected error');
    expect(result.exitCode).toBe(1);
  });
});

describe('handleSetDefaultCommand', () => {
  beforeEach(() => {
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: sampleConfig,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35']);
    mockGetCurrentDefaultConfiguration.mockReturnValue('openai-gpt4');
    mockSaveConfigFile.mockResolvedValue();
  });

  it('should show help when help flag is provided', async () => {
    const result = await handleSetDefaultCommand(['--help']);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('qcr set-default - Set default configuration');
    expect(result.exitCode).toBe(0);
  });

  it('should handle valid arguments', async () => {
    const result = await handleSetDefaultCommand(['azure-gpt35', '-v']);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully set 'azure-gpt35' as the default configuration");
    expect(mockSaveConfigFile).toHaveBeenCalled();
  });

  it('should handle invalid arguments', async () => {
    const result = await handleSetDefaultCommand([]);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid arguments for command \'set-default\'');
    expect(result.details).toContain('Configuration name is required');
    expect(result.exitCode).toBe(2);
  });

  it('should handle too many arguments', async () => {
    const result = await handleSetDefaultCommand(['config1', 'config2']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid arguments for command \'set-default\'');
    expect(result.details).toContain('Too many arguments. Expected exactly one configuration name, got: config1, config2');
    expect(result.exitCode).toBe(2);
  });

  it('should handle unknown options', async () => {
    const result = await handleSetDefaultCommand(['--unknown', 'config1']);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid arguments for command \'set-default\'');
    expect(result.details).toContain('Unknown option: --unknown');
    expect(result.exitCode).toBe(2);
  });
});

describe('Configuration file updates', () => {
  it('should create default_config array if it does not exist', async () => {
    const configWithoutDefault = { ...sampleConfig };
    delete configWithoutDefault.default_config;
    
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: configWithoutDefault,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35']);
    mockGetCurrentDefaultConfiguration.mockReturnValue(null);
    mockSaveConfigFile.mockResolvedValue();

    const options: SetDefaultCommandOptions = {
      configName: 'azure-gpt35'
    };

    await setDefaultCommand(options);

    expect(mockSaveConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        default_config: [{ name: 'azure-gpt35' }]
      }),
      '/test/config.yaml'
    );
  });

  it('should replace existing default_config array', async () => {
    const configWithMultipleDefaults = {
      ...sampleConfig,
      default_config: [
        { name: 'old-config-1' },
        { name: 'old-config-2' }
      ]
    };
    
    mockDiscoverAndLoadConfig.mockResolvedValue({
      config: configWithMultipleDefaults,
      validation: { isValid: true, errors: [], warnings: [] },
      filePath: '/test/config.yaml'
    });
    mockGetAllConfigurationNames.mockReturnValue(['openai-gpt4', 'azure-gpt35']);
    mockGetCurrentDefaultConfiguration.mockReturnValue('old-config-1');
    mockSaveConfigFile.mockResolvedValue();

    const options: SetDefaultCommandOptions = {
      configName: 'azure-gpt35'
    };

    await setDefaultCommand(options);

    expect(mockSaveConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        default_config: [{ name: 'azure-gpt35' }]
      }),
      '/test/config.yaml'
    );
  });
});