module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'simple-server*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'lib/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/*.config.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  bail: false,
  maxWorkers: '50%',
  transformIgnorePatterns: [
    'node_modules/(?!(p-queue|p-timeout|p-defer)/)'
  ]
};