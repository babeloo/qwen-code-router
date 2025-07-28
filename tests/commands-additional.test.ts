/**
 * Additional tests for commands.ts to improve branch coverage
 */

import { listConfigurations, getCurrentStatus } from '../src/commands';
import { ConfigFile } from '../src/types';
import * as environment from '../src/environment';

// Mock environment module
jest.mock('../src/environment');

describe('Commands - Additional Branch Coverage Tests', () => {
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
      }
    ]
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('listConfigurations - Additional Tests', () => {
    it('should handle exception during configuration listing', () => {
      // Create a configuration that will cause an exception
      const invalidConfig = {
        ...testConfigFile,
        configs: null as any // This will cause an exception when trying to access configs
      };

      const result = listConfigurations(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to list configurations');
      expect(result.details).toContain('configFile.configs is not iterable');
      expect(result.exitCode).toBe(1);
    });

    it('should handle configuration entry not found in verbose mode', () => {
      // Create a configuration with a config entry that won't be found
      const configWithMissingEntry: ConfigFile = {
        ...testConfigFile,
        configs: [
          {
            config: [] // Empty config array
          }
        ],
        default_config: [] // No default config
      };

      const result = listConfigurations(configWithMissingEntry, { verbose: true });

      expect(result.success).toBe(true);
      expect(result.message).toBe('No configurations found');
    });
  });

  describe('getCurrentStatus - Additional Tests', () => {
    it('should handle exception during status checking', () => {
      // Mock environment validation to throw an error
      const mockValidateEnvironmentVariables = environment.validateEnvironmentVariables as jest.MockedFunction<typeof environment.validateEnvironmentVariables>;
      mockValidateEnvironmentVariables.mockImplementation(() => {
        throw new Error('Environment validation failed');
      });

      const result = getCurrentStatus();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to get current status');
      expect(result.details).toBe('Environment validation failed');
      expect(result.exitCode).toBe(1);
    });

    it('should handle environment validation with warnings', () => {
      // Mock environment validation with warnings
      const mockValidateEnvironmentVariables = environment.validateEnvironmentVariables as jest.MockedFunction<typeof environment.validateEnvironmentVariables>;
      mockValidateEnvironmentVariables.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['API key seems short', 'Base URL does not use HTTPS']
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
      expect(result.details).toContain('Warnings: API key seems short, Base URL does not use HTTPS');
      expect(result.exitCode).toBe(0);
    });
  });
});