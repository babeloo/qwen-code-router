/**
 * Main entry point for Qwen Code Router CLI
 * 
 * This module parses command line arguments and dispatches to appropriate command handlers.
 */

import { CommandResult } from './commands';
import { getMainHelp } from './help';

// Dynamically import command handlers to reduce initial load time
async function importCommands() {
  const commands = {
    use: await import('./commands/use'),
    run: await import('./commands/run'),
    setDefault: await import('./commands/set-default'),
    list: await import('./commands/list'),
    chk: await import('./commands/chk'),
    router: await import('./commands/router')
  };
  return commands;
}

/**
 * Main application entry point
 */
export async function main(args?: string[]): Promise<void> {
  const actualArgs = args || process.argv.slice(2);

  // Handle empty arguments - show main help
  if (actualArgs.length === 0) {
    const helpResult = getMainHelp();
    printResult(helpResult);
    return process.exit(helpResult.exitCode);
  }

  // Handle help commands
  if (actualArgs[0] === 'help' || actualArgs[0] === '-h' || actualArgs[0] === '--help') {
    const helpResult = getMainHelp();
    printResult(helpResult);
    return process.exit(helpResult.exitCode);
  }

  // Dispatch to appropriate command handler
  try {
    const commands = await importCommands();
    let result: CommandResult;

    switch (actualArgs[0]) {
      case 'use':
        result = await commands.use.handleUseCommand(actualArgs.slice(1));
        break;
      case 'run':
        result = await commands.run.handleRunCommand(actualArgs.slice(1));
        break;
      case 'set-default':
        result = await commands.setDefault.handleSetDefaultCommand(actualArgs.slice(1));
        break;
      case 'list':
        result = await commands.list.handleListCommand(actualArgs.slice(1));
        break;
      case 'chk':
        result = await commands.chk.handleChkCommand(actualArgs.slice(1));
        break;
      case '/router':
        result = await commands.router.handleRouterCommand(actualArgs.slice(1));
        break;
      default:
        // For unknown commands, output directly to stderr as expected by tests
        console.error(`Error: Unknown command: ${actualArgs[0]}`);
        process.exit(2);
    }

    if (result) {
      printResult(result);
      process.exit(result.exitCode);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

/**
 * Prints command result to console
 * @param result - Command result to print
 */
function printResult(result: CommandResult): void {
  if (result.success) {
    if (result.message) {
      console.log(result.message);
    }
    if (result.details) {
      console.log(result.details);
    }
  } else {
    // For error results, output to stderr
    if (result.message) {
      console.error(result.message);
    }
    if (result.details) {
      console.error(result.details);
    }
  }
}

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}