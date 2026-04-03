const config = {
  branches: ["main"],
  tagFormat: "mcp-v${version}",
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
        prepareCmd: "cd mcp-server && npm ci && npm run check",
      },
    ],
    [
      "@semantic-release/npm",
      {
        pkgRoot: "mcp-server",
        npmPublish: true,
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["mcp-server/package.json", "mcp-server/package-lock.json"],
        message:
          "chore(mcp-release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};

export default config;
