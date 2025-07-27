import {
  discoverAndLoadConfig,
} from './persistence';
import { ConfigFile } from './types';
import {
  createErrorResult,
  configFileNotFoundError,
  fileOperationError,
} from './errors';

/**
 * 通用配置文件加载函数，用于需要配置文件的命令
 * @param currentDir - 当前工作目录
 * @returns 配置文件和验证结果，或错误结果
 */
export async function loadConfigFile(currentDir?: string): Promise<{
  success: true;
  config: ConfigFile;
  validation: any;
  filePath: string;
} | {
  success: false;
  errorResult: any;
}> {
  try {
    const result = await discoverAndLoadConfig(currentDir);
    return {
      success: true,
      config: result.config,
      validation: result.validation,
      filePath: result.filePath
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('No configuration file found')) {
      // Extract search paths from error message for better error formatting
      const searchPaths = error.message.split('Searched in:\n')[1]?.split('\n').map(p => p.trim().replace('- ', '')) || [];
      return {
        success: false,
        errorResult: createErrorResult(configFileNotFoundError(searchPaths))
      };
    } else if (error instanceof Error && error.message.includes('Failed to load configuration file')) {
      return {
        success: false,
        errorResult: createErrorResult(fileOperationError('load', 'configuration file', error.message))
      };
    } else {
      throw error; // Re-throw unexpected errors
    }
  }
}