const config = {
  branches: ["main"],
  tagFormat: "sdk-v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "refactor", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "build", release: "patch" },
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "cd src/lib/sdk && npm ci && npm run build",
      },
    ],
    [
      "@semantic-release/npm",
      {
        pkgRoot: "src/lib/sdk",
        npmPublish: true,
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["src/lib/sdk/package.json", "src/lib/sdk/package-lock.json"],
        message:
          "chore(sdk-release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};

export default config;
