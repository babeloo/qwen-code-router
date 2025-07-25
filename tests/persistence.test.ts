/**
 * Unit tests for configuration file persistence layer
 * Tests file loading, parsing, discovery, and error handling
 */

import * as fs from 'fs';
import { type PathLike } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  discoverConfigFile,
  discoverConfigFileHierarchical,
  loadConfigFile,
  loadAndValidateConfigFile,
  discoverAndLoadConfig,
  detectConfigFileFormat,
  parseYamlConfig,
  parseJsonConfig,
  isFileAccessible,
  getConfigFileStats,
  ensureUserConfigDirectory,
  listPotentialConfigPaths
} from '../src/persistence';
import { ConfigFile } from '../src/types';

// Mock fs module for testing
jest.mock('fs');
jest.mock('os');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const mockPath = path as jest.Mocked<typeof path>;


// Sample valid configuration for testing
const validYamlConfig = `
default_config:
  - name: openai-gpt4
configs:
  - config:
      - name: openai-gpt4
        provider: openai
        model: gpt-4
providers:
  - provider: openai
    env:
      api_key: test-key
      base_url: https://api.openai.com/v1
      models:
        - model: gpt-4
        - model: gpt-3.5-turbo
`;

const validJsonConfig = `{
  "default_config": [
    { "name": "openai-gpt4" }
  ],
  "configs": [
    {
      "config": [
        { "name": "openai-gpt4", "provider": "openai", "model": "gpt-4" }
      ]
    }
  ],
  "providers": [
    {
      "provider": "openai",
      "env": {
        "api_key": "test-key",
        "base_url": "https://api.openai.com/v1",
        "models": [
          { "model": "gpt-4" },
          { "model": "gpt-3.5-turbo" }
        ]
      }
    }
  ]
}`;

