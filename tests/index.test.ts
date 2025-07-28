/**
 * Additional tests for main entry point
 */

import { main } from '../src/index';

// Mock process.exit to prevent it from actually exiting during tests
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  // Don't throw an error, just return undefined to prevent actual exit
  return undefined as never;
});

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock command handlers
jest.mock('../src/commands/use', () => ({
  handleUseCommand: jest.fn().mockResolvedValue({ success: true, message: 'use command executed', exitCode: 0 })
}));

jest.mock('../src/commands/run', () => ({
  handleRunCommand: jest.fn().mockResolvedValue({ success: true, message: 'run command executed', exitCode: 0 })
}));

jest.mock('../src/commands/set-default', () => ({
  handleSetDefaultCommand: jest.fn().mockResolvedValue({ success: true, message: 'set-default command executed', exitCode: 0 })
}));

jest.mock('../src/commands/list', () => ({
  handleListCommand: jest.fn().mockResolvedValue({ success: true, message: 'list command executed', exitCode: 0 })
}));

jest.mock('../src/commands/chk', () => ({
  handleChkCommand: jest.fn().mockResolvedValue({ success: true, message: 'chk command executed', exitCode: 0 })
}));

jest.mock('../src/commands/router', () => ({
  handleRouterCommand: jest.fn().mockResolvedValue({ success: true, message: 'router command executed', exitCode: 0 })
}));

jest.mock('../src/help', () => ({
  getMainHelp: jest.fn().mockReturnValue({ success: true, message: 'Help content', exitCode: 0 })
}));

describe('Main Entry Point - Additional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should handle use command', async () => {
    const { handleUseCommand } = require('../src/commands/use');
    
    await main(['use', 'config']);
    
    expect(handleUseCommand).toHaveBeenCalledWith(['config']);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle run command', async () => {
    const { handleRunCommand } = require('../src/commands/run');
    
    await main(['run']);
    
    expect(handleRunCommand).toHaveBeenCalledWith([]);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle set-default command', async () => {
    const { handleSetDefaultCommand } = require('../src/commands/set-default');
    
    await main(['set-default', 'config']);
    
    expect(handleSetDefaultCommand).toHaveBeenCalledWith(['config']);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle list command', async () => {
    const { handleListCommand } = require('../src/commands/list');
    
    await main(['list']);
    
    expect(handleListCommand).toHaveBeenCalledWith([]);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle chk command', async () => {
    const { handleChkCommand } = require('../src/commands/chk');
    
    await main(['chk']);
    
    expect(handleChkCommand).toHaveBeenCalledWith([]);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle router command', async () => {
    const { handleRouterCommand } = require('../src/commands/router');
    
    await main(['/router', 'provider', 'model']);
    
    expect(handleRouterCommand).toHaveBeenCalledWith(['provider', 'model']);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle short help flag', async () => {
    const { getMainHelp } = require('../src/help');
    
    await main(['-h']);
    
    expect(getMainHelp).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle long help flag', async () => {
    const { getMainHelp } = require('../src/help');
    
    await main(['--help']);
    
    expect(getMainHelp).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should handle exception in command handler', async () => {
    // Mock a command that throws an error
    const { handleUseCommand } = require('../src/commands/use');
    handleUseCommand.mockRejectedValueOnce(new Error('Test error'));
    
    await main(['use', 'config']);
    
    expect(mockConsoleError).toHaveBeenCalledWith('Unexpected error:', expect.any(Error));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle missing command result', async () => {
    // Mock a command that returns undefined
    const { handleUseCommand } = require('../src/commands/use');
    handleUseCommand.mockResolvedValueOnce(undefined);
    
    await main(['use', 'config']);
    
    // Should not call process.exit if result is undefined
    expect(mockExit).not.toHaveBeenCalled();
  });
});