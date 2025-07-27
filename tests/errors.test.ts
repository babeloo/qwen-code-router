/**
 * Tests for standardized error handling and formatting
 */

import {
  createErrorResult,
  createSuccessResult,
  configFileNotFoundError,
  configValidationError,
  configNotFoundError,
  providerNotFoundError,
  modelNotFoundError,
  environmentNotSetError,
  environmentValidationError,
  commandNotFoundError,
  invalidArgumentsError,
  fileOperationError,
  processLaunchError,
  networkError,
  noDefaultConfigError,
  unexpectedError,
  formatValidationResult,
  EXIT_CODES,
  ErrorCategory
} from '../src/errors';

describe('Error Handling System', () => {
  describe('createErrorResult', () => {
    it('should create a properly formatted error result', () => {
      const error = {
        message: 'Test error',
        details: 'Error details',
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        availableOptions: ['Option 1', 'Option 2'],
        category: ErrorCategory.CONFIG_FILE,
        exitCode: EXIT_CODES.CONFIG_NOT_FOUND
      };

      const result = createErrorResult(error);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Test error');
      expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
      expect(result.details).toContain('Error details');
      expect(result.details).toContain('Available options:');
      expect(result.details).toContain('Option 1');
      expect(result.details).toContain('Suggestions:');
      expect(result.details).toContain('Suggestion 1');
    });

    it('should handle minimal error structure', () => {
      const error = {
        message: 'Simple error',
        exitCode: EXIT_CODES.GENERAL_ERROR
      };

      const result = createErrorResult(error);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Simple error');
      expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
      expect(result.details).toBeUndefined();
    });
  });

  describe('createSuccessResult', () => {
    it('should create a properly formatted success result', () => {
      const result = createSuccessResult('Success message', 'Success details');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Success message');
      expect(result.details).toBe('Success details');
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('should handle success without details', () => {
      const result = createSuccessResult('Success message');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Success message');
      expect(result.details).toBeUndefined();
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe('configFileNotFoundError', () => {
    it('should create a config file not found error', () => {
      const searchPaths = ['/path/1', '/path/2'];
      const error = configFileNotFoundError(searchPaths);

      expect(error.message).toBe('Configuration file not found');
      expect(error.details).toContain('/path/1');
      expect(error.details).toContain('/path/2');
      expect(error.suggestions).toContain('Create a configuration file in your current directory or user directory');
      expect(error.availableOptions).toContain('config.yaml (recommended)');
      expect(error.category).toBe(ErrorCategory.CONFIG_FILE);
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
    });
  });

  describe('configValidationError', () => {
    it('should create a config validation error with errors and warnings', () => {
      const errors = ['Error 1', 'Error 2'];
      const warnings = ['Warning 1'];
      const error = configValidationError(errors, warnings);

      expect(error.message).toBe('Configuration file validation failed');
      expect(error.details).toContain('✗ Error 1');
      expect(error.details).toContain('✗ Error 2');
      expect(error.details).toContain('⚠ Warning 1');
      expect(error.suggestions).toContain('Check the configuration file syntax and structure');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_VALIDATION_FAILED);
    });

    it('should handle errors without warnings', () => {
      const errors = ['Error 1'];
      const error = configValidationError(errors);

      expect(error.details).toContain('✗ Error 1');
      expect(error.details).not.toContain('Warnings:');
    });
  });

  describe('configNotFoundError', () => {
    it('should create a config not found error with available configs', () => {
      const configName = 'missing-config';
      const availableConfigs = ['config1', 'config2'];
      const error = configNotFoundError(configName, availableConfigs);

      expect(error.message).toBe("Configuration not found: 'missing-config'");
      expect(error.availableOptions).toEqual(availableConfigs);
      expect(error.suggestions).toContain('Use one of the available configurations: config1, config2');
      expect(error.category).toBe(ErrorCategory.CONFIG_FILE);
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
    });

    it('should handle case with no available configs', () => {
      const configName = 'missing-config';
      const availableConfigs: string[] = [];
      const error = configNotFoundError(configName, availableConfigs);

      expect(error.availableOptions).toEqual(['No configurations available']);
      expect(error.suggestions).toContain('Add configurations to your configuration file');
    });
  });

  describe('providerNotFoundError', () => {
    it('should create a provider not found error', () => {
      const providerName = 'missing-provider';
      const availableProviders = ['openai', 'azure'];
      const error = providerNotFoundError(providerName, availableProviders);

      expect(error.message).toBe("Provider 'missing-provider' not found");
      expect(error.availableOptions).toEqual(availableProviders);
      expect(error.suggestions).toContain('Check the spelling of the provider name (case-insensitive)');
      expect(error.category).toBe(ErrorCategory.CONFIG_FILE);
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
    });
  });

  describe('modelNotFoundError', () => {
    it('should create a model not found error', () => {
      const modelName = 'missing-model';
      const providerName = 'openai';
      const availableModels = ['gpt-4', 'gpt-3.5-turbo'];
      const error = modelNotFoundError(modelName, providerName, availableModels);

      expect(error.message).toBe("Model 'missing-model' not found for provider 'openai'");
      expect(error.availableOptions).toEqual(availableModels);
      expect(error.suggestions).toContain('Use "qcr list provider openai" to see available models');
      expect(error.category).toBe(ErrorCategory.CONFIG_FILE);
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
    });
  });

  describe('environmentNotSetError', () => {
    it('should create an environment not set error', () => {
      const missingVars = ['OPENAI_API_KEY', 'OPENAI_BASE_URL'];
      const error = environmentNotSetError(missingVars);

      expect(error.message).toBe('Required environment variables are not set');
      expect(error.details).toContain('OPENAI_API_KEY');
      expect(error.details).toContain('OPENAI_BASE_URL');
      expect(error.suggestions).toContain('Use "qcr use [config_name]" to activate a configuration');
      expect(error.category).toBe(ErrorCategory.ENVIRONMENT);
      expect(error.exitCode).toBe(EXIT_CODES.ENVIRONMENT_ERROR);
    });
  });

  describe('environmentValidationError', () => {
    it('should create an environment validation error', () => {
      const errors = ['Invalid API key format'];
      const warnings = ['API key seems short'];
      const error = environmentValidationError(errors, warnings);

      expect(error.message).toBe('Environment variables validation failed');
      expect(error.details).toContain('✗ Invalid API key format');
      expect(error.details).toContain('⚠ API key seems short');
      expect(error.suggestions).toContain('Check that all environment variables are properly set');
      expect(error.category).toBe(ErrorCategory.ENVIRONMENT);
      expect(error.exitCode).toBe(EXIT_CODES.ENVIRONMENT_ERROR);
    });
  });

  describe('commandNotFoundError', () => {
    it('should create a command not found error', () => {
      const command = 'unknown-command';
      const availableCommands = ['use', 'run', 'list'];
      const error = commandNotFoundError(command, availableCommands);

      expect(error.message).toBe('Unknown command: unknown-command');
      expect(error.availableOptions).toEqual(availableCommands);
      expect(error.suggestions).toContain('Use "qcr help" to see all available commands');
      expect(error.category).toBe(ErrorCategory.COMMAND);
      expect(error.exitCode).toBe(EXIT_CODES.INVALID_USAGE);
    });
  });

  describe('invalidArgumentsError', () => {
    it('should create an invalid arguments error', () => {
      const command = 'use';
      const errorMsg = 'Too many arguments';
      const usage = 'qcr use [config_name]';
      const error = invalidArgumentsError(command, errorMsg, usage);

      expect(error.message).toBe("Invalid arguments for command 'use'");
      expect(error.details).toContain('Too many arguments');
      expect(error.details).toContain('Usage: qcr use [config_name]');
      expect(error.suggestions).toContain('Use "qcr use --help" for detailed usage information');
      expect(error.category).toBe(ErrorCategory.COMMAND);
      expect(error.exitCode).toBe(EXIT_CODES.INVALID_USAGE);
    });
  });

  describe('fileOperationError', () => {
    it('should create a file operation error', () => {
      const operation = 'read';
      const filePath = '/path/to/file';
      const errorMsg = 'Permission denied';
      const error = fileOperationError(operation, filePath, errorMsg);

      expect(error.message).toBe('Failed to read file');
      expect(error.details).toContain('/path/to/file');
      expect(error.details).toContain('Permission denied');
      expect(error.suggestions).toContain('Check file permissions and accessibility');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });
  });

  describe('processLaunchError', () => {
    it('should create a process launch error for command not found', () => {
      const command = 'qwen';
      const errorMsg = 'ENOENT: command not found';
      const error = processLaunchError(command, errorMsg);

      expect(error.message).toBe('Failed to launch qwen');
      expect(error.details).toBe(errorMsg);
      expect(error.suggestions).toContain('Ensure qwen is installed and available in your PATH');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.exitCode).toBe(EXIT_CODES.COMMAND_NOT_FOUND);
    });

    it('should create a process launch error for other errors', () => {
      const command = 'qwen';
      const errorMsg = 'Out of memory';
      const error = processLaunchError(command, errorMsg);

      expect(error.message).toBe('Failed to launch qwen');
      expect(error.details).toBe(errorMsg);
      expect(error.suggestions).toContain('Check system resources and permissions');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });
  });

  describe('networkError', () => {
    it('should create a network error', () => {
      const operation = 'API call';
      const endpoint = 'https://api.openai.com/v1/models';
      const errorMsg = 'Connection timeout';
      const error = networkError(operation, endpoint, errorMsg);

      expect(error.message).toBe('Network error during API call');
      expect(error.details).toContain('https://api.openai.com/v1/models');
      expect(error.details).toContain('Connection timeout');
      expect(error.suggestions).toContain('Check your internet connection');
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });
  });

  describe('noDefaultConfigError', () => {
    it('should create a no default config error', () => {
      const availableConfigs = ['config1', 'config2'];
      const error = noDefaultConfigError(availableConfigs);

      expect(error.message).toBe('No default configuration set and no configuration name provided');
      expect(error.availableOptions).toEqual(availableConfigs);
      expect(error.suggestions).toContain('Set a default configuration using "qcr set-default [config_name]"');
      expect(error.category).toBe(ErrorCategory.CONFIG_FILE);
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
    });
  });

  describe('unexpectedError', () => {
    it('should create an unexpected error from Error object', () => {
      const operation = 'test operation';
      const originalError = new Error('Something went wrong');
      const error = unexpectedError(operation, originalError);

      expect(error.message).toBe('Unexpected error occurred during test operation');
      expect(error.details).toBe('Something went wrong');
      expect(error.suggestions).toContain('Try the operation again');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should create an unexpected error from unknown error', () => {
      const operation = 'test operation';
      const originalError = 'string error';
      const error = unexpectedError(operation, originalError);

      expect(error.message).toBe('Unexpected error occurred during test operation');
      expect(error.details).toBe('Unknown error');
      expect(error.suggestions).toContain('Try the operation again');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });
  });

  describe('formatValidationResult', () => {
    it('should format validation result with errors and warnings', () => {
      const validation = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1']
      };

      const result = formatValidationResult(validation);

      expect(result).toContain('Errors:');
      expect(result).toContain('✗ Error 1');
      expect(result).toContain('✗ Error 2');
      expect(result).toContain('Warnings:');
      expect(result).toContain('⚠ Warning 1');
    });

    it('should format validation result with only errors', () => {
      const validation = {
        isValid: false,
        errors: ['Error 1'],
        warnings: []
      };

      const result = formatValidationResult(validation);

      expect(result).toContain('Errors:');
      expect(result).toContain('✗ Error 1');
      expect(result).not.toContain('Warnings:');
    });

    it('should format validation result with only warnings', () => {
      const validation = {
        isValid: true,
        errors: [],
        warnings: ['Warning 1']
      };

      const result = formatValidationResult(validation);

      expect(result).not.toContain('Errors:');
      expect(result).toContain('Warnings:');
      expect(result).toContain('⚠ Warning 1');
    });

    it('should handle empty validation result', () => {
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };

      const result = formatValidationResult(validation);

      expect(result).toBe('');
    });
  });

  describe('EXIT_CODES', () => {
    it('should have all required exit codes', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.INVALID_USAGE).toBe(2);
      expect(EXIT_CODES.CONFIG_NOT_FOUND).toBe(3);
      expect(EXIT_CODES.CONFIG_INVALID).toBe(4);
      expect(EXIT_CODES.CONFIG_VALIDATION_FAILED).toBe(5);
      expect(EXIT_CODES.ENVIRONMENT_ERROR).toBe(6);
      expect(EXIT_CODES.COMMAND_NOT_FOUND).toBe(127);
      expect(EXIT_CODES.INTERRUPTED).toBe(130);
    });
  });
});