/**
 * Unit tests for CLI command handlers
 * Tests the qcr use command implementation and related functionality
 */

import {
  useCommand,
  useCommandHelp,
  listConfigurations,
  getCurrentStatus,
  parseUseCommandArgs,
  handleUseCommand,
  UseCommandOptions
} from '../src/commands';
import { ConfigFile } from '../src/types';
import { REQUIRED_ENV_VARS } from '../src/environment';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CLI Command Handlers', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };
  
  // Test configuration file
  const testConfigFile: ConfigFile = {
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

  // Temporary directory for test configuration files
  let tempDir: string;
  let testConfigPath: string;

  beforeAll(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-test-'));
    testConfigPath = path.join(tempDir, 'config.yaml');
  });

  afterAll(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset environment variables before each test
    Object.keys(REQUIRED_ENV_VARS).forEach(key => {
      const envVar = REQUIRED_ENV_VARS[key as keyof typeof REQUIRED_ENV_VARS];
      delete process.env[envVar];
    });

    // Create test configuration file
    const yaml = require('yaml');
    fs.writeFileSync(testConfigPath, yaml.stringify(testConfigFile));
  });

  afterEach(() => {
    // Restore original environment variables after each test
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    // Clean up test configuration file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('useCommand', () => {
    it('should activate configuration by name successfully', async () => {
      const options: UseCommandOptions = {
        configName: 'openai-gpt4',
        currentDir: tempDir
      };

      const result = await useCommand(options);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully activated specified configuration 'openai-gpt4'");
      expect(result.details).toContain('Provider: openai, Model: gpt-4');
      expect(result.exitCode).toBe(0);

      // Verify environment variables were set
      expect(process.env[REQUIRED_ENV_VARS.API_KEY]).toBe('test-openai-key');
      expect(process.env[REQUIRED_ENV_VARS.BASE_URL]).toBe('https://api.openai.com/v1');
      expect(process.env[REQUIRED_ENV_VARS.MODEL]).toBe('gpt-4');
    });

    it('should use default configuration when no name provided', async () => {
      const options: UseCommandOptions = {
        currentDir: tempDir
      };

      const result = await useCommand(options);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully activated default configuration 'openai-gpt4'");
      expect(result.details).toContain('Provider: openai, Model: gpt-4');
      expect(result.exitCode).toBe(0);

      // Verify environment variables were set
      expect(process.env[REQUIRED_ENV_VARS.API_KEY]).toBe('test-openai-key');
      expect(process.env[REQUIRED_ENV_VARS.BASE_URL]).toBe('https://api.openai.com/v1');
      expect(process.env[REQUIRED_ENV_VARS.MODEL]).toBe('gpt-4');
    });

    it('should show verbose output when requested', async () => {
      const options: UseCommandOptions = {
        configName: 'azure-gpt35',
        currentDir: tempDir,
        verbose: true
      };

      const result = await useCommand(options);

      expect(result.success).toBe(true);
      expect(result.details).toContain('Configuration file:');
      expect(result.details).toContain('Environment variables set:');
      expect(result.details).toContain('OPENAI_API_KEY: test-azu...');
      expect(result.details).toContain('OPENAI_BASE_URL: https://myazure.openai.azure.com/openai');
      expect(result.details).toContain('OPENAI_MODEL: gpt-35-turbo');
    });

    it('should fail when configuration does not exist', async () => {
      const options: UseCommandOptions = {
        configName: 'nonexistent-config',
        currentDir: tempDir
      };

      const result = await useCommand(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to activate configuration 'nonexistent-config'");
      expect(result.details).toContain('Configuration "nonexistent-config" not found');
      expect(result.exitCode).toBe(1);
    });

    it('should fail when no default configuration is set and no name provided', async () => {
      // Create config file without default configuration
      const configWithoutDefault: ConfigFile = {
        configs: testConfigFile.configs,
        providers: testConfigFile.providers
      };
      
      const yaml = require('yaml');
      fs.writeFileSync(testConfigPath, yaml.stringify(configWithoutDefault));

      const options: UseCommandOptions = {
        currentDir: tempDir
      };

      const result = await useCommand(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No default configuration set and no configuration name provided');
      expect(result.details).toContain('Available configurations:');
      expect(result.details).toContain('qcr set-default');
      expect(result.exitCode).toBe(1);
    });

    it('should fail when configuration file is invalid', async () => {
      // Create invalid configuration file
      fs.writeFileSync(testConfigPath, 'invalid: yaml: content: [');

      const options: UseCommandOptions = {
        configName: 'openai-gpt4',
        currentDir: tempDir
      };

      const result = await useCommand(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to load configuration file');
      expect(result.exitCode).toBe(1);
    });

    it('should fail when configuration file does not exist', async () => {
      const options: UseCommandOptions = {
        configName: 'openai-gpt4',
        currentDir: '/nonexistent/directory'
      };

      const result = await useCommand(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No configuration file found');
      expect(result.exitCode).toBe(1);
    });

    it('should handle provider validation errors', async () => {
      // Create config with missing provider
      const configWithMissingProvider: ConfigFile = {
        ...testConfigFile,
        providers: [] // Remove all providers
      };
      
      const yaml = require('yaml');
      fs.writeFileSync(testConfigPath, yaml.stringify(configWithMissingProvider));

      const options: UseCommandOptions = {
        configName: 'openai-gpt4',
        currentDir: tempDir
      };

      const result = await useCommand(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Configuration file validation failed');
      expect(result.details).toContain('Provider "openai" not found');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('useCommandHelp', () => {
    it('should return help information', () => {
      const result = useCommandHelp();

      expect(result.success).toBe(true);
      expect(result.message).toContain('qcr use - Activate a configuration');
      expect(result.message).toContain('USAGE:');
      expect(result.message).toContain('ARGUMENTS:');
      expect(result.message).toContain('OPTIONS:');
      expect(result.message).toContain('EXAMPLES:');
      expect(result.message).toContain('DESCRIPTION:');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('listConfigurations', () => {
    it('should list all configurations', () => {
      const result = listConfigurations(testConfigFile);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Available configurations:');
      expect(result.details).toContain('openai-gpt4 (default)');
      expect(result.details).toContain('azure-gpt35');
      expect(result.details).toContain('anthropic-claude');
      expect(result.exitCode).toBe(0);
    });

    it('should show verbose configuration details', () => {
      const result = listConfigurations(testConfigFile, { verbose: true });

      expect(result.success).toBe(true);
      expect(result.details).toContain('openai-gpt4 (default) - Provider: openai, Model: gpt-4');
      expect(result.details).toContain('azure-gpt35 - Provider: azure, Model: gpt-35-turbo');
      expect(result.details).toContain('anthropic-claude - Provider: anthropic, Model: claude-3-opus');
    });

    it('should handle empty configuration list', () => {
      const emptyConfig: ConfigFile = {
        configs: [],
        providers: []
      };

      const result = listConfigurations(emptyConfig);

      expect(result.success).toBe(true);
      expect(result.message).toBe('No configurations found');
      expect(result.details).toContain('Add configurations to your configuration file');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('getCurrentStatus', () => {
    it('should show active configuration status', () => {
      // Set environment variables to simulate active configuration
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = getCurrentStatus();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Configuration is currently active');
      expect(result.details).toContain('Provider endpoint: https://api.openai.com/v1');
      expect(result.details).toContain('Model: gpt-4');
      expect(result.details).toContain('API Key: test-api...');
      expect(result.exitCode).toBe(0);
    });

    it('should show inactive status when no configuration is set', () => {
      const result = getCurrentStatus();

      expect(result.success).toBe(true);
      expect(result.message).toBe('No configuration is currently active');
      expect(result.details).toContain('Use "qcr use [config_name]" to activate a configuration.');
      expect(result.exitCode).toBe(0);
    });

    it('should show warnings when present', () => {
      // Set environment variables with potential issues
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'short';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'http://api.openai.com/v1'; // HTTP instead of HTTPS
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = getCurrentStatus();

      expect(result.success).toBe(true);
      expect(result.details).toContain('Warnings:');
      expect(result.details).toContain('seems unusually short');
      expect(result.details).toContain('does not use HTTPS');
    });
  });

  describe('parseUseCommandArgs', () => {
    it('should parse configuration name correctly', () => {
      const result = parseUseCommandArgs(['openai-gpt4']);

      expect(result.valid).toBe(true);
      expect(result.options?.configName).toBe('openai-gpt4');
      expect(result.options?.verbose).toBeUndefined();
    });

    it('should parse verbose flag correctly', () => {
      const result = parseUseCommandArgs(['openai-gpt4', '--verbose']);

      expect(result.valid).toBe(true);
      expect(result.options?.configName).toBe('openai-gpt4');
      expect(result.options?.verbose).toBe(true);
    });

    it('should parse short verbose flag correctly', () => {
      const result = parseUseCommandArgs(['-v', 'azure-gpt35']);

      expect(result.valid).toBe(true);
      expect(result.options?.configName).toBe('azure-gpt35');
      expect(result.options?.verbose).toBe(true);
    });

    it('should handle help flag', () => {
      const result = parseUseCommandArgs(['--help']);

      expect(result.valid).toBe(true);
      expect(result.showHelp).toBe(true);
    });

    it('should handle short help flag', () => {
      const result = parseUseCommandArgs(['-h']);

      expect(result.valid).toBe(true);
      expect(result.showHelp).toBe(true);
    });

    it('should handle no arguments', () => {
      const result = parseUseCommandArgs([]);

      expect(result.valid).toBe(true);
      expect(result.options?.configName).toBeUndefined();
      expect(result.options?.verbose).toBeUndefined();
    });

    it('should reject unknown options', () => {
      const result = parseUseCommandArgs(['--unknown-option']);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown option: --unknown-option');
    });

    it('should reject too many arguments', () => {
      const result = parseUseCommandArgs(['config1', 'config2']);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many arguments');
      expect(result.error).toContain('config1, config2');
    });
  });

  describe('handleUseCommand', () => {
    it('should handle valid command with configuration name', async () => {
      const result = await handleUseCommand(['openai-gpt4']);

      // Should succeed if config file exists and contains the configuration
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully activated');
    });

    it('should show help when requested', async () => {
      const result = await handleUseCommand(['--help']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('qcr use - Activate a configuration');
      expect(result.exitCode).toBe(0);
    });

    it('should handle invalid arguments', async () => {
      const result = await handleUseCommand(['--invalid-option']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown option: --invalid-option');
      expect(result.exitCode).toBe(1);
    });

    it('should handle verbose flag', async () => {
      const result = await handleUseCommand(['-v']);

      // Should succeed if config file exists and use default configuration
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully activated');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full workflow: list -> use -> status', async () => {
      // First, list configurations
      const listResult = listConfigurations(testConfigFile);
      expect(listResult.success).toBe(true);
      expect(listResult.details).toContain('openai-gpt4 (default)');

      // Then, use a configuration
      const useResult = await useCommand({
        configName: 'azure-gpt35',
        currentDir: tempDir
      });
      expect(useResult.success).toBe(true);
      expect(useResult.message).toContain("Successfully activated specified configuration 'azure-gpt35'");

      // Finally, check status
      const statusResult = getCurrentStatus();
      expect(statusResult.success).toBe(true);
      expect(statusResult.message).toBe('Configuration is currently active');
      expect(statusResult.details).toContain('https://myazure.openai.azure.com/openai');
      expect(statusResult.details).toContain('gpt-35-turbo');
    });

    it('should handle switching between configurations', async () => {
      // Use first configuration
      const useResult1 = await useCommand({
        configName: 'openai-gpt4',
        currentDir: tempDir
      });
      expect(useResult1.success).toBe(true);
      expect(process.env[REQUIRED_ENV_VARS.MODEL]).toBe('gpt-4');

      // Switch to second configuration
      const useResult2 = await useCommand({
        configName: 'anthropic-claude',
        currentDir: tempDir
      });
      expect(useResult2.success).toBe(true);
      expect(process.env[REQUIRED_ENV_VARS.MODEL]).toBe('claude-3-opus');
      expect(process.env[REQUIRED_ENV_VARS.BASE_URL]).toBe('https://api.anthropic.com/v1');
    });

    it('should handle default configuration workflow', async () => {
      // Use default configuration (should be openai-gpt4)
      const useResult = await useCommand({
        currentDir: tempDir
      });
      expect(useResult.success).toBe(true);
      expect(useResult.message).toContain("default configuration 'openai-gpt4'");
      expect(process.env[REQUIRED_ENV_VARS.MODEL]).toBe('gpt-4');
      expect(process.env[REQUIRED_ENV_VARS.BASE_URL]).toBe('https://api.openai.com/v1');
    });
  });
});