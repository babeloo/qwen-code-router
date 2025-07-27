/**
 * 'chk' command implementation for Qwen Code Router CLI
 */

import { loadConfigFile } from '../command-utils';
import { getAllConfigurationNames, getCurrentDefaultConfiguration } from '../resolver';
import { CommandResult } from '../commands';
import { ConfigFile } from '../types';
import { parseFlags, validateArgCount } from '../command-args';

/**
 * Options for the chk command
 */
export interface ChkCommandOptions {
  /** Configuration name to validate (optional - validates all if not provided) */
  configName?: string | undefined;
  /** Current working directory (optional - defaults to process.cwd()) */
  currentDir?: string;
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Whether to test actual API connectivity */
  testApi?: boolean;
}

/**
 * Validation result for a single configuration
 */
export interface ConfigValidationResult {
  /** Configuration name */
  configName: string;
  /** Whether the configuration is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Provider information if found */
  provider?: {
    name: string;
    baseUrl: string;
    modelCount: number;
  };
  /** Model information if found */
  model?: {
    name: string;
    isSupported: boolean;
  };
}

/**
 * Validates a specific configuration with API call
 * @param configName - Name of configuration to validate
 * @param configFile - Configuration file to validate against
 * @param testApi - Whether to test actual API connectivity (default: false)
 * @returns Promise<ConfigValidationResult> with validation details
 */
