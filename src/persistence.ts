/**
 * Configuration file persistence layer for Qwen Code Router
 * 
 * This module handles loading, parsing, and discovering configuration files
 * across different platforms and formats (JSON/YAML).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  ConfigFile,
  ConfigFileFormat,
  ConfigDiscoveryResult,
  ValidationResult
} from './types';
import { validateConfigFile } from './validation';

/**
 * Configuration file discovery paths and names
 */
const CONFIG_FILE_NAMES = {
  yaml: ['config.yaml', 'config.yml'],
  json: ['config.json']
};

/**
 * Discovers configuration files in the specified directory
 * @param directory - Directory to search for configuration files
 * @returns ConfigDiscoveryResult with file path and format information
 */
export function discoverConfigFile(directory: string): ConfigDiscoveryResult {
  // Check YAML files first (preferred format)
  for (const fileName of CONFIG_FILE_NAMES.yaml) {
    const filePath = path.join(directory, fileName);
    if (fs.existsSync(filePath)) {
      return {
        filePath,
        format: 'yaml',
        found: true
      };
    }
  }

  // Check JSON files
  for (const fileName of CONFIG_FILE_NAMES.json) {
    const filePath = path.join(directory, fileName);
    if (fs.existsSync(filePath)) {
      return {
        filePath,
        format: 'json',
        found: true
      };
    }
  }

  return {
    filePath: null,
    format: null,
    found: false
  };
}

/**
 * Discovers configuration files using hierarchical search
 * Searches in current directory first, then user home directory
 * @param currentDir - Current working directory (optional, defaults to process.cwd())
 * @returns ConfigDiscoveryResult with file path and format information
 */
export function discoverConfigFileHierarchical(currentDir?: string): ConfigDiscoveryResult {
  const cwd = currentDir || process.cwd();

  // 1. Search in current working directory
  const localResult = discoverConfigFile(cwd);
  if (localResult.found) {
    return localResult;
  }

  // 2. Search in user home directory
  const homeDir = os.homedir();
  const userConfigDir = path.join(homeDir, '.qcr');
  
  // Check if user config directory exists
  if (fs.existsSync(userConfigDir)) {
    const userResult = discoverConfigFile(userConfigDir);
    if (userResult.found) {
      return userResult;
    }
  }

  return {
    filePath: null,
    format: null,
    found: false
  };
}

/**
 * Loads and parses a configuration file
 * @param filePath - Path to the configuration file
 * @param format - Format of the configuration file (optional, auto-detected if not provided)
 * @returns Promise<ConfigFile> - Parsed configuration file
 * @throws Error if file cannot be read or parsed
 */
