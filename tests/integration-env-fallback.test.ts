/**
 * Integration tests for environment variable fallback functionality
 * Tests the complete flow from CLI to environment variable fallback
 */

import { handleRunCommand } from '../src/commands/run';
import { REQUIRED_ENV_VARS } from '../src/environment';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the persistence module to simulate no config file
jest.mock('../src/persistence');
// Mock the platform module to avoid actually spawning processes
jest.mock('../src/platform');

describe('Integration - Environment Variable Fallback', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-integration-env-test-'));
    
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

  describe('Run Command with Environment Variable Fallback', () => {
    it('should succeed when no config file but environment variables are set', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Mock successful process spawning
      const { spawnCrossPlatform } = require('../src/platform');
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            // Simulate successful exit
            setTimeout(() => callback(0, null), 10);
          }
        }),
        pid: 12345
      };
      spawnCrossPlatform.mockReturnValue(mockChild);

      // Set all required environment variables
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await handleRunCommand([]);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Qwen Code completed successfully');
      expect(spawnCrossPlatform).toHaveBeenCalledWith('qwen', [], expect.any(Object));
    });

    it('should fail when no config file and environment variables are missing', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Don't set any environment variables

      const result = await handleRunCommand([]);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Required environment variables are not set');
      expect(result.details).toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.API_KEY}`);
      expect(result.details).toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.BASE_URL}`);
      expect(result.details).toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.MODEL}`);
    });

    it('should fail when no config file and environment variables are invalid', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set invalid environment variables
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'invalid-url';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await handleRunCommand([]);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Required environment variables are not set');
      expect(result.details).toContain('is not a valid URL');
    });

    it('should pass additional arguments when environment variables are valid', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Mock successful process spawning
      const { spawnCrossPlatform } = require('../src/platform');
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            // Simulate successful exit
            setTimeout(() => callback(0, null), 10);
          }
        }),
        pid: 12345
      };
      spawnCrossPlatform.mockReturnValue(mockChild);

      // Set all required environment variables
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await handleRunCommand(['--version']);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Qwen Code completed successfully');
      expect(spawnCrossPlatform).toHaveBeenCalledWith('qwen', ['--version'], expect.any(Object));
    });
  });

  describe('Environment Variable Validation Integration', () => {
    it('should validate all required environment variables are present', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set only some environment variables
      process.env[REQUIRED_ENV_VARS.API_KEY] = 'test-api-key-12345';
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      // Missing MODEL

      const result = await handleRunCommand([]);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Required environment variables are not set');
      expect(result.details).toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.MODEL}`);
      expect(result.details).not.toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.API_KEY}`);
      expect(result.details).not.toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.BASE_URL}`);
    });

    it('should validate environment variable formats', async () => {
      // Mock configuration file not found
      const { discoverAndLoadConfig } = require('../src/persistence');
      discoverAndLoadConfig.mockRejectedValue(new Error('No configuration file found'));

      // Set environment variables with various format issues
      process.env[REQUIRED_ENV_VARS.API_KEY] = '';  // Empty
      process.env[REQUIRED_ENV_VARS.BASE_URL] = 'https://api.openai.com/v1';
      process.env[REQUIRED_ENV_VARS.MODEL] = 'gpt-4';

      const result = await handleRunCommand([]);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Required environment variables are not set');
      expect(result.details).toContain(`Missing required environment variable: ${REQUIRED_ENV_VARS.API_KEY}`);
    });
  });
});