const expectedConfigObject: ConfigFile = {
  default_config: [{ name: 'openai-gpt4' }],
  configs: [
    {
      config: [{ name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' }]
    }
  ],
  providers: [
    {
      provider: 'openai',
      env: {
        api_key: 'test-key',
        base_url: 'https://api.openai.com/v1',
        models: [
          { model: 'gpt-4' },
          { model: 'gpt-3.5-turbo' }
        ]
      }
    }
  ]
};

describe('Configuration Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockOs.homedir.mockReturnValue('/home/user');
    process.cwd = jest.fn().mockReturnValue('/current/dir');

    // Mock path functions
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    mockPath.extname.mockImplementation((filePath: string) => {
      const parts = filePath.split('.');
      return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
    });
  });

  describe('discoverConfigFile', () => {
    it('should discover YAML config file', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '/test/dir/config.yaml';
      });

      const result = discoverConfigFile('/test/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/test/dir/config.yaml');
      expect(result.format).toBe('yaml');
    });

    it('should discover JSON config file when YAML not found', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '/test/dir/config.json';
      });

      const result = discoverConfigFile('/test/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/test/dir/config.json');
      expect(result.format).toBe('json');
    });

    it('should prefer YAML over JSON when both exist', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '/test/dir/config.yaml' || filePath === '/test/dir/config.json';
      });

      const result = discoverConfigFile('/test/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/test/dir/config.yaml');
      expect(result.format).toBe('yaml');
    });

    it('should return not found when no config files exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = discoverConfigFile('/test/dir');

      expect(result.found).toBe(false);
      expect(result.filePath).toBeNull();
      expect(result.format).toBeNull();
    });

    it('should discover config.yml file', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '/test/dir/config.yml';
      });

      const result = discoverConfigFile('/test/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/test/dir/config.yml');
      expect(result.format).toBe('yaml');
    });
  });

  // 修改所有 mockFs.existsSync 实现，使用正确的类型

  describe('discoverConfigFileHierarchical', () => {
    it('should find local config file first', () => {
      // 使用 PathLike 类型而不是 string
      mockFs.existsSync.mockImplementation((filePath: PathLike) => {
        const pathStr = filePath.toString();
        return pathStr === '/current/dir' || pathStr === '/current/dir/config.yaml';
      });

      // Mock platform to ensure consistent path handling
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = discoverConfigFileHierarchical('/current/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/current/dir/config.yaml');
      expect(result.format).toBe('yaml');

      // 恢复原始平台
      Object.defineProperty(process, 'platform', {
        value: os.platform(),
        configurable: true
      });
    });

    it('should find user config file when local not found', () => {
      // 模拟用户配置目录和文件存在
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '/home/user/.config/qcr' || filePath === '/home/user/.config/qcr/config.yaml';
      });

      const result = discoverConfigFileHierarchical('/current/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/home/user/.config/qcr/config.yaml');
      expect(result.format).toBe('yaml');
    });

    it('should return not found when no config files exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = discoverConfigFileHierarchical();

      expect(result.found).toBe(false);
      expect(result.filePath).toBeNull();
      expect(result.format).toBeNull();
    });

    it('should use provided current directory', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        // 确保目录和文件都被认为存在
        return filePath === '/custom/dir' || filePath === '/custom/dir/config.yaml';
      });

      const result = discoverConfigFileHierarchical('/custom/dir');

      expect(result.found).toBe(true);
      expect(result.filePath).toBe('/custom/dir/config.yaml');
    });

    describe('loadConfigFile', () => {
      it('should load and parse YAML config file', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(validYamlConfig);

        const result = await loadConfigFile('/test/config.yaml', 'yaml');

        expect(result).toMatchObject(expectedConfigObject);
      });

      it('should load and parse JSON config file', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(validJsonConfig);

        const result = await loadConfigFile('/test/config.json', 'json');

        expect(result).toMatchObject(expectedConfigObject);
      });

      it('should auto-detect format from file extension', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(validYamlConfig);

        const result = await loadConfigFile('/test/config.yaml');

        expect(result).toMatchObject(expectedConfigObject);
      });

      it('should throw error when file does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        await expect(loadConfigFile('/test/nonexistent.yaml')).rejects.toThrow(
          'Configuration file not found: /test/nonexistent.yaml'
        );
      });

      it('should throw error for invalid YAML', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('invalid: yaml: content: [');

        await expect(loadConfigFile('/test/config.yaml', 'yaml')).rejects.toThrow(
          'Failed to load configuration file "/test/config.yaml"'
        );
      });

      it('should throw error for invalid JSON', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{ invalid json }');

        await expect(loadConfigFile('/test/config.json', 'json')).rejects.toThrow(
          'Failed to load configuration file "/test/config.json"'
        );
      });

      it('should throw error for unsupported format', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('content');

        await expect(loadConfigFile('/test/config.txt', 'xml' as any)).rejects.toThrow(
          'Unsupported configuration file format: xml'
        );
      });
    });

    describe('loadAndValidateConfigFile', () => {
      it('should load and validate valid config file', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(validYamlConfig);

        const result = await loadAndValidateConfigFile('/test/config.yaml', 'yaml');

        expect(result.config).toMatchObject(expectedConfigObject);
        expect(result.validation.isValid).toBe(true);
        expect(result.validation.errors).toHaveLength(0);
      });

      it('should load and validate invalid config file', async () => {
        const invalidConfig = `
configs:
  - config:
      - name: ""
        provider: ""
        model: ""
providers: []
`;
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(invalidConfig);

        const result = await loadAndValidateConfigFile('/test/config.yaml', 'yaml');

        expect(result.validation.isValid).toBe(false);
        expect(result.validation.errors.length).toBeGreaterThan(0);
      });
    });

    describe('discoverAndLoadConfig', () => {
      it('should discover, load, and validate config file', async () => {
        mockFs.existsSync.mockImplementation((filePath: any) => {
          // 确保目录和文件都被认为存在
          return filePath === '/current/dir' || filePath === '/current/dir/config.yaml';
        });
        mockFs.readFileSync.mockReturnValue(validYamlConfig);

        const result = await discoverAndLoadConfig();

        expect(result.config).toMatchObject(expectedConfigObject);
        expect(result.validation.isValid).toBe(true);
        expect(result.filePath).toBe('/current/dir/config.yaml');
      });

      it('should throw error when no config file found', async () => {
        mockFs.existsSync.mockReturnValue(false);

        await expect(discoverAndLoadConfig()).rejects.toThrow(
          'No configuration file found'
        );
      });
    });

    describe('detectConfigFileFormat', () => {
      it('should detect YAML format from .yaml extension', () => {
        expect(detectConfigFileFormat('/test/config.yaml')).toBe('yaml');
      });

      it('should detect YAML format from .yml extension', () => {
        expect(detectConfigFileFormat('/test/config.yml')).toBe('yaml');
      });

      it('should detect JSON format from .json extension', () => {
        expect(detectConfigFileFormat('/test/config.json')).toBe('json');
      });

      it('should default to YAML for unknown extensions', () => {
        expect(detectConfigFileFormat('/test/config.txt')).toBe('yaml');
      });

      it('should handle uppercase extensions', () => {
        expect(detectConfigFileFormat('/test/config.YAML')).toBe('yaml');
        expect(detectConfigFileFormat('/test/config.JSON')).toBe('json');
      });
    });

    describe('parseYamlConfig', () => {
      it('should parse valid YAML content', () => {
        const result = parseYamlConfig(validYamlConfig, '/test/config.yaml');
        expect(result).toMatchObject(expectedConfigObject);
      });

      it('should throw error for empty YAML content', () => {
        expect(() => parseYamlConfig('', '/test/config.yaml')).toThrow(
          'Configuration file is empty or contains only comments'
        );
      });

      it('should throw error for non-object YAML content', () => {
        expect(() => parseYamlConfig('just a string', '/test/config.yaml')).toThrow(
          'Configuration file must contain an object at the root level'
        );
      });

      it('should throw error for invalid YAML syntax', () => {
        expect(() => parseYamlConfig('invalid: yaml: [', '/test/config.yaml')).toThrow(
          'YAML parsing error in /test/config.yaml'
        );
      });
    });

    describe('parseJsonConfig', () => {
      it('should parse valid JSON content', () => {
        const result = parseJsonConfig(validJsonConfig, '/test/config.json');
        expect(result).toMatchObject(expectedConfigObject);
      });

      it('should throw error for empty JSON content', () => {
        expect(() => parseJsonConfig('null', '/test/config.json')).toThrow(
          'Configuration file is empty'
        );
      });

      it('should throw error for non-object JSON content', () => {
        expect(() => parseJsonConfig('"just a string"', '/test/config.json')).toThrow(
          'Configuration file must contain an object at the root level'
        );
      });

      it('should throw error for invalid JSON syntax', () => {
        expect(() => parseJsonConfig('{ invalid json }', '/test/config.json')).toThrow(
          'JSON parsing error in /test/config.json'
        );
      });
    });

    describe('isFileAccessible', () => {
      it('should return true for accessible file', () => {
        mockFs.accessSync.mockImplementation(() => {
          // No error means file is accessible
        });

        expect(isFileAccessible('/test/config.yaml')).toBe(true);
      });

      it('should return false for inaccessible file', () => {
        mockFs.accessSync.mockImplementation(() => {
          throw new Error('File not accessible');
        });

        expect(isFileAccessible('/test/config.yaml')).toBe(false);
      });
    });

    describe('getConfigFileStats', () => {
      it('should return file stats for existing file', () => {
        const mockStats = { size: 1024, mtime: new Date() } as fs.Stats;
        mockFs.statSync.mockReturnValue(mockStats);

        const result = getConfigFileStats('/test/config.yaml');

        expect(result).toBe(mockStats);
      });

      it('should return null for non-existent file', () => {
        mockFs.statSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        const result = getConfigFileStats('/test/config.yaml');

        expect(result).toBeNull();
      });
    });

    describe('ensureUserConfigDirectory', () => {
      it('should create user config directory if it does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => undefined);

        const result = ensureUserConfigDirectory();

        expect(result).toBe('/home/user/.qcr');
        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/home/user/.qcr', { recursive: true });
      });

      it('should return existing user config directory', () => {
        mockFs.existsSync.mockReturnValue(true);

        const result = ensureUserConfigDirectory();

        expect(result).toBe('/home/user/.qcr');
        expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      });
    });

    describe('listPotentialConfigPaths', () => {
      it('should list all potential config file paths', () => {
        const result = listPotentialConfigPaths();

        expect(result).toContain('/current/dir/config.yaml');
        expect(result).toContain('/current/dir/config.yml');
        expect(result).toContain('/current/dir/config.json');
        expect(result).toContain('/home/user/.qcr/config.yaml');
        expect(result).toContain('/home/user/.qcr/config.yml');
        expect(result).toContain('/home/user/.qcr/config.json');
      });

      it('should use provided current directory', () => {
        const result = listPotentialConfigPaths('/custom/dir');

        expect(result).toContain('/custom/dir/config.yaml');
        expect(result).toContain('/custom/dir/config.yml');
        expect(result).toContain('/custom/dir/config.json');
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle file read errors gracefully', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        await expect(loadConfigFile('/test/config.yaml')).rejects.toThrow(
          'Failed to load configuration file "/test/config.yaml": Permission denied'
        );
      });

      it('should handle YAML files with comments', () => {
        const yamlWithComments = `
# This is a comment
default_config:
  - name: openai-gpt4  # Another comment
configs:
  - config:
      - name: openai-gpt4
        provider: openai
        model: gpt-4
providers:
  - provider: openai
    env:
      api_key: test-key
      base_url: https://api.openai.com/v1
      models:
        - model: gpt-4
`;

        const result = parseYamlConfig(yamlWithComments, '/test/config.yaml');
        expect(result.default_config?.[0]?.name).toBe('openai-gpt4');
      });

      it('should handle JSON files with whitespace', () => {
        const jsonWithWhitespace = `
      
      {
        "configs": [],
        "providers": []
      }
      
      `;

        const result = parseJsonConfig(jsonWithWhitespace, '/test/config.json');
        expect(result.configs).toEqual([]);
        expect(result.providers).toEqual([]);
      });
    });
  });
});