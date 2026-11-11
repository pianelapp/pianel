const path = require('path');

const audioUi = path.join(__dirname, '../../node_modules', '@audio-ui');
const workspacePaths = require('./tsconfig.json').compilerOptions.paths;

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
  transformIgnorePatterns: ['/node_modules/(?!@audio-ui/)'],
  moduleNameMapper: {
    '^@audio-ui/react/fader$': `${audioUi}/react/dist/fader.js`,
    '^@audio-ui/core$': `${audioUi}/core/dist/index.js`,
    '^@audio-ui/core/(.*)$': `${audioUi}/core/dist/$1.js`,
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
          paths: {
            ...workspacePaths,
            '@audio-ui/react/fader': [
              `${audioUi}/react/dist/entries/fader.d.ts`,
            ],
            '@audio-ui/core': [`${audioUi}/core/dist/index.d.ts`],
            '@audio-ui/core/*': [
              `${audioUi}/core/dist/primitives/*/index.d.ts`,
              `${audioUi}/core/dist/audio/*/index.d.ts`,
            ],
          },
        },
      },
    ],
    '^.+/node_modules/@audio-ui/.+\\.js$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          module: 'CommonJS',
          moduleResolution: 'node',
          target: 'ES2020',
        },
      },
    ],
  },
};
