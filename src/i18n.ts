/**
 * Internationalization support for Qwen Code Router
 * 
 * This module provides bilingual support (English and Chinese) for error messages,
 * help text, and user-facing content to ensure accessibility for international users.
 */

/**
 * Supported languages
 */
export enum Language {
  ENGLISH = 'en',
  CHINESE = 'zh'
}

/**
 * Language detection based on environment
 */
export function detectLanguage(): Language {
  // Check environment variables for language preference
  const lang = process.env['LANG'] || process.env['LANGUAGE'] || process.env['LC_ALL'] || '';
  
  // Check for Chinese language indicators
  if (lang.toLowerCase().includes('zh') || 
      lang.toLowerCase().includes('chinese') ||
      lang.toLowerCase().includes('cn')) {
    return Language.CHINESE;
  }
  
  // Default to English
  return Language.ENGLISH;
}

/**
 * Bilingual text structure
 */
export interface BilingualText {
  en: string;
  zh: string;
}

/**
 * Gets text in the appropriate language
 * @param text - Bilingual text object
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Text in the specified language
 */
export function getText(text: BilingualText, language?: Language): string {
  const targetLang = language || detectLanguage();
  return text[targetLang] || text.en; // Fallback to English if translation missing
}

/**
 * Common bilingual messages
 */
export const MESSAGES = {
  TOOL_NAME: {
    en: 'Qwen Code Router',
    zh: 'Qwen Code API 切换器'
  },
  
  TOOL_DESCRIPTION: {
    en: 'Manage API configurations for Qwen Code',
    zh: '管理 Qwen Code 的 API 配置'
  },

  // Configuration related messages
  CONFIG_FILE_NOT_FOUND: {
    en: 'Configuration file not found',
    zh: '未找到配置文件'
  },

  CONFIG_VALIDATION_FAILED: {
    en: 'Configuration file validation failed',
    zh: '配置文件验证失败'
  },

  CONFIG_NOT_FOUND: {
    en: 'Configuration not found',
    zh: '未找到配置'
  },

  DEFAULT_CONFIG_NOT_SET: {
    en: 'No default configuration set',
    zh: '未设置默认配置'
  },

  // Environment related messages
  ENV_VARS_NOT_SET: {
    en: 'Required environment variables are not set',
    zh: '未设置必需的环境变量'
  },

  ENV_VALIDATION_FAILED: {
    en: 'Environment variables validation failed',
    zh: '环境变量验证失败'
  },

  // Command related messages
  COMMAND_NOT_FOUND: {
    en: 'Unknown command',
    zh: '未知命令'
  },

  INVALID_ARGUMENTS: {
    en: 'Invalid arguments',
    zh: '无效参数'
  },

  // Success messages
  CONFIG_ACTIVATED: {
    en: 'Configuration activated successfully',
    zh: '配置激活成功'
  },

  DEFAULT_CONFIG_SET: {
    en: 'Default configuration set successfully',
    zh: '默认配置设置成功'
  },

  QWEN_CODE_LAUNCHED: {
    en: 'Qwen Code launched successfully',
    zh: 'Qwen Code 启动成功'
  },

  // Common terms
  PROVIDER: {
    en: 'Provider',
    zh: '提供商'
  },

  MODEL: {
    en: 'Model',
    zh: '模型'
  },

  CONFIGURATION: {
    en: 'Configuration',
    zh: '配置'
  },

  AVAILABLE_OPTIONS: {
    en: 'Available options',
    zh: '可用选项'
  },

  SUGGESTIONS: {
    en: 'Suggestions',
    zh: '建议'
  },

  EXAMPLES: {
    en: 'Examples',
    zh: '示例'
  },

  USAGE: {
    en: 'Usage',
    zh: '用法'
  },

  DESCRIPTION: {
    en: 'Description',
    zh: '描述'
  },

  OPTIONS: {
    en: 'Options',
    zh: '选项'
  },

  COMMANDS: {
    en: 'Commands',
    zh: '命令'
  },

  // Help and documentation
  HELP_HEADER: {
    en: 'For more information about a specific command, use:',
    zh: '要获取特定命令的更多信息，请使用：'
  },

  CONFIGURATION_FILE_LOCATIONS: {
    en: 'Configuration file locations',
    zh: '配置文件位置'
  },

  QWEN_CODE_INSTALLATION: {
    en: 'Visit https://github.com/QwenLM/qwen-code for Qwen Code installation',
    zh: '访问 https://github.com/QwenLM/qwen-code 获取 Qwen Code 安装信息'
  }
};

/**
 * Common bilingual suggestions
 */
