import * as os from 'os';

const isWindows = os.platform() === 'win32';
const isUnix = !isWindows;

/**
 * 为Unix平台创建测试
 * @param name 测试名称
 * @param testFn 测试函数
 */
function itUnix(name: string, testFn: () => void) {
  if (isUnix) {
    it(name, testFn);
  } else {
    it.skip(`[Unix only] ${name}`, () => {}); // 添加空回调函数
  }
}

/**
 * 为Windows平台创建测试
 * @param name 测试名称
 * @param testFn 测试函数
 */
function itWindows(name: string, testFn: () => void) {
  if (isWindows) {
    it(name, testFn);
  } else {
    it.skip(`[Windows only] ${name}`);
  }
}

export { isWindows, isUnix, itUnix, itWindows };