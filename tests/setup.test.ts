// Basic test to verify the testing framework is working
import { main } from '../src/index';

// Mock process.exit to prevent it from actually exiting during tests
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() called');
});

// Mock process.argv to control command line arguments
const originalArgv = process.argv;

describe('Project Setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockExit.mockRestore();
    process.argv = originalArgv;
  });

  test('should have main function', () => {
    expect(typeof main).toBe('function');
  });

  test('should show help when no arguments provided', async () => {
    // Capture console.log to avoid output during tests
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Set empty arguments
    process.argv = ['node', 'qcr'];
    
    try {
      await main();
    } catch (error) {
      // Expected to throw because of mocked process.exit
      expect(error).toEqual(new Error('process.exit() called'));
    }
    
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('should handle help command', async () => {
    // Capture console.log to avoid output during tests
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Set help command arguments
    process.argv = ['node', 'qcr', 'help'];
    
    try {
      await main();
    } catch (error) {
      // Expected to throw because of mocked process.exit
      expect(error).toEqual(new Error('process.exit() called'));
    }
    
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('should handle unknown command', async () => {
    // Capture console.error to avoid output during tests
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Set unknown command arguments
    process.argv = ['node', 'qcr', 'unknown-command'];
    
    try {
      await main();
    } catch (error) {
      // Expected to throw because of mocked process.exit
      expect(error).toEqual(new Error('process.exit() called'));
    }
    
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Unknown command: unknown-command');
    
    consoleErrorSpy.mockRestore();
  });
});