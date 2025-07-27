/**
 * '/router' command implementation for Qwen Code Router CLI
 */

import {
  resolveConfigurationByName,
} from '../resolver';
import { loadConfigFile } from '../command-utils';
import { validateEnvironmentVariables } from '../environment';
import { CommandResult } from '../commands';
import { ConfigFile } from '../types';
import { parseFlags } from '../command-args';
import { BUILTIN_PROVIDERS } from './list';

/**
 * Options for the router command
 */
export interface RouterCommandOptions {
  /** Provider name */
  provider: string;
  /** Model name */
  model: string;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
}

/**
 * Implements the '/router [provider] [model]' command
 * Sets configuration via provider and model parameters
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with execution status and message
 */
export async function routerCommand(options: RouterCommandOptions): Promise<CommandResult> {
  try {
    const { provider: inputProvider, model: inputModel } = options;
    const providerKey = inputProvider.toLowerCase();

    // First, try to find a matching configuration in the config file
    let config: ConfigFile;
    let validation: any;
    let filePath: string | undefined;
    let hasConfigFile = true;

    try {
      const result = await loadConfigFile(options.currentDir);
      if (!result.success) {
        // If it's a "not found" error, continue with built-in providers only
        if (result.errorResult.message.includes('not found')) {
          hasConfigFile = false;
          config = { configs: [], providers: [] };
        } else {
          // For other errors, return the error result
          return result.errorResult;
        }
      } else {
        config = result.config;
        validation = result.validation;
        filePath = result.filePath;

        // Check if configuration file is valid
        if (!validation.isValid) {
          return {
            success: false,
            message: 'Configuration file validation failed',
            details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
            exitCode: 1
          };
        }
      }
    } catch (error) {
      // No config file found, we'll use built-in providers only
      hasConfigFile = false;
      config = { configs: [], providers: [] };
    }

    // Look for matching provider and model in configuration file
    let matchingConfig: { name: string; provider: string; model: string } | undefined;
    let configProvider: any;

    if (hasConfigFile) {
      // Find provider in config file (case-insensitive)
      configProvider = config.providers.find(p => p.provider.toLowerCase() === providerKey);

      if (configProvider) {
        // Check if the model exists in this provider
        const modelExists = configProvider.env.models.some((m: any) => m.model.toLowerCase() === inputModel.toLowerCase());

        if (modelExists) {
          // Look for existing configuration that matches this provider/model combination
          matchingConfig = config.configs
            .flatMap(c => c.config)
            .find(c => c.provider.toLowerCase() === providerKey && c.model.toLowerCase() === inputModel.toLowerCase());
        }
      }
    }

    // Check built-in providers
    const builtinProvider = BUILTIN_PROVIDERS[providerKey as keyof typeof BUILTIN_PROVIDERS];
    let builtinModelExists = false;

    if (builtinProvider) {
      builtinModelExists = builtinProvider.models.some(m => m.toLowerCase() === inputModel.toLowerCase());
    }

    // Determine the best match and set environment variables
    let resolvedProvider: string;
    let resolvedModel: string;
    let baseUrl: string;
    let source: string;

    if (matchingConfig) {
      // Use existing configuration
      const resolutionResult = resolveConfigurationByName(matchingConfig.name, config);

      if (!resolutionResult.success) {
        return {
          success: false,
          message: `Failed to activate configuration '${matchingConfig.name}'`,
          details: resolutionResult.error,
          exitCode: 1
        };
      }

      resolvedProvider = matchingConfig.provider;
      resolvedModel = matchingConfig.model;
      baseUrl = configProvider.env.base_url;
      source = `configuration '${matchingConfig.name}'`;
    } else if (configProvider && configProvider.env.models.some((m: any) => m.model.toLowerCase() === inputModel.toLowerCase())) {
      // Use config file provider with direct model match
      const exactModel = configProvider.env.models.find((m: any) => m.model.toLowerCase() === inputModel.toLowerCase());

      // Set environment variables directly
      process.env['OPENAI_API_KEY'] = configProvider.env.api_key;
      process.env['OPENAI_BASE_URL'] = configProvider.env.base_url;
      process.env['OPENAI_MODEL'] = exactModel.model;

      resolvedProvider = configProvider.provider;
      resolvedModel = exactModel.model;
      baseUrl = configProvider.env.base_url;
      source = 'configuration file provider';
    } else if (builtinProvider && builtinModelExists) {
      // Use built-in provider
      const exactModel = builtinProvider.models.find(m => m.toLowerCase() === inputModel.toLowerCase());

      if (!exactModel) {
        return {
          success: false,
          message: `Model '${inputModel}' not found in built-in provider '${inputProvider}'`,
          details: `Available models: ${builtinProvider.models.join(', ')}`,
          exitCode: 1
        };
      }

      // Set environment variables for built-in provider
      // Note: API key needs to be set by user separately
      process.env['OPENAI_BASE_URL'] = builtinProvider.base_url;
      process.env['OPENAI_MODEL'] = exactModel;

      resolvedProvider = inputProvider;
      resolvedModel = exactModel;
      baseUrl = builtinProvider.base_url;
      source = `built-in provider '${builtinProvider.name}'`;

      // Warning about API key
      if (!process.env['OPENAI_API_KEY']) {
        return {
          success: false,
          message: `API key not set for built-in provider '${inputProvider}'`,
          details: `Please set the OPENAI_API_KEY environment variable or configure this provider in your configuration file.`,
          exitCode: 1
        };
      }
    } else {
      // Provider or model not found
      const availableProviders: string[] = [];
      const availableModels: string[] = [];

      // Collect available providers from config file
      if (hasConfigFile) {
        availableProviders.push(...config.providers.map(p => p.provider));
      }

      // Collect available providers from built-in
      availableProviders.push(...Object.keys(BUILTIN_PROVIDERS));

      // If provider exists, collect available models
      if (configProvider) {
        availableModels.push(...configProvider.env.models.map((m: any) => m.model));
      }
      if (builtinProvider) {
        availableModels.push(...builtinProvider.models);
      }

      const uniqueProviders = [...new Set(availableProviders)];
      const uniqueModels = [...new Set(availableModels)];

      if (uniqueModels.length > 0) {
        return {
          success: false,
          message: `Model '${inputModel}' not found in provider '${inputProvider}'`,
          details: `Available models for '${inputProvider}': ${uniqueModels.join(', ')}`,
          exitCode: 1
        };
      } else {
        return {
          success: false,
          message: `Provider '${inputProvider}' not found`,
          details: `Available providers: ${uniqueProviders.join(', ')}`,
          exitCode: 1
        };
      }
    }

    // Validate that environment variables were set correctly
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      return {
        success: false,
        message: 'Environment variables validation failed after router activation',
        details: `Errors: ${envValidation.errors.join(', ')}`,
        exitCode: 1
      };
    }

    // Build success message
    let message = `Successfully activated provider '${resolvedProvider}' with model '${resolvedModel}'`;
    let details = `Source: ${source}`;

    if (options.verbose) {
      details += `\nProvider: ${resolvedProvider}`;
      details += `\nModel: ${resolvedModel}`;
      details += `\nBase URL: ${baseUrl}`;
      details += `\nEnvironment variables set:`;
      details += `\n  OPENAI_API_KEY: ${process.env['OPENAI_API_KEY']?.substring(0, 8)}...`;
      details += `\n  OPENAI_BASE_URL: ${process.env['OPENAI_BASE_URL']}`;
      details += `\n  OPENAI_MODEL: ${process.env['OPENAI_MODEL']}`;

      if (hasConfigFile && filePath) {
        details += `\nConfiguration file: ${filePath}`;
      }

      if (envValidation.warnings.length > 0) {
        details += `\nWarnings: ${envValidation.warnings.join(', ')}`;
      }
    }

    return {
      success: true,
      message,
      details,
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while executing router command',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the router command
 * @returns CommandResult with help information
 */
export function routerCommandHelp(): CommandResult {
  const helpText = `
/router - Quick configuration via provider/model

USAGE:
  /router <provider> <model>

ARGUMENTS:
  provider       Name of the provider (required)
  model          Name of the model (required)

OPTIONS:
  -v, --verbose  Show detailed output including environment variables
  -h, --help     Show this help message

EXAMPLES:
  /router openai gpt-4           # Use OpenAI GPT-4
  /router azure gpt-35-turbo     # Use Azure GPT-3.5 Turbo
  /router anthropic claude-3-opus # Use Anthropic Claude 3 Opus
  /router google gemini-pro -v    # Use Google Gemini Pro with verbose output

DESCRIPTION:
  The '/router' command provides a quick way to activate a provider and model
  combination without needing to know the specific configuration name.
  
  SUPPORTED PROVIDERS:
  Built-in Providers:
  - openai: OpenAI models (gpt-4, gpt-3.5-turbo, etc.)
  - azure: Azure OpenAI models (gpt-4, gpt-35-turbo, etc.)
  - anthropic: Anthropic models (claude-3-opus, claude-3-sonnet, etc.)
  - google: Google AI models (gemini-pro, gemini-1.5-pro, etc.)
  
  Configuration File Providers:
  Any provider defined in your configuration file is supported.
  
  BUILT-IN vs CONFIGURED:
  Built-in providers provide default base URLs and known model lists, but require
  API keys to be set via environment variables. Configured providers in your
  configuration file can have custom settings and embedded API keys.
  
  The command searches for the provider/model combination in the following order:
  1. Existing named configuration in the configuration file
  2. Direct provider/model match in configuration file providers
  3. Built-in provider definitions (OpenAI, Azure, Anthropic, Google)
  
  For built-in providers, you must have the OPENAI_API_KEY environment variable
  set, or configure the provider in your configuration file with API credentials.
  
  The command is case-insensitive for both provider and model names, but will
  preserve the exact case from the configuration when setting environment variables.
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
}

/**
 * Validates command arguments for the router command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseRouterCommandArgs(args: string[]): {
  valid: boolean;
  options?: RouterCommandOptions;
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

  // Check for unknown flags before validating argument count
  for (const arg of args) {
    if (arg && arg.startsWith('-') && arg !== '-h' && arg !== '--help' && arg !== '-v' && arg !== '--verbose') {
      return {
        valid: false,
        error: `Unknown option: ${arg}. Use --help for usage information.`
      };
    }
  }

  // Validate argument count
  if (remainingArgs.length < 2) {
    if (remainingArgs.length === 0) {
      return {
        valid: false,
        error: 'Provider name is required. Use --help for usage information.'
      };
    } else {
      return {
        valid: false,
        error: 'Model name is required. Use --help for usage information.'
      };
    }
  }

  if (remainingArgs.length > 2) {
    return {
      valid: false,
      error: `Too many arguments. Expected provider and model, got: ${remainingArgs.join(', ')}`
    };
  }

  const options: RouterCommandOptions = {
    provider: remainingArgs[0]!,
    model: remainingArgs[1]!,
  };
  
  // Only add verbose property if it was explicitly set
  if (parsedFlags['verbose']) {
    options.verbose = true;
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the router command from CLI
 * @param args - Command line arguments (excluding '/router')
 * @returns Promise<CommandResult>
 */
export async function handleRouterCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseRouterCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
  }

  if (parseResult.showHelp) {
    return routerCommandHelp();
  }

  return await routerCommand(parseResult.options!);
}