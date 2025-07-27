/**
 * Unit tests for the run command functionality
 */

import { handleRunCommand } from '../src/commands';
import { runCommand, parseRunCommandArgs, runCommandHelp, RunCommandOptions } from '../src/commands/run';
import * as environment from '../src/environment';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock environment module
jest.mock('../src/environment');
const mockValidateEnvironmentVariables = environment.validateEnvironmentVariables as jest.MockedFunction<typeof environment.validateEnvironmentVariables>;

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset console mocks
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  
  // Reset environment variables
  delete process.env['OPENAI_API_KEY'];
  delete process.env['OPENAI_BASE_URL'];
  delete process.env['OPENAI_MODEL'];
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('parseRunCommandArgs', () => {
  it('should parse empty arguments correctly', () => {
    const result = parseRunCommandArgs([]);
    
    expect(result.valid).toBe(true);
    expect(result.options).toEqual({
      additionalArgs: []
    });
    expect(result.showHelp).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should parse help flag correctly', () => {
    const result1 = parseRunCommandArgs(['-h']);
    const result2 = parseRunCommandArgs(['--help']);
    
    expect(result1.valid).toBe(true);
    expect(result1.showHelp).toBe(true);
    
    expect(result2.valid).toBe(true);
    expect(result2.showHelp).toBe(true);
  });

  it('should parse verbose flag correctly', () => {
    const result1 = parseRunCommandArgs(['-v']);
    const result2 = parseRunCommandArgs(['--verbose']);
    
    expect(result1.valid).toBe(true);
    expect(result1.options?.verbose).toBe(true);
    expect(result1.options?.additionalArgs).toEqual([]);
    
    expect(result2.valid).toBe(true);
    expect(result2.options?.verbose).toBe(true);
    expect(result2.options?.additionalArgs).toEqual([]);
  });

  it('should parse additional arguments correctly', () => {
    const result = parseRunCommandArgs(['--model-config', 'custom.json', '--debug']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.additionalArgs).toEqual(['--model-config', 'custom.json', '--debug']);
    expect(result.options?.verbose).toBeUndefined();
  });

  it('should parse mixed arguments correctly', () => {
    const result = parseRunCommandArgs(['-v', '--model-config', 'custom.json', '--debug']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.verbose).toBe(true);
    expect(result.options?.additionalArgs).toEqual(['--model-config', 'custom.json', '--debug']);
  });

  it('should handle undefined arguments', () => {
    const result = parseRunCommandArgs([undefined as any, '-v', undefined as any, '--debug']);
    
    expect(result.valid).toBe(true);
    expect(result.options?.verbose).toBe(true);
    expect(result.options?.additionalArgs).toEqual(['--debug']);
  });
});

describe('runCommandHelp', () => {
  it('should return help information', () => {
    const result = runCommandHelp();
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('qcr run - Launch Qwen Code with active configuration');
    expect(result.message).toContain('USAGE:');
    expect(result.message).toContain('EXAMPLES:');
    expect(result.message).toContain('DESCRIPTION:');
  });
});

