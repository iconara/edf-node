module.exports = {
  clearMocks: true,
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: [
    'jest-extended',
    'bdd-lazy-var/global',
  ],
  testEnvironment: 'node',
}
