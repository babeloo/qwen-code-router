/**
 * Startup flow command implementation
 * 
 * This module provides commands to test and validate the startup flow.
 */

import { CommandResult } from './commands';
import {
  executeStartupFlow,
  validateStartupFlow,
  formatStartupFlowResult,
  getStartupStatus,
  isReadyToLaunch
} from './startup';
import {
  createErrorResult,
  createSuccessResult,
  invalidArgumentsError
} from './errors';

/**
 * Options for startup flow commands
 */
export interface StartupCommandOptions {
  /** Current working directory (optional) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Whether to execute the startup flow (set environment variables) */
  execute?: boolean;
}

/**
 * Implements the startup flow validation/execution command
 * @param options - Command options
 * @returns Promise<CommandResult> with startup flow results
 */
export async function startupFlowCommand(options: StartupCommandOptions = {}): Promise<CommandResult> {
  try {
    if (options.execute) {
      // Execute the full startup flow (sets environment variables)
      const result = await executeStartupFlow(options.currentDir);
      return formatStartupFlowResult(result);
    } else {
      // Just validate the startup flow (no environment variable changes)
      const result = await validateStartupFlow(options.currentDir);
      return formatStartupFlowResult(result);
    }
  } catch (error) {
    return createErrorResult({
      message: 'Unexpected error during startup flow command',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    });
  }
}

/**
 * Implements the startup status command
 * @param options - Command options
 * @returns Promise<CommandResult> with current startup status
 */
export async function startupStatusCommand(options: StartupCommandOptions = {}): Promise<CommandResult> {
  try {
    const result = await getStartupStatus(options.currentDir);
    
    if (result.success) {
      let message = 'System is ready to launch Qwen Code';
      let details = `Configuration: ${result.defaultConfigName}`;
      
      if (options.verbose && result.configFilePath) {
        details += `\nConfiguration file: ${result.configFilePath}`;
      }
      
      return createSuccessResult(message, details);
    } else {
      return formatStartupFlowResult(result);
    }
  } catch (error) {
    return createErrorResult({
      message: 'Unexpected error while checking startup status',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    });
  }
}

/**
 * Implements the ready check command
 * @param options - Command options
 * @returns Promise<CommandResult> with ready status
 */
export async function readyCheckCommand(options: StartupCommandOptions = {}): Promise<CommandResult> {
  try {
    const ready = await isReadyToLaunch(options.currentDir);
    
    if (ready) {
      return createSuccessResult('System is ready to launch Qwen Code');
    } else {
      const status = await getStartupStatus(options.currentDir);
      return formatStartupFlowResult(status);
    }
  } catch (error) {
    return createErrorResult({
      message: 'Unexpected error while checking ready status',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    });
  }
}

/**
 * Shows help information for startup flow commands
 * @returns CommandResult with help information
 */
export function startupFlowCommandHelp(): CommandResult {
  const helpText = `
qcr startup - Validate or execute startup flow

DESCRIPTION:
  The startup flow command validates the system configuration according to
  the proper startup sequence:
  
  1. Check configuration file existence
  2. Check default configuration existence  
  3. Validate default configuration
  4. Set environment variables (if executing)
  5. Ready to launch Qwen Code

USAGE:
  qcr startup [options]

OPTIONS:
  --execute      Execute the startup flow (set environment variables)
  --status       Show current startup status
  --ready        Check if system is ready to launch
  -v, --verbose  Show detailed output
  -h, --help     Show this help message

EXAMPLES:
  qcr startup                # Validate startup flow (no changes)
  qcr startup --execute      # Execute startup flow (set environment)
  qcr startup --status       # Show current startup status
  qcr startup --ready        # Check if ready to launch
  qcr startup -v             # Validate with verbose output

STARTUP FLOW STEPS:
  1. Configuration File Check: Verifies config file exists and is valid
  2. Default Configuration Check: Ensures default configuration is set
  3. Default Configuration Validation: Validates default config is usable
  4. Environment Setup: Sets required environment variables
  5. Ready State: System ready to launch Qwen Code

ERROR HANDLING:
  Each step provides specific error messages and suggestions for resolution.
  Use --verbose for detailed information about each step.

RELATED COMMANDS:
  qcr use                    # Activate a configuration
  qcr set-default <name>     # Set default configuration
  qcr chk <name>            # Validate specific configuration
  qcr run                   # Launch Qwen Code
`;

  return createSuccessResult(helpText.trim());
}

/**
 * Validates command arguments for startup flow commands
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseStartupFlowCommandArgs(args: string[]): {
  valid: boolean;
  options?: StartupCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const options: StartupCommandOptions = {};
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue; // Skip undefined/empty arguments

    if (arg === '-h' || arg === '--help') {
      return { valid: true, showHelp: true };
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--status') {
      command = 'status';
    } else if (arg === '--ready') {
      command = 'ready';
    } else if (arg.startsWith('-')) {
      return {
        valid: false,
        error: `Unknown option: ${arg}`
      };
    } else {
      return {
        valid: false,
        error: `Unexpected argument: ${arg}`
      };
    }
  }

  // Set command type in options for processing
  (options as any).command = command;

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for startup flow commands from CLI
 * @param args - Command line arguments (excluding 'qcr startup')
 * @returns Promise<CommandResult>
 */
export async function handleStartupFlowCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseStartupFlowCommandArgs(args);

  if (!parseResult.valid) {
    return createErrorResult(invalidArgumentsError('startup', parseResult.error || 'Invalid arguments', 'qcr startup [--execute|--status|--ready] [-v|--verbose]'));
  }

  if (parseResult.showHelp) {
    return startupFlowCommandHelp();
  }

  const options = parseResult.options!;
  const command = (options as any).command;

  // Route to appropriate command handler
  switch (command) {
    case 'status':
      return await startupStatusCommand(options);
    case 'ready':
      return await readyCheckCommand(options);
    default:
      return await startupFlowCommand(options);
  }
}