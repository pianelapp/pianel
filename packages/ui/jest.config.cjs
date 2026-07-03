/** @type {import('jest').Config} */
const path = require('path');

// react-dom is a peer dependency satisfied by the host apps; for tests we point
// jest at the web host's copy (React 19) and pin `react` to the same install so
// the renderer and the hooks under test share a single React instance.
const webModules = path.resolve(__dirname, '../../apps/web/node_modules');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    // Compile core from source so tests exercise the live implementation.
    '^@pianel/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@pianel/core$': '<rootDir>/../core/src/store/index.ts',
    // Single React instance shared by renderer + components under test.
    '^react$': path.join(webModules, 'react'),
    '^react/(.*)$': path.join(webModules, 'react/$1'),
    '^react-dom$': path.join(webModules, 'react-dom'),
    '^react-dom/(.*)$': path.join(webModules, 'react-dom/$1'),
    // Asset / icon stubs.
    '\\.(css)$': '<rootDir>/tests/mocks/styleMock.ts',
    '^lucide-react/dist/esm/icons/(.*)$': '<rootDir>/tests/mocks/iconMock.tsx',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'CommonJS',
          moduleResolution: 'node',
          target: 'ES2020',
          strict: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          types: ['node', 'jest'],
        },
      },
    ],
  },
};
