/** @type {import('jest').Config} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // react / react-dom are peer dependencies hoisted to the workspace-root
  // node_modules; resolving through the root install gives the renderer and the
  // components under test a single shared React instance.
  moduleDirectories: [
    'node_modules',
    '<rootDir>/node_modules',
    '<rootDir>/../../node_modules',
  ],
  moduleNameMapper: {
    // Compile core from source so tests exercise the live implementation.
    '^@pianel/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@pianel/core$': '<rootDir>/../core/src/store/index.ts',
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
