/**
 * More additional tests for commands.ts to further improve branch coverage
 */

import { listConfigurations, getCurrentStatus } from '../src/commands';
import { ConfigFile } from '../src/types';
import * as environment from '../src/environment';

// Mock environment module
jest.mock('../src/environment');

describe('Commands - More Additional Branch Coverage Tests', () => {
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
            { model: 'gpt-4' }
          ]
        }
      }
    ]
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('listConfigurations - More Edge Cases', () => {
    it('should handle verbose mode with config entry found', () => {
      const result = listConfigurations(testConfigFile, { verbose: true });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Available configurations:');
      expect(result.details).toContain('openai-gpt4 (default) - Provider: openai, Model: gpt-4');
      expect(result.exitCode).toBe(0);
    });

    it('should handle verbose mode with config entry not found', () => {
      // Config with a name that won't be found in the config entries
      const configWithMissingEntry: ConfigFile = {
        default_config: [{ name: 'openai-gpt4' }], // This name won't be found in configs
        configs: [
          {
            config: [
              {
                name: 'different-config',
                provider: 'openai',
                model: 'gpt-4'
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
                { model: 'gpt-4' }
              ]
            }
          }
        ]
      };

      const result = listConfigurations(configWithMissingEntry, { verbose: true });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Available configurations:');
      // Should show both config names
      expect(result.details).toContain('different-config');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('getCurrentStatus - More Edge Cases', () => {
    it('should handle environment validation failure', () => {
      // Mock environment validation failure
      const mockValidateEnvironmentVariables = environment.validateEnvironmentVariables as jest.MockedFunction<typeof environment.validateEnvironmentVariables>;
      mockValidateEnvironmentVariables.mockReturnValue({
        isValid: false,
        errors: ['Missing API key'],
        warnings: []
      });

      const result = getCurrentStatus();

      expect(result.success).toBe(true);
      expect(result.message).toBe('No configuration is currently active');
      expect(result.details).toBe('Use "qcr use [config_name]" to activate a configuration.');
      expect(result.exitCode).toBe(0);
    });

    it('should handle environment validation success without warnings', () => {
      // Mock environment validation success without warnings
      const mockValidateEnvironmentVariables = environment.validateEnvironmentVariables as jest.MockedFunction<typeof environment.validateEnvironmentVariables>;
      mockValidateEnvironmentVariables.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Set environment variables
      process.env['OPENAI_API_KEY'] = 'test-key';
      process.env['OPENAI_BASE_URL'] = 'https://api.openai.com/v1';
      process.env['OPENAI_MODEL'] = 'gpt-4';

      const result = getCurrentStatus();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Configuration is currently active');
      expect(result.details).toContain('Provider endpoint: https://api.openai.com/v1');
      expect(result.details).toContain('Model: gpt-4');
      expect(result.details).toContain('API Key: test-key...');
      expect(result.details).not.toContain('Warnings:');
      expect(result.exitCode).toBe(0);
    });
  });
});