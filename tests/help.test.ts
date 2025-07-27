/**
 * Tests for comprehensive help and documentation system
 */

import {
  getMainHelp,
  getUseCommandHelp,
  getRunCommandHelp,
  getSetDefaultCommandHelp,
  listCommandHelp as getListCommandHelp,
  chkCommandHelp as getChkCommandHelp,
  routerCommandHelp as getRouterCommandHelp,
  getCommandHelp,
  getQuickUsage,
  getCommandExamples,
  getConfigurationHelp,
  getTroubleshootingHelp,
  getHelpTopics,
  getTopicHelp
} from '../src/help';

describe('Help System', () => {
  describe('getMainHelp', () => {
    it('should return comprehensive main help', () => {
      const result = getMainHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('Qwen Code Router');
      expect(result.message).toContain('USAGE:');
      expect(result.message).toContain('COMMANDS:');
      expect(result.message).toContain('EXAMPLES:');
      expect(result.message).toContain('CONFIGURATION:');
      expect(result.message).toContain('use [config_name]');
      expect(result.message).toContain('run [args...]');
      expect(result.message).toContain('/router <provider> <model>');
    });

    it('should include bilingual tool name', () => {
      const result = getMainHelp();
      expect(result.message).toContain('Qwen Code API 切换器');
    });
  });

  describe('getUseCommandHelp', () => {
    it('should return detailed use command help', () => {
      const result = getUseCommandHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('qcr use - Activate a configuration');
      expect(result.message).toContain('USAGE:');
      expect(result.message).toContain('ARGUMENTS:');
      expect(result.message).toContain('OPTIONS:');
      expect(result.message).toContain('EXAMPLES:');
      expect(result.message).toContain('BEHAVIOR:');
      expect(result.message).toContain('ERROR HANDLING:');
      expect(result.message).toContain('RELATED COMMANDS:');
    });
  });

  describe('getRunCommandHelp', () => {
    it('should return detailed run command help', () => {
      const result = getRunCommandHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('qcr run - Launch Qwen Code');
      expect(result.message).toContain('PREREQUISITES:');
      expect(result.message).toContain('BEHAVIOR:');
      expect(result.message).toContain('signals');
      expect(result.message).toContain('qwen command');
    });
  });

  describe('getSetDefaultCommandHelp', () => {
    it('should return detailed set-default command help', () => {
      const result = getSetDefaultCommandHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('qcr set-default - Set default configuration');
      expect(result.message).toContain('default_config');
      expect(result.message).toContain('configuration file');
    });
  });

  describe('getListCommandHelp', () => {
    it('should return detailed list command help', () => {
      const result = getListCommandHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('qcr list - List configurations and providers');
      expect(result.message).toContain('SUBCOMMANDS:');
      expect(result.message).toContain('provider --tree');
      expect(result.message).toContain('provider --builtin');
      expect(result.message).toContain('provider --all');
      expect(result.message).toContain('BUILT-IN PROVIDERS:');
      expect(result.message).toContain('openai');
      expect(result.message).toContain('azure');
      expect(result.message).toContain('anthropic');
      expect(result.message).toContain('google');
    });
  });

  describe('getChkCommandHelp', () => {
    it('should return detailed chk command help', () => {
      const result = getChkCommandHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('qcr chk - Validate configuration');
      expect(result.message).toContain('VALIDATION TYPES:');
      expect(result.message).toContain('Static Validation');
      expect(result.message).toContain('API Validation');
      expect(result.message).toContain('--test-api');
      expect(result.message).toContain('VALIDATION RESULTS:');
      expect(result.message).toContain('✓ Success');
      expect(result.message).toContain('✗ Error');
      expect(result.message).toContain('⚠ Warning');
    });
  });

  describe('getRouterCommandHelp', () => {
    it('should return detailed router command help', () => {
      const result = getRouterCommandHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('/router - Quick configuration');
      expect(result.message).toContain('SUPPORTED PROVIDERS:');
      expect(result.message).toContain('Built-in Providers');
      expect(result.message).toContain('Configuration File Providers');
      expect(result.message).toContain('BUILT-IN vs CONFIGURED:');
    });
  });

  describe('getCommandHelp', () => {
    it('should return appropriate help for each command', () => {
      expect(getCommandHelp('use').message).toContain('qcr use - Activate');
      expect(getCommandHelp('run').message).toContain('qcr run - Launch');
      expect(getCommandHelp('set-default').message).toContain('qcr set-default - Set');
      expect(getCommandHelp('list').message).toContain('qcr list - List');
      expect(getCommandHelp('chk').message).toContain('qcr chk - Validate');
      expect(getCommandHelp('/router').message).toContain('/router - Quick');
      expect(getCommandHelp('router').message).toContain('/router - Quick');
    });

    it('should return main help for unknown commands', () => {
      const result = getCommandHelp('unknown');
      expect(result.message).toContain('Qwen Code Router');
    });

    it('should handle case insensitive commands', () => {
      expect(getCommandHelp('USE').message).toContain('qcr use - Activate');
      expect(getCommandHelp('Run').message).toContain('qcr run - Launch');
    });
  });

  describe('getQuickUsage', () => {
    it('should return correct usage for each command', () => {
      expect(getQuickUsage('use')).toBe('qcr use [config_name] [-v|--verbose]');
      expect(getQuickUsage('run')).toBe('qcr run [additional_args...] [-v|--verbose]');
      expect(getQuickUsage('set-default')).toBe('qcr set-default <config_name> [-v|--verbose]');
      expect(getQuickUsage('list')).toBe('qcr list <subcommand> [-v|--verbose]');
      expect(getQuickUsage('chk')).toBe('qcr chk [config_name] [--test-api] [-v|--verbose]');
      expect(getQuickUsage('/router')).toBe('/router <provider> <model>');
      expect(getQuickUsage('router')).toBe('/router <provider> <model>');
    });

    it('should return generic usage for unknown commands', () => {
      expect(getQuickUsage('unknown')).toBe('qcr <command> [options]');
    });

    it('should handle case insensitive commands', () => {
      expect(getQuickUsage('USE')).toBe('qcr use [config_name] [-v|--verbose]');
    });
  });

  describe('getCommandExamples', () => {
    it('should return examples for each command', () => {
      const useExamples = getCommandExamples('use');
      expect(useExamples).toContain('qcr use');
      expect(useExamples).toContain('qcr use openai-gpt4');
      expect(useExamples).toContain('qcr use azure-gpt35 -v');

      const runExamples = getCommandExamples('run');
      expect(runExamples).toContain('qcr run');
      expect(runExamples).toContain('qcr run --help');

      const routerExamples = getCommandExamples('/router');
      expect(routerExamples).toContain('/router openai gpt-4');
      expect(routerExamples).toContain('/router azure gpt-35-turbo');
    });

    it('should return default example for unknown commands', () => {
      const examples = getCommandExamples('unknown');
      expect(examples).toEqual(['qcr help']);
    });
  });

  describe('getConfigurationHelp', () => {
    it('should return comprehensive configuration help', () => {
      const result = getConfigurationHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('Configuration File Format');
      expect(result.message).toContain('FILE LOCATIONS:');
      expect(result.message).toContain('YAML EXAMPLE:');
      expect(result.message).toContain('STRUCTURE:');
      expect(result.message).toContain('VALIDATION RULES:');
      expect(result.message).toContain('SECURITY NOTES:');
      expect(result.message).toContain('default_config:');
      expect(result.message).toContain('configs:');
      expect(result.message).toContain('providers:');
    });
  });

  describe('getTroubleshootingHelp', () => {
    it('should return comprehensive troubleshooting help', () => {
      const result = getTroubleshootingHelp();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('Troubleshooting Guide');
      expect(result.message).toContain('COMMON ISSUES AND SOLUTIONS:');
      expect(result.message).toContain('Configuration File Not Found');
      expect(result.message).toContain('Configuration Validation Failed');
      expect(result.message).toContain('Environment Variables Not Set');
      expect(result.message).toContain('Qwen Code Command Not Found');
      expect(result.message).toContain('API Authentication Errors');
      expect(result.message).toContain('DEBUGGING TIPS:');
      expect(result.message).toContain('GETTING HELP:');
    });
  });

  describe('getHelpTopics', () => {
    it('should return available help topics', () => {
      const topics = getHelpTopics();
      
      expect(topics).toContain('commands');
      expect(topics).toContain('configuration');
      expect(topics).toContain('troubleshooting');
      expect(topics).toContain('examples');
      expect(topics.length).toBeGreaterThan(0);
    });
  });

  describe('getTopicHelp', () => {
    it('should return help for specific topics', () => {
      const configHelp = getTopicHelp('configuration');
      expect(configHelp.message).toContain('Configuration File Format');

      const configHelpShort = getTopicHelp('config');
      expect(configHelpShort.message).toContain('Configuration File Format');

      const troubleshootHelp = getTopicHelp('troubleshooting');
      expect(troubleshootHelp.message).toContain('Troubleshooting Guide');

      const troubleshootHelpShort = getTopicHelp('troubleshoot');
      expect(troubleshootHelpShort.message).toContain('Troubleshooting Guide');

      const commandsHelp = getTopicHelp('commands');
      expect(commandsHelp.message).toContain('Qwen Code Router');
    });

    it('should return main help for unknown topics', () => {
      const result = getTopicHelp('unknown');
      expect(result.message).toContain('Qwen Code Router');
    });
  });

  describe('Help Content Quality', () => {
    it('should include bilingual support information', () => {
      const mainHelp = getMainHelp();
      expect(mainHelp.message).toContain('切换器');
    });

    it('should include proper formatting and structure', () => {
      const useHelp = getUseCommandHelp();
      expect(useHelp.message).toMatch(/USAGE:\s*\n/);
      expect(useHelp.message).toMatch(/ARGUMENTS:\s*\n/);
      expect(useHelp.message).toMatch(/OPTIONS:\s*\n/);
      expect(useHelp.message).toMatch(/EXAMPLES:\s*\n/);
    });

    it('should include cross-references between commands', () => {
      const useHelp = getUseCommandHelp();
      expect(useHelp.message).toContain('RELATED COMMANDS:');
      expect(useHelp.message).toContain('qcr list config');
      expect(useHelp.message).toContain('qcr set-default');

      const runHelp = getRunCommandHelp();
      expect(runHelp.message).toContain('RELATED COMMANDS:');
      expect(runHelp.message).toContain('qcr use');
    });

    it('should include error handling information', () => {
      const useHelp = getUseCommandHelp();
      expect(useHelp.message).toContain('ERROR HANDLING:');
      expect(useHelp.message).toContain('Configuration file not found');
      expect(useHelp.message).toContain('Configuration validation failed');
    });

    it('should include practical examples', () => {
      const listHelp = getListCommandHelp();
      expect(listHelp.message).toContain('qcr list config');
      expect(listHelp.message).toContain('qcr list provider --tree');
      expect(listHelp.message).toContain('qcr list provider --all openai');
    });
  });
});