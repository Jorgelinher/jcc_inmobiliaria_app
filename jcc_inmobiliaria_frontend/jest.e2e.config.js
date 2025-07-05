module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.js'],
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  testMatch: [
    '<rootDir>/src/test/e2e/**/*.test.jsx',
    '<rootDir>/src/test/e2e/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/test/**/*',
    '!src/main.jsx',
    '!src/vite-env.d.ts'
  ],
  coverageDirectory: 'coverage/e2e',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  verbose: true,
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-router-dom|react-select)/)'
  ],
  moduleDirectories: ['node_modules', 'src'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  globals: {
    'process.env': {
      NODE_ENV: 'test',
      VITE_API_BASE_URL: 'http://localhost:8000/api'
    }
  }
}; 