if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Installation, generation, builds and automated checks are permitted only in GitHub Actions.');
}
