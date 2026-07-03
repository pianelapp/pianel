/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Resolve hoisted workspace-root deps (e.g. react-dom, which Radix's peer is
  // not hoisted to find from its own location) when rendering the real shared
  // renderer in integration tests.
  moduleDirectories: [
    'node_modules',
    '<rootDir>/node_modules',
    '<rootDir>/../../node_modules',
  ],
  moduleNameMapper: {
    // lucide-react ships ESM-only JS; stub icon imports in tests.
    '^lucide-react/.*$': '<rootDir>/tests/__mocks__/lucideIcon.tsx',
    '^lucide-react$': '<rootDir>/tests/__mocks__/lucideIcon.tsx',
    '^@pianel/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
    '^@pianel/core$': '<rootDir>/../../packages/core/src/store/index.ts',
    '^@pianel/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
    '^@pianel/ui$': '<rootDir>/../../packages/ui/src/App.tsx',
    // vite-plugin-pwa virtual module — stubbed in tests.
    '^virtual:pwa-register$': '<rootDir>/tests/__mocks__/pwaRegister.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          moduleResolution: 'node',
          types: ['jest', 'node', '@testing-library/jest-dom'],
        },
      },
    ],
  },
};