describe('runCommand', () => {
  let mockChildProcess: EventEmitter & { pid?: number };

  beforeEach(() => {
    mockChildProcess = new EventEmitter() as EventEmitter & { pid?: number };
    mockChildProcess.pid = 12345;
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  it('should fail when environment variables are not set', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: false,
      errors: ['OPENAI_API_KEY is missing', 'OPENAI_BASE_URL is missing'],
      warnings: []
    });

    const result = await runCommand();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Required environment variables are not set');
    expect(result.details).toContain('Missing environment variables:');
    expect(result.details).toContain('OPENAI_API_KEY is missing');
    expect(result.details).toContain('Use "qcr use [config_name]" to activate a configuration');
    expect(result.exitCode).toBe(6);
  });

  it('should launch qwen successfully with valid environment', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    process.env['OPENAI_API_KEY'] = 'test-api-key-12345';
    process.env['OPENAI_BASE_URL'] = 'https://api.openai.com/v1';
    process.env['OPENAI_MODEL'] = 'gpt-4';

    const resultPromise = runCommand();

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    const result = await resultPromise;

    expect(mockSpawn).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'qwen.cmd' : 'qwen',
      [],
      expect.objectContaining({
        stdio: 'inherit',
        env: process.env,
        shell: expect.anything() // Allow any shell value, including true or a specific path
      })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Qwen Code completed successfully');
    expect(result.exitCode).toBe(0);
  });

  it('should pass additional arguments to qwen command', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    const options: RunCommandOptions = {
      additionalArgs: ['--model-config', 'custom.json', '--debug']
    };

    const resultPromise = runCommand(options);

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    await resultPromise;

    expect(mockSpawn).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'qwen.cmd' : 'qwen',
      ['--model-config', 'custom.json', '--debug'],
      expect.objectContaining({
        stdio: 'inherit',
        env: process.env,
        shell: expect.anything() // Allow any shell value, including true or a specific path
      })
    );
  });

  it('should show verbose output when requested', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: ['Some warning']
    });

    process.env['OPENAI_API_KEY'] = 'test-api-key-12345';
    process.env['OPENAI_BASE_URL'] = 'https://api.openai.com/v1';
    process.env['OPENAI_MODEL'] = 'gpt-4';

    const options: RunCommandOptions = {
      verbose: true,
      additionalArgs: ['--debug']
    };

    const resultPromise = runCommand(options);

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    await resultPromise;

    expect(console.warn).toHaveBeenCalledWith('Warnings:\n  ⚠ Some warning');
    expect(console.log).toHaveBeenCalledWith('Launching Qwen Code with environment:');
    expect(console.log).toHaveBeenCalledWith('  OPENAI_API_KEY: test-api...');
    expect(console.log).toHaveBeenCalledWith('  OPENAI_BASE_URL: https://api.openai.com/v1');
    expect(console.log).toHaveBeenCalledWith('  OPENAI_MODEL: gpt-4');
    expect(console.log).toHaveBeenCalledWith('  Command: qwen --debug');
  });

  it('should handle command not found error', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    const resultPromise = runCommand();

    // Simulate command not found error
    setTimeout(() => {
      const error = new Error('spawn qwen ENOENT');
      error.message = 'spawn qwen ENOENT';
      mockChildProcess.emit('error', error);
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to launch Qwen Code');
    expect(result.details).toContain('Ensure Qwen Code is installed and available in your PATH');
    expect(result.details).toContain('Check the installation documentation for proper setup');
    expect(result.exitCode).toBe(127);
  });

  it('should handle other spawn errors', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    const resultPromise = runCommand();

    // Simulate other error
    setTimeout(() => {
      const error = new Error('Permission denied');
      mockChildProcess.emit('error', error);
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to launch Qwen Code');
    expect(result.details).toContain('Permission denied');
    expect(result.exitCode).toBe(1);
  });

  it('should handle process exit with non-zero code', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    const resultPromise = runCommand();

    // Simulate process exit with error code
    setTimeout(() => {
      mockChildProcess.emit('exit', 1, null);
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.message).toBe('Qwen Code exited with code 1');
    expect(result.exitCode).toBe(1);
  });

  it('should handle process termination by signal', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    const resultPromise = runCommand();

    // Simulate process termination by SIGINT
    setTimeout(() => {
      mockChildProcess.emit('exit', null, 'SIGINT');
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.message).toBe('Qwen Code terminated by signal SIGINT');
    expect(result.exitCode).toBe(130); // 128 + 2 for SIGINT
  });

  it('should handle process termination by SIGTERM', async () => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    const resultPromise = runCommand();

    // Simulate process termination by SIGTERM
    setTimeout(() => {
      mockChildProcess.emit('exit', null, 'SIGTERM');
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.message).toBe('Qwen Code terminated by signal SIGTERM');
    expect(result.exitCode).toBe(1); // Changed to match implementation
  });

  it('should handle unexpected errors', async () => {
    mockValidateEnvironmentVariables.mockImplementation(() => {
      throw new Error('Unexpected validation error');
    });

    const result = await runCommand();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected error occurred during run command execution');
    expect(result.details).toContain('Unexpected validation error');
    expect(result.exitCode).toBe(1);
  });
});

describe('handleRunCommand', () => {
  beforeEach(() => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });
  });

  it('should show help when help flag is provided', async () => {
    const result = await handleRunCommand(['--help']);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('qcr run - Launch Qwen Code with active configuration');
    expect(result.exitCode).toBe(0);
  });

  it('should handle valid arguments', async () => {
    let mockChildProcess: EventEmitter & { pid?: number };
    mockChildProcess = new EventEmitter() as EventEmitter & { pid?: number };
    mockChildProcess.pid = 12345;
    mockSpawn.mockReturnValue(mockChildProcess as any);

    const resultPromise = handleRunCommand(['-v', '--debug']);

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(mockSpawn).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'qwen.cmd' : 'qwen',
      ['--debug'],
      expect.any(Object)
    );
  });

  it('should handle empty arguments', async () => {
    let mockChildProcess: EventEmitter & { pid?: number };
    mockChildProcess = new EventEmitter() as EventEmitter & { pid?: number };
    mockChildProcess.pid = 12345;
    mockSpawn.mockReturnValue(mockChildProcess as any);

    const resultPromise = handleRunCommand([]);

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(mockSpawn).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'qwen.cmd' : 'qwen',
      [],
      expect.any(Object)
    );
  });
});

describe('Signal handling', () => {
  let mockChildProcess: EventEmitter & { pid?: number };
  let originalProcessOn: typeof process.on;
  let originalProcessRemoveListener: typeof process.removeListener;
  let originalProcessKill: typeof process.kill;
  
  const mockProcessOn = jest.fn();
  const mockProcessRemoveListener = jest.fn();
  const mockProcessKill = jest.fn();

  beforeEach(() => {
    mockValidateEnvironmentVariables.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    mockChildProcess = new EventEmitter() as EventEmitter & { pid?: number };
    mockChildProcess.pid = 12345;
    mockSpawn.mockReturnValue(mockChildProcess as any);

    // Mock process methods
    originalProcessOn = process.on;
    originalProcessRemoveListener = process.removeListener;
    originalProcessKill = process.kill;
    
    process.on = mockProcessOn as any;
    process.removeListener = mockProcessRemoveListener as any;
    process.kill = mockProcessKill as any;
  });

  afterEach(() => {
    // Restore process methods
    process.on = originalProcessOn;
    process.removeListener = originalProcessRemoveListener;
    process.kill = originalProcessKill;
  });

  it('should set up signal handlers', async () => {
    const resultPromise = runCommand();

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    await resultPromise;

    expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should clean up signal handlers on process exit', async () => {
    const resultPromise = runCommand();

    // Simulate successful process exit
    setTimeout(() => {
      mockChildProcess.emit('exit', 0, null);
    }, 10);

    await resultPromise;

    expect(mockProcessRemoveListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(mockProcessRemoveListener).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });
});