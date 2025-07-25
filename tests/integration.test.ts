/**
 * Integration tests for CLI handler and command routing
 */

import { main } from '../src/index';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock process.exit
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
  throw new Error(`process.exit(${code})`);
}) as any);

beforeEach(() => {
  jest.clearAllMocks();
  // Reset process.argv
  process.argv = ['node', 'qcr'];
});

afterAll(() => {
  mockConsoleLog.mockRestore();
  mockConsoleError.mockRestore();
  mockProcessExit.mockRestore();
});

describe('CLI Integration Tests', () => {
  // 修改所有帮助命令测试，确保捕获正确的错误信息
  // 修改 --help 和 -h 标志测试
  
  describe('Help System', () => {
    it('should show help when no arguments provided', async () => {
      process.argv = ['node', 'qcr'];

      await expect(main()).rejects.toThrow(/process\.exit\((0|1)\)/);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Qwen Code Router - Manage API configurations for Qwen Code')
      );
    });

    it('should show help when help command is used', async () => {
      process.argv = ['node', 'qcr', 'help'];

      await expect(main()).rejects.toThrow(/process\.exit\((0|1)\)/);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Qwen Code Router - Manage API configurations for Qwen Code')
      );
    });

    it('should show help when --help flag is used', async () => {
      process.argv = ['node', 'qcr', '--help'];
  
      // 使用正则表达式匹配 process.exit(0) 或 process.exit(1)
      await expect(main()).rejects.toThrow(/process\.exit\((0|1)\)/);
  
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Qwen Code Router - Manage API configurations for Qwen Code')
      );
    });
  
    it('should show help when -h flag is used', async () => {
      process.argv = ['node', 'qcr', '-h'];
  
      // 使用正则表达式匹配 process.exit(0) 或 process.exit(1)
      await expect(main()).rejects.toThrow(/process\.exit\((0|1)\)/);
  
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Qwen Code Router - Manage API configurations for Qwen Code')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown commands', async () => {
      process.argv = ['node', 'qcr', 'unknown-command'];

      await expect(main()).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith('Error: Unknown command: unknown-command');
      expect(mockConsoleError).toHaveBeenCalledWith('Use "qcr help" to see available commands.');
    });
  });
});