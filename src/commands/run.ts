/**
 * 'run' command implementation for Qwen Code Router CLI
 */

import { ChildProcess } from 'child_process';
import { spawnCrossPlatform } from '../platform';
import { validateEnvironmentVariables } from '../environment';
import {
  createErrorResult,
  createSuccessResult,
  environmentNotSetError,
  processLaunchError,
  unexpectedError,
  invalidArgumentsError,
  EXIT_CODES
} from '../errors';
import { CommandResult } from '../commands';
import { parseFlags } from '../command-args';

/**
 * Options for the run command
 */
export interface RunCommandOptions {
  /** Additional arguments to pass to the qwen command */
  additionalArgs?: string[];
  /** Whether to show verbose output */
  verbose?: boolean;
}

/**
 * Implements the 'qcr run' command
 * Launches Qwen Code with the currently active configuration
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with execution status and message
 */
export async function runCommand(options: RunCommandOptions = {}): Promise<CommandResult> {
  try {
    // Validate that required environment variables are set
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return createErrorResult(environmentNotSetError(envValidation.errors));
    }

    // Show warnings if any
    if (envValidation.warnings.length > 0 && options.verbose) {
      console.warn(`Warnings:\n${envValidation.warnings.map(w => `  ⚠ ${w}`).join('\n')}`);
    }

    // Prepare command arguments
    const qwenArgs = options.additionalArgs || [];

    if (options.verbose) {
      console.log(`Launching Qwen Code with environment:`);
      console.log(`  OPENAI_API_KEY: ${process.env['OPENAI_API_KEY']?.substring(0, 8)}...`);
      console.log(`  OPENAI_BASE_URL: ${process.env['OPENAI_BASE_URL']}`);
      console.log(`  OPENAI_MODEL: ${process.env['OPENAI_MODEL']}`);
      console.log(`  Command: qwen ${qwenArgs.join(' ')}`);
    }

    // Launch Qwen Code process using cross-platform spawning
    return new Promise<CommandResult>((resolve) => {
      const child: ChildProcess = spawnCrossPlatform('qwen', qwenArgs, {
        stdio: 'inherit', // Pass through stdin/stdout/stderr
        env: process.env, // Use current environment (including our set variables)
        useShell: true // Use shell to handle command resolution
      });

      // Handle process errors
      child.on('error', (error) => {
        resolve(createErrorResult(processLaunchError('Qwen Code', error.message)));
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        if (signal) {
          const exitCode = signal === 'SIGINT' ? EXIT_CODES.INTERRUPTED : EXIT_CODES.GENERAL_ERROR;
          resolve(createSuccessResult(`Qwen Code terminated by signal ${signal}`, undefined, exitCode));
        } else {
          const exitCode = code || 0;
          const message = exitCode === 0 ? 'Qwen Code completed successfully' : `Qwen Code exited with code ${exitCode}`;
          resolve(createSuccessResult(message, undefined, exitCode));
        }
      });

      // Handle signals to forward them to the child process
      const signalHandler = (signal: NodeJS.Signals) => {
        if (child.pid) {
          try {
            process.kill(child.pid, signal);
          } catch (error) {
            // Child process may have already exited
            if (options.verbose) {
              console.warn(`Failed to send ${signal} to child process:`, error);
            }
          }
        }
      };

      process.on('SIGINT', signalHandler);
      process.on('SIGTERM', signalHandler);

      // Clean up signal handlers when child exits
      child.on('exit', () => {
        process.removeListener('SIGINT', signalHandler);
        process.removeListener('SIGTERM', signalHandler);
      });
    });
  } catch (error) {
    return createErrorResult(unexpectedError('run command execution', error));
  }
}

/**
 * Shows help information for the run command
 * @returns CommandResult with help information
 */
export function runCommandHelp(): CommandResult {
  // Import here to avoid circular dependency
  const { getRunCommandHelp } = require('../help');
  return getRunCommandHelp();
}

/**
 * Validates command arguments for the run command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseRunCommandArgs(args: string[]): {
  valid: boolean;
  options?: RunCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const { parsedFlags, remainingArgs } = parseFlags(args, {
    help: ['-h', '--help'],
    verbose: ['-v', '--verbose']
  });

  if (parsedFlags['help']) {
    return { valid: true, showHelp: true };
  }

  const options: RunCommandOptions = {
    additionalArgs: remainingArgs,
    verbose: parsedFlags['verbose'] || false
  };

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the run command from CLI
 * @param args - Command line arguments (excluding 'qcr run')
 * @returns Promise<CommandResult>
 */
export async function handleRunCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseRunCommandArgs(args);

  if (!parseResult.valid) {
    return createErrorResult(invalidArgumentsError('run', parseResult.error || 'Invalid arguments', 'qcr run [additional_args...] [-v|--verbose]'));
  }

  if (parseResult.showHelp) {
    return runCommandHelp();
  }

  return await runCommand(parseResult.options);
}