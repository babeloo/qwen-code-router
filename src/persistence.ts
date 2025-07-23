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

/**
 * Saves a configuration file to disk
 * @param config - Configuration object to save
 * @param filePath - Path where to save the configuration file
 * @param format - Format to save in (optional, auto-detected from file extension if not provided)
 * @returns Promise<void>
 * @throws Error if file cannot be written
 */
export async function saveConfigFile(config: ConfigFile, filePath: string, format?: ConfigFileFormat): Promise<void> {
  try {
    // Auto-detect format if not provided
    const saveFormat = format || detectConfigFileFormat(filePath);
    
    // Convert config to string based on format
    let configContent: string;
    switch (saveFormat) {
      case 'yaml':
        configContent = serializeYamlConfig(config);
        break;
      case 'json':
        configContent = serializeJsonConfig(config);
        break;
      default:
        throw new Error(`Unsupported configuration file format: ${saveFormat}`);
    }

    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file with proper permissions
    fs.writeFileSync(filePath, configContent, { 
      encoding: 'utf-8',
      mode: 0o644 // Read/write for owner, read for group and others
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to save configuration file "${filePath}": ${error.message}`);
    }
    throw new Error(`Failed to save configuration file "${filePath}": Unknown error`);
  }
}

/**
 * Saves and validates a configuration file
 * @param config - Configuration object to save
 * @param filePath - Path where to save the configuration file
 * @param format - Format to save in (optional, auto-detected from file extension if not provided)
 * @returns Promise<ValidationResult> - Validation result of the saved configuration
 */
export async function saveAndValidateConfigFile(config: ConfigFile, filePath: string, format?: ConfigFileFormat): Promise<ValidationResult> {
  // Validate before saving
  const validation = validateConfigFile(config);
  
  if (!validation.isValid) {
    throw new Error(`Cannot save invalid configuration: ${validation.errors.join(', ')}`);
  }

  // Save the configuration
  await saveConfigFile(config, filePath, format);
  
  return validation;
}

/**
 * Updates an existing configuration file while preserving its format
 * @param config - Updated configuration object
 * @param originalFilePath - Path to the original configuration file
 * @param backupOriginal - Whether to create a backup of the original file (default: true)
 * @returns Promise<void>
 * @throws Error if original file doesn't exist or cannot be updated
 */
export async function updateConfigFile(config: ConfigFile, originalFilePath: string, backupOriginal: boolean = true): Promise<void> {
  try {
    // Check if original file exists
    if (!fs.existsSync(originalFilePath)) {
      throw new Error(`Original configuration file not found: ${originalFilePath}`);
    }

    // Create backup if requested
    if (backupOriginal) {
      const backupPath = `${originalFilePath}.backup.${Date.now()}`;
      fs.copyFileSync(originalFilePath, backupPath);
    }

    // Detect original format and save in the same format
    const originalFormat = detectConfigFileFormat(originalFilePath);
    await saveConfigFile(config, originalFilePath, originalFormat);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update configuration file "${originalFilePath}": ${error.message}`);
    }
    throw new Error(`Failed to update configuration file "${originalFilePath}": Unknown error`);
  }
}

/**
 * Serializes configuration to YAML format
 * @param config - Configuration object to serialize
 * @returns YAML string representation
 */
export function serializeYamlConfig(config: ConfigFile): string {
  try {
    return yaml.stringify(config, {
      indent: 2,
      lineWidth: 120,
      minContentWidth: 20
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`YAML serialization error: ${error.message}`);
    }
    throw new Error('YAML serialization error: Unknown error');
  }
}

/**
 * Serializes configuration to JSON format
 * @param config - Configuration object to serialize
 * @returns JSON string representation
 */
export function serializeJsonConfig(config: ConfigFile): string {
  try {
    return JSON.stringify(config, null, 2);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JSON serialization error: ${error.message}`);
    }
    throw new Error('JSON serialization error: Unknown error');
  }
}

/**
 * Creates a configuration file with default structure
 * @param filePath - Path where to create the configuration file
 * @param format - Format to create (optional, auto-detected from file extension if not provided)
 * @returns Promise<void>
 */
export async function createDefaultConfigFile(filePath: string, format?: ConfigFileFormat): Promise<void> {
  const defaultConfig: ConfigFile = {
    configs: [],
    providers: []
  };

  await saveConfigFile(defaultConfig, filePath, format);
}

/**
 * Safely writes configuration file with atomic operation
 * Uses temporary file and rename to ensure atomic write operation
 * @param config - Configuration object to save
 * @param filePath - Path where to save the configuration file
 * @param format - Format to save in (optional, auto-detected from file extension if not provided)
 * @returns Promise<void>
 */
export async function atomicSaveConfigFile(config: ConfigFile, filePath: string, format?: ConfigFileFormat): Promise<void> {
  const tempFilePath = `${filePath}.tmp.${Date.now()}`;
  
  try {
    // Save to temporary file first
    await saveConfigFile(config, tempFilePath, format);
    
    // Atomically move temporary file to final location
    fs.renameSync(tempFilePath, filePath);
  } catch (error) {
    // Clean up temporary file if it exists
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    if (error instanceof Error) {
      throw new Error(`Failed to atomically save configuration file "${filePath}": ${error.message}`);
    }
    throw new Error(`Failed to atomically save configuration file "${filePath}": Unknown error`);
  }
}

/**
 * Checks if a file path is writable
 * @param filePath - Path to check
 * @returns boolean - True if file/directory is writable
 */
export function isFileWritable(filePath: string): boolean {
  try {
    const directory = path.dirname(filePath);
    
    // Check if file exists and is writable
    if (fs.existsSync(filePath)) {
      fs.accessSync(filePath, fs.constants.W_OK);
      return true;
    }
    
    // Check if directory exists and is writable
    if (fs.existsSync(directory)) {
      fs.accessSync(directory, fs.constants.W_OK);
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Gets the recommended configuration file path for saving
 * @param preferLocal - Whether to prefer local directory over user directory (default: true)
 * @param format - Preferred format (default: 'yaml')
 * @returns string - Recommended file path
 */
export function getRecommendedConfigPath(preferLocal: boolean = true, format: ConfigFileFormat = 'yaml'): string {
  const fileName = format === 'yaml' ? 'config.yaml' : 'config.json';
  
  if (preferLocal) {
    const localPath = path.join(process.cwd(), fileName);
    if (isFileWritable(localPath) || isFileWritable(process.cwd())) {
      return localPath;
    }
  }
  
  // Fall back to user directory
  const userConfigDir = ensureUserConfigDirectory();
  return path.join(userConfigDir, fileName);
}

/**
 * Lists existing configuration files that can be updated
 * @param currentDir - Current working directory (optional, defaults to process.cwd())
 * @returns Array of existing configuration file paths
 */
export function listExistingConfigFiles(currentDir?: string): string[] {
  const potentialPaths = listPotentialConfigPaths(currentDir);
  return potentialPaths.filter(filePath => fs.existsSync(filePath));
}