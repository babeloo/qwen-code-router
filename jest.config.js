module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        types: ['node', 'jest']
      }
    }],
  },
  collectCoverage: false, // 默认不收集覆盖率
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'reports/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold:{
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 85
    }
  },
  reporters: [
    "default", // 保留终端输出
    ["jest-html-reporter", {
      pageTitle: "测试报告",
      outputPath: "reports/test-report.html" // 报告文件路径
    }]
  ]
};