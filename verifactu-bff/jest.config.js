/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testMatch: ['**/?(*.)+(e2e-spec).ts'],
  transform: { '^.+\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  verbose: true,
};
