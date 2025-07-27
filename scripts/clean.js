const fs = require('fs').promises;
const path = require('path');
const { rimraf } = require('rimraf');

async function clean() {
  // 定义要删除的路径
  const pathsToDelete = [
    'dist',
    'bin',
    'release',
    'qcr.exe',
    'qcr'
  ];

  // 删除指定的文件和目录
  for (const p of pathsToDelete) {
    try {
      await rimraf(p);
      console.log(`Deleted: ${p}`);
    } catch (error) {
      // 忽略错误，因为文件或目录可能不存在
    }
  }

  // 删除 .zip 文件
  try {
    const files = await fs.readdir('.');
    const zipFiles = files.filter(file => file.endsWith('.zip'));
    for (const zipFile of zipFiles) {
      try {
        await fs.unlink(zipFile);
        console.log(`Deleted: ${zipFile}`);
      } catch (error) {
        // 忽略错误
      }
    }
  } catch (error) {
    // 忽略错误
  }

  console.log('Clean completed.');
}

clean();