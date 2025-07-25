/**
 * Cross-platform integration tests
 * These tests verify that the platform utilities work correctly across different platforms
 */

import {
  getPlatformInfo,
  getConfigPaths,
  spawnCrossPlatform,
  isCommandAvailable,
  getDefaultShell,
  getLineEnding,
  createEnvironmentManager,
  normalizePath,
  resolveHomePath
} from '../src/platform';
import * as os from 'os';
import * as path from 'path';

describe('Cross-Platform Integration', () => {
  const currentPlatform = os.platform();
  const isWindows = currentPlatform === 'win32';
  
  describe('Platform-Specific Behavior', () => {
    it('should behave correctly for the current platform', () => {
      const platformInfo = getPlatformInfo();
      
      // Verify platform detection matches actual platform
      expect(platformInfo.platform).toBe(currentPlatform);
      expect(platformInfo.isWindows).toBe(isWindows);
      expect(platformInfo.isUnix).toBe(!isWindows);
      
      // Verify platform-specific separators
      if (isWindows) {
        expect(platformInfo.envPathSeparator).toBe(';');
        expect(platformInfo.pathSeparator).toBe('\\');
      } else {
        expect(platformInfo.envPathSeparator).toBe(':');
        expect(platformInfo.pathSeparator).toBe('/');
      }
    });

    it('should use platform-appropriate configuration paths', () => {
      const configPaths = getConfigPaths();
      
      expect(configPaths.currentDir).toBe(process.cwd());
      expect(configPaths.userConfigDir).toContain('qcr');
      expect(configPaths.searchPaths).toContain(configPaths.currentDir);
      expect(configPaths.searchPaths).toContain(configPaths.userConfigDir);
      
      if (isWindows) {
        // Windows should not have system config directory
        expect(configPaths.systemConfigDir).toBeUndefined();
        expect(configPaths.searchPaths).not.toContain('/etc/qcr');
      } else {
        // Unix should have system config directory
        expect(configPaths.systemConfigDir).toBe('/etc/qcr');
        expect(configPaths.searchPaths).toContain('/etc/qcr');
      }
    });

    it('should use platform-appropriate line endings', () => {
      const lineEnding = getLineEnding();
      
      if (isWindows) {
        expect(lineEnding).toBe('\r\n');
      } else {
        expect(lineEnding).toBe('\n');
      }
    });

    it('should use platform-appropriate default shell', () => {
      const shell = getDefaultShell();
      
      expect(typeof shell).toBe('string');
      expect(shell.length).toBeGreaterThan(0);
      
      if (isWindows) {
        expect(shell.toLowerCase()).toContain('cmd');
      } else {
        expect(shell).toMatch(/\/bin\/.*sh$/);
      }
    });
  });

  describe('Cross-Platform Process Spawning', () => {
    it('should spawn processes with platform-appropriate options', () => {
      const child = spawnCrossPlatform('node', ['--version'], {
        stdio: 'pipe'
      });
      
      expect(child).toBeDefined();
      expect(typeof child.pid).toBe('number');
      
      child.kill();
    });

    it('should handle shell usage appropriately per platform', () => {
      // Test explicit shell usage
      const childWithShell = spawnCrossPlatform('echo', ['test'], {
        stdio: 'pipe',
        useShell: true
      });
      
      expect(childWithShell).toBeDefined();
      childWithShell.kill();
      
      // Test explicit no shell
      const childNoShell = spawnCrossPlatform('node', ['--version'], {
        stdio: 'pipe',
        useShell: false
      });
      
      expect(childNoShell).toBeDefined();
      childNoShell.kill();
    });
  });

  describe('Environment Variable Management', () => {
    it('should manage environment variables consistently across platforms', () => {
      const envManager = createEnvironmentManager();
      const testVar = 'QCR_TEST_VAR';
      const testValue = 'test_value_123';
      
      // Clean up any existing test variable
      envManager.unset(testVar);
      
      // Test setting and getting
      expect(envManager.has(testVar)).toBe(false);
      
      envManager.set(testVar, testValue);
      expect(envManager.has(testVar)).toBe(true);
      expect(envManager.get(testVar)).toBe(testValue);
      
      // Test unsetting
      envManager.unset(testVar);
      expect(envManager.has(testVar)).toBe(false);
      expect(envManager.get(testVar)).toBeUndefined();
    });
  });

  describe('Path Handling', () => {
    it('should normalize paths correctly for the current platform', () => {
      const testPaths = [
        'test/path/../normalized',
        './relative/path',
        '../parent/path'
      ];
      
      testPaths.forEach(testPath => {
        const normalized = normalizePath(testPath);
        expect(normalized).toBe(path.normalize(testPath));
      });
    });

    it('should resolve home paths correctly', () => {
      const relativePath = '.config/qcr/test';
      const resolved = resolveHomePath(relativePath);
      
      expect(resolved).toBe(path.resolve(os.homedir(), relativePath));
      expect(path.isAbsolute(resolved)).toBe(true);
    });
  });

  describe('Command Availability', () => {
    it('should check command availability correctly for the platform', async () => {
      // Test with Node.js which should be available
      const nodeAvailable = await isCommandAvailable('node');
      expect(nodeAvailable).toBe(true);
      
      // Test with a command that definitely doesn't exist
      const fakeAvailable = await isCommandAvailable('definitely-not-a-real-command-xyz-123');
      expect(fakeAvailable).toBe(false);
    }, 15000);

    it('should check platform-specific commands', async () => {
      if (isWindows) {
        // Test Windows-specific commands
        const cmdAvailable = await isCommandAvailable('cmd');
        expect(cmdAvailable).toBe(true);
        
        const powershellAvailable = await isCommandAvailable('powershell');
        // PowerShell might not be available on all Windows systems
        expect(typeof powershellAvailable).toBe('boolean');
      } else {
        // Test Unix-specific commands
        const shAvailable = await isCommandAvailable('sh');
        expect(shAvailable).toBe(true);
        
        const lsAvailable = await isCommandAvailable('ls');
        expect(lsAvailable).toBe(true);
      }
    }, 15000);
  });

  describe('Integration with Real File System', () => {
    it('should work with actual configuration paths', () => {
      const configPaths = getConfigPaths();
      
      // All paths should be absolute
      configPaths.searchPaths.forEach(searchPath => {
        expect(path.isAbsolute(searchPath)).toBe(true);
      });
      
      // User config directory should be under home directory
      const homeDir = os.homedir();
      expect(configPaths.userConfigDir.startsWith(homeDir) || 
             configPaths.userConfigDir.includes('AppData')).toBe(true);
    });

    it('should handle platform-specific environment variables', () => {
      if (isWindows) {
        // Windows should have these environment variables
        expect(process.env['USERPROFILE']).toBeDefined();
        expect(process.env['APPDATA'] || process.env['LOCALAPPDATA']).toBeDefined();
        expect(process.env['COMSPEC']).toBeDefined();
      } else {
        // Unix should have these environment variables
        expect(process.env['HOME']).toBeDefined();
        expect(process.env['SHELL']).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      const invalidAvailable = await isCommandAvailable('');
      expect(invalidAvailable).toBe(false);
    });

    it('should handle process spawning errors gracefully', () => {
      // This should not throw an error, but the process might fail
      expect(() => {
        const child = spawnCrossPlatform('non-existent-command-xyz', [], {
          stdio: 'pipe'
        });
        child.kill();
      }).not.toThrow();
    });
  });
});