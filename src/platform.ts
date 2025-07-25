/**
 * Cross-platform compatibility utilities for Qwen Code Router
 * 
 * This module provides platform-specific functionality for Windows and Unix systems,
 * including path handling, process spawning, and environment variable management.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, SpawnOptions, ChildProcess } from 'child_process';

/**
 * Platform information
 */
export interface PlatformInfo {
  /** Operating system platform */
  platform: NodeJS.Platform;
  /** Whether running on Windows */
  isWindows: boolean;
  /** Whether running on Unix-like system */
  isUnix: boolean;
  /** Home directory path */
  homeDir: string;
  /** Path separator for the current platform */
  pathSeparator: string;
  /** Environment variable path separator */
  envPathSeparator: string;
}

/**
 * Gets platform information
 * @returns PlatformInfo object with platform details
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = os.platform();
  const isWindows = platform === 'win32';
  const isUnix = !isWindows;
  
  return {
    platform,
    isWindows,
    isUnix,
    homeDir: os.homedir(),
    pathSeparator: path.sep,
    envPathSeparator: isWindows ? ';' : ':'
  };
}

/**
 * Cross-platform configuration directory paths
 */
export interface ConfigPaths {
  /** Current working directory */
  currentDir: string;
  /** User configuration directory */
  userConfigDir: string;
  /** System configuration directory (if applicable) */
  systemConfigDir: string | undefined;
  /** All search paths in order of priority */
  searchPaths: string[];
}

/**
 * Gets configuration file search paths for the current platform
 * @param currentDir - Current working directory (optional)
 * @returns ConfigPaths object with platform-specific paths
 */
export function getConfigPaths(currentDir?: string): ConfigPaths {
  const platformInfo = getPlatformInfo();
  const cwd = currentDir || process.cwd();
  
  // User configuration directory
  let userConfigDir: string;
  if (platformInfo.isWindows) {
    // Windows: Use APPDATA or fallback to home directory
    const appData = process.env['APPDATA'];
    userConfigDir = appData 
      ? path.join(appData, 'qcr')
      : path.join(platformInfo.homeDir, '.qcr');
  } else {
    // Unix: Use XDG_CONFIG_HOME or fallback to ~/.config
    const xdgConfigHome = process.env['XDG_CONFIG_HOME'];
    userConfigDir = xdgConfigHome
      ? path.join(xdgConfigHome, 'qcr')
      : path.join(platformInfo.homeDir, '.config', 'qcr');
  }
  
  // System configuration directory (Unix only)
  let systemConfigDir: string | undefined;
  if (platformInfo.isUnix) {
    systemConfigDir = '/etc/qcr';
  }
  
  // Build search paths in order of priority
  const searchPaths = [
    cwd,
    userConfigDir
  ];
  
  if (systemConfigDir) {
    searchPaths.push(systemConfigDir);
  }
  
  return {
    currentDir: cwd,
    userConfigDir,
    systemConfigDir,
    searchPaths
  };
}

/**
 * Cross-platform path normalization
 * @param filePath - Path to normalize
 * @returns Normalized path for the current platform
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Resolves a path relative to the home directory
 * @param relativePath - Path relative to home directory
 * @returns Absolute path
 */
export function resolveHomePath(relativePath: string): string {
  const platformInfo = getPlatformInfo();
  return path.resolve(platformInfo.homeDir, relativePath);
}

/**
 * Cross-platform environment variable handling
 */
export interface EnvironmentManager {
  /** Gets an environment variable value */
  get(name: string): string | undefined;
  /** Sets an environment variable */
  set(name: string, value: string): void;
  /** Unsets an environment variable */
  unset(name: string): void;
  /** Gets all environment variables */
  getAll(): Record<string, string | undefined>;
  /** Checks if an environment variable exists */
  has(name: string): boolean;
}

/**
 * Creates a cross-platform environment variable manager
 * @returns EnvironmentManager instance
 */
