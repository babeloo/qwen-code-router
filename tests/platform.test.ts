/**
 * Unit tests for cross-platform compatibility utilities
 */

import {
  getPlatformInfo,
  getConfigPaths,
  normalizePath,
  resolveHomePath,
  createEnvironmentManager,
  spawnCrossPlatform,
  isCommandAvailable,
  getDefaultShell,
  createDirectoryRecursive,
  isPathAccessible,
  getFileStats,
  getTempDir,
  getLineEnding
} from '../src/platform';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('Platform Utilities', () => {
  describe('getPlatformInfo', () => {
    it('should return correct platform information', () => {
      const platformInfo = getPlatformInfo();
      
      expect(platformInfo).toHaveProperty('platform');
      expect(platformInfo).toHaveProperty('isWindows');
      expect(platformInfo).toHaveProperty('isUnix');
      expect(platformInfo).toHaveProperty('homeDir');
      expect(platformInfo).toHaveProperty('pathSeparator');
      expect(platformInfo).toHaveProperty('envPathSeparator');
      
      expect(typeof platformInfo.platform).toBe('string');
      expect(typeof platformInfo.isWindows).toBe('boolean');
      expect(typeof platformInfo.isUnix).toBe('boolean');
      expect(typeof platformInfo.homeDir).toBe('string');
      expect(typeof platformInfo.pathSeparator).toBe('string');
      expect(typeof platformInfo.envPathSeparator).toBe('string');
      
      // Verify platform consistency
      expect(platformInfo.isWindows).toBe(platformInfo.platform === 'win32');
      expect(platformInfo.isUnix).toBe(!platformInfo.isWindows);
    });

    it('should return correct path separators for Windows', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      
      const platformInfo = getPlatformInfo();
      
      expect(platformInfo.isWindows).toBe(true);
      expect(platformInfo.isUnix).toBe(false);
      expect(platformInfo.envPathSeparator).toBe(';');
      
      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should return correct path separators for Unix', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      try {
        // Mock Unix platform
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
        
        const platformInfo = getPlatformInfo();
        
        expect(platformInfo.isWindows).toBe(false);
        expect(platformInfo.isUnix).toBe(true);
        expect(platformInfo.envPathSeparator).toBe(':');
      } finally {
        // Restore original platform
        if (originalPlatform) {
          Object.defineProperty(process, 'platform', originalPlatform);
        }
      }
    });
  });

  describe('getConfigPaths', () => {
    it('should return valid configuration paths', () => {
      const configPaths = getConfigPaths();
      
      expect(configPaths).toHaveProperty('currentDir');
      expect(configPaths).toHaveProperty('userConfigDir');
      expect(configPaths).toHaveProperty('searchPaths');
      
      expect(Array.isArray(configPaths.searchPaths)).toBe(true);
      expect(configPaths.searchPaths.length).toBeGreaterThan(0);
      expect(configPaths.searchPaths).toContain(configPaths.currentDir);
      expect(configPaths.searchPaths).toContain(configPaths.userConfigDir);
    });

    it('should use provided current directory', () => {
      const testDir = '/test/directory';
      const configPaths = getConfigPaths(testDir);
      
      expect(configPaths.currentDir).toBe(testDir);
      expect(configPaths.searchPaths).toContain(testDir);
    });

    it('should include system config directory on Unix', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      try {
        // Mock Unix platform
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
        
        const configPaths = getConfigPaths();
        
        expect(configPaths.systemConfigDir).toBe('/etc/qcr');
        expect(configPaths.searchPaths).toContain('/etc/qcr');
      } finally {
        // Restore original platform
        if (originalPlatform) {
          Object.defineProperty(process, 'platform', originalPlatform);
        }
      }
    });

    it('should not include system config directory on Windows', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      
      const configPaths = getConfigPaths();
      
      expect(configPaths.systemConfigDir).toBeUndefined();
      
      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });
  });

  describe('normalizePath', () => {
    it('should normalize paths correctly', () => {
      const testPath = 'test/path/../normalized';
      const normalized = normalizePath(testPath);
      
      expect(normalized).toBe(path.normalize(testPath));
    });

    it('should handle absolute paths', () => {
      const testPath = '/absolute/path/../normalized';
      const normalized = normalizePath(testPath);
      
      expect(normalized).toBe(path.normalize(testPath));
    });
  });

  describe('resolveHomePath', () => {
    it('should resolve paths relative to home directory', () => {
      const relativePath = '.config/qcr';
      const resolved = resolveHomePath(relativePath);
      
      expect(resolved).toBe(path.resolve(os.homedir(), relativePath));
    });

    it('should handle nested paths', () => {
      const relativePath = 'nested/deep/path';
      const resolved = resolveHomePath(relativePath);
      
      expect(resolved).toBe(path.resolve(os.homedir(), relativePath));
    });
  });

  describe('createEnvironmentManager', () => {
    let envManager: ReturnType<typeof createEnvironmentManager>;
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      envManager = createEnvironmentManager();
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should get environment variables', () => {
      process.env['TEST_VAR'] = 'test_value';
      
      expect(envManager.get('TEST_VAR')).toBe('test_value');
      expect(envManager.get('NON_EXISTENT')).toBeUndefined();
    });

    it('should set environment variables', () => {
      envManager.set('NEW_VAR', 'new_value');
      
      expect(process.env['NEW_VAR']).toBe('new_value');
      expect(envManager.get('NEW_VAR')).toBe('new_value');
    });

    it('should unset environment variables', () => {
      process.env['TEMP_VAR'] = 'temp_value';
      expect(envManager.get('TEMP_VAR')).toBe('temp_value');
      
      envManager.unset('TEMP_VAR');
      
      expect(envManager.get('TEMP_VAR')).toBeUndefined();
      expect(process.env['TEMP_VAR']).toBeUndefined();
    });

    it('should check if environment variables exist', () => {
      process.env['EXISTS_VAR'] = 'value';
      
      expect(envManager.has('EXISTS_VAR')).toBe(true);
      expect(envManager.has('NOT_EXISTS')).toBe(false);
    });

    it('should get all environment variables', () => {
      const allEnv = envManager.getAll();
      
      expect(typeof allEnv).toBe('object');
      expect(allEnv).toEqual(process.env);
    });
  });

  describe('spawnCrossPlatform', () => {
    it('should spawn processes with correct options', () => {
      const child = spawnCrossPlatform('echo', ['test'], {
        stdio: 'pipe'
      });
      
      expect(child).toBeDefined();
      expect(typeof child.pid).toBe('number');
      
      child.kill();
    });

    it('should use shell on Windows by default', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      
      const child = spawnCrossPlatform('echo', ['test'], {
        stdio: 'pipe'
      });
      
      expect(child).toBeDefined();
      child.kill();
      
      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should respect useShell option', () => {
      const child = spawnCrossPlatform('echo', ['test'], {
        stdio: 'pipe',
        useShell: false
      });
      
      expect(child).toBeDefined();
      child.kill();
    });
  });

  describe('isCommandAvailable', () => {
    it('should check if commands are available', async () => {
      // Test with a command that should exist on most systems
      const nodeAvailable = await isCommandAvailable('node');
      expect(typeof nodeAvailable).toBe('boolean');
      
      // Test with a command that should not exist
      const fakeAvailable = await isCommandAvailable('definitely-not-a-real-command-12345');
      expect(fakeAvailable).toBe(false);
    }, 10000); // Increase timeout for command checking
  });

  describe('getDefaultShell', () => {
    it('should return a valid shell path', () => {
      const shell = getDefaultShell();
      
      expect(typeof shell).toBe('string');
      expect(shell.length).toBeGreaterThan(0);
    });

    it('should return cmd.exe on Windows', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      const originalComspec = process.env['COMSPEC'];
      
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      
      delete process.env['COMSPEC'];
      
      const shell = getDefaultShell();
      
      expect(shell).toBe('cmd.exe');
      
      // Restore original values
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
      if (originalComspec) {
        process.env['COMSPEC'] = originalComspec;
      }
    });

    it('should return /bin/sh on Unix', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      const originalShell = process.env['SHELL'];
      
      try {
        // Mock Unix platform
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
        
        delete process.env['SHELL'];
        
        const shell = getDefaultShell();
        
        expect(shell).toBe('/bin/sh');
      } finally {
        // Restore original values
        if (originalPlatform) {
          Object.defineProperty(process, 'platform', originalPlatform);
        }
        if (originalShell) {
          process.env['SHELL'] = originalShell;
        }
      }
    });
  });

  describe('createDirectoryRecursive', () => {
    const testDir = path.join(os.tmpdir(), 'qcr-test-dir', 'nested', 'deep');

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.promises.rmdir(path.join(os.tmpdir(), 'qcr-test-dir'), { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create directories recursively', async () => {
      await createDirectoryRecursive(testDir);
      
      const stats = await fs.promises.stat(testDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await createDirectoryRecursive(testDir);
      
      // Should not throw when creating again
      await expect(createDirectoryRecursive(testDir)).resolves.not.toThrow();
    });
  });

  describe('isPathAccessible', () => {
    it('should check if paths are accessible', async () => {
      const tempFile = path.join(os.tmpdir(), 'qcr-test-file.txt');
      
      // Create test file
      await fs.promises.writeFile(tempFile, 'test content');
      
      const accessible = await isPathAccessible(tempFile);
      expect(accessible).toBe(true);
      
      // Clean up
      await fs.promises.unlink(tempFile);
      
      const notAccessible = await isPathAccessible(tempFile);
      expect(notAccessible).toBe(false);
    });

    it('should check with different access modes', async () => {
      const tempFile = path.join(os.tmpdir(), 'qcr-test-file-2.txt');
      
      // Create test file
      await fs.promises.writeFile(tempFile, 'test content');
      
      const readable = await isPathAccessible(tempFile, fs.constants.R_OK);
      expect(readable).toBe(true);
      
      const writable = await isPathAccessible(tempFile, fs.constants.W_OK);
      expect(writable).toBe(true);
      
      // Clean up
      await fs.promises.unlink(tempFile);
    });
  });

  describe('getFileStats', () => {
    it('should return file stats for existing files', async () => {
      const tempFile = path.join(os.tmpdir(), 'qcr-test-stats.txt');
      
      // Create test file
      await fs.promises.writeFile(tempFile, 'test content');
      
      const stats = await getFileStats(tempFile);
      expect(stats).not.toBeNull();
      expect(stats!.isFile()).toBe(true);
      
      // Clean up
      await fs.promises.unlink(tempFile);
    });

    it('should return null for non-existent files', async () => {
      const nonExistentFile = path.join(os.tmpdir(), 'non-existent-file.txt');
      
      const stats = await getFileStats(nonExistentFile);
      expect(stats).toBeNull();
    });
  });

  describe('getTempDir', () => {
    it('should return a valid temporary directory', () => {
      const tempDir = getTempDir();
      
      expect(typeof tempDir).toBe('string');
      expect(tempDir.length).toBeGreaterThan(0);
      expect(tempDir).toBe(os.tmpdir());
    });
  });

  describe('getLineEnding', () => {
    it('should return correct line ending for platform', () => {
      const lineEnding = getLineEnding();
      
      expect(typeof lineEnding).toBe('string');
      expect(['\n', '\r\n']).toContain(lineEnding);
    });

    it('should return CRLF on Windows', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      
      const lineEnding = getLineEnding();
      
      expect(lineEnding).toBe('\r\n');
      
      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should return LF on Unix', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      try {
        // Mock Unix platform
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
        
        const lineEnding = getLineEnding();
        
        expect(lineEnding).toBe('\n');
      } finally {
        // Restore original platform
        if (originalPlatform) {
          Object.defineProperty(process, 'platform', originalPlatform);
        }
      }
    });
  });
});