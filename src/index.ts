// Main entry point for Qwen Code Router
export * from './types';
import { handleUseCommand, handleRunCommand, handleSetDefaultCommand, handleListCommand, handleChkCommand, CommandResult } from './commands';

/**
 * Main CLI handler function
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  
  let result: CommandResult;
  
  try {
    switch (command) {
      case 'use':
        result = await handleUseCommand(commandArgs);
        break;
      case 'run':
        result = await handleRunCommand(commandArgs);
        break;
      case 'set-default':
        result = await handleSetDefaultCommand(commandArgs);
        break;
      case 'list':
        result = await handleListCommand(commandArgs);
        break;
      case 'chk':
        result = await handleChkCommand(commandArgs);
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        result = {
          success: false,
          message: `Unknown command: ${command}`,
          details: 'Use "qcr help" to see available commands.',
          exitCode: 1
        };
    }
    
    // Output result
    if (result.success) {
      console.log(result.message);
      if (result.details) {
        console.log(result.details);
      }
    } else {
      console.error(`Error: ${result.message}`);
      if (result.details) {
        console.error(result.details);
      }
    }
    
    process.exit(result.exitCode);
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Shows general help information
 */
function showHelp(): void {
  const helpText = `
Qwen Code Router - Manage API configurations for Qwen Code

USAGE:
  qcr <command> [options]

COMMANDS:
  use [config_name]     Activate a configuration by name
  run [args...]         Launch Qwen Code with active configuration
  set-default <name>    Set default configuration
  list <subcommand>     List configurations and providers
  chk [config_name]     Validate configuration(s)
  help                  Show this help message

OPTIONS:
  -h, --help           Show help for a command
  -v, --verbose        Show detailed output

EXAMPLES:
  qcr use openai-gpt4   # Activate the openai-gpt4 configuration
  qcr run               # Launch Qwen Code with active configuration
  qcr run --help        # Show Qwen Code help (passes --help to qwen)

For more information about a specific command, use:
  qcr <command> --help

CONFIGURATION:
  Qwen Code Router looks for configuration files in the following order:
  1. ./config.yaml or ./config.json (current directory)
  2. ~/.qcr/config.yaml or ~/.qcr/config.json (user directory)

Visit https://github.com/QwenLM/qwen-code for Qwen Code installation.
`;
  
  console.log(helpText.trim());
}