export const SUGGESTIONS = {
  CREATE_CONFIG_FILE: {
    en: 'Create a configuration file in your current directory or user directory',
    zh: '在当前目录或用户目录中创建配置文件'
  },

  CHECK_FILE_PERMISSIONS: {
    en: 'Check file permissions and accessibility',
    zh: '检查文件权限和可访问性'
  },

  USE_EXAMPLE_CONFIG: {
    en: 'Use the example configuration files as a reference',
    zh: '使用示例配置文件作为参考'
  },

  SET_DEFAULT_CONFIG: {
    en: 'Set a default configuration using "qcr set-default [config_name]"',
    zh: '使用 "qcr set-default [config_name]" 设置默认配置'
  },

  LIST_AVAILABLE_CONFIGS: {
    en: 'Use "qcr list config" to see all available configurations',
    zh: '使用 "qcr list config" 查看所有可用配置'
  },

  ACTIVATE_CONFIG_FIRST: {
    en: 'Use "qcr use [config_name]" to activate a configuration',
    zh: '使用 "qcr use [config_name]" 激活配置'
  },

  INSTALL_QWEN_CODE: {
    en: 'Ensure Qwen Code is installed and available in your PATH',
    zh: '确保 Qwen Code 已安装并在 PATH 中可用'
  },

  CHECK_API_KEY: {
    en: 'Verify API key format and validity',
    zh: '验证 API 密钥格式和有效性'
  },

  CHECK_INTERNET_CONNECTION: {
    en: 'Check your internet connection',
    zh: '检查网络连接'
  }
};

/**
 * Formats error messages with bilingual support
 * @param messageKey - Message key from MESSAGES
 * @param details - Additional details (optional)
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted error message
 */
export function formatErrorMessage(
  messageKey: keyof typeof MESSAGES,
  details?: string,
  language?: Language
): string {
  const message = getText(MESSAGES[messageKey], language);
  
  if (details) {
    return `${message}: ${details}`;
  }
  
  return message;
}

/**
 * Formats success messages with bilingual support
 * @param messageKey - Message key from MESSAGES
 * @param details - Additional details (optional)
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted success message
 */
export function formatSuccessMessage(
  messageKey: keyof typeof MESSAGES,
  details?: string,
  language?: Language
): string {
  const message = getText(MESSAGES[messageKey], language);
  
  if (details) {
    return `${message}: ${details}`;
  }
  
  return message;
}

/**
 * Formats suggestion lists with bilingual support
 * @param suggestions - Array of suggestion keys
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted suggestion list
 */
export function formatSuggestions(
  suggestions: (keyof typeof SUGGESTIONS)[],
  language?: Language
): string[] {
  return suggestions.map(key => getText(SUGGESTIONS[key], language));
}

/**
 * Gets bilingual tool name with both English and Chinese
 * @returns Tool name in both languages
 */
export function getToolName(): string {
  return `${MESSAGES.TOOL_NAME.en} (${MESSAGES.TOOL_NAME.zh})`;
}

/**
 * Gets localized tool name based on detected language
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Tool name in the specified language
 */
export function getLocalizedToolName(language?: Language): string {
  return getText(MESSAGES.TOOL_NAME, language);
}

/**
 * Checks if the current environment prefers Chinese language
 * @returns True if Chinese is preferred, false otherwise
 */
export function isChinesePreferred(): boolean {
  return detectLanguage() === Language.CHINESE;
}

/**
 * Formats command usage with bilingual support
 * @param command - Command name
 * @param usage - Usage pattern
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted usage string
 */
export function formatUsage(command: string, usage: string, language?: Language): string {
  const usageLabel = getText(MESSAGES.USAGE, language);
  return `${usageLabel}: ${command} ${usage}`;
}

/**
 * Formats available options with bilingual support
 * @param options - Array of available options
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted options string
 */
export function formatAvailableOptions(options: string[], language?: Language): string {
  const optionsLabel = getText(MESSAGES.AVAILABLE_OPTIONS, language);
  return `${optionsLabel}:\n${options.map(opt => `  - ${opt}`).join('\n')}`;
}

/**
 * Formats suggestion list with bilingual support
 * @param suggestions - Array of suggestions
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted suggestions string
 */
export function formatSuggestionList(suggestions: string[], language?: Language): string {
  const suggestionsLabel = getText(MESSAGES.SUGGESTIONS, language);
  return `${suggestionsLabel}:\n${suggestions.map(sug => `  • ${sug}`).join('\n')}`;
}

/**
 * Common bilingual help sections
 */
export const HELP_SECTIONS = {
  GETTING_STARTED: {
    en: 'Getting Started',
    zh: '入门指南'
  },

  CONFIGURATION: {
    en: 'Configuration',
    zh: '配置'
  },

  TROUBLESHOOTING: {
    en: 'Troubleshooting',
    zh: '故障排除'
  },

  EXAMPLES: {
    en: 'Examples',
    zh: '示例'
  },

  PREREQUISITES: {
    en: 'Prerequisites',
    zh: '前提条件'
  },

  BEHAVIOR: {
    en: 'Behavior',
    zh: '行为'
  },

  ERROR_HANDLING: {
    en: 'Error Handling',
    zh: '错误处理'
  },

  RELATED_COMMANDS: {
    en: 'Related Commands',
    zh: '相关命令'
  }
};

/**
 * Gets help section header with bilingual support
 * @param sectionKey - Section key from HELP_SECTIONS
 * @param language - Target language (optional, auto-detected if not provided)
 * @returns Formatted section header
 */
export function getHelpSectionHeader(
  sectionKey: keyof typeof HELP_SECTIONS,
  language?: Language
): string {
  return getText(HELP_SECTIONS[sectionKey], language).toUpperCase() + ':';
}