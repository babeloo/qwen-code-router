// Basic test to verify the testing framework is working
import { main } from '../src/index';

// Mock process.exit to prevent it from actually exiting during tests
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  // Don't throw an error, just return undefined to prevent actual exit
  return undefined as never;
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
    // Capture console.log and console.error to avoid output during tests
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await main([]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should handle help command', async () => {
    // Capture console.log and console.error to avoid output during tests
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await main(['help']);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should handle unknown command', async () => {
    // Capture console.log and console.error to avoid output during tests
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await main(['unknown-command']);

    expect(mockExit).toHaveBeenCalledWith(2);
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Unknown command: unknown-command');

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});