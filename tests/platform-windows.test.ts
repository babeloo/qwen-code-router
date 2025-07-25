/**
 * Windows-specific platform compatibility tests
 * These tests verify that the platform utilities work correctly on Windows
 */

import {
  getPlatformInfo,
  getConfigPaths,
  spawnCrossPlatform,
  isCommandAvailable,
  getDefaultShell,
  getLineEnding
} from '../src/platform';
import * as os from 'os';
import * as path from 'path';

describe('Windows Platform Compatibility', () => {
  // Only run these tests on Windows
  const isWindows = os.platform() === 'win32';
  
  describe('Platform Detection', () => {
    it('should correctly detect Windows platform', () => {
      const platformInfo = getPlatformInfo();
      
      if (isWindows) {
        expect(platformInfo.platform).toBe('win32');
        expect(platformInfo.isWindows).toBe(true);
        expect(platformInfo.isUnix).toBe(false);
        expect(platformInfo.envPathSeparator).toBe(';');
        expect(platformInfo.pathSeparator).toBe('\\');
      } else {
        expect(platformInfo.isWindows).toBe(false);
        expect(platformInfo.isUnix).toBe(true);
        expect(platformInfo.envPathSeparator).toBe(':');
      }
    });
  });

  describe('Configuration Paths on Windows', () => {
    it('should use Windows-specific configuration paths', () => {
      const configPaths = getConfigPaths();
      
      if (isWindows) {
        // On Windows, should not have system config directory
        expect(configPaths.systemConfigDir).toBeUndefined();
        
        // User config directory should be in APPDATA or home directory
        expect(configPaths.userConfigDir).toMatch(/qcr$/);
        
        // Should contain current directory and user config directory
        expect(configPaths.searchPaths).toContain(configPaths.currentDir);
        expect(configPaths.searchPaths).toContain(configPaths.userConfigDir);
        
        // Should not contain system config directory
        expect(configPaths.searchPaths).not.toContain('/etc/qcr');
      }
    });

    it('should handle APPDATA environment variable', () => {
      if (!isWindows) return;
      
      const originalAppData = process.env['APPDATA'];
      const testAppData = 'C:\\\\Users\\\\Test\\\\AppData\\\\Roaming';
      
      try {
        process.env['APPDATA'] = testAppData;
        
        const configPaths = getConfigPaths();
        
        expect(configPaths.userConfigDir).toBe(path.join(testAppData, 'qcr'));
      } finally {
        if (originalAppData) {
          process.env['APPDATA'] = originalAppData;
        } else {
          delete process.env['APPDATA'];
        }
      }
    });
  });

  describe('Process Spawning on Windows', () => {
    it('should use shell by default on Windows', () => {
      if (!isWindows) return;
      
      const child = spawnCrossPlatform('echo', ['test'], {
        stdio: 'pipe'
      });
      
      expect(child).toBeDefined();
      expect(typeof child.pid).toBe('number');
      
      child.kill();
    });

    it('should handle Windows command extensions', () => {
      if (!isWindows) return;
      
      // Test that commands without extensions work
      const child = spawnCrossPlatform('node', ['--version'], {
        stdio: 'pipe'
      });
      
      expect(child).toBeDefined();
      child.kill();
    });
  });

  describe('Command Availability on Windows', () => {
    it('should check Windows commands correctly', async () => {
      if (!isWindows) return;
      
      // Test with a Windows command that should exist
      const cmdAvailable = await isCommandAvailable('cmd');
      expect(cmdAvailable).toBe(true);
      
      // Test with a command that should not exist
      const fakeAvailable = await isCommandAvailable('definitely-not-a-real-command-12345');
      expect(fakeAvailable).toBe(false);
    }, 10000);
  });

  describe('Default Shell on Windows', () => {
    it('should return Windows shell', () => {
      if (!isWindows) return;
      
      const shell = getDefaultShell();
      
      // Should be cmd.exe or the value of COMSPEC
      expect(shell).toMatch(/cmd\.exe$/i);
    });

    it('should respect COMSPEC environment variable', () => {
      if (!isWindows) return;
      
      const originalComspec = process.env['COMSPEC'];
      const testComspec = 'C:\\\\Windows\\\\System32\\\\cmd.exe';
      
      try {
        process.env['COMSPEC'] = testComspec;
        
        const shell = getDefaultShell();
        
        expect(shell).toBe(testComspec);
      } finally {
        if (originalComspec) {
          process.env['COMSPEC'] = originalComspec;
        } else {
          delete process.env['COMSPEC'];
        }
      }
    });
  });

  describe('Line Endings on Windows', () => {
    it('should return CRLF on Windows', () => {
      if (!isWindows) return;
      
      const lineEnding = getLineEnding();
      
      expect(lineEnding).toBe('\r\n');
    });
  });

  describe('Path Handling on Windows', () => {
    it('should handle Windows paths correctly', () => {
      if (!isWindows) return;
      
      const platformInfo = getPlatformInfo();
      
      // Home directory should be a Windows path
      expect(platformInfo.homeDir).toMatch(/^[A-Z]:\\/);
      
      // Path separator should be backslash
      expect(platformInfo.pathSeparator).toBe('\\');
    });
  });
});