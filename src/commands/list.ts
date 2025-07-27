/**
 * 'list' command implementation for Qwen Code Router CLI
 */

import { loadConfigFile } from '../command-utils';
import { CommandResult, listConfigurations } from '../commands';
import { ConfigFile } from '../types';
import { parseFlags } from '../command-args';

/**
 * Built-in provider definitions with their known models
 */
export const BUILTIN_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4-0125-preview',
      'gpt-4-1106-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
      'gpt-3.5-turbo-16k'
    ]
  },
  azure: {
    name: 'Azure OpenAI',
    base_url: 'https://[resource].openai.azure.com/openai',
    models: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-32k',
      'gpt-35-turbo',
      'gpt-35-turbo-16k'
    ]
  },
  anthropic: {
    name: 'Anthropic',
    base_url: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ]
  },
  google: {
    name: 'Google AI',
    base_url: 'https://generativelanguage.googleapis.com/v1',
    models: [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
  }
} as const;

/**
 * Options for the list command
 */
export interface ListCommandOptions {
  /** Subcommand to execute (config, provider, etc.) */
  subcommand?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show all providers and models in tree structure */
  all?: boolean;
  /** Whether to show providers and models in tree structure (--tree flag) */
  tree?: boolean;
  /** Specific provider to show models for */
  provider?: string;
  /** Whether to use short form (-p instead of provider) */
  shortForm?: boolean;
  /** Whether to list built-in providers (-f flag) */
  builtinProviders?: boolean;
}

/**
 * Implements the 'qcr list config' command
 * Lists all available configurations with their details
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with configuration list
 */