export async function loadConfigFile(filePath: string, format?: ConfigFileFormat): Promise<ConfigFile> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Auto-detect format if not provided
    const detectedFormat = format || detectConfigFileFormat(filePath);
    
    // Parse based on format
    let config: ConfigFile;
    switch (detectedFormat) {
      case 'yaml':
        config = parseYamlConfig(fileContent, filePath);
        break;
      case 'json':
        config = parseJsonConfig(fileContent, filePath);
        break;
      default:
        throw new Error(`Unsupported configuration file format: ${detectedFormat}`);
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration file "${filePath}": ${error.message}`);
    }
    throw new Error(`Failed to load configuration file "${filePath}": Unknown error`);
  }
}

/**
 * Loads and validates a configuration file
 * @param filePath - Path to the configuration file
 * @param format - Format of the configuration file (optional, auto-detected if not provided)
 * @returns Promise<{ config: ConfigFile, validation: ValidationResult }> - Parsed and validated configuration
 */
export async function loadAndValidateConfigFile(filePath: string, format?: ConfigFileFormat): Promise<{
  config: ConfigFile;
  validation: ValidationResult;
}> {
  const config = await loadConfigFile(filePath, format);
  const validation = validateConfigFile(config);
  
  return { config, validation };
}

/**
 * Discovers, loads, and validates a configuration file using hierarchical search
 * @param currentDir - Current working directory (optional, defaults to process.cwd())
 * @returns Promise<{ config: ConfigFile, validation: ValidationResult, filePath: string }> - Configuration with validation results
 * @throws Error if no configuration file is found
 */
export async function discoverAndLoadConfig(currentDir?: string): Promise<{
  config: ConfigFile;
  validation: ValidationResult;
  filePath: string;
}> {
  const discovery = discoverConfigFileHierarchical(currentDir);
  
  if (!discovery.found || !discovery.filePath) {
    const searchPaths = [
      currentDir || process.cwd(),
      path.join(os.homedir(), '.qcr')
    ];
    throw new Error(
      `No configuration file found. Searched in:\n${searchPaths.map(p => `  - ${p}`).join('\n')}\n\n` +
      `Expected file names: ${[...CONFIG_FILE_NAMES.yaml, ...CONFIG_FILE_NAMES.json].join(', ')}`
    );
  }

  const { config, validation } = await loadAndValidateConfigFile(discovery.filePath, discovery.format!);
  
  return {
    config,
    validation,
    filePath: discovery.filePath
  };
}

/**
 * Detects the format of a configuration file based on its extension
 * @param filePath - Path to the configuration file
 * @returns ConfigFileFormat - Detected format
 */
export function detectConfigFileFormat(filePath: string): ConfigFileFormat {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.json':
      return 'json';
    default:
      // Default to YAML for unknown extensions
      return 'yaml';
  }
}

/**
 * Parses YAML configuration content
 * @param content - YAML content as string
 * @param filePath - File path for error reporting
 * @returns ConfigFile - Parsed configuration
 * @throws Error if YAML parsing fails
 */
export function parseYamlConfig(content: string, filePath: string): ConfigFile {
  try {
    const parsed = yaml.parse(content);
    
    if (parsed === null || parsed === undefined) {
      throw new Error('Configuration file is empty or contains only comments');
    }
    
    if (typeof parsed !== 'object') {
      throw new Error('Configuration file must contain an object at the root level');
    }
    
    return parsed as ConfigFile;
  } catch (error) {
    if (error instanceof yaml.YAMLParseError) {
      throw new Error(`YAML parsing error in ${filePath} at line ${error.linePos?.[0]?.line || 'unknown'}: ${error.message}`);
    }
    if (error instanceof Error) {
      throw new Error(`YAML parsing error in ${filePath}: ${error.message}`);
    }
    throw new Error(`YAML parsing error in ${filePath}: Unknown error`);
  }
}

/**
 * Parses JSON configuration content
 * @param content - JSON content as string
 * @param filePath - File path for error reporting
 * @returns ConfigFile - Parsed configuration
 * @throws Error if JSON parsing fails
 */
export function parseJsonConfig(content: string, filePath: string): ConfigFile {
  try {
    const parsed = JSON.parse(content);
    
    if (parsed === null || parsed === undefined) {
      throw new Error('Configuration file is empty');
    }
    
    if (typeof parsed !== 'object') {
      throw new Error('Configuration file must contain an object at the root level');
    }
    
    return parsed as ConfigFile;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Try to extract line number from error message
      const lineMatch = error.message.match(/line (\d+)/i);
      const lineInfo = lineMatch ? ` at line ${lineMatch[1]}` : '';
      throw new Error(`JSON parsing error in ${filePath}${lineInfo}: ${error.message}`);
    }
    if (error instanceof Error) {
      throw new Error(`JSON parsing error in ${filePath}: ${error.message}`);
    }
    throw new Error(`JSON parsing error in ${filePath}: Unknown error`);
  }
}

/**
 * Checks if a file path is accessible for reading
 * @param filePath - Path to check
 * @returns boolean - True if file is accessible for reading
 */
export function isFileAccessible(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets file statistics for a configuration file
 * @param filePath - Path to the configuration file
 * @returns File stats or null if file doesn't exist
 */
export function getConfigFileStats(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Creates the user configuration directory if it doesn't exist
 * @returns string - Path to the user configuration directory
 */
export function ensureUserConfigDirectory(): string {
  const homeDir = os.homedir();
  const userConfigDir = path.join(homeDir, '.qcr');
  
  if (!fs.existsSync(userConfigDir)) {
    fs.mkdirSync(userConfigDir, { recursive: true });
  }
  
  return userConfigDir;
}

/**
 * Lists all potential configuration file paths
 * @param currentDir - Current working directory (optional, defaults to process.cwd())
 * @returns Array of potential configuration file paths
 */
export function listPotentialConfigPaths(currentDir?: string): string[] {
  const cwd = currentDir || process.cwd();
  const homeDir = os.homedir();
  const userConfigDir = path.join(homeDir, '.qcr');
  
  const paths: string[] = [];
  
  // Local configuration files
  for (const fileName of [...CONFIG_FILE_NAMES.yaml, ...CONFIG_FILE_NAMES.json]) {
    paths.push(path.join(cwd, fileName));
  }
  
  // User configuration files
  for (const fileName of [...CONFIG_FILE_NAMES.yaml, ...CONFIG_FILE_NAMES.json]) {
    paths.push(path.join(userConfigDir, fileName));
  }
  
  return paths;
}