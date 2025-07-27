/**
 * Tests for internationalization support
 */

import {
  Language,
  detectLanguage,
  getText,
  formatErrorMessage,
  formatSuccessMessage,
  formatSuggestions,
  getToolName,
  getLocalizedToolName,
  isChinesePreferred,
  formatUsage,
  formatAvailableOptions,
  formatSuggestionList,
  getHelpSectionHeader,
  MESSAGES,
  SUGGESTIONS,
  HELP_SECTIONS
} from '../src/i18n';

describe('Internationalization System', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('Language Detection', () => {
    it('should detect Chinese from LANG environment variable', () => {
      process.env['LANG'] = 'zh_CN.UTF-8';
      expect(detectLanguage()).toBe(Language.CHINESE);

      process.env['LANG'] = 'zh_TW.UTF-8';
      expect(detectLanguage()).toBe(Language.CHINESE);

      process.env['LANG'] = 'chinese';
      expect(detectLanguage()).toBe(Language.CHINESE);
    });

    it('should detect Chinese from LANGUAGE environment variable', () => {
      delete process.env['LANG'];
      process.env['LANGUAGE'] = 'zh:en';
      expect(detectLanguage()).toBe(Language.CHINESE);
    });

    it('should detect Chinese from LC_ALL environment variable', () => {
      delete process.env['LANG'];
      delete process.env['LANGUAGE'];
      process.env['LC_ALL'] = 'zh_CN.UTF-8';
      expect(detectLanguage()).toBe(Language.CHINESE);
    });

    it('should default to English when no Chinese indicators found', () => {
      delete process.env['LANG'];
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      expect(detectLanguage()).toBe(Language.ENGLISH);

      process.env['LANG'] = 'en_US.UTF-8';
      expect(detectLanguage()).toBe(Language.ENGLISH);

      process.env['LANG'] = 'fr_FR.UTF-8';
      expect(detectLanguage()).toBe(Language.ENGLISH);
    });
  });

  describe('getText Function', () => {
    const testText = {
      en: 'Hello World',
      zh: '你好世界'
    };

    it('should return English text when language is English', () => {
      expect(getText(testText, Language.ENGLISH)).toBe('Hello World');
    });

    it('should return Chinese text when language is Chinese', () => {
      expect(getText(testText, Language.CHINESE)).toBe('你好世界');
    });

    it('should auto-detect language when not specified', () => {
      process.env['LANG'] = 'zh_CN.UTF-8';
      expect(getText(testText)).toBe('你好世界');

      process.env['LANG'] = 'en_US.UTF-8';
      expect(getText(testText)).toBe('Hello World');
    });

    it('should fallback to English when translation is missing', () => {
      const incompleteText = {
        en: 'English only',
        zh: ''
      } as any;

      expect(getText(incompleteText, Language.CHINESE)).toBe('English only');
    });
  });

  describe('Message Formatting', () => {
    it('should format error messages correctly', () => {
      const message = formatErrorMessage('CONFIG_FILE_NOT_FOUND', undefined, Language.ENGLISH);
      expect(message).toBe('Configuration file not found');

      const messageZh = formatErrorMessage('CONFIG_FILE_NOT_FOUND', undefined, Language.CHINESE);
      expect(messageZh).toBe('未找到配置文件');

      const messageWithDetails = formatErrorMessage('CONFIG_FILE_NOT_FOUND', 'Additional info', Language.ENGLISH);
      expect(messageWithDetails).toBe('Configuration file not found: Additional info');
    });

    it('should format success messages correctly', () => {
      const message = formatSuccessMessage('CONFIG_ACTIVATED', undefined, Language.ENGLISH);
      expect(message).toBe('Configuration activated successfully');

      const messageZh = formatSuccessMessage('CONFIG_ACTIVATED', undefined, Language.CHINESE);
      expect(messageZh).toBe('配置激活成功');

      const messageWithDetails = formatSuccessMessage('CONFIG_ACTIVATED', 'test-config', Language.ENGLISH);
      expect(messageWithDetails).toBe('Configuration activated successfully: test-config');
    });

    it('should format suggestions correctly', () => {
      const suggestions = formatSuggestions(['CREATE_CONFIG_FILE', 'CHECK_FILE_PERMISSIONS'], Language.ENGLISH);
      expect(suggestions).toEqual([
        'Create a configuration file in your current directory or user directory',
        'Check file permissions and accessibility'
      ]);

      const suggestionsZh = formatSuggestions(['CREATE_CONFIG_FILE', 'CHECK_FILE_PERMISSIONS'], Language.CHINESE);
      expect(suggestionsZh).toEqual([
        '在当前目录或用户目录中创建配置文件',
        '检查文件权限和可访问性'
      ]);
    });
  });

  describe('Tool Name Functions', () => {
    it('should return bilingual tool name', () => {
      const toolName = getToolName();
      expect(toolName).toBe('Qwen Code Router (Qwen Code API 切换器)');
    });

    it('should return localized tool name', () => {
      const englishName = getLocalizedToolName(Language.ENGLISH);
      expect(englishName).toBe('Qwen Code Router');

      const chineseName = getLocalizedToolName(Language.CHINESE);
      expect(chineseName).toBe('Qwen Code API 切换器');
    });

    it('should detect Chinese preference correctly', () => {
      process.env['LANG'] = 'zh_CN.UTF-8';
      expect(isChinesePreferred()).toBe(true);

      process.env['LANG'] = 'en_US.UTF-8';
      expect(isChinesePreferred()).toBe(false);
    });
  });

  describe('Formatting Utilities', () => {
    it('should format usage strings correctly', () => {
      const usage = formatUsage('qcr', 'use [config_name]', Language.ENGLISH);
      expect(usage).toBe('Usage: qcr use [config_name]');

      const usageZh = formatUsage('qcr', 'use [config_name]', Language.CHINESE);
      expect(usageZh).toBe('用法: qcr use [config_name]');
    });

    it('should format available options correctly', () => {
      const options = formatAvailableOptions(['option1', 'option2'], Language.ENGLISH);
      expect(options).toBe('Available options:\n  - option1\n  - option2');

      const optionsZh = formatAvailableOptions(['option1', 'option2'], Language.CHINESE);
      expect(optionsZh).toBe('可用选项:\n  - option1\n  - option2');
    });

    it('should format suggestion lists correctly', () => {
      const suggestions = formatSuggestionList(['suggestion1', 'suggestion2'], Language.ENGLISH);
      expect(suggestions).toBe('Suggestions:\n  • suggestion1\n  • suggestion2');

      const suggestionsZh = formatSuggestionList(['suggestion1', 'suggestion2'], Language.CHINESE);
      expect(suggestionsZh).toBe('建议:\n  • suggestion1\n  • suggestion2');
    });

    it('should format help section headers correctly', () => {
      const header = getHelpSectionHeader('CONFIGURATION', Language.ENGLISH);
      expect(header).toBe('CONFIGURATION:');

      const headerZh = getHelpSectionHeader('CONFIGURATION', Language.CHINESE);
      expect(headerZh).toBe('配置:');
    });
  });

  describe('Message Constants', () => {
    it('should have all required message keys', () => {
      expect(MESSAGES.TOOL_NAME).toBeDefined();
      expect(MESSAGES.TOOL_NAME.en).toBe('Qwen Code Router');
      expect(MESSAGES.TOOL_NAME.zh).toBe('Qwen Code API 切换器');

      expect(MESSAGES.CONFIG_FILE_NOT_FOUND).toBeDefined();
      expect(MESSAGES.CONFIG_VALIDATION_FAILED).toBeDefined();
      expect(MESSAGES.ENV_VARS_NOT_SET).toBeDefined();
      expect(MESSAGES.COMMAND_NOT_FOUND).toBeDefined();
    });

    it('should have all required suggestion keys', () => {
      expect(SUGGESTIONS.CREATE_CONFIG_FILE).toBeDefined();
      expect(SUGGESTIONS.CHECK_FILE_PERMISSIONS).toBeDefined();
      expect(SUGGESTIONS.SET_DEFAULT_CONFIG).toBeDefined();
      expect(SUGGESTIONS.LIST_AVAILABLE_CONFIGS).toBeDefined();
      expect(SUGGESTIONS.ACTIVATE_CONFIG_FIRST).toBeDefined();
    });

    it('should have all required help section keys', () => {
      expect(HELP_SECTIONS.GETTING_STARTED).toBeDefined();
      expect(HELP_SECTIONS.CONFIGURATION).toBeDefined();
      expect(HELP_SECTIONS.TROUBLESHOOTING).toBeDefined();
      expect(HELP_SECTIONS.EXAMPLES).toBeDefined();
      expect(HELP_SECTIONS.PREREQUISITES).toBeDefined();
      expect(HELP_SECTIONS.BEHAVIOR).toBeDefined();
      expect(HELP_SECTIONS.ERROR_HANDLING).toBeDefined();
      expect(HELP_SECTIONS.RELATED_COMMANDS).toBeDefined();
    });
  });

  describe('Bilingual Content Quality', () => {
    it('should have consistent bilingual content for all messages', () => {
      Object.keys(MESSAGES).forEach(key => {
        const message = MESSAGES[key as keyof typeof MESSAGES];
        expect(message.en).toBeDefined();
        expect(message.en).not.toBe('');
        expect(message.zh).toBeDefined();
        expect(message.zh).not.toBe('');
      });
    });

    it('should have consistent bilingual content for all suggestions', () => {
      Object.keys(SUGGESTIONS).forEach(key => {
        const suggestion = SUGGESTIONS[key as keyof typeof SUGGESTIONS];
        expect(suggestion.en).toBeDefined();
        expect(suggestion.en).not.toBe('');
        expect(suggestion.zh).toBeDefined();
        expect(suggestion.zh).not.toBe('');
      });
    });

    it('should have consistent bilingual content for all help sections', () => {
      Object.keys(HELP_SECTIONS).forEach(key => {
        const section = HELP_SECTIONS[key as keyof typeof HELP_SECTIONS];
        expect(section.en).toBeDefined();
        expect(section.en).not.toBe('');
        expect(section.zh).toBeDefined();
        expect(section.zh).not.toBe('');
      });
    });
  });

  describe('Auto-detection Integration', () => {
    it('should use auto-detected language when not specified', () => {
      process.env['LANG'] = 'zh_CN.UTF-8';
      
      const message = formatErrorMessage('CONFIG_FILE_NOT_FOUND');
      expect(message).toBe('未找到配置文件');

      const toolName = getLocalizedToolName();
      expect(toolName).toBe('Qwen Code API 切换器');
    });

    it('should use English as fallback', () => {
      process.env['LANG'] = 'fr_FR.UTF-8'; // Non-Chinese, non-English locale
      
      const message = formatErrorMessage('CONFIG_FILE_NOT_FOUND');
      expect(message).toBe('Configuration file not found');

      const toolName = getLocalizedToolName();
      expect(toolName).toBe('Qwen Code Router');
    });
  });
});