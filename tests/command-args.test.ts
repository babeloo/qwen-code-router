/**
 * Tests for command argument parsing utilities
 */

import { parseFlags, validateArgCount } from '../src/command-args';

describe('Command Argument Utilities', () => {
  describe('parseFlags', () => {
    it('should parse flags correctly', () => {
      const flags = {
        verbose: ['-v', '--verbose'],
        help: ['-h', '--help']
      };
      
      const result = parseFlags(['-v', 'arg1', '--help', 'arg2'], flags);
      
      expect(result.parsedFlags['verbose']).toBe(true);
      expect(result.parsedFlags['help']).toBe(true);
      expect(result.remainingArgs).toEqual(['arg1', 'arg2']);
    });

    it('should handle empty arguments', () => {
      const flags = {
        verbose: ['-v', '--verbose']
      };
      
      const result = parseFlags([], flags);
      
      expect(result.parsedFlags['verbose']).toBe(false);
      expect(result.remainingArgs).toEqual([]);
    });

    it('should handle undefined arguments', () => {
      const flags = {
        verbose: ['-v', '--verbose']
      };
      
      const result = parseFlags([undefined as any, '-v', undefined as any], flags);
      
      expect(result.parsedFlags['verbose']).toBe(true);
      expect(result.remainingArgs).toEqual([]);
    });

    it('should not match partial flags', () => {
      const flags = {
        verbose: ['-v', '--verbose']
      };
      
      const result = parseFlags(['-ver', '--verbose2'], flags);
      
      expect(result.parsedFlags['verbose']).toBe(false);
      expect(result.remainingArgs).toEqual(['-ver', '--verbose2']);
    });
  });

  describe('validateArgCount', () => {
    it('should validate minimum argument count', () => {
      const result = validateArgCount(['arg1', 'arg2'], 1, -1, 'Test error');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when below minimum argument count', () => {
      const result = validateArgCount(['arg1'], 2, -1, 'Test error');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected at least 2 arguments, got 1');
    });

    it('should validate maximum argument count', () => {
      const result = validateArgCount(['arg1', 'arg2'], 0, 2, 'Test error');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when above maximum argument count', () => {
      const result = validateArgCount(['arg1', 'arg2', 'arg3'], 0, 2, 'Test error');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected at most 2 arguments, got 3');
    });

    it('should handle exact argument count', () => {
      const result = validateArgCount(['arg1', 'arg2'], 2, 2, 'Test error');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle singular/plural wording correctly', () => {
      // Singular
      const result1 = validateArgCount([], 1, -1, 'Test error');
      expect(result1.error).toContain('1 argument');
      
      // Plural
      const result2 = validateArgCount([], 2, -1, 'Test error');
      expect(result2.error).toContain('2 arguments');
    });
  });
});