export async function validateConfigurationWithApi(
  configName: string, 
  configFile: ConfigFile, 
  testApi: boolean = false
): Promise<ConfigValidationResult> {
  // First do static validation
  const result = validateConfiguration(configName, configFile);
  
  // If static validation failed or API testing is disabled, return early
  if (!result.isValid || !testApi) {
    return result;
  }

  // Get the configuration and provider for API testing
  const configEntry = configFile.configs
    .flatMap(c => c.config)
    .find(c => c.name === configName);
  
  const provider = configFile.providers.find(p => p.provider === configEntry!.provider);
  
  if (!provider || !configEntry) {
    return result;
  }

  // Test API connectivity
  try {
    const response = await fetch(`${provider.env.base_url}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.env.api_key}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      result.isValid = false;
      result.errors.push(`API test failed: ${response.status} ${response.statusText}`);
      return result;
    }

    const data = await response.json() as any;
    
    // Check if the configured model is available in the API response
    if (data && data.data && Array.isArray(data.data)) {
      const availableModels = data.data.map((model: any) => model.id);
      if (!availableModels.includes(configEntry.model)) {
        result.isValid = false;
        result.errors.push(`Model '${configEntry.model}' not available in API response`);
      }
    }
    
  } catch (error) {
    result.isValid = false;
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        result.errors.push(`API test timeout: Unable to connect to ${provider.env.base_url}`);
      } else {
        result.errors.push(`API test failed: ${error.message}`);
      }
    } else {
      result.errors.push(`API test failed: Unknown error`);
    }
  }

  return result;
}

/**
 * Validates a specific configuration (static validation only)
 * @param configName - Name of configuration to validate
 * @param configFile - Configuration file to validate against
 * @returns ConfigValidationResult with validation details
 */
export function validateConfiguration(configName: string, configFile: ConfigFile): ConfigValidationResult {
  const result: ConfigValidationResult = {
    configName,
    isValid: true,
    errors: [],
    warnings: []
  };

  // Find the configuration entry
  const configEntry = configFile.configs
    .flatMap(c => c.config)
    .find(c => c.name === configName);

  if (!configEntry) {
    result.isValid = false;
    result.errors.push(`Configuration '${configName}' not found`);
    return result;
  }

  // Validate provider exists
  const provider = configFile.providers.find(p => p.provider === configEntry.provider);
  if (!provider) {
    result.isValid = false;
    result.errors.push(`Provider '${configEntry.provider}' not found in providers section`);
  } else {
    result.provider = {
      name: provider.provider,
      baseUrl: provider.env.base_url,
      modelCount: provider.env.models.length
    };

    // Validate model exists in provider
    const model = provider.env.models.find(m => m.model === configEntry.model);
    if (!model) {
      result.isValid = false;
      result.errors.push(`Model '${configEntry.model}' not found in provider '${configEntry.provider}'`);
    } else {
      result.model = {
        name: model.model,
        isSupported: true
      };
    }

    // Check for API key configuration
    if (!provider.env.api_key) {
      result.warnings.push(`No API key configured for provider '${configEntry.provider}'`);
    }

    // Check for base URL configuration
    if (!provider.env.base_url) {
      result.warnings.push(`No base URL configured for provider '${configEntry.provider}'`);
    }

    // Check if provider has any models
    if (provider.env.models.length === 0) {
      result.warnings.push(`Provider '${configEntry.provider}' has no models configured`);
    }
  }

  // Note: Being the default configuration is not a warning condition
  // It's normal and expected behavior, so we don't add any warning for this

  return result;
}

/**
 * Implements the 'qcr chk [config_name]' command
 * Validates a configuration by name, or all configurations if no name provided
 * 
 * @param options - Command options
 * @returns Promise<CommandResult> with validation results
 */
export async function chkCommand(options: ChkCommandOptions = {}): Promise<CommandResult> {
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

    // Get all available configurations
    const availableConfigs = getAllConfigurationNames(config);

    if (availableConfigs.length === 0) {
      return {
        success: false,
        message: 'No configurations found',
        details: 'Add configurations to your configuration file to validate them.',
        exitCode: 1
      };
    }

    // Determine which configurations to validate
    let configsToValidate: string[];
    if (options.configName) {
      if (!availableConfigs.includes(options.configName)) {
        return {
          success: false,
          message: `Configuration '${options.configName}' does not exist`,
          details: `Available configurations: ${availableConfigs.join(', ')}`,
          exitCode: 1
        };
      }
      configsToValidate = [options.configName];
    } else {
      configsToValidate = availableConfigs;
    }

    // Validate configurations
    const validationResults: ConfigValidationResult[] = [];
    for (const configName of configsToValidate) {
      const result = await validateConfigurationWithApi(configName, config, options.testApi || false);
      validationResults.push(result);
    }

    // Build result message
    const validConfigs = validationResults.filter(r => r.isValid);
    const invalidConfigs = validationResults.filter(r => !r.isValid);

    let message: string;
    let details = '';
    let success = true;

    if (options.configName) {
      // Single configuration validation
      const result = validationResults[0];
      if (!result) {
        return {
          success: false,
          message: 'Internal error: validation result not found',
          exitCode: 1
        };
      }

      if (result.isValid) {
        message = `Configuration '${result.configName}' is valid`;
        if (result.warnings.length > 0) {
          details += `Warnings:\n${result.warnings.map(w => `  - ${w}`).join('\n')}`;
        }
      } else {
        message = `Configuration '${result.configName}' is invalid`;
        details += `Errors:\n${result.errors.map(e => `  - ${e}`).join('\n')}`;
        if (result.warnings.length > 0) {
          details += `\n\nWarnings:\n${result.warnings.map(w => `  - ${w}`).join('\n')}`;
        }
        success = false;
      }

      // Add detailed information in verbose mode
      if (options.verbose) {
        if (result.provider) {
          details += `\n\nProvider details:`;
          details += `\n  Name: ${result.provider.name}`;
          details += `\n  Base URL: ${result.provider.baseUrl}`;
          details += `\n  Available models: ${result.provider.modelCount}`;
        }
        if (result.model) {
          details += `\n\nModel details:`;
          details += `\n  Name: ${result.model.name}`;
          details += `\n  Supported: ${result.model.isSupported ? 'Yes' : 'No'}`;
        }
        details += `\n\nConfiguration file: ${filePath}`;
      }
    } else {
      // Multiple configuration validation
      if (invalidConfigs.length === 0) {
        message = `All ${validConfigs.length} configurations are valid`;
      } else {
        const invalidCount = invalidConfigs.length;
        const totalCount = validationResults.length;
        if (invalidCount === 1) {
          message = `${invalidCount} of ${totalCount} configurations is invalid`;
        } else {
          message = `${invalidCount} of ${totalCount} configurations are invalid`;
        }
        success = false;
      }

      // Get default configuration for marking
      const defaultConfig = getCurrentDefaultConfiguration(config);

      // Build compact configuration list on same line
      const configList: string[] = [];
      const errorDetails: string[] = [];
      
      for (const result of validationResults) {
        const status = result.isValid ? '✓' : '✗';
        const warningCount = result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : '';
        const defaultMarker = result.configName === defaultConfig ? ' (default)' : '';
        configList.push(`${status} ${result.configName}${defaultMarker}${warningCount}`);

        // Collect error details for invalid configurations
        if (!result.isValid && result.errors.length > 0) {
          errorDetails.push(`✗ ${result.configName}\nErrors: ${result.errors.join(', ')}`);
        }
        
        // Collect warning details if verbose mode
        if (options.verbose && result.warnings.length > 0) {
          errorDetails.push(`${status} ${result.configName}\nWarnings: ${result.warnings.join(', ')}`);
        }
      }
      
      // Add the compact configuration list (each on a new line with indentation)
      // All items have two spaces indentation
      if (configList.length > 0) {
        details += '\n  ' + configList.join('\n  ');
      }
      
      // Add error details after the configuration list
      if (errorDetails.length > 0) {
        details += '\n' + errorDetails.join('\n');
      }

      if (options.verbose) {
        details += `\n\nConfiguration file: ${filePath}`;
      }
    }

    return {
      success,
      message,
      details: details.trim(),
      exitCode: success ? 0 : 1
    };
  } catch (error) {
    return {
      success: false,
      message: 'Unexpected error occurred while validating configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1
    };
  }
}

/**
 * Shows help information for the chk command
 * @returns CommandResult with help information
 */
export function chkCommandHelp(): CommandResult {
  const helpText = `
qcr chk - Validate configuration

USAGE:
  qcr chk [config_name]

ARGUMENTS:
  config_name    Name of the configuration to validate (optional)
                 If not provided, validates all configurations

OPTIONS:
  -v, --verbose  Show detailed validation information
  --test-api     Test actual API connectivity (slower but more thorough)
  -h, --help     Show this help message

EXAMPLES:
  qcr chk                    # Validate all configurations (static validation only)
  qcr chk openai-gpt4        # Validate specific configuration
  qcr chk azure-gpt35 -v     # Validate configuration with detailed output
  qcr chk --test-api         # Validate all configurations with API testing

DESCRIPTION:
  The 'chk' command validates configurations to ensure they are properly
  set up and can be used successfully. It performs the following checks:
  
  VALIDATION TYPES:
  Static Validation (default):
  - Configuration exists in the configuration file
  - Referenced provider exists in the providers section
  - Referenced model exists in the provider's model list
  - Provider has required settings (API key, base URL)
  
  API Validation (with --test-api):
  - All static validation checks
  - Actual API connectivity test
  - Verify model availability through API call
  - Provider has required settings (API key, base URL)
  - Provider has at least one model configured
  
  VALIDATION RESULTS:
  ✓ Success - Configuration is valid and ready to use
  ✗ Error - Critical issue preventing configuration from working
  ⚠ Warning - Potential issue or missing optional setting
  
  The command will report errors for critical issues that prevent the
  configuration from working, and warnings for potential issues or
  missing optional settings.
  
  When validating all configurations, the command will show a summary
  of validation results and exit with code 1 if any configuration is invalid.
`;

  return {
    success: true,
    message: helpText.trim(),
    exitCode: 0
  };
}

/**
 * Validates command arguments for the chk command
 * @param args - Command line arguments
 * @returns Validation result with parsed options or error
 */
export function parseChkCommandArgs(args: string[]): {
  valid: boolean;
  options?: ChkCommandOptions;
  error?: string;
  showHelp?: boolean;
} {
  const { parsedFlags, remainingArgs } = parseFlags(args, {
    help: ['-h', '--help'],
    verbose: ['-v', '--verbose'],
    testApi: ['--test-api']
  });

  if (parsedFlags['help']) {
    return { valid: true, showHelp: true };
  }

  // 验证参数数量
  const argValidation = validateArgCount(remainingArgs, 0, 1, 'Too many arguments');
  if (!argValidation.valid) {
    return {
      valid: false,
      error: argValidation.error || 'Too many arguments'
    };
  }

  const options: ChkCommandOptions = {
    verbose: parsedFlags['verbose'] || false,
    testApi: parsedFlags['testApi'] || false
  };

  if (remainingArgs.length > 0) {
    options.configName = remainingArgs[0];
  }

  return {
    valid: true,
    options
  };
}

/**
 * Main entry point for the chk command from CLI
 * @param args - Command line arguments (excluding 'qcr chk')
 * @returns Promise<CommandResult>
 */
export async function handleChkCommand(args: string[]): Promise<CommandResult> {
  const parseResult = parseChkCommandArgs(args);

  if (!parseResult.valid) {
    return {
      success: false,
      message: parseResult.error || 'Invalid arguments',
      exitCode: 1
    };
  }

  if (parseResult.showHelp) {
    return chkCommandHelp();
  }

  return await chkCommand(parseResult.options);
}