/**
 * Tests for startup flow validation and initialization
 */

import {
  executeStartupFlow,
  validateStartupFlow,
  formatStartupFlowResult,
  getStartupStatus,
  isReadyToLaunch,
  getStartupStepDescription,
  getStartupFlowSuggestions,
  StartupStep
} from '../src/startup';
import {
  startupFlowCommand,
  startupStatusCommand,
  readyCheckCommand,
  parseStartupFlowCommandArgs,
  handleStartupFlowCommand
} from '../src/startup-command';
import { ConfigFile } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the persistence module
jest.mock('../src/persistence');
jest.mock('../src/environment');

describe('Startup Flow System', () => {
  let tempDir: string;
  let mockConfigFile: ConfigFile;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-startup-test-'));
    
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

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('StartupStep enum and utilities', () => {
    it('should provide correct step descriptions', () => {
      expect(getStartupStepDescription(StartupStep.CHECKING_CONFIG_FILE)).toBe('Checking configuration file existence');
      expect(getStartupStepDescription(StartupStep.CHECKING_DEFAULT_CONFIG)).toBe('Checking default configuration existence');
      expect(getStartupStepDescription(StartupStep.VALIDATING_DEFAULT_CONFIG)).toBe('Validating default configuration');
      expect(getStartupStepDescription(StartupStep.SETTING_ENVIRONMENT)).toBe('Setting environment variables');
      expect(getStartupStepDescription(StartupStep.READY)).toBe('Ready to launch Qwen Code');
      expect(getStartupStepDescription(StartupStep.FAILED)).toBe('Startup flow failed');
    });

    it('should provide appropriate suggestions for each step', () => {
      const configFileSuggestions = getStartupFlowSuggestions(StartupStep.CHECKING_CONFIG_FILE);
      expect(configFileSuggestions).toContain('Create a configuration file (config.yaml or config.json)');
      expect(configFileSuggestions).toContain('Check file permissions and accessibility');

      const defaultConfigSuggestions = getStartupFlowSuggestions(StartupStep.CHECKING_DEFAULT_CONFIG);
      expect(defaultConfigSuggestions).toContain('Set a default configuration using "qcr set-default [config_name]"');
      expect(defaultConfigSuggestions).toContain('Add a default_config section to your configuration file');

      const validationSuggestions = getStartupFlowSuggestions(StartupStep.VALIDATING_DEFAULT_CONFIG);
      expect(validationSuggestions).toContain('Check that the default configuration references a valid provider');
      expect(validationSuggestions).toContain('Use "qcr chk [config_name]" to validate the configuration');

      const environmentSuggestions = getStartupFlowSuggestions(StartupStep.SETTING_ENVIRONMENT);
      expect(environmentSuggestions).toContain('Check that all required environment variables are properly set');
      expect(environmentSuggestions).toContain('Verify API key format and validity');
    });
  });

  describe('validateStartupFlow', () => {
    it('should succeed with valid configuration and default', async () => {
      // Mock successful configuration loading
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(StartupStep.READY);
      expect(result.configFile).toEqual(mockConfigFile);
      expect(result.defaultConfigName).toBe('test-config');
      expect(result.exitCode).toBe(0);
    });

    it('should fail when configuration file not found', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file not found');
      expect(result.exitCode).toBe(3); // CONFIG_NOT_FOUND
    });

    it('should fail when configuration validation fails', async () => {
      // Mock configuration with validation errors
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: false, errors: ['Missing required field'], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_CONFIG_FILE);
      expect(result.errorMessage).toBe('Configuration file validation failed');
      expect(result.exitCode).toBe(5); // CONFIG_VALIDATION_FAILED
    });

    it('should fail when no default configuration is set', async () => {
      // Mock configuration without default
      const configWithoutDefault = {
        ...mockConfigFile,
        default_config: []
      };

      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: configWithoutDefault,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.CHECKING_DEFAULT_CONFIG);
      expect(result.errorMessage).toBe('No default configuration set');
      expect(result.exitCode).toBe(4); // CONFIG_INVALID
    });

    it('should fail when default configuration is invalid', async () => {
      // Mock configuration with invalid default
      const configWithInvalidDefault = {
        ...mockConfigFile,
        default_config: [{ name: 'non-existent-config' }]
      };

      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: configWithInvalidDefault,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      const result = await validateStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.VALIDATING_DEFAULT_CONFIG);
      expect(result.errorMessage).toContain('Default configuration \'non-existent-config\' is invalid');
      expect(result.exitCode).toBe(4); // CONFIG_INVALID
    });
  });

  describe('executeStartupFlow', () => {
    it('should execute startup flow and set environment variables', async () => {
      // Mock successful configuration loading
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      // Mock environment validation
      const { validateEnvironmentVariables } = require('../src/environment');
      validateEnvironmentVariables.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await executeStartupFlow(tempDir);

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(StartupStep.READY);
      expect(result.configFile).toEqual(mockConfigFile);
      expect(result.defaultConfigName).toBe('test-config');
    });

    it('should fail when environment variables cannot be set', async () => {
      // Mock successful configuration loading
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      // Mock environment validation failure
      const { validateEnvironmentVariables } = require('../src/environment');
      validateEnvironmentVariables.mockReturnValue({
        isValid: false,
        errors: ['Missing OPENAI_API_KEY'],
        warnings: []
      });

      const result = await executeStartupFlow(tempDir);

      expect(result.success).toBe(false);
      expect(result.currentStep).toBe(StartupStep.SETTING_ENVIRONMENT);
      expect(result.errorMessage).toBe('Environment variables validation failed after setting default configuration');
      expect(result.exitCode).toBe(6); // ENVIRONMENT_ERROR
    });
  });

  describe('formatStartupFlowResult', () => {
    it('should format successful result correctly', () => {
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
    });

    it('should format failure result with suggestions', () => {
      const failureResult = {
        success: false,
        currentStep: StartupStep.CHECKING_DEFAULT_CONFIG,
        errorMessage: 'No default configuration set',
        errorDetails: 'Default configuration is required',
        exitCode: 4
      };

      const formatted = formatStartupFlowResult(failureResult);

      expect(formatted.success).toBe(false);
      expect(formatted.message).toBe('No default configuration set');
      expect(formatted.details).toContain('Failed at step: Checking default configuration existence');
      expect(formatted.details).toContain('Error details:');
      expect(formatted.details).toContain('Suggestions:');
      expect(formatted.details).toContain('Set a default configuration using "qcr set-default [config_name]"');
    });
  });

  describe('Utility functions', () => {
    it('should check if system is ready to launch', async () => {
      // Mock successful validation
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      const ready = await isReadyToLaunch(tempDir);
      expect(ready).toBe(true);
    });

    it('should return false when system is not ready', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      const ready = await isReadyToLaunch(tempDir);
      expect(ready).toBe(false);
    });

    it('should get current startup status', async () => {
      // Mock successful validation
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockResolvedValue({
        config: mockConfigFile,
        validation: { isValid: true, errors: [], warnings: [] },
        filePath: path.join(tempDir, 'config.yaml')
      });

      const status = await getStartupStatus(tempDir);
      expect(status.success).toBe(true);
      expect(status.currentStep).toBe(StartupStep.READY);
    });
  });

  describe('Startup Commands', () => {
    describe('parseStartupFlowCommandArgs', () => {
      it('should parse valid arguments', () => {
        const result1 = parseStartupFlowCommandArgs(['--execute', '-v']);
        expect(result1.valid).toBe(true);
        expect(result1.options?.execute).toBe(true);
        expect(result1.options?.verbose).toBe(true);

        const result2 = parseStartupFlowCommandArgs(['--status']);
        expect(result2.valid).toBe(true);
        expect((result2.options as any)?.command).toBe('status');

        const result3 = parseStartupFlowCommandArgs(['--ready']);
        expect(result3.valid).toBe(true);
        expect((result3.options as any)?.command).toBe('ready');
      });

      it('should handle help flag', () => {
        const result = parseStartupFlowCommandArgs(['--help']);
        expect(result.valid).toBe(true);
        expect(result.showHelp).toBe(true);
      });

      it('should reject invalid arguments', () => {
        const result1 = parseStartupFlowCommandArgs(['--invalid']);
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain('Unknown option: --invalid');

        const result2 = parseStartupFlowCommandArgs(['unexpected']);
        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('Unexpected argument: unexpected');
      });
    });

    describe('startupFlowCommand', () => {
      it('should validate startup flow by default', async () => {
        // Mock successful validation
        const { discoverAndLoadConfig } = require('../src/persistence');
        discoverAndLoadConfig.mockResolvedValue({
          config: mockConfigFile,
          validation: { isValid: true, errors: [], warnings: [] },
          filePath: path.join(tempDir, 'config.yaml')
        });

        const result = await startupFlowCommand({ currentDir: tempDir });
        expect(result.success).toBe(true);
        expect(result.message).toBe('Startup flow validation completed successfully');
      });

      it('should execute startup flow when requested', async () => {
        // Mock successful configuration loading and environment validation
        const { discoverAndLoadConfig } = require('../src/persistence');
        const { validateEnvironmentVariables } = require('../src/environment');
        
        discoverAndLoadConfig.mockResolvedValue({
          config: mockConfigFile,
          validation: { isValid: true, errors: [], warnings: [] },
          filePath: path.join(tempDir, 'config.yaml')
        });
        
        validateEnvironmentVariables.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: []
        });

        const result = await startupFlowCommand({ 
          currentDir: tempDir, 
          execute: true 
        });
        
        expect(result.success).toBe(true);
        expect(result.message).toBe('Startup flow validation completed successfully');
      });
    });

    describe('startupStatusCommand', () => {
      it('should return ready status when system is ready', async () => {
        // Mock successful validation
        const { discoverAndLoadConfig } = require('../src/persistence');
        discoverAndLoadConfig.mockResolvedValue({
          config: mockConfigFile,
          validation: { isValid: true, errors: [], warnings: [] },
          filePath: path.join(tempDir, 'config.yaml')
        });

        const result = await startupStatusCommand({ currentDir: tempDir });
        expect(result.success).toBe(true);
        expect(result.message).toBe('System is ready to launch Qwen Code');
        expect(result.details).toContain('Configuration: test-config');
      });

      it('should return error status when system is not ready', async () => {
        // Mock configuration file not found
        const { discoverAndLoadConfig } = require('../src/persistence');
        discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

        const result = await startupStatusCommand({ currentDir: tempDir });
        expect(result.success).toBe(false);
        expect(result.message).toBe('Configuration file not found');
      });
    });

    describe('readyCheckCommand', () => {
      it('should return success when ready', async () => {
        // Mock successful validation
        const { discoverAndLoadConfig } = require('../src/persistence');
        discoverAndLoadConfig.mockResolvedValue({
          config: mockConfigFile,
          validation: { isValid: true, errors: [], warnings: [] },
          filePath: path.join(tempDir, 'config.yaml')
        });

        const result = await readyCheckCommand({ currentDir: tempDir });
        expect(result.success).toBe(true);
        expect(result.message).toBe('System is ready to launch Qwen Code');
      });

      it('should return failure when not ready', async () => {
        // Mock configuration file not found
        const { discoverAndLoadConfig } = require('../src/persistence');
        discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

        const result = await readyCheckCommand({ currentDir: tempDir });
        expect(result.success).toBe(false);
      });
    });

    describe('handleStartupFlowCommand', () => {
      it('should route to appropriate command handlers', async () => {
        // Mock successful validation
        const { discoverAndLoadConfig } = require('../src/persistence');
        discoverAndLoadConfig.mockResolvedValue({
          config: mockConfigFile,
          validation: { isValid: true, errors: [], warnings: [] },
          filePath: path.join(tempDir, 'config.yaml')
        });

        // Test default command
        const result1 = await handleStartupFlowCommand([]);
        expect(result1.success).toBe(true);

        // Test status command
        const result2 = await handleStartupFlowCommand(['--status']);
        expect(result2.success).toBe(true);
        expect(result2.message).toBe('System is ready to launch Qwen Code');

        // Test ready command
        const result3 = await handleStartupFlowCommand(['--ready']);
        expect(result3.success).toBe(true);
        expect(result3.message).toBe('System is ready to launch Qwen Code');

        // Test help
        const result4 = await handleStartupFlowCommand(['--help']);
        expect(result4.success).toBe(true);
        expect(result4.message).toContain('qcr startup - Validate or execute startup flow');
      });

      it('should handle invalid arguments', async () => {
        const result = await handleStartupFlowCommand(['--invalid']);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid arguments for command \'startup\'');
      });
    });
  });
});