export async function listConfigCommand(options: ListCommandOptions = {}): Promise<CommandResult> {
  try {
    // Load configuration file
    const loadResult = await loadConfigFile(options.currentDir);
    
    if (!loadResult.success) {
      return loadResult.errorResult;
    }
    
    const { config, validation, filePath } = loadResult;

    // Check if configuration file is valid
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Configuration file validation failed',
        details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
        exitCode: 1
      };
    }

    // Use the existing listConfigurations function
    const result = listConfigurations(config, { verbose: options.verbose || false });

    // Add configuration file path to verbose output
    if (options.verbose && result.success && result.details) {
      result.details += `\n\nConfiguration file: ${filePath}`;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while listing configurations',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Lists built-in providers and their models
 * @param options - Display options
 * @returns CommandResult with built-in provider list
 */
export function listBuiltinProviders(
  options: { verbose?: boolean; provider?: string } = {}
): CommandResult {
  try {
    const providerKeys = Object.keys(BUILTIN_PROVIDERS) as (keyof typeof BUILTIN_PROVIDERS)[];

    // If specific provider requested
    if (options.provider) {
      const providerKey = providerKeys.find(key =>
        key.toLowerCase() === options.provider!.toLowerCase()
      );

      if (!providerKey) {
        return {
          success: false,
          message: `Built-in provider '${options.provider}' not found`,
          details: `Available built-in providers: ${providerKeys.join(', ')}`,
          exitCode: 1
        };
      }

      const provider = BUILTIN_PROVIDERS[providerKey];
      let message = `Models for built-in provider '${providerKey}' (${provider.name}):`;
      let details = '';

      for (const model of provider.models) {
        details += `\n  ${model}`;
      }

      if (options.verbose) {
        details += `\n\nProvider details:`;
        details += `\n  Name: ${provider.name}`;
        details += `\n  Base URL: ${provider.base_url}`;
        details += `\n  Total models: ${provider.models.length}`;
      }

      return {
        success: true,
        message,
        details: details.trim(),
        exitCode: 0
      };
    }

    // Default: list all built-in providers
    let message = 'Available built-in providers:';
    let details = '';

    for (const providerKey of providerKeys) {
      const provider = BUILTIN_PROVIDERS[providerKey];
      if (options.verbose) {
        details += `\n  ${providerKey} (${provider.name}) - ${provider.models.length} models`;
        details += `\n    Base URL: ${provider.base_url}`;
      } else {
        details += `\n  ${providerKey} (${provider.name})`;
      }
    }

    if (!options.verbose) {
      details += `\n\nUse 'qcr list -f [provider]' to see models for a specific provider.`;
    }

    return {
      success: true,
      message,
      details: details.trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to list built-in providers',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Lists all available providers from configuration file
 * @param configFile - Configuration file to list from
 * @param options - Display options
 * @returns CommandResult with provider list
 */
export function listProviders(
  configFile: ConfigFile,
  options: { verbose?: boolean; all?: boolean; tree?: boolean; provider?: string; comprehensive?: boolean } = {}
): CommandResult {
  try {
    if (configFile.providers.length === 0) {
      return {
        success: true,
        message: 'No providers found',
        details: 'Add providers to your configuration file to get started.',
        exitCode: 0
      };
    }

    // If specific provider requested
    if (options.provider) {
      const provider = configFile.providers.find(p => p.provider.toLowerCase() === options.provider!.toLowerCase());

      // If comprehensive flag is set, merge with built-in providers
      if (options.comprehensive) {
        const providerKey = options.provider.toLowerCase();
        const builtinProvider = BUILTIN_PROVIDERS[providerKey as keyof typeof BUILTIN_PROVIDERS];

        if (!provider && !builtinProvider) {
          const availableProviders = [
            ...configFile.providers.map(p => p.provider),
            ...Object.keys(BUILTIN_PROVIDERS)
          ];
          return {
            success: false,
            message: `Provider '${options.provider}' not found`,
            details: `Available providers: ${[...new Set(availableProviders)].join(', ')}`,
            exitCode: 1
          };
        }

        // Merge models from both sources
        const allModels = new Set<string>();
        let baseUrl = '';
        let providerName = options.provider;  // Keep original case

        // Add models from configuration file
        if (provider) {
          provider.env.models.forEach(model => allModels.add(model.model));
          baseUrl = provider.env.base_url;
          // Keep original case from input, not from config
        }

        // Add models from built-in provider
        if (builtinProvider) {
          builtinProvider.models.forEach(model => allModels.add(model));
          if (!baseUrl) {
            baseUrl = builtinProvider.base_url;
          }
        }

        let message = `All available models for provider '${providerName}':`;
        let details = '';

        const sortedModels = Array.from(allModels).sort();
        for (const model of sortedModels) {
          details += `\n  ${model}`;
        }

        if (options.verbose) {
          details += `\n\nProvider details:`;
          details += `\n  Base URL: ${baseUrl}`;
          details += `\n  Total models: ${sortedModels.length}`;
          if (provider && builtinProvider) {
            details += `\n  Sources: Configuration file + Built-in definitions`;
          } else if (provider) {
            details += `\n  Source: Configuration file only`;
          } else {
            details += `\n  Source: Built-in definitions only`;
          }
        }

        return {
          success: true,
          message,
          details: details.trim(),
          exitCode: 0
        };
      }

      // Standard provider listing (configuration file only)
      if (!provider) {
        const availableProviders = configFile.providers.map(p => p.provider);
        return {
          success: false,
          message: `Provider '${options.provider}' not found`,
          details: `Available providers: ${availableProviders.join(', ')}`,
          exitCode: 1
        };
      }

      let message = `Models for provider '${provider.provider}':`;
      let details = '';

      for (const model of provider.env.models) {
        details += `\n  ${model.model}`;
      }

      if (options.verbose) {
        details += `\n\nProvider details:`;
        details += `\n  Base URL: ${provider.env.base_url}`;
        details += `\n  Total models: ${provider.env.models.length}`;
      }

      return {
        success: true,
        message,
        details: details.trim(),
        exitCode: 0
      };
    }

    // If --all or --tree flag is used, show tree structure
    if (options.all || options.tree) {
      let message = 'Available providers and models:';
      let details = '';

      if (options.comprehensive) {
        // Merge configuration file providers and built-in providers
        const allProviders = new Map<string, { models: Set<string>; baseUrl: string; source: string }>();

        // Add configuration file providers
        for (const provider of configFile.providers) {
          const providerKey = provider.provider.toLowerCase();
          if (!allProviders.has(providerKey)) {
            allProviders.set(providerKey, {
              models: new Set(),
              baseUrl: provider.env.base_url,
              source: 'config'
            });
          }
          const providerData = allProviders.get(providerKey)!;
          provider.env.models.forEach(model => providerData.models.add(model.model));
        }

        // Add built-in providers
        for (const [providerKey, builtinProvider] of Object.entries(BUILTIN_PROVIDERS)) {
          if (!allProviders.has(providerKey)) {
            allProviders.set(providerKey, {
              models: new Set(),
              baseUrl: builtinProvider.base_url,
              source: 'builtin'
            });
          }
          const providerData = allProviders.get(providerKey)!;
          builtinProvider.models.forEach(model => providerData.models.add(model));
          if (providerData.source === 'config') {
            providerData.source = 'both';
          }
        }

        // Display merged providers
        for (const [providerName, providerData] of Array.from(allProviders.entries()).sort()) {
          details += `\n${providerName}`;
          const sortedModels = Array.from(providerData.models).sort();
          for (const model of sortedModels) {
            details += `\n  └─ ${model}`;
          }
          if (options.verbose) {
            details += `\n     Base URL: ${providerData.baseUrl}`;
            details += `\n     Source: ${providerData.source === 'both' ? 'Configuration + Built-in' :
              providerData.source === 'config' ? 'Configuration file' : 'Built-in'}`;
          }
        }
      } else {
        // Show only configuration file providers
        for (const provider of configFile.providers) {
          details += `\n${provider.provider}`;
          for (const model of provider.env.models) {
            details += `\n  └─ ${model.model}`;
          }
          if (options.verbose) {
            details += `\n     Base URL: ${provider.env.base_url}`;
          }
        }
      }

      return {
        success: true,
        message,
        details: details.trim(),
        exitCode: 0
      };
    }

    // Default: just list provider names
    let message = 'Available providers:';
    let details = '';

    if (options.comprehensive) {
      // Merge configuration file providers and built-in providers
      const allProviders = new Map<string, { modelCount: number; baseUrl: string; source: string }>();

      // Add configuration file providers
      for (const provider of configFile.providers) {
        const providerKey = provider.provider.toLowerCase();
        allProviders.set(providerKey, {
          modelCount: provider.env.models.length,
          baseUrl: provider.env.base_url,
          source: 'config'
        });
      }

      // Add built-in providers
      for (const [providerKey, builtinProvider] of Object.entries(BUILTIN_PROVIDERS)) {
        if (allProviders.has(providerKey)) {
          // Provider exists in both, merge model counts
          const existing = allProviders.get(providerKey)!;
          const configModels = new Set(configFile.providers.find(p => p.provider.toLowerCase() === providerKey)?.env.models.map(m => m.model) || []);
          const builtinModels = new Set(builtinProvider.models);
          const mergedModels = new Set([...configModels, ...builtinModels]);
          existing.modelCount = mergedModels.size;
          existing.source = 'both';
        } else {
          // Only built-in provider
          allProviders.set(providerKey, {
            modelCount: builtinProvider.models.length,
            baseUrl: builtinProvider.base_url,
            source: 'builtin'
          });
        }
      }

      // Display merged providers
      for (const [providerName, providerData] of Array.from(allProviders.entries()).sort()) {
        if (options.verbose) {
          const sourceText = providerData.source === 'both' ? 'Configuration + Built-in' :
            providerData.source === 'config' ? 'Configuration file' : 'Built-in';
          details += `\n  ${providerName} - ${providerData.modelCount} models (${providerData.baseUrl}) [${sourceText}]`;
        } else {
          details += `\n  ${providerName}`;
        }
      }
    } else {
      // Show only configuration file providers
      for (const provider of configFile.providers) {
        if (options.verbose) {
          details += `\n  ${provider.provider} - ${provider.env.models.length} models (${provider.env.base_url})`;
        } else {
          details += `\n  ${provider.provider}`;
        }
      }
    }

    return {
      success: true,
      message,
      details: details.trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to list providers',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Implements the 'qcr list provider', 'qcr list -p', and 'qcr list -f' commands
 * Lists providers and their models from configuration file or built-in providers
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with provider list
 */
export async function listProviderCommand(options: ListCommandOptions = {}): Promise<CommandResult> {
  try {
    // If built-in providers flag is set, use built-in providers
    if (options.builtinProviders) {
      const builtinOptions: { verbose?: boolean; provider?: string } = {
        verbose: options.verbose || false
      };

      if (options.provider) {
        builtinOptions.provider = options.provider;
      }

      return listBuiltinProviders(builtinOptions);
    }

    // Otherwise, use configuration file providers
    // Load configuration file
    const loadResult = await loadConfigFile(options.currentDir);
    
    if (!loadResult.success) {
      return loadResult.errorResult;
    }
    
    const { config, validation, filePath } = loadResult;

    // Check if configuration file is valid
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Configuration file validation failed',
        details: validation.errors.length > 0 ? `Errors: ${validation.errors.join(', ')}` : undefined,
        exitCode: 1
      };
    }

    // Use the listProviders function
    const providerOptions: { verbose?: boolean; all?: boolean; provider?: string; tree?: boolean; comprehensive?: boolean } = {
      verbose: options.verbose || false,
      all: options.all || false,
      tree: options.tree || false,
      comprehensive: options.all || false  // Enable comprehensive mode when --all is used
    };

    if (options.provider) {
      providerOptions.provider = options.provider;
      providerOptions.comprehensive = options.all || false;  // Enable comprehensive mode for specific provider with --all
    }

    const result = listProviders(config, providerOptions);

    // Add configuration file path to verbose output
    if (options.verbose && result.success && result.details) {
      result.details += `\n\nConfiguration file: ${filePath}`;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while listing providers',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the list command
 * @returns CommandResult with help information
 */
export function listCommandHelp(): CommandResult {
  const helpText = `
qcr list - List configurations and providers

USAGE:
  qcr list <subcommand> [options]
  qcr list -p [options]
  qcr list -f [provider]

SUBCOMMANDS:
  config                List all available configurations
  provider              List all available providers from configuration file
  provider --tree       Show providers and models in tree structure
  provider --builtin    List built-in known providers
  provider --all        Show all providers and models in tree structure

OPTIONS:
  -v, --verbose         Show detailed output including provider and model information
  -h, --help           Show this help message
  --all                 Show providers and models in tree structure (with -p)
  --tree                Show providers and models in tree structure (with provider)
  [provider_name]       Show models for specific provider (with -p or -f)

EXAMPLES:
  qcr list config              # List all configurations
  qcr list config -v           # List configurations with detailed information
  qcr list provider            # List all providers from configuration file
  qcr list -p                  # List all providers from configuration file (short form)
  qcr list -p --all            # List providers and models in tree structure
  qcr list provider --tree     # List providers and models in tree structure
  qcr list -p openai           # List models for openai provider from configuration file
  qcr list -f                  # List all built-in known providers
  qcr list -f openai           # List models for built-in openai provider
  qcr list provider -v         # List providers with detailed information
  qcr list provider --builtin  # List built-in providers (same as -f)
  qcr list provider --all openai # List all models for openai provider

DESCRIPTION:
  The 'list' command provides various listing capabilities for configurations
  and providers. Use the appropriate subcommand to list the desired information.
  
  The 'config' subcommand shows all available configurations from the
  configuration file, highlighting the default configuration if one is set.
  
  The 'provider' subcommand (or '-p' short form) shows providers from the
  configuration file. Use --all or --tree to see a tree structure of providers and
  their models, or specify a provider name to see models for that provider.
  
  The '-f' flag shows built-in known providers (OpenAI, Azure, Anthropic, Google)
  with their predefined models. This doesn't require a configuration file.
  
  Use the verbose option (-v) to see additional details including base URLs
  and model counts for providers.

BUILT-IN PROVIDERS:
  The built-in providers are:
  - openai: OpenAI models (gpt-4, gpt-3.5-turbo, etc.)
  - azure: Azure OpenAI models (gpt-4, gpt-35-turbo, etc.)
  - anthropic: Anthropic models (claude-3-opus, claude-3-sonnet, etc.)
  - google: Google AI models (gemini-pro, gemini-1.5-pro, etc.)
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
}

/**
 * Validates command arguments for the list command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseListCommandArgs(args: string[]): {
  valid: boolean;
  options?: ListCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  // Check for unknown flags first
  for (const arg of args) {
    if (arg && arg.startsWith('-') && 
        arg !== '-h' && arg !== '--help' && 
        arg !== '-v' && arg !== '--verbose' &&
        arg !== '-p' && 
        arg !== '-f' &&
        arg !== '--all' && 
        arg !== '--tree') {
      return {
        valid: false,
        error: `Unknown option: ${arg}. Use --help for usage information.`
      };
    }
  }

  const { parsedFlags, remainingArgs } = parseFlags(args, {
    help: ['-h', '--help'],
    verbose: ['-v', '--verbose'],
    all: ['--all'],
    tree: ['--tree'],
    shortForm: ['-p'],
    builtinProviders: ['-f']
  });

  if (parsedFlags['help']) {
    return { valid: true, showHelp: true };
  }

  const options: ListCommandOptions = {};
  
  // Only add properties if they were explicitly set
  if (parsedFlags['verbose']) {
    options.verbose = true;
  }
  if (parsedFlags['all']) {
    options.all = true;
  }
  if (parsedFlags['tree']) {
    options.tree = true;
  }
  if (parsedFlags['shortForm']) {
    options.shortForm = true;
  }
  if (parsedFlags['builtinProviders']) {
    options.builtinProviders = true;
  }

  let subcommand: string | undefined;
  let providerName: string | undefined;

  // Parse remaining arguments
  for (let i = 0; i < remainingArgs.length; i++) {
    const arg = remainingArgs[i];

    if (!arg) continue; // Skip undefined/empty arguments

    // This could be a subcommand or provider name
    if (subcommand === undefined) {
      // Special handling for when -p is used - 'arg' is actually a provider name, not a subcommand
      if (options.shortForm && !options.builtinProviders) {
        subcommand = 'provider';
        providerName = arg;
      } 
      // Special handling for when -f is used - 'arg' is actually a provider name, not a subcommand
      else if (options.builtinProviders) {
        subcommand = 'provider';
        providerName = arg;
      } else {
        subcommand = arg;
      }
    } else if (subcommand === 'provider' && providerName === undefined) {
      providerName = arg;
    } else {
      return {
        valid: false,
        error: `Too many arguments. Unexpected argument: ${arg}`
      };
    }
  }

  // Validate subcommand
  if (subcommand && !['config', 'provider'].includes(subcommand) && !options.builtinProviders) {
    return {
      valid: false,
      error: `Unknown subcommand: ${subcommand}. Available subcommands: config, provider`
    };
  }

  // Validate --all flag usage with built-in providers (must be done before other validations)
  if (options.all && options.builtinProviders) {
    return {
      valid: false,
      error: '--all flag cannot be used with -f (built-in providers) flag'
    };
  }

  // Validate --tree flag usage with built-in providers (must be done before other validations)
  if (options.tree && options.builtinProviders) {
    return {
      valid: false,
      error: '--tree flag cannot be used with -f (built-in providers) flag'
    };
  }

  // Validate --all flag usage
  if (options.all && !(subcommand === 'provider' || options.shortForm)) {
    return {
      valid: false,
      error: '--all flag can only be used with provider subcommand'
    };
  }

  // Validate --tree flag usage
  if (options.tree && !(subcommand === 'provider' || options.shortForm)) {
    return {
      valid: false,
      error: '--tree flag can only be used with provider subcommand'
    };
  }

  // Validate provider name usage
  if (providerName && !(subcommand === 'provider' || options.shortForm || options.builtinProviders)) {
    return {
      valid: false,
      error: 'Provider name can only be specified with provider subcommand'
    };
  }

  if (subcommand !== undefined) {
    options.subcommand = subcommand;
  }

  if (providerName !== undefined) {
    options.provider = providerName;
  }

  // If short form is used, set subcommand to provider
  if (options.shortForm && !options.subcommand && !subcommand) {
    options.subcommand = 'provider';
    subcommand = 'provider';
  }

  // If builtin providers flag is used, set subcommand to provider
  if (options.builtinProviders && !options.subcommand && !subcommand) {
    options.subcommand = 'provider';
    subcommand = 'provider';
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the list command from CLI
 * @param args - Command line arguments (excluding 'qcr list')
 * @returns Promise<CommandResult>
 */
export async function handleListCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseListCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
  }

  if (parseResult.showHelp) {
    return listCommandHelp();
  }

  const options = parseResult.options!;

  // Handle different subcommands
  switch (options.subcommand) {
    case 'config':
      return await listConfigCommand(options);
    case 'provider':
      return await listProviderCommand(options);
    case undefined:
      // No subcommand provided, show help
      return listCommandHelp();
    default:
      return {
        success: false,
        message: `Unknown subcommand: ${options.subcommand}`,
        details: 'Use "qcr list --help" to see available subcommands.',
        exitCode: 1
      };
  }
}