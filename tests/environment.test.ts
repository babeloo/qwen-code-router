/**
 * Unit tests for environment variable management
 * Tests setting, validating, and clearing environment variables
 */

import {
  setEnvironmentVariables,
  setEnvironmentVariablesFromObject,
  validateEnvironmentVariables,
  getCurrentEnvironmentVariables,
  getRequiredEnvironmentVariables,
  clearEnvironmentVariables,
  backupEnvironmentVariables,
  restoreEnvironmentVariables,
  areEnvironmentVariablesSet,
  getEnvironmentVariableStatus,
  validateEnvironmentVariablesAgainstProvider,
  createEnvironmentVariables,
  REQUIRED_ENV_VARS
} from '../src/environment';

import {
  ConfigEntry,
  Provider,
  EnvironmentVariables
} from '../src/types';

describe('Environment Variable Management', () => {
  // Sample test data
  const sampleConfigEntry: ConfigEntry = {
    name: 'openai-gpt4',
    provider: 'openai',
    model: 'gpt-4'
  };

  const sampleProvider: Provider = {
    provider: 'openai',
    env: {
      api_key: 'test-api-key-12345',
      base_url: 'https://api.openai.com/v1',
      models: [
        { model: 'gpt-4' },
        { model: 'gpt-3.5-turbo' }
      ]
    }
  };

  const sampleEnvVars: EnvironmentVariables = {
    OPENAI_API_KEY: 'test-api-key-12345',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_MODEL: 'gpt-4'
  };

  // Store original environment variables
  let originalEnv: Partial<EnvironmentVariables>;

  beforeEach(() => {
    // Backup original environment variables
    originalEnv = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      OPENAI_MODEL: process.env.OPENAI_MODEL
    };

    // Clear environment variables for clean testing
    clearEnvironmentVariables();
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalEnv.OPENAI_API_KEY !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    if (originalEnv.OPENAI_BASE_URL !== undefined) {
      process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL;
    } else {
      delete process.env.OPENAI_BASE_URL;
    }

    if (originalEnv.OPENAI_MODEL !== undefined) {
      process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
    } else {
      delete process.env.OPENAI_MODEL;
    }
  });

  describe('REQUIRED_ENV_VARS', () => {
    it('should define all required environment variable names', () => {
      expect(REQUIRED_ENV_VARS.API_KEY).toBe('OPENAI_API_KEY');
      expect(REQUIRED_ENV_VARS.BASE_URL).toBe('OPENAI_BASE_URL');
      expect(REQUIRED_ENV_VARS.MODEL).toBe('OPENAI_MODEL');
    });
  });

  describe('setEnvironmentVariables', () => {
    it('should set environment variables from config entry and provider', () => {
      setEnvironmentVariables(sampleConfigEntry, sampleProvider);

      expect(process.env.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(process.env.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should throw error if config entry is missing', () => {
      expect(() => setEnvironmentVariables(null as any, sampleProvider)).toThrow(
        'Configuration entry is required'
      );
    });

    it('should throw error if provider is missing', () => {
      expect(() => setEnvironmentVariables(sampleConfigEntry, null as any)).toThrow(
        'Provider information is required'
      );
    });

    it('should throw error if config provider does not match provider', () => {
      const mismatchedConfig: ConfigEntry = {
        name: 'azure-config',
        provider: 'azure',
        model: 'gpt-4'
      };

      expect(() => setEnvironmentVariables(mismatchedConfig, sampleProvider)).toThrow(
        'Configuration provider "azure" does not match provider "openai"'
      );
    });

    it('should throw error if model is not supported by provider', () => {
      const unsupportedModelConfig: ConfigEntry = {
        name: 'openai-unsupported',
        provider: 'openai',
        model: 'unsupported-model'
      };

      expect(() => setEnvironmentVariables(unsupportedModelConfig, sampleProvider)).toThrow(
        'Model "unsupported-model" is not supported by provider "openai"'
      );
    });
  });

  describe('setEnvironmentVariablesFromObject', () => {
    it('should set environment variables from object', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      expect(process.env.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(process.env.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should throw error if environment variables object is missing', () => {
      expect(() => setEnvironmentVariablesFromObject(null as any)).toThrow(
        'Environment variables object is required'
      );
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate when all environment variables are set correctly', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing API key', () => {
      process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
      process.env.OPENAI_MODEL = 'gpt-4';

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required environment variable: OPENAI_API_KEY');
    });

    it('should detect missing base URL', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_MODEL = 'gpt-4';

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required environment variable: OPENAI_BASE_URL');
    });

    it('should detect missing model', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required environment variable: OPENAI_MODEL');
    });

    it('should detect empty API key', () => {
      process.env.OPENAI_API_KEY = '';
      process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
      process.env.OPENAI_MODEL = 'gpt-4';

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Environment variable OPENAI_API_KEY cannot be empty');
    });

    it('should detect invalid URL format', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_BASE_URL = 'invalid-url';
      process.env.OPENAI_MODEL = 'gpt-4';

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('not a valid URL'))).toBe(true);
    });

    it('should warn about short API key', () => {
      process.env.OPENAI_API_KEY = 'short';
      process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
      process.env.OPENAI_MODEL = 'gpt-4';

      const result = validateEnvironmentVariables();

      expect(result.warnings.some(warning => warning.includes('seems unusually short'))).toBe(true);
    });

    it('should warn about non-HTTPS URL', () => {
      process.env.OPENAI_API_KEY = 'test-api-key-12345';
      process.env.OPENAI_BASE_URL = 'http://api.openai.com/v1';
      process.env.OPENAI_MODEL = 'gpt-4';

      const result = validateEnvironmentVariables();

      expect(result.warnings.some(warning => warning.includes('does not use HTTPS'))).toBe(true);
    });
  });

  describe('getCurrentEnvironmentVariables', () => {
    it('should return current environment variables', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      const result = getCurrentEnvironmentVariables();

      expect(result.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(result.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(result.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should return undefined values when variables are not set', () => {
      const result = getCurrentEnvironmentVariables();

      expect(result.OPENAI_API_KEY).toBeUndefined();
      expect(result.OPENAI_BASE_URL).toBeUndefined();
      expect(result.OPENAI_MODEL).toBeUndefined();
    });
  });

  describe('getRequiredEnvironmentVariables', () => {
    it('should return complete environment variables when all are set', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      const result = getRequiredEnvironmentVariables();

      expect(result.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(result.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(result.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should throw error when required variables are missing', () => {
      expect(() => getRequiredEnvironmentVariables()).toThrow(
        'Missing required environment variables'
      );
    });
  });

  describe('clearEnvironmentVariables', () => {
    it('should clear all Qwen Code environment variables', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      clearEnvironmentVariables();

      expect(process.env.OPENAI_API_KEY).toBeUndefined();
      expect(process.env.OPENAI_BASE_URL).toBeUndefined();
      expect(process.env.OPENAI_MODEL).toBeUndefined();
    });
  });

  describe('backupEnvironmentVariables', () => {
    it('should backup current environment variables', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      const backup = backupEnvironmentVariables();

      expect(backup.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(backup.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(backup.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should backup undefined values when variables are not set', () => {
      const backup = backupEnvironmentVariables();

      expect(backup.OPENAI_API_KEY).toBeUndefined();
      expect(backup.OPENAI_BASE_URL).toBeUndefined();
      expect(backup.OPENAI_MODEL).toBeUndefined();
    });
  });

  describe('restoreEnvironmentVariables', () => {
    it('should restore environment variables from backup', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);
      const backup = backupEnvironmentVariables();

      clearEnvironmentVariables();
      restoreEnvironmentVariables(backup);

      expect(process.env.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(process.env.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should handle partial backup restoration', () => {
      const partialBackup = {
        OPENAI_API_KEY: 'restored-key',
        OPENAI_BASE_URL: undefined,
        OPENAI_MODEL: 'restored-model'
      };

      restoreEnvironmentVariables(partialBackup);

      expect(process.env.OPENAI_API_KEY).toBe('restored-key');
      expect(process.env.OPENAI_BASE_URL).toBeUndefined();
      expect(process.env.OPENAI_MODEL).toBe('restored-model');
    });
  });

  describe('areEnvironmentVariablesSet', () => {
    it('should return true when all variables are set correctly', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      expect(areEnvironmentVariablesSet()).toBe(true);
    });

    it('should return false when variables are missing', () => {
      expect(areEnvironmentVariablesSet()).toBe(false);
    });

    it('should return false when variables are invalid', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_BASE_URL = 'invalid-url';
      process.env.OPENAI_MODEL = 'gpt-4';

      expect(areEnvironmentVariablesSet()).toBe(false);
    });
  });

  describe('getEnvironmentVariableStatus', () => {
    it('should return status for all variables when set', () => {
      setEnvironmentVariablesFromObject(sampleEnvVars);

      const status = getEnvironmentVariableStatus();

      expect(status.apiKey.isSet).toBe(true);
      expect(status.apiKey.isEmpty).toBe(false);
      expect(status.apiKey.value).toBe('test-api...'); // Masked

      expect(status.baseUrl.isSet).toBe(true);
      expect(status.baseUrl.isEmpty).toBe(false);
      expect(status.baseUrl.value).toBe('https://api.openai.com/v1');

      expect(status.model.isSet).toBe(true);
      expect(status.model.isEmpty).toBe(false);
      expect(status.model.value).toBe('gpt-4');
    });

    it('should return status for unset variables', () => {
      const status = getEnvironmentVariableStatus();

      expect(status.apiKey.isSet).toBe(false);
      expect(status.apiKey.isEmpty).toBe(true);
      expect(status.apiKey.value).toBeUndefined();

      expect(status.baseUrl.isSet).toBe(false);
      expect(status.baseUrl.isEmpty).toBe(true);
      expect(status.baseUrl.value).toBeUndefined();

      expect(status.model.isSet).toBe(false);
      expect(status.model.isEmpty).toBe(true);
      expect(status.model.value).toBeUndefined();
    });
  });

  describe('validateEnvironmentVariablesAgainstProvider', () => {
    it('should validate when environment matches provider', () => {
      setEnvironmentVariables(sampleConfigEntry, sampleProvider);

      const result = validateEnvironmentVariablesAgainstProvider(sampleProvider);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect API key mismatch', () => {
      setEnvironmentVariablesFromObject({
        ...sampleEnvVars,
        OPENAI_API_KEY: 'different-key'
      });

      const result = validateEnvironmentVariablesAgainstProvider(sampleProvider);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('API key does not match'))).toBe(true);
    });

    it('should detect base URL mismatch', () => {
      setEnvironmentVariablesFromObject({
        ...sampleEnvVars,
        OPENAI_BASE_URL: 'https://different.api.com/v1'
      });

      const result = validateEnvironmentVariablesAgainstProvider(sampleProvider);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('base URL does not match'))).toBe(true);
    });

    it('should detect unsupported model', () => {
      setEnvironmentVariablesFromObject({
        ...sampleEnvVars,
        OPENAI_MODEL: 'unsupported-model'
      });

      const result = validateEnvironmentVariablesAgainstProvider(sampleProvider);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('not supported by provider'))).toBe(true);
    });
  });

  describe('createEnvironmentVariables', () => {
    it('should create environment variables object from config and provider', () => {
      const result = createEnvironmentVariables(sampleConfigEntry, sampleProvider);

      expect(result.OPENAI_API_KEY).toBe('test-api-key-12345');
      expect(result.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(result.OPENAI_MODEL).toBe('gpt-4');
    });

    it('should throw error if config entry is missing', () => {
      expect(() => createEnvironmentVariables(null as any, sampleProvider)).toThrow(
        'Configuration entry is required'
      );
    });

    it('should throw error if provider is missing', () => {
      expect(() => createEnvironmentVariables(sampleConfigEntry, null as any)).toThrow(
        'Provider information is required'
      );
    });

    it('should throw error if config provider does not match provider', () => {
      const mismatchedConfig: ConfigEntry = {
        name: 'azure-config',
        provider: 'azure',
        model: 'gpt-4'
      };

      expect(() => createEnvironmentVariables(mismatchedConfig, sampleProvider)).toThrow(
        'Configuration provider "azure" does not match provider "openai"'
      );
    });

    it('should throw error if model is not supported by provider', () => {
      const unsupportedModelConfig: ConfigEntry = {
        name: 'openai-unsupported',
        provider: 'openai',
        model: 'unsupported-model'
      };

      expect(() => createEnvironmentVariables(unsupportedModelConfig, sampleProvider)).toThrow(
        'Model "unsupported-model" is not supported by provider "openai"'
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: set, validate, backup, clear, restore', () => {
      // Set environment variables
      setEnvironmentVariables(sampleConfigEntry, sampleProvider);
      expect(areEnvironmentVariablesSet()).toBe(true);

      // Validate
      const validation = validateEnvironmentVariables();
      expect(validation.isValid).toBe(true);

      // Backup
      const backup = backupEnvironmentVariables();
      expect(backup.OPENAI_API_KEY).toBe('test-api-key-12345');

      // Clear
      clearEnvironmentVariables();
      expect(areEnvironmentVariablesSet()).toBe(false);

      // Restore
      restoreEnvironmentVariables(backup);
      expect(areEnvironmentVariablesSet()).toBe(true);
      expect(process.env.OPENAI_API_KEY).toBe('test-api-key-12345');
    });

    it('should handle multiple provider configurations', () => {
      const azureProvider: Provider = {
        provider: 'azure',
        env: {
          api_key: 'azure-api-key',
          base_url: 'https://myazure.openai.azure.com/openai',
          models: [{ model: 'gpt-35-turbo' }]
        }
      };

      const azureConfig: ConfigEntry = {
        name: 'azure-gpt35',
        provider: 'azure',
        model: 'gpt-35-turbo'
      };

      // Test OpenAI configuration
      setEnvironmentVariables(sampleConfigEntry, sampleProvider);
      let validation = validateEnvironmentVariablesAgainstProvider(sampleProvider);
      expect(validation.isValid).toBe(true);

      // Switch to Azure configuration
      setEnvironmentVariables(azureConfig, azureProvider);
      validation = validateEnvironmentVariablesAgainstProvider(azureProvider);
      expect(validation.isValid).toBe(true);

      expect(process.env.OPENAI_API_KEY).toBe('azure-api-key');
      expect(process.env.OPENAI_BASE_URL).toBe('https://myazure.openai.azure.com/openai');
      expect(process.env.OPENAI_MODEL).toBe('gpt-35-turbo');
    });
  });
});