export function createEnvironmentManager(): EnvironmentManager {
  return {
    get(name: string): string | undefined {
      return process.env[name];
    },
    
    set(name: string, value: string): void {
      process.env[name] = value;
    },
    
    unset(name: string): void {
      delete process.env[name];
    },
    
    getAll(): Record<string, string | undefined> {
      return { ...process.env };
    },
    
    has(name: string): boolean {
      return name in process.env;
    }
  };
}

/**
 * Cross-platform process spawning options
 */
export interface CrossPlatformSpawnOptions extends Omit<SpawnOptions, 'shell'> {
  /** Whether to use shell (auto-detected if not specified) */
  useShell?: boolean;
  /** Shell to use (auto-detected if not specified) */
  shell?: string | boolean;
  /** Whether to detach the process */
  detached?: boolean;
}

/**
 * Cross-platform process spawning
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Spawn options
 * @returns ChildProcess instance
 */
export function spawnCrossPlatform(
  command: string,
  args: string[] = [],
  options: CrossPlatformSpawnOptions = {}
): ChildProcess {
  const platformInfo = getPlatformInfo();
  
  // Determine shell usage
  const useShell = options.useShell !== undefined 
    ? options.useShell 
    : platformInfo.isWindows;
  
  // Determine shell
  let shell: string | boolean = false;
  if (useShell) {
    if (typeof options.shell === 'string') {
      shell = options.shell;
    } else if (options.shell === true || options.shell === undefined) {
      shell = platformInfo.isWindows ? 'cmd.exe' : '/bin/sh';
    }
  }
  
  // Prepare spawn options
  const spawnOptions: SpawnOptions = {
    ...options,
    shell: useShell ? shell : false,
    env: options.env || process.env
  };
  
  // On Windows, handle command extension
  let finalCommand = command;
  if (platformInfo.isWindows && !path.extname(command)) {
    // Try to find the command with common Windows extensions
    const extensions = ['.exe', '.cmd', '.bat', '.com'];
    for (const ext of extensions) {
      const commandWithExt = command + ext;
      try {
        // Check if command exists in PATH
        const which = require('which');
        if (which.sync(commandWithExt, { nothrow: true })) {
          finalCommand = commandWithExt;
          break;
        }
      } catch {
        // Continue with original command if 'which' is not available
        break;
      }
    }
  }
  
  return spawn(finalCommand, args, spawnOptions);
}

/**
 * Checks if a command is available on the system
 * @param command - Command to check
 * @returns Promise<boolean> - True if command is available
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platformInfo = getPlatformInfo();
    
    // Use 'where' on Windows, 'which' on Unix
    const checkCommand = platformInfo.isWindows ? 'where' : 'which';
    const child = spawnCrossPlatform(checkCommand, [command], {
      stdio: 'ignore',
      useShell: true
    });
    
    child.on('exit', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Gets the default shell for the current platform
 * @returns Default shell path
 */
export function getDefaultShell(): string {
  const platformInfo = getPlatformInfo();
  
  if (platformInfo.isWindows) {
    return process.env['COMSPEC'] || 'cmd.exe';
  } else {
    return process.env['SHELL'] || '/bin/sh';
  }
}

/**
 * Creates a directory recursively with cross-platform support
 * @param dirPath - Directory path to create
 * @returns Promise<void>
 */
export async function createDirectoryRecursive(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }
}

/**
 * Checks if a path exists and is accessible
 * @param filePath - Path to check
 * @param mode - Access mode (default: fs.constants.F_OK)
 * @returns Promise<boolean> - True if path is accessible
 */
export async function isPathAccessible(
  filePath: string, 
  mode: number = fs.constants.F_OK
): Promise<boolean> {
  try {
    await fs.promises.access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets file stats with error handling
 * @param filePath - Path to file
 * @returns Promise<fs.Stats | null> - File stats or null if error
 */
export async function getFileStats(filePath: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(filePath);
  } catch {
    return null;
  }
}

/**
 * Platform-specific temporary directory
 * @returns Temporary directory path
 */
export function getTempDir(): string {
  return os.tmpdir();
}

/**
 * Platform-specific line ending
 * @returns Line ending for the current platform
 */
export function getLineEnding(): string {
  const platformInfo = getPlatformInfo();
  return platformInfo.isWindows ? '\r\n' : '\n';
}