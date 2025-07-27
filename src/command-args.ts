/**
 * 通用参数解析工具函数
 */

/**
 * 解析布尔标志参数 (-v, --verbose, -h, --help等)
 * @param args - 参数数组
 * @param flags - 要识别的标志映射，例如 { verbose: ['-v', '--verbose'], help: ['-h', '--help'] }
 * @returns 解析结果，包含识别的标志和剩余参数
 */
export function parseFlags(
  args: string[],
  flags: Record<string, string[]>
): {
  parsedFlags: Record<string, boolean>;
  remainingArgs: string[];
} {
  const parsedFlags: Record<string, boolean> = {};
  const remainingArgs: string[] = [];
  
  // 初始化所有标志为false
  Object.keys(flags).forEach(flag => {
    parsedFlags[flag] = false;
  });

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (!arg) continue; // 跳过空参数

    let matched = false;
    
    // 检查是否匹配任何已知标志
    for (const [flagName, flagAliases] of Object.entries(flags)) {
      if (flagAliases.includes(arg)) {
        parsedFlags[flagName] = true;
        matched = true;
        break;
      }
    }
    
    // 如果不是已知标志，则添加到剩余参数中
    if (!matched) {
      remainingArgs.push(arg);
    }
  }

  return { parsedFlags, remainingArgs };
}

/**
 * 验证参数数量
 * @param args - 参数数组
 * @param min - 最小参数数量
 * @param max - 最大参数数量 (-1表示无限制)
 * @param errorMessage - 错误消息前缀
 * @returns 验证结果
 */
export function validateArgCount(
  args: string[],
  min: number,
  max: number,
  errorMessage: string
): { valid: boolean; error?: string } {
  if (args.length < min) {
    return {
      valid: false,
      error: `${errorMessage}. Expected at least ${min} argument${min !== 1 ? 's' : ''}, got ${args.length}`
    };
  }
  
  if (max !== -1 && args.length > max) {
    return {
      valid: false,
      error: `${errorMessage}. Expected at most ${max} argument${max !== 1 ? 's' : ''}, got ${args.length}`
    };
  }
  
  return { valid: true };
}