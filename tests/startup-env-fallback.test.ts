/**
 * Tests for environment variable fallback functionality in startup flow
 * This tests the implementation of requirements 6.3, 6.4, 6.5
 */

import {
  executeStartupFlow,
  validateStartupFlow,
  StartupStep
} from '../src/startup';
import { REQUIRED_ENV_VARS } from '../src/environment';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the persistence module
jest.mock('../src/persistence');

describe('Startup Flow - Environment Variable Fallback', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-env-fallback-test-'));
    
    // Backup original environment variables
    originalEnv = { ...process.env };
    
    // Clear environment variables
    delete process.env[REQUIRED_ENV_VARS.API_KEY];
    delete process.env[REQUIRED_ENV_VARS.BASE_URL];
    delete process.env[REQUIRED_ENV_VARS.MODEL];

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Environment Variable Fallback - Success Cases', () => {
    it('should succeed when configuration file not found but all environment variables are set and valid', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set all required environment variables
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(StartupStep.READY);
      expect(result.exitCode).toBe(0);
    });

    it('should succeed in executeStartupFlow when environment variables are valid', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set all required environment variables
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await executeStartupFlow(tempDir);

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(StartupStep.READY);
      expect(result.exitCode).toBe(0);
    });

    it('should work with different valid base URLs', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set environment variables with different base URL
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'azure-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://myazure.openai.azure.com/openai';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-35-turbo';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(StartupStep.READY);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Environment Variable Fallback - Missing Variables', () => {
    it('should fail when configuration file not found and API key is missing', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set only base URL and model, missing API key
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.API_KEY}`);
      expect(result.errorDetails).toContain('Either create a configuration file or set all required environment variables');
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when configuration file not found and base URL is missing', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set only API key and model, missing base URL
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.BASE_URL}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when configuration file not found and model is missing', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set only API key and base URL, missing model
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.MODEL}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when configuration file not found and multiple variables are missing', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set only model, missing API key and base URL
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.API_KEY}, ${REQUIRED_ENV_VARS.BASE_URL}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when configuration file not found and no environment variables are set', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // No environment variables set

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.API_KEY}, ${REQUIRED_ENV_VARS.BASE_URL}, ${REQUIRED_ENV_VARS.MODEL}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });
  });

  describe('Environment Variable Fallback - Invalid Variables', () => {
    it('should fail when environment variables are set but API key is empty', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set environment variables with empty API key
      process.env[REQUIRED_ENV_VARS.API_KEY] = '';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.API_KEY}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when environment variables are set but base URL is invalid', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set environment variables with invalid base URL
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'invalid-url';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain('Validation errors:');
      expect(result.errorDetails).toContain('is not a valid URL');
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when environment variables are set but model is empty', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set environment variables with empty model
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = '';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.MODEL}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when environment variables are set but contain only whitespace', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set environment variables with whitespace only
      process.env[REQUIRED_ENV_VARS.API_KEY] = '   ';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.API_KEY}`);
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });
  });

  describe('Environment Variable Fallback - Edge Cases', () => {
    it('should handle unexpected error during environment variable check', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Mock getCurrentEnvironmentVariables to throw an error
      const environmentModule = require('../src/environment');
      const originalGetCurrentEnv = environmentModule.getCurrentEnvironmentVariables;
      const mockGetCurrentEnv = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error in environment check');
      });
      environmentModule.getCurrentEnvironmentVariables = mockGetCurrentEnv;

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found and environment variables not set');
      expect(result.errorDetails).toContain('Unexpected error in environment check');

      // Restore original function
      environmentModule.getCurrentEnvironmentVariables = originalGetCurrentEnv;
    });

    it('should prioritize configuration file over environment variables when both exist', async () => {
      // Mock successful configuration loading
      const mockConfigFile = {
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
            api_key: 'config-api-key',
            base_url: 'https://api.openai.com/v1',
            models: [{ model: 'gpt-4' }]
          }
        }]
      };

      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      // Set environment variables (should be ignored when config file exists)
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'env-api-key';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://env.example.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'env-model';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(StartupStep.READY);
      expect(result.configFile).toEqual(mockConfigFile);
      expect(result.defaultConfigName).toBe('test-config');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Environment Variable Fallback - Error Message Quality', () => {
    beforeEach(() => {
      // Ensure clean environment for these tests
      delete process.env[REQUIRED_ENV_VARS.API_KEY];
      delete process.env[REQUIRED_ENV_VARS.BASE_URL];
      delete process.env[REQUIRED_ENV_VARS.MODEL];
      
      // Reset all mocks to ensure clean state
      jest.clearAllMocks();
    });

    it('should provide helpful error message with setup instructions', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // No environment variables set

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.errorDetails).toContain('Either create a configuration file or set all required environment variables:');
      expect(result.errorDetails).toContain(`${REQUIRED_ENV_VARS.API_KEY}=your_api_key`);
      expect(result.errorDetails).toContain(`${REQUIRED_ENV_VARS.BASE_URL}=your_base_url`);
      expect(result.errorDetails).toContain(`${REQUIRED_ENV_VARS.MODEL}=your_model`);
    });

    it('should provide specific error message for each missing variable', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set only API key
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key';

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.errorDetails).toContain(`Missing environment variables: ${REQUIRED_ENV_VARS.BASE_URL}, ${REQUIRED_ENV_VARS.MODEL}`);
      // The error details should not contain the API key in the missing variables list
      const missingVarsLine = result.errorDetails?.split('\n')[0];
      expect(missingVarsLine).not.toContain(REQUIRED_ENV_VARS.API_KEY);
    });
  });
});