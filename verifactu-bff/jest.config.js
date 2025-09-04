/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // ejecuta unit y e2e (ambos usan ts-jest con tsconfig.spec.json)
  testRegex: '.*\\.(e2e-)?spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  // silencia warnings de source maps en e2e
  silent: false,
};