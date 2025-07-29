/**
 * More additional tests for startup.ts to further improve branch coverage
 */

import {
  validateStartupFlow,
  formatStartupFlowResult,
  StartupStep
} from '../src/startup';
import { ConfigFile } from '../src/types';

// Mock the persistence and environment modules
jest.mock('../src/persistence');
jest.mock('../src/environment');
jest.mock('../src/resolver');

describe('Startup - More Additional Branch Coverage Tests', () => {
  let mockConfigFile: ConfigFile;

  beforeEach(() => {
    // Mock configuration file
    mockConfigFile = {
      default_config: [{ name: 'test-config' }],
      configs: [{
        config: [{
          name: 'test-config',
          provider: 'openai',
          model: 'gpt-4'
        }]
      }],
      providers: [{
        provider: 'openai',
        env: {
          api_key: 'test-api-key',
          base_url: 'https://api.openai.com/v1',
          models: [{ model: 'gpt-4' }]
        }
      }]
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('formatStartupFlowResult - Additional Tests', () => {
    it('should format successful result with all details', () => {
      const successResult = {
        success: true,
        currentStep: StartupStep.READY,
        configFile: mockConfigFile,
        configFilePath: '/path/to/config.yaml',
        defaultConfigName: 'test-config',
        exitCode: 0
      };

      const formatted = formatStartupFlowResult(successResult);

      expect(formatted.success).toBe(true);
      expect(formatted.message).toBe('Startup flow validation completed successfully');
      expect(formatted.details).toContain('Step: Ready to launch Qwen Code');
      expect(formatted.details).toContain('Configuration file: /path/to/config.yaml');
      expect(formatted.details).toContain('Default configuration: test-config');
      expect(formatted.exitCode).toBe(0);
    });

    it('should format failure result with all details', () => {
      const failureResult = {
        success: false,
        currentStep: StartupStep.FAILED,
        errorMessage: 'Test error',
        errorDetails: 'Detailed error info',
        configFilePath: '/path/to/config.yaml',
        exitCode: 1
      };

      const formatted = formatStartupFlowResult(failureResult);

      expect(formatted.success).toBe(false);
      expect(formatted.message).toBe('Test error');
      expect(formatted.details).toContain('Failed at step: Startup flow failed');
      expect(formatted.details).toContain('Error details:');
      expect(formatted.details).toContain('Detailed error info');
      expect(formatted.details).toContain('Configuration file: /path/to/config.yaml');
      expect(formatted.details).toContain('Suggestions:');
      expect(formatted.exitCode).toBe(1);
    });

    it('should format failure result without config file path', () => {
      const failureResult = {
        success: false,
        currentStep: StartupStep.FAILED,
        errorMessage: 'Test error',
        errorDetails: 'Detailed error info',
        exitCode: 1
      };

      const formatted = formatStartupFlowResult(failureResult);

      expect(formatted.success).toBe(false);
      expect(formatted.message).toBe('Test error');
      expect(formatted.details).toContain('Failed at step: Startup flow failed');
      expect(formatted.details).toContain('Error details:');
      expect(formatted.details).toContain('Detailed error info');
      expect(formatted.details).not.toContain('Configuration file:');
      expect(formatted.exitCode).toBe(1);
    });
  });

  describe('validateStartupFlow - More Edge Cases', () => {
    it('should handle config file not found error with specific message', async () => {
      // Mock configuration file not found with specific message
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found in current directory'));

      const result = await validateStartupFlow('/test/dir');

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should handle config validation errors with multiple errors', async () => {
      // Mock configuration with multiple validation errors
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { 
          isValid: false, 
          errors: ['Error 1', 'Error 2'], 
          warnings: [] 
        },
        filePath: '/test/config.yaml'
      });

      const result = await validateStartupFlow('/test/dir');

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file validation failed');
      expect(result.errorDetails).toBe('Errors: Error 1, Error 2');
      expect(result.exitCode).toBe(5); // CONFIG_VALIDATION_FAILED
    });
  });
});