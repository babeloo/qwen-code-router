/**
 * Tests for CLI entry point
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

describe('CLI Entry Point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should call main function with command line arguments', async () => {
    // Test with no arguments (should show help)
    await main([]);
    
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should handle unhandled errors gracefully', async () => {
    // Mock an unexpected error in main
    const mockMain = jest.fn().mockRejectedValue(new Error('Test error'));
    jest.mock('../src/index', () => ({
      main: mockMain
    }));
    
    // Re-import the CLI module to trigger error handling
    await import('../src/cli');
    
    // Verify that the error is caught and logged
    expect(mockConsoleError).toHaveBeenCalledWith('Unhandled error:', expect.any(Error));
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});