// Basic test to verify the testing framework is working
import { main } from '../src/index';

describe('Project Setup', () => {
  test('should have main function', () => {
    expect(typeof main).toBe('function');
  });

  test('should run without errors', () => {
    // Capture console.log to avoid output during tests
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    expect(() => main()).not.toThrow();
    
    consoleSpy.mockRestore();
  });
});